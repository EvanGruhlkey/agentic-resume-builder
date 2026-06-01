from __future__ import annotations

from platforms.base import SearchSpec
from platforms.generic import GenericSearchPlatform, PlatformSelectors, freshness_days, query_params


class LinkedInPlatform(GenericSearchPlatform):
    name = "linkedin"
    selectors = PlatformSelectors(
        card="li.jobs-search-results__list-item, .base-card, .job-search-card",
        title=["a.job-card-list__title, a.base-card__full-link, h3.base-search-card__title"],
        company=[".job-card-container__primary-description, h4.base-search-card__subtitle"],
        location=[".job-card-container__metadata-item, .job-search-card__location, .base-search-card__metadata"],
        posted=["time, .job-search-card__listdate, .job-card-container__listed-time"],
        description=[".jobs-description__content, .show-more-less-html, .description__text, main"],
        easy_apply=["text=Easy Apply"],
        next_button=["button[aria-label='View next page'], button.jobs-search-pagination__button--next"],
        job_id_patterns=[r"/jobs/view/(\d+)"],
    )

    def build_search_url(self, spec: SearchSpec) -> str:
        seconds = 86400 if freshness_days(spec) == 1 else 604800
        params = query_params(
            keywords=spec.keywords,
            location=spec.location or "United States",
            f_TPR=f"r{seconds}",
            sortBy="DD",
        )
        return f"https://www.linkedin.com/jobs/search/?{params}"
