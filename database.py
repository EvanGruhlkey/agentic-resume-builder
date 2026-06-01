from __future__ import annotations

import asyncio
import sqlite3
from dataclasses import asdict
from pathlib import Path

from platforms.base import JobPosting
from utils.helpers import ensure_dir, utc_now_iso


SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  platform_job_id TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT,
  location TEXT,
  remote INTEGER DEFAULT 0,
  posted_at TEXT,
  posted_text TEXT,
  url TEXT NOT NULL,
  description TEXT,
  easy_apply INTEGER DEFAULT 0,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  raw_json TEXT,
  UNIQUE(platform, platform_job_id)
);

CREATE TABLE IF NOT EXISTS crawls (
  platform TEXT PRIMARY KEY,
  last_crawl_at TEXT NOT NULL,
  new_jobs INTEGER DEFAULT 0
);
"""


class JobDatabase:
    def __init__(self, path: Path):
        self.path = path
        self._lock = asyncio.Lock()

    async def initialize(self) -> None:
        ensure_dir(self.path.parent)
        async with self._lock:
            with sqlite3.connect(self.path) as conn:
                conn.executescript(SCHEMA)
                conn.commit()

    async def last_crawl_at(self, platform: str) -> str | None:
        async with self._lock:
            with sqlite3.connect(self.path) as conn:
                row = conn.execute("SELECT last_crawl_at FROM crawls WHERE platform = ?", (platform,)).fetchone()
                return row[0] if row else None

    async def record_crawl(self, platform: str, new_jobs: int) -> None:
        now = utc_now_iso()
        async with self._lock:
            with sqlite3.connect(self.path) as conn:
                conn.execute(
                    """
                    INSERT INTO crawls(platform, last_crawl_at, new_jobs)
                    VALUES(?, ?, ?)
                    ON CONFLICT(platform) DO UPDATE SET
                      last_crawl_at = excluded.last_crawl_at,
                      new_jobs = excluded.new_jobs
                    """,
                    (platform, now, new_jobs),
                )
                conn.commit()

    async def upsert_new_jobs(self, jobs: list[JobPosting]) -> list[JobPosting]:
        now = utc_now_iso()
        new_jobs: list[JobPosting] = []
        async with self._lock:
            with sqlite3.connect(self.path) as conn:
                for job in jobs:
                    exists = conn.execute(
                        "SELECT 1 FROM jobs WHERE platform = ? AND platform_job_id = ?",
                        (job.platform, job.platform_job_id),
                    ).fetchone()
                    if exists:
                        conn.execute(
                            "UPDATE jobs SET last_seen_at = ? WHERE platform = ? AND platform_job_id = ?",
                            (now, job.platform, job.platform_job_id),
                        )
                        continue

                    payload = asdict(job)
                    conn.execute(
                        """
                        INSERT INTO jobs(
                          platform, platform_job_id, title, company, location, remote,
                          posted_at, posted_text, url, description, easy_apply,
                          first_seen_at, last_seen_at, raw_json
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            job.platform,
                            job.platform_job_id,
                            job.title,
                            job.company,
                            job.location,
                            int(job.remote),
                            job.posted_at,
                            job.posted_text,
                            job.url,
                            job.description,
                            int(job.easy_apply),
                            now,
                            now,
                            __import__("json").dumps(payload, ensure_ascii=True),
                        ),
                    )
                    new_jobs.append(job)
                conn.commit()
        return new_jobs

    async def summary_since(self, iso_timestamp: str) -> dict:
        async with self._lock:
            with sqlite3.connect(self.path) as conn:
                rows = conn.execute(
                    """
                    SELECT platform, COUNT(*)
                    FROM jobs
                    WHERE first_seen_at >= ?
                    GROUP BY platform
                    ORDER BY COUNT(*) DESC
                    """,
                    (iso_timestamp,),
                ).fetchall()
                return {platform: count for platform, count in rows}
