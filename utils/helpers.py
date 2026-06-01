from __future__ import annotations

import asyncio
import random
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

import yaml


def load_yaml(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle) or {}


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def config_get(config: dict, dotted: str, default=None):
    current = config
    for part in dotted.split("."):
        if not isinstance(current, dict) or part not in current:
            return default
        current = current[part]
    return current


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def normalize_url(url: str) -> str:
    try:
        parsed = urlparse(url)
        query = parse_qs(parsed.query, keep_blank_values=True)
        clean_query = {
            key: values
            for key, values in query.items()
            if not re.match(r"^(utm_|fbclid|gclid|trk|tracking|ref)", key, re.I)
        }
        return urlunparse(
            (
                parsed.scheme,
                parsed.netloc.lower(),
                parsed.path,
                "",
                urlencode(clean_query, doseq=True),
                "",
            )
        )
    except Exception:
        return url


def normalize_company(company: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (company or "").lower()).strip()


def text_has_any(text: str, terms) -> bool:
    lower = (text or "").lower()
    return any(str(term).lower() in lower for term in terms)


def is_blocked_text(text: str) -> bool:
    return bool(
        re.search(
            r"captcha|verify you are human|security check|unusual traffic|access denied|"
            r"sign in to continue|log in to continue|authwall|checkpoint|forbidden",
            text or "",
            re.I,
        )
    )


def extract_job_id(url: str, param_names: tuple[str, ...], path_patterns: list[str]) -> str:
    parsed = urlparse(url)
    params = parse_qs(parsed.query)
    for name in param_names:
        if params.get(name):
            return params[name][0]
    for pattern in path_patterns:
        match = re.search(pattern, parsed.path)
        if match:
            return match.group(1)
    slug = parsed.path.strip("/").split("/")[-1]
    return slug[:160]


def parse_posted_at(value: str) -> str | None:
    text = (value or "").strip().lower()
    if not text:
        return None
    now = datetime.now(timezone.utc)
    if "today" in text or "just posted" in text or "moments ago" in text:
        return now.replace(microsecond=0).isoformat()
    if "yesterday" in text:
        return (now - timedelta(days=1)).replace(microsecond=0).isoformat()
    match = re.search(r"(\d+)\s*(minute|hour|day|week|month)s?\s*ago", text)
    if match:
        amount = int(match.group(1))
        unit = match.group(2)
        delta = {
            "minute": timedelta(minutes=amount),
            "hour": timedelta(hours=amount),
            "day": timedelta(days=amount),
            "week": timedelta(weeks=amount),
            "month": timedelta(days=30 * amount),
        }[unit]
        return (now - delta).replace(microsecond=0).isoformat()
    for fmt in ("%Y-%m-%d", "%b %d, %Y", "%B %d, %Y", "%m/%d/%Y"):
        try:
            parsed = datetime.strptime(value.strip(), fmt).replace(tzinfo=timezone.utc)
            return parsed.replace(microsecond=0).isoformat()
        except ValueError:
            continue
    return None


async def random_delay(min_seconds: float, max_seconds: float) -> None:
    await asyncio.sleep(random.uniform(min_seconds, max_seconds))


async def safe_inner_text(locator) -> str:
    try:
        if await locator.count() == 0:
            return ""
        return " ".join((await locator.first.inner_text(timeout=2500)).split())
    except Exception:
        return ""
