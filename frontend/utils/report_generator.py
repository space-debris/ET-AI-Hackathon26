"""
FinSage AI — PDF Report Generator (Ayush)
============================================
Generates downloadable PDF report from FinalReport/AdvisoryReport + PortfolioAnalytics.
Uses fpdf2 for PDF generation.
Owner: Ayush
"""

import os
import tempfile
from datetime import datetime
from fpdf import FPDF
from typing import Optional
from math import ceil

os.environ.setdefault("XDG_CACHE_HOME", tempfile.gettempdir())
os.environ.setdefault("MPLCONFIGDIR", tempfile.gettempdir())

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
from matplotlib.ticker import FuncFormatter
from PIL import Image

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

    def metric_tiles(self, metrics: list[tuple[str, str, tuple[int, int, int]]]):
        tile_width = 90
        tile_height = 20
        gap = 8
        start_x = 10
        start_y = self.get_y()
        columns = 2
        row_gap = 6

        for index, (label, value, color) in enumerate(metrics):
            row = index // columns
            col = index % columns
            current_x = start_x + col * (tile_width + gap)
            current_y = start_y + row * (tile_height + row_gap)
            self.set_fill_color(*color)
            self.set_draw_color(*color)
            self.rect(current_x, current_y, tile_width, tile_height, style="FD")
            self.set_xy(current_x + 4, current_y + 3)
            self.set_font("Helvetica", "B", 8)
            self.set_text_color(255, 255, 255)
            self.cell(tile_width - 8, 4, _sanitize(label))
            self.set_xy(current_x + 4, current_y + 9)
            self.set_font("Helvetica", "B", 12)
            self.cell(tile_width - 8, 7, _sanitize(value))

        total_rows = ceil(len(metrics) / columns)
        self.set_y(start_y + total_rows * (tile_height + row_gap) + 2)

    def chart_image(self, image_path: str, title: str, width: float = 156):
        with Image.open(image_path) as chart_image:
            pixel_width, pixel_height = chart_image.size

        display_height = width * (pixel_height / pixel_width)
        required_height = 8 + display_height + 4
        if self.get_y() + required_height > self.page_break_trigger:
            self.add_page()
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(60, 60, 80)
        self.cell(0, 6, _sanitize(title), new_x="LMARGIN", new_y="NEXT")
        self.ln(2)
        image_x = (self.w - width) / 2
        self.image(image_path, x=image_x, y=self.get_y(), w=width)
        self.ln(display_height + 4)


def _fmt_inr(value: float) -> str:
    if abs(value) >= 1_00_00_000:
        return f"Rs. {value / 1_00_00_000:,.2f} Cr"
    elif abs(value) >= 1_00_000:
        return f"Rs. {value / 1_00_000:,.2f} L"
    else:
        return f"Rs. {value:,.0f}"


def _fmt_inr_compact(value: float) -> str:
    if abs(value) >= 1_00_00_000:
        return f"₹{value / 1_00_00_000:.1f}Cr"
    if abs(value) >= 1_00_000:
        return f"₹{value / 1_00_000:.1f}L"
    if abs(value) >= 1_000:
        return f"₹{value / 1_000:.0f}K"
    return f"₹{value:.0f}"


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


def _compute_overlap_score(analytics: PortfolioAnalytics) -> float:
    if analytics.overlap_details:
        return sum(detail.total_portfolio_exposure for detail in analytics.overlap_details) * 100
    if analytics.overlap_matrix:
        return sum(
            sum(weight * 100 for weight in fund_weights.values())
            for fund_weights in analytics.overlap_matrix.values()
        ) / len(analytics.overlap_matrix)
    return 0.0


def _humanize_label(value: str) -> str:
    return value.replace("_", " ").title()


def _format_year_month(value: str) -> str:
    if not value:
        return value
    try:
        parsed = datetime.strptime(value, "%Y-%m")
        return parsed.strftime("%b %Y")
    except ValueError:
        return value


