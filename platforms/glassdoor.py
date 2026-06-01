from __future__ import annotations

from platforms.base import SearchSpec
from platforms.generic import GenericSearchPlatform, PlatformSelectors, freshness_days, query_params


class GlassdoorPlatform(GenericSearchPlatform):
    name = "glassdoor"
    selectors = PlatformSelectors(
        card="li[data-test='jobListing'], li.react-job-listing, .JobCard_jobCardContainer__",
        title=["a[data-test='job-link'], a.JobCard_jobTitle__"],
        company=["span[data-test='employer-name'], .EmployerProfile_compactEmployerName__"],
        location=["div[data-test='emp-location'], .JobCard_location__"],
        posted=["div[data-test='job-age'], .JobCard_listingAge__"],
        description=[".JobDetails_jobDescription__, [data-test='jobDescriptionContent'], main"],
        easy_apply=["text=Easy Apply"],
        next_button=["button[data-test='pagination-next'], button[aria-label='Next']"],
        job_id_patterns=[r"/job-listing/.*?-JV_IC\d+_KO\d+,\d+_KE\d+,\d+\.htm\?jl=(\d+)"],
    )

    def build_search_url(self, spec: SearchSpec) -> str:
        params = query_params(
            sc_keyword=spec.keywords,
            location=spec.location or "United States",
            fromAge=freshness_days(spec),
            sortBy="date_desc",
        )
        return f"https://www.glassdoor.com/Job/jobs.htm?{params}"
