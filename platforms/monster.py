from __future__ import annotations

from platforms.base import SearchSpec
from platforms.generic import GenericSearchPlatform, PlatformSelectors, query_params


class MonsterPlatform(GenericSearchPlatform):
    name = "monster"
    selectors = PlatformSelectors(
        card="[data-testid='svx_jobCard'], section.card-content, article",
        title=["a[data-testid='jobTitle'], h2 a, a[href*='/job-openings/']"],
        company=["[data-testid='company'], .company"],
        location=["[data-testid='jobDetailLocation'], .location"],
        posted=["[data-testid='postedDate'], time"],
        description=["[data-testid='jobDescription'], .job-description, main"],
        easy_apply=["text=Quick Apply", "text=Apply now"],
        next_button=["button[aria-label='Next'], a[aria-label='Next']"],
        job_id_patterns=[r"/job-openings/.*?--([A-Za-z0-9-]+)"],
    )

    def build_search_url(self, spec: SearchSpec) -> str:
        params = query_params(q=spec.keywords, where=spec.location or "United States", so="m.s.sh")
        return f"https://www.monster.com/jobs/search?{params}"
