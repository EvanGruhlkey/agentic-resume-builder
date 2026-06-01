from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass, field
from typing import Iterable
from urllib.parse import urlencode

from playwright.async_api import Page, TimeoutError as PlaywrightTimeoutError

from platforms.base import BasePlatform, CrawlContext, JobPosting, SearchSpec
from utils.helpers import (
    extract_job_id,
    is_blocked_text,
    parse_posted_at,
    random_delay,
    safe_inner_text,
    text_has_any,
)


@dataclass(frozen=True)
class PlatformSelectors:
    card: str
    title: list[str]
    company: list[str] = field(default_factory=list)
    location: list[str] = field(default_factory=list)
    posted: list[str] = field(default_factory=list)
    description: list[str] = field(default_factory=list)
    easy_apply: list[str] = field(default_factory=list)
    next_button: list[str] = field(default_factory=list)
    url_attr: str = "href"
    job_id_patterns: list[str] = field(default_factory=list)


class GenericSearchPlatform(BasePlatform):
    base_url = ""
    selectors = PlatformSelectors(card="")
    id_param_names: tuple[str, ...] = ("jk", "jobId", "job_id", "currentJobId", "id")

    async def crawl(self, specs: Iterable[SearchSpec], context: CrawlContext) -> list[JobPosting]:
        jobs: list[JobPosting] = []
        seen: set[tuple[str, str]] = set()

        async with self.browser_pool.page(platform=self.name) as page:
            for spec in specs:
                if len(jobs) >= context.max_jobs:
                    break
                url = self.build_search_url(spec)
                self.logger.info("%s searching %s", self.name, url)
                await page.goto(url, wait_until="domcontentloaded")
                await self.browser_pool.settle(page)

                if await self.is_blocked(page):
                    self.logger.warning("%s blocked or requires human login at %s", self.name, page.url)
                    continue

                collected = await self.collect_from_results(page, spec, context, seen, context.max_jobs - len(jobs))
                jobs.extend(collected)

        return jobs[: context.max_jobs]

    def build_search_url(self, spec: SearchSpec) -> str:
        raise NotImplementedError

    async def collect_from_results(
        self,
        page: Page,
        spec: SearchSpec,
        context: CrawlContext,
        seen: set[tuple[str, str]],
        remaining: int,
    ) -> list[JobPosting]:
        jobs: list[JobPosting] = []
        for page_number in range(context.max_pages):
            await self.browser_pool.human_scroll(page)
            cards = await page.locator(self.selectors.card).all()
            self.logger.debug("%s page %s has %s cards", self.name, page_number + 1, len(cards))

            for card in cards:
                if len(jobs) >= remaining:
                    break
                try:
                    job = await self.extract_card(card, page, spec)
                except Exception as error:
                    self.logger.debug("%s skipped card: %s", self.name, error)
                    continue
                key = (job.platform, job.platform_job_id)
                if key in seen:
                    continue
                seen.add(key)
                job = self.clean_job(job)
                if self.keep_job(job, context):
                    jobs.append(job)

            if len(jobs) >= remaining:
                break
            if not await self.go_next(page):
                break
            await self.browser_pool.settle(page)

        return jobs

    async def extract_card(self, card, page: Page, spec: SearchSpec) -> JobPosting:
        title = await first_text(card, self.selectors.title)
        company = await first_text(card, self.selectors.company)
        location = await first_text(card, self.selectors.location)
        posted_text = await first_text(card, self.selectors.posted)
        description = await first_text(card, self.selectors.description)
        easy_apply_text = await first_text(card, self.selectors.easy_apply)
        url = await first_href(card, self.selectors.title, self.selectors.url_attr)
        if not url:
            url = page.url
        if url.startswith("/"):
            parsed = __import__("urllib.parse").parse.urlparse(page.url)
            url = f"{parsed.scheme}://{parsed.netloc}{url}"

        if not title or not url:
            raise ValueError("missing title or url")

        job_id = extract_job_id(url, self.id_param_names, self.selectors.job_id_patterns)
        if not job_id:
            job_id = f"{self.name}:{abs(hash(url))}"

        if not description and url != page.url:
            description = await self.fetch_detail_description(page, url)

        remote = "remote" in f"{title} {location} {description}".lower()
        posted_at = parse_posted_at(posted_text)
        return JobPosting(
            platform=self.name,
            platform_job_id=job_id,
            title=title,
            company=company,
            location=location or spec.location,
            remote=remote,
            posted_text=posted_text,
            posted_at=posted_at,
            url=url,
            description=description,
            easy_apply=text_has_any(easy_apply_text, {"easy apply", "quick apply", "1-click apply"}),
        )

    async def fetch_detail_description(self, page: Page, url: str) -> str:
        detail = await page.context.new_page()
        try:
            await detail.goto(url, wait_until="domcontentloaded", timeout=self.browser_pool.navigation_timeout_ms)
            await self.browser_pool.settle(detail)
            if await self.is_blocked(detail):
                return ""
            for selector in self.selectors.description:
                text = await safe_inner_text(detail.locator(selector))
                if len(text) > 120:
                    return text
            return await safe_inner_text(detail.locator("main, body"))
        except PlaywrightTimeoutError:
            return ""
        finally:
            await detail.close()

    async def is_blocked(self, page: Page) -> bool:
        text = await safe_inner_text(page.locator("body"))
        return is_blocked_text(text) or is_blocked_text(page.url)

    async def go_next(self, page: Page) -> bool:
        for selector in self.selectors.next_button:
            locator = page.locator(selector)
            if await locator.count() == 0:
                continue
            if not await locator.first.is_enabled():
                continue
            await random_delay(0.3, 1.2)
            await locator.first.click()
            return True
        return False


async def first_text(scope, selectors: list[str]) -> str:
    for selector in selectors:
        text = await safe_inner_text(scope.locator(selector))
        if text:
            return text
    return ""


async def first_href(scope, selectors: list[str], attr: str) -> str:
    for selector in selectors:
        locator = scope.locator(selector)
        if await locator.count() == 0:
            continue
        value = await locator.first.get_attribute(attr)
        if value:
            return value
    return ""


def query_params(**kwargs) -> str:
    return urlencode({key: value for key, value in kwargs.items() if value is not None and value != ""})


def freshness_days(spec: SearchSpec) -> int:
    return 1 if spec.freshness == "past_24h" else 7