def _wrap_text_lines(pdf: FPDF, text: str, width: float) -> list[str]:
    text = _sanitize(text or "")
    if not text:
        return [""]

    lines: list[str] = []
    for paragraph in text.splitlines() or [""]:
        words = paragraph.split()
        if not words:
            lines.append("")
            continue

        current = words[0]
        for word in words[1:]:
            candidate = f"{current} {word}"
            if pdf.get_string_width(candidate) <= width:
                current = candidate
            else:
                lines.append(current)
                current = word
        lines.append(current)
    return lines


def _estimate_health_block_height(pdf: FPDF, label: str, rationale: str, suggestions: list[str]) -> float:
    usable_width = pdf.w - pdf.l_margin - pdf.r_margin
    line_height = 4
    title_height = 6
    padding = 4

    total_lines = len(_wrap_text_lines(pdf, rationale, usable_width))
    for suggestion in suggestions:
        total_lines += len(_wrap_text_lines(pdf, f"- {suggestion}", usable_width))

    return title_height + (total_lines * line_height) + padding


def _ensure_space(pdf: FPDF, required_height: float) -> None:
    if pdf.get_y() + required_height > pdf.page_break_trigger:
        pdf.add_page()


def _fresh_page_capacity(pdf: FPDF) -> float:
    # After a new page, the custom header consumes roughly 28mm before content starts.
    return pdf.page_break_trigger - 28


def _estimate_fire_section_height(pdf: FPDF, at_current_trajectory: str | None) -> float:
    base_height = 68
    if at_current_trajectory:
        usable_width = pdf.w - pdf.l_margin - pdf.r_margin
        base_height += len(_wrap_text_lines(pdf, f"At Current Rate: {at_current_trajectory}", usable_width)) * 5
    return base_height


def _estimate_tax_section_height(pdf: FPDF, missed_deductions: list[str]) -> float:
    base_height = 56
    usable_width = pdf.w - pdf.l_margin - pdf.r_margin
    for deduction in missed_deductions:
        base_height += len(_wrap_text_lines(pdf, f"- {deduction}", usable_width)) * 4
    return base_height + 8


def _shorten_label(value: str, limit: int = 18) -> str:
    if len(value) <= limit:
        return value
    return value[: limit - 3] + "..."


