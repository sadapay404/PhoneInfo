"""
Field-level merge across sources.

Each source contributes a normalized device record. For every field, the value
from the highest-priority source that has it wins. Provenance is recorded per
field, so the app (and you) can see where each value came from.
"""
from __future__ import annotations

import re
from typing import Any

DEFAULT_PRIORITY = ["gsmarena", "manufacturer", "licensed"]


def device_key(brand: str, model: str) -> str:
    """Stable identity across sources: lowercase slug of brand + model."""
    return re.sub(r"[^a-z0-9]+", "-", f"{brand} {model}".lower()).strip("-")


def _flatten(data: dict[str, Any], prefix: str = "") -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in data.items():
        path = f"{prefix}{k}"
        if isinstance(v, dict):
            out.update(_flatten(v, path + "."))
        elif v is not None:
            out[path] = v
    return out


def _unflatten(flat: dict[str, Any]) -> dict[str, Any]:
    root: dict[str, Any] = {}
    for path, value in flat.items():
        node = root
        *parents, leaf = path.split(".")
        for p in parents:
            node = node.setdefault(p, {})
        node[leaf] = value
    return root


def merge_records(records: list[tuple[str, dict[str, Any]]], priority: list[str] | None = None) -> tuple[dict[str, Any], dict[str, str]]:
    """
    records: [(source_name, normalized_data), ...] for ONE device.
    Returns (merged_data, provenance) where provenance maps each field path to its source.
    """
    order = priority or DEFAULT_PRIORITY

    def rank(source: str) -> int:
        return order.index(source) if source in order else len(order)

    merged: dict[str, Any] = {}
    provenance: dict[str, str] = {}
    for source, data in sorted(records, key=lambda r: rank(r[0])):
        for path, value in _flatten(data).items():
            if path not in merged:
                merged[path] = value
                provenance[path] = source
    return _unflatten(merged), provenance
