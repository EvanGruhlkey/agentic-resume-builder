from __future__ import annotations

from platforms.base import SearchSpec
from platforms.generic import GenericSearchPlatform, PlatformSelectors, freshness_days, query_params


class IndeedPlatform(GenericSearchPlatform):
    name = "indeed"
    selectors = PlatformSelectors(
        card="div.job_seen_beacon, div[data-jk], .jobsearch-SerpJobCard",
        title=["h2.jobTitle a, a[data-jk], a.jcs-JobTitle"],
        company=["span[data-testid='company-name'], .companyName"],
        location=["div[data-testid='text-location'], .companyLocation"],
        posted=["span[data-testid='myJobsStateDate'], .date"],
        description=["#jobDescriptionText, .job-snippet, [data-testid='jobsearch-JobComponent-description']"],
        easy_apply=["text=Apply now", "text=Easily apply"],
        next_button=["a[aria-label='Next Page'], a[data-testid='pagination-page-next']"],
        job_id_patterns=[r"/viewjob[^?]*\?.*jk=([A-Za-z0-9]+)"],
    )

    def build_search_url(self, spec: SearchSpec) -> str:
        params = query_params(
            q=spec.keywords,
            l=spec.location or "United States",
            fromage=freshness_days(spec),
            sort="date",
            sc="0kf:attr(DSQF7);",
        )
        return f"https://www.indeed.com/jobs?{params}"
