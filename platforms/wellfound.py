from __future__ import annotations

from platforms.base import SearchSpec
from platforms.generic import GenericSearchPlatform, PlatformSelectors, query_params


class WellfoundPlatform(GenericSearchPlatform):
    name = "wellfound"
    selectors = PlatformSelectors(
        card="[data-test='JobCard'], .job-card, div[class*='JobListItem']",
        title=["a[href*='/jobs/'], [data-test='job-title']"],
        company=["[data-test='StartupResult'], [data-test='company-name']"],
        location=["[data-test='location'], .locations"],
        posted=["time, [data-test='posted-at']"],
        description=["[data-test='JobDescription'], .job-description, main"],
        easy_apply=["text=Apply Now", "text=Easy Apply"],
        next_button=["button[aria-label='Next'], a[rel='next']"],
        job_id_patterns=[r"/jobs/(\d+)"],
    )

    def build_search_url(self, spec: SearchSpec) -> str:
        params = query_params(keyword=spec.keywords, location=spec.location or "Remote")
        return f"https://wellfound.com/jobs?{params}"
