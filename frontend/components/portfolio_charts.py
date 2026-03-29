"""
FinSage AI — Portfolio Charts (Ayush)
=======================================
Plotly-based portfolio visualizations — Stripe-inspired dark fintech theme.
- Donut chart: fund allocation
- Bar chart: fund-wise XIRR comparison
- Heatmap: stock-level overlap
- Summary metric cards
Owner: Ayush
"""

import streamlit as st
import plotly.graph_objects as go
import html as html_mod
from shared.schemas import PortfolioAnalytics

# ── Stripe-Inspired Color Palette ──────────────────────────────────────
COLORS = [
    "#635BFF",  # Stripe primary indigo
    "#00D4AA",  # Teal accent
    "#FF5C8A",  # Pink-coral
    "#FFBB38",  # Amber
    "#0ACF97",  # Emerald
    "#3B82F6",  # Blue
    "#A78BFA",  # Lavender
    "#38BDF8",  # Sky
    "#F472B6",  # Rose
    "#34D399",  # Green
]

PLOT_BG = "rgba(0,0,0,0)"
PAPER_BG = "rgba(0,0,0,0)"
GRID_COLOR = "rgba(255,255,255,0.04)"
FONT_COLOR = "#C1C8D4"

LAYOUT_DEFAULTS = dict(
    paper_bgcolor=PAPER_BG,
    plot_bgcolor=PLOT_BG,
    font=dict(family="Inter, -apple-system, BlinkMacSystemFont, sans-serif", color=FONT_COLOR, size=13),
    margin=dict(l=16, r=16, t=44, b=16),
    hoverlabel=dict(
        bgcolor="#1A1F2E",
        font_size=13,
        font_family="Inter, sans-serif",
        bordercolor="rgba(255,255,255,0.08)",
    ),
)


def _esc(text: str) -> str:
    """HTML-escape dynamic text to prevent '<' and '&' from breaking Streamlit's HTML parser."""
    if not text:
        return ""
    return html_mod.escape(str(text))


def _fmt_inr(value: float) -> str:
    """Format INR with lakhs/crores notation."""
    if abs(value) >= 1_00_00_000:
        return f"₹{value / 1_00_00_000:,.2f} Cr"
    elif abs(value) >= 1_00_000:
        return f"₹{value / 1_00_000:,.2f} L"
    else:
        return f"₹{value:,.0f}"


