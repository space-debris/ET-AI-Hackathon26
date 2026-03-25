"""
FinSage AI — Fund Overlap Detector (Abhishek)
================================================
Detects stock-level overlap across mutual fund holdings.
"""

from typing import List, Dict
from shared.schemas import FundHolding, OverlapDetail


def detect_overlap(
    holdings: List[FundHolding],
) -> tuple[Dict[str, Dict[str, float]], List[OverlapDetail]]:
    """
    Detect stock-level overlap across all fund holdings.
    
    Args:
        holdings: List of FundHolding objects with top_holdings populated
        
    Returns:
        Tuple of:
        - overlap_matrix: {stock_name: {fund_name: weight}}
          (only stocks appearing in 2+ funds)
        - overlap_details: List of OverlapDetail objects with
          total portfolio exposure calculated
          
    Example output:
        overlap_matrix = {
            "Reliance Industries": {
                "HDFC Flexicap": 0.08,
                "SBI Bluechip": 0.07,
                "ICICI Multicap": 0.05
            }
        }
    """
    fund_values = {holding.fund_name: max(holding.current_value, 0.0) for holding in holdings}
    portfolio_value = sum(fund_values.values())

    stock_to_funds: Dict[str, Dict[str, float]] = {}
    for holding in holdings:
        for stock in holding.top_holdings:
            stock_name = stock.stock_name.strip()
            if not stock_name:
                continue
            stock_to_funds.setdefault(stock_name, {})[holding.fund_name] = float(stock.weight)

    overlap_matrix: Dict[str, Dict[str, float]] = {
        stock_name: fund_weights
        for stock_name, fund_weights in stock_to_funds.items()
        if len(fund_weights) >= 2
    }

    overlap_details: List[OverlapDetail] = []
    for stock_name, fund_weights in overlap_matrix.items():
        if portfolio_value <= 0:
            exposure = 0.0
        else:
            exposure = 0.0
            for fund_name, stock_weight in fund_weights.items():
                fund_portfolio_weight = fund_values.get(fund_name, 0.0) / portfolio_value
                exposure += fund_portfolio_weight * stock_weight

        overlap_details.append(
            OverlapDetail(
                stock_name=stock_name,
                funds=fund_weights,
                total_portfolio_exposure=exposure,
            )
        )

    overlap_details.sort(
        key=lambda item: item.total_portfolio_exposure,
        reverse=True,
    )

    return overlap_matrix, overlap_details
