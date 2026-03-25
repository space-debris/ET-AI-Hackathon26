"""
FinSage AI — XIRR Calculator (Abhishek)
==========================================
Calculates Extended Internal Rate of Return for mutual fund investments.

Uses scipy.optimize for numerical root-finding.
"""

from datetime import date
from typing import List, Tuple


def calculate_xirr(cashflows: List[Tuple[date, float]], guess: float = 0.1) -> float:
    """
    Calculate XIRR (Extended Internal Rate of Return) for a series of cashflows.
    
    Args:
        cashflows: List of (date, amount) tuples. 
                   Negative = investment, Positive = redemption/current value.
        guess: Initial guess for the rate (default 10%)
        
    Returns:
        XIRR as a decimal (e.g., 0.12 for 12%)
        
    Raises:
        ValueError: If XIRR cannot be computed
        
    Example:
        >>> cashflows = [
        ...     (date(2020, 1, 1), -100000),  # invested ₹1L
        ...     (date(2020, 7, 1), -50000),   # invested ₹50K
        ...     (date(2024, 1, 1), 200000),   # current value ₹2L
        ... ]
        >>> xirr = calculate_xirr(cashflows)
        >>> print(f"XIRR: {xirr:.2%}")
    """
    raise NotImplementedError("Abhishek: Implement XIRR using scipy.optimize")
