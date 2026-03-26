"""
FinSage AI — FIRE Planner UI (Ayush)
=======================================
FIRE planning form with dynamic slider updates + timeline visualization.
Stripe-inspired dark fintech theme.
Owner: Ayush
"""

import streamlit as st
import plotly.graph_objects as go
from shared.schemas import FIREPlan, UserFinancialProfile


PLOT_BG = "rgba(0,0,0,0)"
PAPER_BG = "rgba(0,0,0,0)"
GRID_COLOR = "rgba(255,255,255,0.04)"
FONT_COLOR = "#C1C8D4"

LAYOUT_DEFAULTS = dict(
    paper_bgcolor=PAPER_BG,
    plot_bgcolor=PLOT_BG,
    font=dict(family="Inter, -apple-system, sans-serif", color=FONT_COLOR, size=13),
    margin=dict(l=16, r=16, t=44, b=16),
    hoverlabel=dict(bgcolor="#1A1F2E", font_size=13, font_family="Inter, sans-serif", bordercolor="rgba(255,255,255,0.08)"),
)


def _fmt_inr(value: float) -> str:
    if abs(value) >= 1_00_00_000:
        return f"₹{value / 1_00_00_000:,.2f} Cr"
    elif abs(value) >= 1_00_000:
        return f"₹{value / 1_00_000:,.2f} L"
    else:
        return f"₹{value:,.0f}"


def render_fire_summary(fire_plan: FIREPlan):
    """FIRE plan KPI cards."""
    cols = st.columns(4)
    metrics = [
        ("🎯 Target Corpus", _fmt_inr(fire_plan.target_corpus), "#635BFF"),
        ("💰 Current Corpus", _fmt_inr(fire_plan.current_corpus), "#00D4AA"),
        ("📈 Monthly SIP", _fmt_inr(fire_plan.monthly_sip_required), "#FFBB38"),
        ("📅 Years Left", f"{fire_plan.years_to_retirement} yrs", "#3B82F6"),
    ]
    for col, (label, value, color) in zip(cols, metrics):
        with col:
            st.markdown(
                f"""<div class="kpi-card">
                    <div class="kpi-label">{label}</div>
                    <div class="kpi-value" style="color:{color};">{value}</div>
                </div>""",
                unsafe_allow_html=True,
            )


def render_fire_timeline(fire_plan: FIREPlan):
    """Stacked area chart of SIP allocation + corpus growth."""
    if not fire_plan.milestones:
        st.info("No FIRE milestones data available.")
        return

    milestones = fire_plan.milestones
    periods = [f"{m.month:02d}/{m.year}" for m in milestones]
    step = max(1, len(milestones) // 40)
    sampled_idx = list(range(0, len(milestones), step))
    if sampled_idx[-1] != len(milestones) - 1:
        sampled_idx.append(len(milestones) - 1)

    s_periods = [periods[i] for i in sampled_idx]
    s_equity = [milestones[i].equity_sip for i in sampled_idx]
    s_debt = [milestones[i].debt_sip for i in sampled_idx]
    s_gold = [milestones[i].gold_sip for i in sampled_idx]
    s_corpus = [milestones[i].projected_corpus for i in sampled_idx]

    # Stacked area
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=s_periods, y=s_equity, name="Equity SIP", fill="tozeroy", mode="lines",
        line=dict(color="#635BFF", width=0), fillcolor="rgba(99,91,255,0.35)",
        hovertemplate="Equity: ₹%{y:,.0f}<extra></extra>",
    ))
    fig.add_trace(go.Scatter(
        x=s_periods, y=[e + d for e, d in zip(s_equity, s_debt)],
        name="Debt SIP", fill="tonexty", mode="lines",
        line=dict(color="#00D4AA", width=0), fillcolor="rgba(0,212,170,0.35)",
        hovertemplate="Debt: ₹%{y:,.0f}<extra></extra>",
    ))
    fig.add_trace(go.Scatter(
        x=s_periods, y=[e + d + g for e, d, g in zip(s_equity, s_debt, s_gold)],
        name="Gold SIP", fill="tonexty", mode="lines",
        line=dict(color="#FFBB38", width=0), fillcolor="rgba(255,187,56,0.25)",
        hovertemplate="Gold: ₹%{y:,.0f}<extra></extra>",
    ))
    fig.update_layout(
        **LAYOUT_DEFAULTS,
        title=dict(text="SIP Allocation Glidepath", font=dict(size=15, color="#E8ECF1")),
        xaxis=dict(gridcolor=GRID_COLOR, tickangle=-45, tickfont=dict(size=9), nticks=15),
        yaxis=dict(title="SIP (₹)", gridcolor=GRID_COLOR, tickfont=dict(size=9)),
        legend=dict(orientation="h", yanchor="bottom", y=1.03, xanchor="center", x=0.5, font=dict(size=10)),
        height=370,
    )
    st.plotly_chart(fig, width='stretch')

    # Corpus growth
    fig2 = go.Figure()
    fig2.add_trace(go.Scatter(
        x=s_periods, y=s_corpus, name="Projected Corpus", mode="lines",
        line=dict(color="#635BFF", width=2.5, shape="spline"),
        fill="tozeroy", fillcolor="rgba(99,91,255,0.08)",
        hovertemplate="Corpus: ₹%{y:,.0f}<extra></extra>",
    ))
    fig2.add_hline(
        y=fire_plan.target_corpus, line_dash="dash", line_color="#FF5C8A", line_width=1.5,
        annotation_text=f"Target: {_fmt_inr(fire_plan.target_corpus)}",
        annotation_font=dict(size=10, color="#FF5C8A"), annotation_position="top left",
    )
    fig2.update_layout(
        **LAYOUT_DEFAULTS,
        title=dict(text="Corpus Growth Projection", font=dict(size=15, color="#E8ECF1")),
        xaxis=dict(gridcolor=GRID_COLOR, tickangle=-45, tickfont=dict(size=9), nticks=15),
        yaxis=dict(title="Corpus (₹)", gridcolor=GRID_COLOR, tickfont=dict(size=9)),
        height=350,
    )
    st.plotly_chart(fig2, width='stretch')


