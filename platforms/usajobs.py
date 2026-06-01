from __future__ import annotations

import json
from typing import Iterable
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from platforms.base import BasePlatform, CrawlContext, JobPosting, SearchSpec
from platforms.generic import GenericSearchPlatform, PlatformSelectors, freshness_days, query_params
from utils.helpers import config_get, parse_posted_at


class USAJobsPlatform(GenericSearchPlatform):
    name = "usajobs"
    selectors = PlatformSelectors(
        card=".usajobs-search-result--core, .usajobs-search-result, article",
        title=["a.usajobs-search-result--core__title, a[href*='/job/']"],
        company=[".usajobs-search-result--core__agency"],
        location=[".usajobs-search-result--core__location"],
        posted=[".usajobs-search-result--core__date, time"],
        description=["#duties, #requirements, .usajobs-joa-section, main"],
        easy_apply=["text=Apply"],
        next_button=["a[aria-label='Next page'], a[rel='next']"],
        job_id_patterns=[r"/job/(\d+)"],
    )

    async def crawl(self, specs: Iterable[SearchSpec], context: CrawlContext) -> list[JobPosting]:
        api_key = config_get(self.config, "usajobs.api_key")
        email = config_get(self.config, "usajobs.user_agent_email")
        if api_key and email:
            return await self.crawl_api(specs, context, api_key, email)
        return await super().crawl(specs, context)

    def build_search_url(self, spec: SearchSpec) -> str:
        params = query_params(
            Keyword=spec.keywords,
            LocationName=spec.location or "United States",
            DatePosted=freshness_days(spec),
            SortField="opendate",
            SortDirection="Desc",
        )
        return f"https://www.usajobs.gov/Search/Results?{params}"

    async def crawl_api(self, specs: Iterable[SearchSpec], context: CrawlContext, api_key: str, email: str) -> list[JobPosting]:
        jobs: list[JobPosting] = []
        for spec in specs:
            if len(jobs) >= context.max_jobs:
                break
            params = urlencode({
                "Keyword": spec.keywords,
                "LocationName": spec.location or "United States",
                "DatePosted": freshness_days(spec),
                "ResultsPerPage": min(500, context.max_jobs),
                "SortField": "opendate",
                "SortDirection": "Desc",
            })
            request = Request(
                f"https://data.usajobs.gov/api/search?{params}",
                headers={
                    "Host": "data.usajobs.gov",
                    "User-Agent": email,
                    "Authorization-Key": api_key,
                },
            )
            with urlopen(request, timeout=30) as response:
                payload = json.loads(response.read().decode("utf-8"))
            for item in payload.get("SearchResult", {}).get("SearchResultItems", []):
                matched = item.get("MatchedObjectDescriptor", {})
                job = JobPosting(
                    platform=self.name,
                    platform_job_id=str(matched.get("PositionID") or matched.get("PositionURI") or ""),
                    title=matched.get("PositionTitle") or "",
                    company=matched.get("OrganizationName") or matched.get("DepartmentName") or "USAJobs",
                    location=", ".join(loc.get("LocationName", "") for loc in matched.get("PositionLocation", []) if loc.get("LocationName")),
                    remote="remote" in json.dumps(matched).lower(),
                    posted_text=matched.get("PublicationStartDate") or "",
                    posted_at=parse_posted_at(matched.get("PublicationStartDate") or ""),
                    url=matched.get("PositionURI") or "",
                    description="\n".join(matched.get("UserArea", {}).get("Details", {}).get(key, "") for key in ["JobSummary", "MajorDuties", "Requirements"]),
                    easy_apply=False,
                )
                job = self.clean_job(job)
                if job.platform_job_id and self.keep_job(job, context):
                    jobs.append(job)
                if len(jobs) >= context.max_jobs:
                    break
        return jobs
