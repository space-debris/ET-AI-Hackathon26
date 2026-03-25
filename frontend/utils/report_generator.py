"""
FinSage AI — PDF Report Generator (Ayush)
============================================
Generates downloadable PDF report from FinalReport/AdvisoryReport + PortfolioAnalytics.
Uses fpdf2 for PDF generation.
Owner: Ayush
"""

import io
from datetime import datetime
from fpdf import FPDF
from typing import Optional
from shared.schemas import PortfolioAnalytics, AdvisoryReport, FinalReport


class FinSageReport(FPDF):
    """Custom PDF with FinSage branding."""

    def __init__(self):
        super().__init__()
        self.set_auto_page_break(auto=True, margin=20)

    def header(self):
        self.set_font("Helvetica", "B", 14)
        self.set_text_color(108, 99, 255)  # Brand purple
        self.cell(0, 10, "FinSage AI", align="L")
        self.set_font("Helvetica", "", 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f"Generated: {datetime.now().strftime('%d %b %Y, %I:%M %p')}", align="R", new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(108, 99, 255)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 7)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="C")

    def section_title(self, title: str, icon: str = ""):
        self.ln(6)
        self.set_font("Helvetica", "B", 12)
        self.set_text_color(60, 60, 80)
        self.cell(0, 8, f"  {title}", new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(230, 230, 240)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(3)

    def key_value(self, key: str, value: str):
        self.set_font("Helvetica", "", 9)
        self.set_text_color(100, 100, 100)
        self.cell(60, 6, _sanitize(key), new_x="END")
        self.set_text_color(40, 40, 60)
        self.set_font("Helvetica", "B", 9)
        self.cell(0, 6, _sanitize(value), new_x="LMARGIN", new_y="NEXT")

    def body_text(self, text: str):
        self.set_font("Helvetica", "", 9)
        self.set_text_color(60, 60, 80)
        self.multi_cell(0, 5, _sanitize(text))
        self.ln(2)


def _fmt_inr(value: float) -> str:
    if abs(value) >= 1_00_00_000:
        return f"Rs. {value / 1_00_00_000:,.2f} Cr"
    elif abs(value) >= 1_00_000:
        return f"Rs. {value / 1_00_000:,.2f} L"
    else:
        return f"Rs. {value:,.0f}"


def _sanitize(text: str) -> str:
    """Sanitize text for Helvetica font — replace Unicode with ASCII equivalents."""
    replacements = {
        "\u20b9": "Rs.",  # ₹
        "\u2014": "-",    # —
        "\u2013": "-",    # –
        "\u2018": "'",    # '
        "\u2019": "'",    # '
        "\u201c": '"',    # "
        "\u201d": '"',    # "
        "\u2022": "-",    # •
        "\u2264": "<=",   # ≤
        "\u2265": ">=",   # ≥
        "\u2026": "...",  # …
    }
    for uni, ascii_eq in replacements.items():
        text = text.replace(uni, ascii_eq)
    # Strip any remaining non-latin-1 characters
    return text.encode("latin-1", errors="ignore").decode("latin-1")


def generate_pdf(
    analytics: Optional[PortfolioAnalytics] = None,
    advisory_report: Optional[AdvisoryReport] = None,
    final_report: Optional[FinalReport] = None,
) -> bytes:
    """
    Generate a multi-page PDF report.

    Returns:
        PDF as bytes — suitable for st.download_button(data=...)
    """
    pdf = FinSageReport()
    pdf.alias_nb_pages()
    pdf.add_page()

    # ── Title Page ──────────────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(108, 99, 255)
    pdf.ln(20)
    pdf.cell(0, 12, "Financial Health Report", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 8, "Powered by FinSage AI - Multi-Agent Financial Analysis", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(15)

    # ── Portfolio Summary ──────────────────────────────────────────────
    if analytics:
        pdf.section_title("Portfolio Summary")
        gain = analytics.total_current_value - analytics.total_invested
        gain_pct = (gain / analytics.total_invested * 100) if analytics.total_invested else 0

        pdf.key_value("Total Current Value:", _fmt_inr(analytics.total_current_value))
        pdf.key_value("Total Invested:", _fmt_inr(analytics.total_invested))
        pdf.key_value("Total Gain/Loss:", f"{_fmt_inr(gain)} ({gain_pct:+.1f}%)")
        pdf.key_value("Portfolio XIRR:", f"{analytics.overall_xirr * 100:.1f}%")
        pdf.key_value("Annual Expense Drag:", f"{_fmt_inr(analytics.expense_ratio_drag_inr)}")
        pdf.key_value("Number of Funds:", str(len(analytics.holdings)))
        pdf.ln(4)

        # Holdings table
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_fill_color(245, 245, 250)
        pdf.cell(65, 6, "Fund Name", border=1, fill=True)
        pdf.cell(25, 6, "Category", border=1, fill=True)
        pdf.cell(30, 6, "Value", border=1, fill=True, align="R")
        pdf.cell(30, 6, "Invested", border=1, fill=True, align="R")
        pdf.cell(22, 6, "XIRR", border=1, fill=True, align="R")
        pdf.cell(18, 6, "ER %", border=1, fill=True, align="R", new_x="LMARGIN", new_y="NEXT")

        pdf.set_font("Helvetica", "", 8)
        for h in analytics.holdings:
            name = h.fund_name[:32] + "..." if len(h.fund_name) > 32 else h.fund_name
            cat = h.category.value.replace("_", " ").title()[:12]
            xirr_str = f"{h.xirr * 100:.1f}%" if h.xirr else "-"
            pdf.cell(65, 5, name, border=1)
            pdf.cell(25, 5, cat, border=1)
            pdf.cell(30, 5, _fmt_inr(h.current_value), border=1, align="R")
            pdf.cell(30, 5, _fmt_inr(h.invested_amount), border=1, align="R")
            pdf.cell(22, 5, xirr_str, border=1, align="R")
            pdf.cell(18, 5, f"{h.expense_ratio * 100:.2f}%", border=1, align="R", new_x="LMARGIN", new_y="NEXT")

    # ── Rebalancing Plan ──────────────────────────────────────────────
    report = final_report or advisory_report
    if report and report.rebalancing_plan:
        pdf.add_page()
        pdf.section_title("Rebalancing Recommendations")
        for i, action in enumerate(report.rebalancing_plan, 1):
            action_val = action.action.value if hasattr(action.action, 'value') else action.action
            pdf.set_font("Helvetica", "B", 9)
            pdf.set_text_color(40, 40, 60)
            pdf.cell(0, 6, _sanitize(f"{i}. {action.fund_name} - {action_val.upper()}"), new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", "", 8)
            pdf.set_text_color(80, 80, 100)
            pdf.set_x(10)
            pdf.multi_cell(190, 4, _sanitize(f"   Rationale: {action.rationale}"))
            if action.tax_impact:
                pdf.set_x(10)
                pdf.multi_cell(190, 4, _sanitize(f"   Tax Impact: {action.tax_impact}"))
            if action.target_fund:
                pdf.set_x(10)
                pdf.multi_cell(190, 4, _sanitize(f"   Switch to: {action.target_fund}"))
            pdf.ln(2)

    # ── FIRE Plan ──────────────────────────────────────────────────────
    if report and report.fire_plan:
        pdf.add_page()
        pdf.section_title("FIRE Path Plan")
        fp = report.fire_plan
        pdf.key_value("Target Corpus:", _fmt_inr(fp.target_corpus))
        pdf.key_value("Current Corpus:", _fmt_inr(fp.current_corpus))
        pdf.key_value("Monthly SIP Required:", _fmt_inr(fp.monthly_sip_required))
        pdf.key_value("Years to Retirement:", str(fp.years_to_retirement))
        pdf.key_value("Expected Retirement:", fp.expected_retirement_date)
        if fp.at_current_trajectory:
            pdf.key_value("At Current Rate:", fp.at_current_trajectory)

    # ── Tax Analysis ──────────────────────────────────────────────────
    if report and report.tax_analysis:
        pdf.add_page()
        pdf.section_title("Tax Regime Comparison")
        ta = report.tax_analysis
        pdf.key_value("Gross Income:", _fmt_inr(ta.gross_income))
        pdf.key_value("Old Regime Tax:", _fmt_inr(ta.old_total_tax))
        pdf.key_value("New Regime Tax:", _fmt_inr(ta.new_total_tax))
        pdf.key_value("Recommended:", ta.recommended_regime.upper() + " Regime")
        pdf.key_value("You Save:", _fmt_inr(ta.savings_amount))

        if ta.missed_deductions:
            pdf.ln(3)
            pdf.set_font("Helvetica", "B", 9)
            pdf.cell(0, 6, "Missed Deductions:", new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", "", 8)
            for d in ta.missed_deductions:
                pdf.cell(0, 5, _sanitize(f"  - {d}"), new_x="LMARGIN", new_y="NEXT")

    # ── Health Score ──────────────────────────────────────────────────
    if report and report.health_score:
        pdf.add_page()
        pdf.section_title("Money Health Score")

        avg = sum(h.score for h in report.health_score) / len(report.health_score)
        pdf.key_value("Overall Score:", f"{avg:.0f} / 100")
        pdf.ln(3)

        for dim in report.health_score:
            label = dim.dimension.replace("_", " ").title()
            pdf.set_font("Helvetica", "B", 9)
            pdf.cell(0, 6, _sanitize(f"{label}: {dim.score:.0f}/100"), new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", "", 8)
            pdf.multi_cell(0, 4, _sanitize(f"  {dim.rationale}"))
            if dim.suggestions:
                for s in dim.suggestions:
                    pdf.cell(0, 4, _sanitize(f"    - {s}"), new_x="LMARGIN", new_y="NEXT")
            pdf.ln(2)

    # ── Disclaimer ────────────────────────────────────────────────────
    pdf.add_page()
    pdf.section_title("Disclaimer")
    disclaimer = ""
    if final_report and final_report.disclaimer:
        disclaimer = final_report.disclaimer
    else:
        disclaimer = (
            "This analysis is generated by an AI system for educational and informational purposes only. "
            "It does NOT constitute financial advice, investment recommendations, or solicitation to buy/sell "
            "any securities. Past performance does not guarantee future results. Mutual fund investments are "
            "subject to market risks. Please read all scheme-related documents carefully before investing. "
            "Consult a SEBI-registered investment advisor for personalised financial advice."
        )
    pdf.body_text(disclaimer)

    # ── Audit Trail ───────────────────────────────────────────────────
    if report and report.audit_trail:
        pdf.section_title("Audit Trail")
        pdf.set_font("Helvetica", "", 7)
        for entry in report.audit_trail:
            clean_entry = entry.encode('latin-1', errors='ignore').decode('latin-1')
            pdf.cell(0, 4, f"- {clean_entry}", new_x="LMARGIN", new_y="NEXT")

    # ── Output ────────────────────────────────────────────────────────
    return pdf.output()