def render_portfolio_summary(analytics: PortfolioAnalytics):
    """Render KPI metric cards — Stripe-style glassmorphism."""
    gain = analytics.total_current_value - analytics.total_invested
    gain_pct = (gain / analytics.total_invested * 100) if analytics.total_invested else 0

    cols = st.columns(5)
    metrics = [
        ("Portfolio Value", _fmt_inr(analytics.total_current_value), "↗", "+12.4%", "#00D4AA"),
        ("Total Invested", _fmt_inr(analytics.total_invested), "→", "", "#C1C8D4"),
        ("Unrealised Gain", _fmt_inr(gain), "↗" if gain > 0 else "↘", f"{gain_pct:+.1f}%",
         "#00D4AA" if gain > 0 else "#FF5C8A"),
        ("Portfolio XIRR", f"{analytics.overall_xirr * 100:.1f}%", "↗", "annualised", "#635BFF"),
        ("Expense Drag", _fmt_inr(analytics.expense_ratio_drag_inr), "↘", "/year", "#FF5C8A"),
    ]

    for col, (label, value, arrow, delta, color) in zip(cols, metrics):
        with col:
            st.markdown(
                f"""
                <div class="kpi-card">
                    <div class="kpi-label">{label}</div>
                    <div class="kpi-value">{value}</div>
                    <div class="kpi-delta" style="color:{color};">
                        <span>{arrow}</span> {delta}
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )


def render_allocation_pie(analytics: PortfolioAnalytics):
    """Donut chart — fund allocation by current value."""
    names = [h.fund_name for h in analytics.holdings]
    values = [h.current_value for h in analytics.holdings]
    custom_data = [[h.category.value.replace("_", " ").title(), _fmt_inr(h.invested_amount)]
                   for h in analytics.holdings]

    fig = go.Figure(
        data=[
            go.Pie(
                labels=names,
                values=values,
                hole=0.62,
                marker=dict(colors=COLORS[: len(names)], line=dict(color="#0E1117", width=2.5)),
                textinfo="percent",
                textfont=dict(size=11, color="#fff"),
                hovertemplate=(
                    "<b>%{label}</b><br>"
                    "Value: ₹%{value:,.0f}<br>"
                    "Category: %{customdata[0]}<br>"
                    "Invested: %{customdata[1]}<br>"
                    "<extra></extra>"
                ),
                customdata=custom_data,
            )
        ]
    )

    fig.update_layout(
        **LAYOUT_DEFAULTS,
        title=dict(text="Fund Allocation", font=dict(size=15, color="#E8ECF1")),
        showlegend=True,
        legend=dict(
            orientation="v", yanchor="middle", y=0.5, xanchor="left", x=1.02,
            font=dict(size=10, color="#8A94A6"), bgcolor="rgba(0,0,0,0)",
        ),
        height=380,
    )

    fig.add_annotation(
        text=f"<b>{_fmt_inr(analytics.total_current_value)}</b><br>"
             f"<span style='font-size:10px;color:#8A94A6;'>Total Value</span>",
        x=0.5, y=0.5, showarrow=False,
        font=dict(size=15, color="#E8ECF1"),
    )

    st.plotly_chart(fig, width='stretch')


def render_xirr_bar(analytics: PortfolioAnalytics):
    """Horizontal bar — fund-wise XIRR with color-coded performance."""
    if not analytics.fund_wise_xirr:
        st.info("No XIRR data available yet.")
        return

    funds = list(analytics.fund_wise_xirr.keys())
    xirrs = [v * 100 for v in analytics.fund_wise_xirr.values()]

    sorted_pairs = sorted(zip(funds, xirrs), key=lambda x: x[1])
    funds, xirrs = zip(*sorted_pairs) if sorted_pairs else ([], [])

    bar_colors = [
        "#00D4AA" if x >= 15 else "#635BFF" if x >= 10 else "#FFBB38" if x >= 5 else "#FF5C8A"
        for x in xirrs
    ]

    fig = go.Figure(
        data=[
            go.Bar(
                x=list(xirrs), y=list(funds), orientation="h",
                marker=dict(color=bar_colors, line=dict(width=0), cornerradius=6),
                text=[f"{x:.1f}%" for x in xirrs],
                textposition="outside",
                textfont=dict(size=11, color="#C1C8D4"),
                hovertemplate="<b>%{y}</b><br>XIRR: %{x:.1f}%<extra></extra>",
            )
        ]
    )

    overall = analytics.overall_xirr * 100
    fig.add_vline(
        x=overall, line_dash="dash", line_color="#FFBB38", line_width=1.5,
        annotation_text=f"Avg: {overall:.1f}%",
        annotation_font=dict(size=10, color="#FFBB38"),
        annotation_position="top",
    )

    fig.update_layout(
        **LAYOUT_DEFAULTS,
        title=dict(text="Fund-wise XIRR", font=dict(size=15, color="#E8ECF1")),
        xaxis=dict(title="XIRR (%)", gridcolor=GRID_COLOR, zeroline=False, tickfont=dict(size=10)),
        yaxis=dict(tickfont=dict(size=10), automargin=True),
        height=max(300, len(funds) * 52 + 80),
    )

    st.plotly_chart(fig, width='stretch')


def render_overlap_heatmap(analytics: PortfolioAnalytics):
    """Stock overlap heatmap (stocks × funds)."""
    if not analytics.overlap_matrix:
        st.markdown(
            """<div class="insight-card" style="border-left:3px solid #00D4AA;">
                <span style="font-size:1.1em;">✓</span>
                <span style="color:#C1C8D4; margin-left:8px;">No stock overlap detected — good diversification!</span>
            </div>""",
            unsafe_allow_html=True,
        )
        return

    stocks = list(analytics.overlap_matrix.keys())
    fund_set = set()
    for stock_data in analytics.overlap_matrix.values():
        fund_set.update(stock_data.keys())
    funds = sorted(fund_set)

    z = []
    hover_text = []
    for stock in stocks:
        row, h_row = [], []
        for fund in funds:
            weight = analytics.overlap_matrix[stock].get(fund, 0)
            row.append(weight * 100)
            h_row.append(f"{stock} in {fund}: {weight * 100:.1f}%")
        z.append(row)
        hover_text.append(h_row)

    short_funds = [f[:22] + "…" if len(f) > 22 else f for f in funds]

    fig = go.Figure(
        data=go.Heatmap(
            z=z, x=short_funds, y=stocks,
            colorscale=[
                [0, "rgba(99,91,255,0.03)"],
                [0.3, "rgba(99,91,255,0.25)"],
                [0.6, "#635BFF"],
                [1.0, "#FF5C8A"],
            ],
            text=[[f"{v:.1f}%" for v in row] for row in z],
            texttemplate="%{text}",
            textfont=dict(size=11, color="#E8ECF1"),
            hovertext=hover_text,
            hovertemplate="%{hovertext}<extra></extra>",
            colorbar=dict(title=dict(text="Weight %", font=dict(size=10)), tickfont=dict(size=9), len=0.8),
        )
    )

    fig.update_layout(
        **LAYOUT_DEFAULTS,
        title=dict(text="Stock Overlap Across Funds", font=dict(size=15, color="#E8ECF1")),
        xaxis=dict(tickangle=-30, tickfont=dict(size=9), side="bottom"),
        yaxis=dict(tickfont=dict(size=10), automargin=True),
        height=max(320, len(stocks) * 50 + 100),
    )

    st.plotly_chart(fig, width='stretch')


def _hex_to_rgba(hex_color: str, alpha: float) -> str:
    """Convert #RRGGBB to rgba(r,g,b,a)."""
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"rgba({r},{g},{b},{alpha})"


def render_rebalancing_table(rebalancing_plan):
    """Rebalancing actions using Streamlit-native layout — no nested HTML."""
    if not rebalancing_plan:
        st.info("No rebalancing actions to display.")
        return

    ACTION_CONFIG = {
        "hold": ("✓", "#00D4AA", "HOLD"),
        "exit": ("✕", "#FF5C8A", "EXIT"),
        "reduce": ("↓", "#FFBB38", "REDUCE"),
        "increase": ("↑", "#0ACF97", "INCREASE"),
        "switch": ("⇄", "#635BFF", "SWITCH"),
    }

    for action in rebalancing_plan:
        action_val = action.action.value if hasattr(action.action, 'value') else action.action
        icon, color, label = ACTION_CONFIG.get(action_val, ("•", "#8A94A6", action_val.upper()))
        bg_rgba = _hex_to_rgba(color, 0.07)
        badge_bg = _hex_to_rgba(color, 0.1)
        badge_border = _hex_to_rgba(color, 0.2)

        # Use st.container for each card
        with st.container():
            # Card header: icon + name + badge + amount
            col_main, col_right = st.columns([5, 1])
            with col_main:
                st.markdown(
                    f'<span style="display:inline-block;width:32px;height:32px;border-radius:8px;'
                    f'background:{bg_rgba};color:{color};text-align:center;line-height:32px;'
                    f'font-weight:700;font-size:1em;margin-right:8px;vertical-align:middle;">{icon}</span>'
                    f'<span style="color:var(--text-primary);font-weight:600;font-size:0.95em;vertical-align:middle;">{_esc(action.fund_name)}</span> '
                    f'<span style="background:{badge_bg};color:{color};border:1px solid {badge_border};'
                    f'padding:2px 10px;border-radius:20px;font-size:0.7em;font-weight:700;'
                    f'letter-spacing:0.5px;vertical-align:middle;">{label}</span>',
                    unsafe_allow_html=True,
                )
            with col_right:
                if action.amount_inr:
                    st.markdown(f'<p style="color:{color};font-weight:700;font-size:1.1em;text-align:right;margin:0;">₹{action.amount_inr:,.0f}</p>', unsafe_allow_html=True)
                elif action.percentage:
                    st.markdown(f'<p style="color:{color};font-weight:700;font-size:1.1em;text-align:right;margin:0;">{action.percentage}%</p>', unsafe_allow_html=True)
                st.markdown(f'<p style="color:var(--text-muted);font-size:0.72em;text-align:right;margin:0;opacity:0.6;">Priority: P{action.priority}</p>', unsafe_allow_html=True)

            # Rationale
            st.markdown(f'<p style="color:var(--text-muted);font-size:0.85em;line-height:1.6;margin:4px 0 4px 40px;">{_esc(action.rationale)}</p>', unsafe_allow_html=True)

            # Target fund
            if action.target_fund:
                st.markdown(f'<p style="color:var(--text-muted);font-size:0.82em;margin:2px 0 2px 40px;">➜ Switch to: <strong style="color:var(--text-primary);">{_esc(action.target_fund)}</strong></p>', unsafe_allow_html=True)

            # Tax impact
            if action.tax_impact:
                st.markdown(f'<p style="color:var(--text-muted);font-size:0.8em;margin:2px 0 2px 40px;">💰 {_esc(action.tax_impact)}</p>', unsafe_allow_html=True)

            st.markdown('<hr style="border:none;border-top:1px solid var(--card-border);margin:12px 0;">', unsafe_allow_html=True)

