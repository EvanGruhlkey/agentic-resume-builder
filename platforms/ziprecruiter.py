from __future__ import annotations

from platforms.base import SearchSpec
from platforms.generic import GenericSearchPlatform, PlatformSelectors, freshness_days, query_params


class ZipRecruiterPlatform(GenericSearchPlatform):
    name = "ziprecruiter"
    selectors = PlatformSelectors(
        card="article.job_result, div[data-testid='job-card'], .job_content",
        title=["a.job_link, a[data-testid='job-card-title'], h2 a"],
        company=["a.t_org_link, [data-testid='job-card-company']"],
        location=[".t_location, [data-testid='job-card-location']"],
        posted=[".job_age, [data-testid='job-card-posted-date']"],
        description=[".job_snippet, .jobDescriptionSection, main"],
        easy_apply=["text=Quick Apply", "text=Easy Apply"],
        next_button=["a.next, a[aria-label='Next page']"],
        job_id_patterns=[r"/jobs/[^/]+-([A-Za-z0-9]+)"],
    )

    def build_search_url(self, spec: SearchSpec) -> str:
        params = query_params(
            search=spec.keywords,
            location=spec.location or "United States",
            days=freshness_days(spec),
            refine_by_salary=spec.salary_min,
        )
        return f"https://www.ziprecruiter.com/jobs-search?{params}"
