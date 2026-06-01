from __future__ import annotations

from platforms.base import SearchSpec
from platforms.generic import GenericSearchPlatform, PlatformSelectors, freshness_days, query_params


class CareerBuilderPlatform(GenericSearchPlatform):
    name = "careerbuilder"
    selectors = PlatformSelectors(
        card="[data-testid='job-card'], .data-results-content-parent, article",
        title=["a[data-testid='job-card-title'], a[href*='/job/']"],
        company=["[data-testid='company-name'], .company-name"],
        location=["[data-testid='job-location'], .data-details"],
        posted=["[data-testid='posted-date'], time"],
        description=[".job-description, [data-testid='job-description'], main"],
        easy_apply=["text=Quick Apply", "text=Easy Apply"],
        next_button=["a[aria-label='Next Page'], button[aria-label='Next']"],
        job_id_patterns=[r"/job/([A-Za-z0-9]+)"],
    )

    def build_search_url(self, spec: SearchSpec) -> str:
        params = query_params(
            keywords=spec.keywords,
            location=spec.location or "United States",
            posted=freshness_days(spec),
            sort="date_desc",
        )
        return f"https://www.careerbuilder.com/jobs?{params}"
