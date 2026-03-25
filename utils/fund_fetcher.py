"""
FinSage AI — Fund Data Fetcher (Abhishek)
============================================
Wrapper around mftool for fetching live NAV and fund metadata.
"""

from typing import Dict, List, Optional


def _get_mf_client():
    """Create mftool client lazily to avoid import-time hard failures."""
    try:
        from mftool import Mftool  # type: ignore

        return Mftool()
    except Exception:
        return None


def _safe_float(value: object) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(str(value).replace(",", "").strip())
    except Exception:
        return None


def get_fund_nav(scheme_code: str) -> Optional[float]:
    """
    Get current NAV for a mutual fund scheme.
    
    Args:
        scheme_code: AMFI scheme code (e.g., "119551")
        
    Returns:
        Current NAV as float, or None if unavailable
    """
    client = _get_mf_client()
    if client is None:
        return None

    try:
        quote = client.get_scheme_quote(scheme_code)
        if not quote:
            return None
        return _safe_float(quote.get("nav"))
    except Exception:
        return None


def get_fund_details(scheme_code: str) -> Optional[Dict]:
    """
    Get complete fund details including scheme name, category, etc.
    
    Args:
        scheme_code: AMFI scheme code
        
    Returns:
        Dict with fund details, or None if unavailable
    """
    client = _get_mf_client()
    if client is None:
        return None

    try:
        quote = client.get_scheme_quote(scheme_code)
        if not quote:
            return None

        return {
            "scheme_code": str(quote.get("scheme_code") or scheme_code),
            "scheme_name": quote.get("scheme_name"),
            "fund_house": quote.get("fund_house"),
            "scheme_type": quote.get("scheme_type"),
            "scheme_category": quote.get("scheme_category"),
            "nav": _safe_float(quote.get("nav")),
            "nav_date": quote.get("date"),
        }
    except Exception:
        return None


def search_fund(query: str) -> List[Dict]:
    """
    Search for mutual funds by name.
    
    Args:
        query: Search query (e.g., "HDFC Mid-Cap")
        
    Returns:
        List of matching fund dicts with scheme_code and scheme_name
    """
    if not query.strip():
        return []

    client = _get_mf_client()
    if client is None:
        return []

    try:
        schemes = client.get_scheme_codes() or {}
    except Exception:
        return []

    query_lower = query.lower().strip()
    results: List[Dict] = []

    for scheme_code, scheme_name in schemes.items():
        name = str(scheme_name)
        if query_lower in name.lower():
            results.append(
                {
                    "scheme_code": str(scheme_code),
                    "scheme_name": name,
                }
            )

    results.sort(key=lambda item: item["scheme_name"])
    return results[:25]
