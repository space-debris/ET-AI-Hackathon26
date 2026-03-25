"""
FinSage AI - Factsheet Loader (Abhishek)
========================================
Loads static factsheet-derived metadata (expense ratios, top holdings)
used by the Analytics Agent until full RAG ingestion is enabled.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from shared.schemas import StockHolding


_FACTSHEET_FILE = Path(__file__).parent.parent / "data" / "fund_factsheets" / "factsheet_reference.json"


def _normalize_name(name: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", " ", name.lower()).strip()
    tokens = [t for t in cleaned.split() if t not in {"fund", "growth", "plan", "regular", "direct", "option"}]
    return " ".join(tokens)


def load_factsheet_index() -> Dict[str, Dict[str, Any]]:
    """Load factsheet index keyed by normalized scheme names."""
    if not _FACTSHEET_FILE.exists():
        return {}

    raw = json.loads(_FACTSHEET_FILE.read_text(encoding="utf-8"))
    index: Dict[str, Dict[str, Any]] = {}
    for item in raw.get("funds", []):
        key = _normalize_name(item.get("scheme", ""))
        if key:
            index[key] = item
    return index


def lookup_factsheet(
    fund_name: str,
    isin: Optional[str],
    index: Optional[Dict[str, Dict[str, Any]]] = None,
) -> Optional[Dict[str, Any]]:
    """Return best matching factsheet record for a fund."""
    factsheet_index = index if index is not None else load_factsheet_index()
    if not factsheet_index:
        return None

    # ISIN exact match has highest priority.
    if isin:
        for item in factsheet_index.values():
            if str(item.get("isin", "")).strip().upper() == isin.strip().upper():
                return item

    normalized = _normalize_name(fund_name)
    if normalized in factsheet_index:
        return factsheet_index[normalized]

    # Fuzzy fallback by token overlap.
    query_tokens = set(normalized.split())
    best_item = None
    best_score = 0
    for key, item in factsheet_index.items():
        key_tokens = set(key.split())
        overlap = len(query_tokens & key_tokens)
        if overlap > best_score:
            best_score = overlap
            best_item = item

    return best_item if best_score >= 2 else None


def parse_top_holdings(rows: List[Dict[str, Any]]) -> List[StockHolding]:
    holdings: List[StockHolding] = []
    for row in rows or []:
        name = str(row.get("stock_name", "")).strip()
        if not name:
            continue
        try:
            weight = float(row.get("weight", 0.0))
        except Exception:
            weight = 0.0
        holdings.append(
            StockHolding(
                stock_name=name,
                weight=weight,
                sector=row.get("sector"),
            )
        )
    return holdings
