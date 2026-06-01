from __future__ import annotations

from platforms.base import SearchSpec
from platforms.generic import GenericSearchPlatform, PlatformSelectors, freshness_days, query_params


class DicePlatform(GenericSearchPlatform):
    name = "dice"
    selectors = PlatformSelectors(
        card="dhi-search-card, div[data-cy='search-card'], .card",
        title=["a[data-cy='card-title-link'], a[href*='/job-detail/']"],
        company=["a[data-cy='search-result-company-name'], [data-cy='companyName']"],
        location=["span[data-cy='search-result-location'], [data-cy='location']"],
        posted=["span[data-cy='card-posted-date'], time"],
        description=["div[data-cy='jobDescription'], .job-description, main"],
        easy_apply=["text=Easy Apply", "text=Quick Apply"],
        next_button=["a[aria-label='Next'], button[aria-label='Next']"],
        job_id_patterns=[r"/job-detail/([A-Za-z0-9-]+)"],
    )

    def build_search_url(self, spec: SearchSpec) -> str:
        posted = "ONE" if freshness_days(spec) == 1 else "SEVEN"
        params = query_params(q=spec.keywords, location=spec.location or "United States", **{"filters.postedDate": posted})
        return f"https://www.dice.com/jobs?{params}"
