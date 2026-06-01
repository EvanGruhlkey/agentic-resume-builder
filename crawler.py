from __future__ import annotations

import argparse
import asyncio
import logging
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from database import JobDatabase
from platforms import PLATFORM_REGISTRY
from platforms.base import CrawlContext, JobPosting, SearchSpec
from utils.browser import BrowserPool
from utils.exporters import export_csv, export_json
from utils.helpers import config_get, ensure_dir, load_yaml, utc_now_iso
from utils.logging_config import configure_logging


LOGGER = logging.getLogger("crawler")


def build_search_specs(config: dict) -> list[SearchSpec]:
    search = config.get("search", {})
    keywords = search.get("keywords") or []
    locations = search.get("locations") or [""]
    specs: list[SearchSpec] = []

    for keyword in keywords:
        for location in locations:
            specs.append(
                SearchSpec(
                    keywords=str(keyword),
                    location=str(location or ""),
                    freshness=str(search.get("freshness") or "past_week"),
                    remote=bool(search.get("remote", True)),
                    hybrid=bool(search.get("hybrid", True)),
                    onsite=bool(search.get("onsite", True)),
                    experience_levels=list(search.get("experience_levels") or []),
                    salary_min=search.get("salary_min"),
                    boolean_mode=bool(search.get("boolean_mode", True)),
                )
            )

    return specs


def enabled_platforms(config: dict) -> list[str]:
    enabled = config_get(config, "platforms.enabled", [])
    return [name for name in enabled if name in PLATFORM_REGISTRY]


async def crawl_platform(
    platform_name: str,
    config: dict,
    specs: Iterable[SearchSpec],
    db: JobDatabase,
    browser_pool: BrowserPool,
) -> list[JobPosting]:
    platform_cls = PLATFORM_REGISTRY[platform_name]
    platform = platform_cls(config=config, browser_pool=browser_pool)
    max_jobs = int(config_get(config, "platforms.max_jobs_per_platform", 100))
    max_pages = int(config_get(config, "platforms.max_pages_per_platform", 8))
    context = CrawlContext(
        max_jobs=max_jobs,
        max_pages=max_pages,
        last_crawl_at=await db.last_crawl_at(platform_name),
        blacklisted_companies=set(config_get(config, "filters.blacklisted_companies", [])),
        required_terms=set(config_get(config, "filters.required_terms", [])),
        excluded_terms=set(config_get(config, "filters.excluded_terms", [])),
    )

    LOGGER.info("Starting %s", platform_name)
    jobs = await platform.crawl(specs=specs, context=context)
    new_jobs = await db.upsert_new_jobs(jobs)
    await db.record_crawl(platform_name, len(new_jobs))
    LOGGER.info("%s: saved %s new jobs (%s collected)", platform_name, len(new_jobs), len(jobs))
    return new_jobs


async def run(config_path: Path) -> int:
    config = load_yaml(config_path)
    configure_logging()
    specs = build_search_specs(config)
    if not specs:
        raise SystemExit("No search.keywords configured.")

    storage_path = Path(config_get(config, "storage.sqlite_path", "data/python-job-crawler/jobs.sqlite"))
    export_dir = ensure_dir(Path(config_get(config, "storage.export_dir", "data/python-job-crawler/exports")))
    enabled = enabled_platforms(config)
    unknown = set(config_get(config, "platforms.enabled", [])) - set(enabled)
    if unknown:
        LOGGER.warning("Ignoring unknown platforms: %s", ", ".join(sorted(unknown)))

    db = JobDatabase(storage_path)
    await db.initialize()
    started = datetime.now(timezone.utc)
    all_new_jobs: list[JobPosting] = []

    concurrency = int(config_get(config, "platforms.concurrency", 3))
    semaphore = asyncio.Semaphore(max(1, concurrency))

    async with BrowserPool(config=config) as browser_pool:
        async def guarded(platform_name: str) -> list[JobPosting]:
            async with semaphore:
                try:
                    return await crawl_platform(platform_name, config, specs, db, browser_pool)
                except Exception:
                    LOGGER.exception("%s failed", platform_name)
                    return []

        results = await asyncio.gather(*(guarded(platform_name) for platform_name in enabled))

    for platform_jobs in results:
        all_new_jobs.extend(platform_jobs)

    timestamp = started.strftime("%Y%m%d-%H%M%S")
    if config_get(config, "storage.export_csv", True):
        export_csv(export_dir / f"jobs-{timestamp}.csv", all_new_jobs)
    if config_get(config, "storage.export_json", True):
        export_json(export_dir / f"jobs-{timestamp}.json", [asdict(job) for job in all_new_jobs])

    summary = await db.summary_since(started.isoformat())
    LOGGER.info(
        "Found %s new jobs today across %s platforms. Run started %s.",
        len(all_new_jobs),
        len([items for items in results if items]),
        utc_now_iso(),
    )
    LOGGER.info("Database summary: %s", summary)
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Discovery-only async job crawler.")
    parser.add_argument("--config", default="config.yaml", help="Path to YAML config.")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    raise SystemExit(asyncio.run(run(Path(args.config))))