def render_fire_assumptions(fire_plan: FIREPlan):
    """Assumptions + insurance gap."""
    if fire_plan.assumptions:
        with st.expander("📐 Assumptions", expanded=False):
            cols = st.columns(3)
            for i, (key, val) in enumerate(fire_plan.assumptions.items()):
                label = key.replace("_", " ").title()
                display = f"{val * 100:.1f}%" if isinstance(val, float) and val < 1 else str(val)
                with cols[i % 3]:
                    st.markdown(f"<div class='chip'><span style='color:#8A94A6;'>{label}:</span> {display}</div>",
                                unsafe_allow_html=True)

    if fire_plan.insurance_gap:
        with st.expander("🛡️ Insurance Gap", expanded=False):
            for key, val in fire_plan.insurance_gap.items():
                st.markdown(f"- **{key.replace('_', ' ').title()}**: {val}")

    if fire_plan.at_current_trajectory:
        st.markdown(
            f"""<div class="insight-card" style="border-left:3px solid #FFBB38;">
                <span style="font-size:1.1em;">⏳</span>
                <span style="color:#C1C8D4; margin-left:8px;">At current rate: <strong style="color:#FFBB38;">{fire_plan.at_current_trajectory}</strong></span>
            </div>""",
            unsafe_allow_html=True,
        )


def _render_allocation_snapshot(title: str, milestone):
    """Mini donut for glidepath snapshot."""
    labels = ["Equity", "Debt", "Gold"]
    values = [milestone.equity_pct, milestone.debt_pct, milestone.gold_pct]
    colors = ["#635BFF", "#00D4AA", "#FFBB38"]

    fig = go.Figure(data=[go.Pie(
        labels=labels, values=values, hole=0.65,
        marker=dict(colors=colors, line=dict(color="#0E1117", width=2.5)),
        textinfo="percent", textfont=dict(size=10, color="#fff"),
        hovertemplate="<b>%{label}</b>: %{value:.0f}%<extra></extra>",
    )])
    fig.update_layout(
        paper_bgcolor=PAPER_BG, plot_bgcolor=PLOT_BG,
        font=dict(family="Inter, sans-serif", color=FONT_COLOR, size=11),
        margin=dict(l=8, r=8, t=32, b=8),
        title=dict(text=title, font=dict(size=13, color="#E8ECF1")),
        showlegend=False, height=200,
    )
    fig.add_annotation(
        text=f"<b>{milestone.equity_pct:.0f}%</b><br><span style='font-size:9px;'>Equity</span>",
        x=0.5, y=0.5, showarrow=False, font=dict(size=13, color="#635BFF"),
    )
    st.plotly_chart(fig, width='stretch')


def render_fire_planner(fire_plan: FIREPlan, user_profile: UserFinancialProfile = None):
    """Main FIRE planner render."""
    st.markdown(
        """<div class="section-header">
            <h2>🔥 FIRE Path Planner</h2>
            <p>Your month-by-month roadmap to Financial Independence</p>
        </div>""",
        unsafe_allow_html=True,
    )
    if fire_plan is None:
        st.warning("FIRE plan not yet generated. Fill in your profile and run analysis.")
        return

    render_fire_summary(fire_plan)
    st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)

    if fire_plan.milestones:
        col1, col2 = st.columns(2)
        with col1:
            _render_allocation_snapshot("Current Allocation", fire_plan.milestones[0])
        with col2:
            _render_allocation_snapshot("At Retirement", fire_plan.milestones[-1])

    render_fire_timeline(fire_plan)
    render_fire_assumptions(fire_plan)
