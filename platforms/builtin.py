from __future__ import annotations

from platforms.base import SearchSpec
from platforms.generic import GenericSearchPlatform, PlatformSelectors, query_params


class BuiltInPlatform(GenericSearchPlatform):
    name = "builtin"
    selectors = PlatformSelectors(
        card="div[data-testid='job-card'], .job-card, article",
        title=["a[data-testid='job-card-title'], a[href*='/job/']"],
        company=["[data-testid='company-title'], .company-title"],
        location=["[data-testid='job-card-location'], .job-location"],
        posted=["time, [data-testid='posted-date']"],
        description=[".job-description, [data-testid='job-description'], main"],
        easy_apply=["text=Easy Apply"],
        next_button=["a[rel='next'], a[aria-label='Next']"],
        job_id_patterns=[r"/job/[^/]+/(\d+)"],
    )

    def build_search_url(self, spec: SearchSpec) -> str:
        params = query_params(search=spec.keywords, location=spec.location or "Remote")
        return f"https://builtin.com/jobs?{params}"