def _save_chart(fig, temp_files: list[str]) -> str:
    handle, path = tempfile.mkstemp(prefix="finsage-report-", suffix=".png")
    os.close(handle)
    fig.savefig(path, format="png", dpi=180, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    temp_files.append(path)
    return path


def _build_allocation_chart(analytics: PortfolioAnalytics, temp_files: list[str]) -> Optional[str]:
    if not analytics.holdings:
        return None

    labels = [_shorten_label(h.fund_name, 22) for h in analytics.holdings]
    values = [h.current_value for h in analytics.holdings]
    colors = ["#4F46E5", "#2563EB", "#10B981", "#F59E0B", "#EF4444", "#7C3AED", "#06B6D4", "#EC4899"]

    fig, ax = plt.subplots(figsize=(8.0, 4.6), facecolor="white")
    wedges, _, autotexts = ax.pie(
        values,
        startangle=90,
        counterclock=False,
        colors=colors[: len(values)],
        wedgeprops=dict(width=0.42, edgecolor="white", linewidth=2),
        autopct=lambda pct: f"{pct:.1f}%" if pct >= 4 else "",
        pctdistance=0.78,
    )
    for autotext in autotexts:
        autotext.set_color("#111827")
        autotext.set_fontsize(9)

    ax.text(
        0,
        0,
        f"Total Value\n{_fmt_inr_compact(analytics.total_current_value)}",
        ha="center",
        va="center",
        fontsize=12,
        fontweight="bold",
        color="#111827",
    )
    ax.legend(
        wedges,
        labels,
        loc="center left",
        bbox_to_anchor=(1.02, 0.5),
        frameon=False,
        fontsize=8,
    )
    ax.set_title("Fund Allocation by Current Value", fontsize=14, fontweight="bold", color="#111827")
    return _save_chart(fig, temp_files)


def _build_xirr_chart(analytics: PortfolioAnalytics, temp_files: list[str]) -> Optional[str]:
    pairs = list(analytics.fund_wise_xirr.items())
    if not pairs:
        pairs = [(h.fund_name, h.xirr) for h in analytics.holdings if h.xirr is not None]
    pairs = [(name, value * 100) for name, value in pairs if value is not None]
    if not pairs:
        return None

    pairs.sort(key=lambda item: item[1])
    labels = [_shorten_label(name, 22) for name, _ in pairs]
    values = [value for _, value in pairs]
    colors = [
        "#10B981" if value >= 15 else "#2563EB" if value >= 10 else "#F59E0B" if value >= 5 else "#EF4444"
        for value in values
    ]

    fig, ax = plt.subplots(figsize=(8.0, 4.8), facecolor="white")
    bars = ax.barh(labels, values, color=colors, edgecolor="none")
    overall = analytics.overall_xirr * 100
    ax.axvline(overall, color="#7C3AED", linestyle="--", linewidth=1.6, label=f"Portfolio: {overall:.1f}%")
    ax.xaxis.set_major_formatter(FuncFormatter(lambda value, _: f"{value:.0f}%"))
    ax.grid(axis="x", color="#E5E7EB", linewidth=0.8)
    ax.set_axisbelow(True)
    ax.set_title("Fund-wise XIRR Comparison", fontsize=14, fontweight="bold", color="#111827")
    ax.set_xlabel("XIRR (%)", fontsize=10, color="#374151")
    ax.tick_params(axis="y", labelsize=9, colors="#111827")
    ax.tick_params(axis="x", labelsize=9, colors="#374151")

    for bar, value in zip(bars, values):
        ax.text(
            bar.get_width() + 0.5,
            bar.get_y() + bar.get_height() / 2,
            f"{value:.1f}%",
            va="center",
            fontsize=8,
            color="#111827",
        )

    ax.legend(frameon=False, fontsize=8, loc="lower right")
    fig.tight_layout()
    return _save_chart(fig, temp_files)


def _build_overlap_chart(analytics: PortfolioAnalytics, temp_files: list[str]) -> Optional[str]:
    if not analytics.overlap_matrix:
        return None

    stocks = list(analytics.overlap_matrix.keys())[:6]
    fund_names = sorted({fund for stock in stocks for fund in analytics.overlap_matrix[stock].keys()})[:6]
    if not stocks or not fund_names:
        return None

    matrix = []
    for stock in stocks:
        row = []
        for fund in fund_names:
            row.append(analytics.overlap_matrix[stock].get(fund, 0.0) * 100)
        matrix.append(row)

    cmap = LinearSegmentedColormap.from_list("finsage_overlap", ["#F3E8FF", "#7C3AED", "#EF4444"])
    fig, ax = plt.subplots(figsize=(8.2, 4.8), facecolor="white")
    heatmap = ax.imshow(matrix, cmap=cmap, aspect="auto")
    ax.set_title("Overlap Heatmap", fontsize=14, fontweight="bold", color="#111827")
    ax.set_xticks(range(len(fund_names)))
    ax.set_xticklabels([_shorten_label(name, 14) for name in fund_names], rotation=25, ha="right", fontsize=8)
    ax.set_yticks(range(len(stocks)))
    ax.set_yticklabels([_shorten_label(name, 18) for name in stocks], fontsize=8)

    for row_index, row in enumerate(matrix):
        for col_index, value in enumerate(row):
            ax.text(
                col_index,
                row_index,
                f"{value:.1f}%",
                ha="center",
                va="center",
                fontsize=8,
                color="white" if value >= 5 else "#111827",
            )

    colorbar = fig.colorbar(heatmap, ax=ax, shrink=0.88)
    colorbar.set_label("Weight %", fontsize=9)
    colorbar.ax.tick_params(labelsize=8)
    fig.tight_layout()
    return _save_chart(fig, temp_files)


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
    if isinstance(analytics, dict):
        analytics = PortfolioAnalytics(**analytics)
    if isinstance(advisory_report, dict):
        advisory_report = AdvisoryReport(**advisory_report)
    if isinstance(final_report, dict):
        final_report = FinalReport(**final_report)

    pdf = FinSageReport()
    temp_files: list[str] = []

    try:
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

            pdf.metric_tiles([
                ("Current Value", _fmt_inr(analytics.total_current_value), (79, 70, 229)),
                ("Total Invested", _fmt_inr(analytics.total_invested), (37, 99, 235)),
                ("Portfolio XIRR", f"{analytics.overall_xirr * 100:.1f}%", (16, 185, 129)),
                ("Overlap Score", f"{_compute_overlap_score(analytics):.1f}%", (220, 38, 38)),
            ])

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
            pdf.cell(58, 6, "Fund Name", border=1, fill=True)
            pdf.cell(27, 6, "Category", border=1, fill=True)
            pdf.cell(30, 6, "Value", border=1, fill=True, align="R")
            pdf.cell(30, 6, "Invested", border=1, fill=True, align="R")
            pdf.cell(20, 6, "XIRR", border=1, fill=True, align="R")
            pdf.cell(20, 6, "ER %", border=1, fill=True, align="R", new_x="LMARGIN", new_y="NEXT")

            pdf.set_font("Helvetica", "", 8)
            for h in analytics.holdings:
                name = h.fund_name[:27] + "..." if len(h.fund_name) > 27 else h.fund_name
                cat = h.category.value.replace("_", " ").title()[:12]
                xirr_str = f"{h.xirr * 100:.1f}%" if h.xirr is not None else "-"
                pdf.cell(58, 5, name, border=1)
                pdf.cell(27, 5, cat, border=1)
                pdf.cell(30, 5, _fmt_inr(h.current_value), border=1, align="R")
                pdf.cell(30, 5, _fmt_inr(h.invested_amount), border=1, align="R")
                pdf.cell(20, 5, xirr_str, border=1, align="R")
                pdf.cell(20, 5, f"{h.expense_ratio * 100:.2f}%", border=1, align="R", new_x="LMARGIN", new_y="NEXT")

            pdf.add_page()
            pdf.section_title("Portfolio Charts")
            allocation_chart = _build_allocation_chart(analytics, temp_files)
            if allocation_chart:
                pdf.chart_image(allocation_chart, "Fund Allocation")

            xirr_chart = _build_xirr_chart(analytics, temp_files)
            if xirr_chart:
                pdf.chart_image(xirr_chart, "Fund-wise XIRR")

            pdf.add_page()
            pdf.section_title("Overlap Snapshot")
            overlap_score = _compute_overlap_score(analytics)
            pdf.key_value("Overlap Score:", f"{overlap_score:.1f}%")
            pdf.key_value("Repeated Stocks:", str(len(analytics.overlap_matrix)))
            if analytics.overlap_details:
                strongest_signal = analytics.overlap_details[0]
                pdf.key_value("Strongest Signal:", strongest_signal.stock_name)
                pdf.body_text(
                    f"{strongest_signal.stock_name} appears across "
                    f"{len(strongest_signal.funds)} funds with "
                    f"{strongest_signal.total_portfolio_exposure * 100:.1f}% weighted exposure."
                )

                pdf.set_font("Helvetica", "B", 9)
                pdf.set_fill_color(245, 245, 250)
                pdf.cell(72, 6, "Stock", border=1, fill=True)
                pdf.cell(45, 6, "Funds", border=1, fill=True, align="R")
                pdf.cell(45, 6, "Portfolio Exposure", border=1, fill=True, align="R", new_x="LMARGIN", new_y="NEXT")
                pdf.set_font("Helvetica", "", 8)

                for detail in analytics.overlap_details[:5]:
                    stock_name = detail.stock_name[:34] + "..." if len(detail.stock_name) > 34 else detail.stock_name
                    pdf.cell(72, 5, _sanitize(stock_name), border=1)
                    pdf.cell(45, 5, str(len(detail.funds)), border=1, align="R")
                    pdf.cell(
                        45,
                        5,
                        f"{detail.total_portfolio_exposure * 100:.1f}%",
                        border=1,
                        align="R",
                        new_x="LMARGIN",
                        new_y="NEXT",
                    )

                overlap_chart = _build_overlap_chart(analytics, temp_files)
                if overlap_chart:
                    pdf.ln(4)
                    pdf.chart_image(overlap_chart, "Overlap Heatmap")
            else:
                pdf.body_text("No overlapping stock positions were detected in the current analytics payload.")

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
            fire_height = _estimate_fire_section_height(pdf, report.fire_plan.at_current_trajectory)
            tax_height = None
            if report.tax_analysis:
                tax_height = _estimate_tax_section_height(pdf, report.tax_analysis.missed_deductions)

            if (
                tax_height is not None
                and fire_height + tax_height <= _fresh_page_capacity(pdf)
                and pdf.get_y() + fire_height + tax_height > pdf.page_break_trigger
            ):
                pdf.add_page()
            else:
                _ensure_space(pdf, fire_height)

            pdf.section_title("FIRE Path Plan")
            fp = report.fire_plan
            pdf.key_value("Target Corpus:", _fmt_inr(fp.target_corpus))
            pdf.key_value("Current Corpus:", _fmt_inr(fp.current_corpus))
            pdf.key_value("Monthly SIP Required:", _fmt_inr(fp.monthly_sip_required))
            pdf.key_value("Years to Retirement:", str(fp.years_to_retirement))
            pdf.key_value("Expected Retirement:", _format_year_month(fp.expected_retirement_date))
            if fp.at_current_trajectory:
                pdf.body_text(f"At Current Rate: {fp.at_current_trajectory}")

        # ── Tax Analysis ──────────────────────────────────────────────────
        if report and report.tax_analysis:
            tax_height = _estimate_tax_section_height(pdf, report.tax_analysis.missed_deductions)
            _ensure_space(pdf, tax_height)
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
                    pdf.set_x(pdf.l_margin)
                    pdf.multi_cell(0, 4, _sanitize(f"- {d}"))
                pdf.ln(2)

        # ── Health Score ──────────────────────────────────────────────────
        if report and report.health_score:
            pdf.add_page()
            pdf.section_title("Money Health Score")

            avg = sum(h.score for h in report.health_score) / len(report.health_score)
            pdf.key_value("Overall Score:", f"{avg:.0f} / 100")
            pdf.ln(3)

            for dim in report.health_score:
                label = _humanize_label(dim.dimension)
                block_height = _estimate_health_block_height(pdf, label, dim.rationale, dim.suggestions)
                remaining_height = pdf.page_break_trigger - pdf.get_y()
                if block_height > remaining_height and remaining_height < 90:
                    pdf.add_page()

                pdf.set_font("Helvetica", "B", 9)
                pdf.cell(0, 6, _sanitize(f"{label}: {dim.score:.0f}/100"), new_x="LMARGIN", new_y="NEXT")
                pdf.set_font("Helvetica", "", 8)
                pdf.set_x(pdf.l_margin)
                pdf.multi_cell(0, 4, _sanitize(dim.rationale))
                if dim.suggestions:
                    for s in dim.suggestions:
                        pdf.set_x(pdf.l_margin)
                        pdf.multi_cell(0, 4, _sanitize(f"- {s}"))
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
    finally:
        for path in temp_files:
            try:
                os.remove(path)
            except OSError:
                pass
