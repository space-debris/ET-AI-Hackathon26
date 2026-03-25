"""
FinSage AI — XIRR Calculator (Abhishek)
==========================================
Calculates Extended Internal Rate of Return for mutual fund investments.

Uses scipy.optimize for numerical root-finding.
"""

from datetime import date
from typing import List, Tuple

from scipy.optimize import brentq, newton


def _year_fraction(start_date: date, current_date: date) -> float:
    """Return fraction of year between two dates using a 365-day basis."""
    return (current_date - start_date).days / 365.0


def _xnpv(rate: float, cashflows: List[Tuple[date, float]]) -> float:
    """NPV for irregular cashflows used in XIRR calculations."""
    if rate <= -1.0:
        raise ValueError("Rate must be greater than -1.0")

    base_date = min(txn_date for txn_date, _ in cashflows)
    return sum(
        amount / ((1 + rate) ** _year_fraction(base_date, txn_date))
        for txn_date, amount in cashflows
    )


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
    if not cashflows:
        raise ValueError("Cashflows cannot be empty")

    amounts = [amount for _, amount in cashflows]
    if not any(amount < 0 for amount in amounts) or not any(amount > 0 for amount in amounts):
        raise ValueError("Cashflows must contain at least one negative and one positive amount")

    if len({txn_date for txn_date, _ in cashflows}) < 2:
        raise ValueError("XIRR requires cashflows across at least two distinct dates")

    try:
        # Newton is fast when derivative behavior is good around the initial guess.
        rate = float(newton(lambda r: _xnpv(r, cashflows), x0=guess, maxiter=200))
        if rate <= -1.0:
            raise ValueError("Computed XIRR is invalid")
        return rate
    except Exception:
        pass

    # Fallback to a bracketed solver that is more robust for difficult curves.
    lower, upper = -0.9999, 10.0
    try:
        f_lower = _xnpv(lower, cashflows)
        f_upper = _xnpv(upper, cashflows)
        if f_lower == 0:
            return lower
        if f_upper == 0:
            return upper
        if f_lower * f_upper > 0:
            raise ValueError("Unable to bracket XIRR root")
        return float(brentq(lambda r: _xnpv(r, cashflows), lower, upper, maxiter=500))
    except Exception as exc:
        raise ValueError("XIRR could not be computed for the provided cashflows") from exc
