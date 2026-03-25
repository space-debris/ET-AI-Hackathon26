"""
FinSage AI — Fund Data Fetcher (Abhishek)
============================================
Wrapper around mftool for fetching live NAV and fund metadata.
"""

from typing import Dict, List, Optional


def get_fund_nav(scheme_code: str) -> Optional[float]:
    """
    Get current NAV for a mutual fund scheme.
    
    Args:
        scheme_code: AMFI scheme code (e.g., "119551")
        
    Returns:
        Current NAV as float, or None if unavailable
    """
    raise NotImplementedError("Abhishek: Implement using mftool")


def get_fund_details(scheme_code: str) -> Optional[Dict]:
    """
    Get complete fund details including scheme name, category, etc.
    
    Args:
        scheme_code: AMFI scheme code
        
    Returns:
        Dict with fund details, or None if unavailable
    """
    raise NotImplementedError("Abhishek: Implement using mftool")


def search_fund(query: str) -> List[Dict]:
    """
    Search for mutual funds by name.
    
    Args:
        query: Search query (e.g., "HDFC Mid-Cap")
        
    Returns:
        List of matching fund dicts with scheme_code and scheme_name
    """
    raise NotImplementedError("Abhishek: Implement using mftool")
