from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Iterable

from utils.helpers import is_blocked_text, normalize_company, normalize_url, text_has_any


LOGGER = logging.getLogger("crawler.platform")


@dataclass(frozen=True)
class SearchSpec:
    keywords: str
    location: str = ""
    freshness: str = "past_week"
    remote: bool = True
    hybrid: bool = True
    onsite: bool = True
    experience_levels: list[str] = field(default_factory=list)
    salary_min: int | None = None
    boolean_mode: bool = True


@dataclass(frozen=True)
class CrawlContext:
    max_jobs: int
    max_pages: int
    last_crawl_at: str | None = None
    blacklisted_companies: set[str] = field(default_factory=set)
    required_terms: set[str] = field(default_factory=set)
    excluded_terms: set[str] = field(default_factory=set)


@dataclass
class JobPosting:
    platform: str
    platform_job_id: str
    title: str
    company: str
    location: str
    remote: bool
    posted_text: str
    posted_at: str | None
    url: str
    description: str
    easy_apply: bool = False


class BasePlatform:
    name = "base"

    def __init__(self, config: dict, browser_pool):
        self.config = config
        self.browser_pool = browser_pool
        self.logger = logging.getLogger(f"crawler.{self.name}")

    async def crawl(self, specs: Iterable[SearchSpec], context: CrawlContext) -> list[JobPosting]:
        raise NotImplementedError

    def keep_job(self, job: JobPosting, context: CrawlContext) -> bool:
        company_key = normalize_company(job.company)
        if company_key in {normalize_company(company) for company in context.blacklisted_companies}:
            return False

        haystack = f"{job.title} {job.company} {job.location} {job.description}".lower()
        if context.required_terms and not all(term.lower() in haystack for term in context.required_terms):
            return False
        if text_has_any(haystack, context.excluded_terms):
            return False
        if context.last_crawl_at and job.posted_at:
            try:
                if datetime.fromisoformat(job.posted_at) <= datetime.fromisoformat(context.last_crawl_at):
                    return False
            except ValueError:
                pass
        return True

    def clean_job(self, job: JobPosting) -> JobPosting:
        job.url = normalize_url(job.url)
        job.title = " ".join((job.title or "").split())
        job.company = " ".join((job.company or "").split())
        job.location = " ".join((job.location or "").split())
        job.description = " ".join((job.description or "").split())[:8000]
        return job

    async def page_is_blocked(self, page) -> bool:
        try:
            text = await page.locator("body").inner_text(timeout=5000)
        except Exception:
            text = ""
        return is_blocked_text(text) or is_blocked_text(page.url)
