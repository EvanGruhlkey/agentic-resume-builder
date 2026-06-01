from __future__ import annotations

from platforms.base import SearchSpec
from platforms.generic import GenericSearchPlatform, PlatformSelectors, query_params


class HandshakePlatform(GenericSearchPlatform):
    name = "handshake"
    selectors = PlatformSelectors(
        card="[data-hook='jobs-card'], .job-card, article",
        title=["a[href*='/jobs/'], [data-hook='job-title']"],
        company=["[data-hook='employer-name'], .employer-name"],
        location=["[data-hook='location'], .location"],
        posted=["time, [data-hook='posted-date']"],
        description=["[data-hook='job-description'], .job-description, main"],
        easy_apply=["text=Quick Apply", "text=Apply"],
        next_button=["button[aria-label='Next'], a[rel='next']"],
        job_id_patterns=[r"/jobs/(\d+)"],
    )

    def build_search_url(self, spec: SearchSpec) -> str:
        params = query_params(query=spec.keywords, location=spec.location or "United States", sort_direction="desc")
        return f"https://app.joinhandshake.com/stu/jobs?{params}"
