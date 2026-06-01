from __future__ import annotations

import csv
import json
from dataclasses import asdict, is_dataclass
from pathlib import Path


def export_json(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(rows, indent=2, ensure_ascii=True), encoding="utf-8")


def export_csv(path: Path, rows: list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    normalized = [asdict(row) if is_dataclass(row) else row for row in rows]
    fieldnames = [
        "platform",
        "platform_job_id",
        "title",
        "company",
        "location",
        "remote",
        "posted_text",
        "posted_at",
        "url",
        "description",
        "easy_apply",
    ]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(normalized)
