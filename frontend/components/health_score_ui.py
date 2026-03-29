"""
FinSage AI — Health Score UI (Ayush)
======================================
Radar chart for 6-dimension Money Health Score — Stripe-inspired dark theme.
Owner: Ayush
"""

import streamlit as st
import plotly.graph_objects as go
from typing import List
from shared.schemas import HealthScoreDimension


PLOT_BG = "rgba(0,0,0,0)"
PAPER_BG = "rgba(0,0,0,0)"
FONT_COLOR = "#C1C8D4"

DIMENSION_ICONS = {
    "diversification": "🎯", "cost_efficiency": "💸", "tax_efficiency": "🏛️",
    "risk_alignment": "⚖️", "goal_readiness": "🚀", "liquidity": "💧",
}
DIMENSION_LABELS = {
    "diversification": "Diversification", "cost_efficiency": "Cost Efficiency",
    "tax_efficiency": "Tax Efficiency", "risk_alignment": "Risk Alignment",
    "goal_readiness": "Goal Readiness", "liquidity": "Liquidity",
}


def _score_color(score: float) -> str:
    if score >= 75: return "#00D4AA"
    elif score >= 50: return "#FFBB38"
    else: return "#FF5C8A"


def _score_label(score: float) -> str:
    if score >= 90: return "Excellent"
    elif score >= 75: return "Good"
    elif score >= 50: return "Fair"
    elif score >= 25: return "Poor"
    else: return "Critical"


def render_health_radar(health_scores: List[HealthScoreDimension]):
    """Radar/spider chart."""
    categories = [DIMENSION_LABELS.get(h.dimension, h.dimension.replace("_", " ").title()) for h in health_scores]
    scores = [h.score for h in health_scores]

    categories_closed = categories + [categories[0]]
    scores_closed = scores + [scores[0]]

    fig = go.Figure()
    fig.add_trace(go.Scatterpolar(
        r=scores_closed, theta=categories_closed, name="Your Score",
        fill="toself", fillcolor="rgba(99,91,255,0.15)",
        line=dict(color="#635BFF", width=2.5),
        marker=dict(size=7, color="#635BFF", line=dict(color="#fff", width=1)),
        hovertemplate="<b>%{theta}</b><br>Score: %{r}/100<extra></extra>",
    ))
    ref_vals = [75] * (len(categories) + 1)
    fig.add_trace(go.Scatterpolar(
        r=ref_vals, theta=categories_closed, name="Good (75)",
        line=dict(color="rgba(0,212,170,0.25)", width=1, dash="dash"),
        mode="lines", hoverinfo="skip",
    ))

    fig.update_layout(
        polar=dict(
            bgcolor="rgba(0,0,0,0)",
            radialaxis=dict(visible=True, range=[0, 100], gridcolor="rgba(255,255,255,0.05)",
                            tickfont=dict(size=9, color="#555"), linecolor="rgba(255,255,255,0.08)"),
            angularaxis=dict(gridcolor="rgba(255,255,255,0.05)", tickfont=dict(size=11, color="#C1C8D4"),
                             linecolor="rgba(255,255,255,0.08)"),
        ),
        paper_bgcolor=PAPER_BG,
        font=dict(family="Inter, sans-serif", color=FONT_COLOR, size=13),
        margin=dict(l=60, r=60, t=30, b=30),
        showlegend=False, height=420,
    )
    st.plotly_chart(fig, width='stretch')


def render_overall_score(health_scores: List[HealthScoreDimension]):
    """Overall score — large centered metric."""
    if not health_scores:
        return
    avg = sum(h.score for h in health_scores) / len(health_scores)
    color = _score_color(avg)
    label = _score_label(avg)

    st.markdown(
        f"""<div style="text-align:center; padding:20px 0 12px;">
            <div style="display:inline-flex; align-items:center; justify-content:center;
                        background:linear-gradient(135deg, {color}15, {color}05);
                        border:2px solid {color}40; border-radius:50%;
                        width:130px; height:130px; margin:0 auto;">
                <div>
                    <div style="font-size:2.4em; font-weight:800; color:{color}; line-height:1;">{avg:.0f}</div>
                    <div style="font-size:0.8em; color:{color}; font-weight:600; margin-top:2px;">{label}</div>
                </div>
            </div>
            <p style="color:#8A94A6; margin-top:10px; font-size:0.85em;">Overall Money Health Score</p>
        </div>""",
        unsafe_allow_html=True,
    )


def render_dimension_cards(health_scores: List[HealthScoreDimension]):
    """Expandable detail cards per dimension."""
    cols = st.columns(2)
    for i, dim in enumerate(health_scores):
        icon = DIMENSION_ICONS.get(dim.dimension, "📊")
        label = DIMENSION_LABELS.get(dim.dimension, dim.dimension.replace("_", " ").title())
        color = _score_color(dim.score)
        score_label = _score_label(dim.score)

        with cols[i % 2]:
            with st.expander(f"{icon}  {label} — {dim.score:.0f}/100", expanded=False):
                st.markdown(
                    f"""<div style="margin-bottom:10px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                            <span style="color:#8A94A6; font-size:0.85em;">{score_label}</span>
                            <span style="color:{color}; font-weight:600;">{dim.score:.0f}/100</span>
                        </div>
                        <div style="background:rgba(255,255,255,0.04); border-radius:6px; height:6px; overflow:hidden;">
                            <div style="background:linear-gradient(90deg, {color}, {color}88);
                                        width:{dim.score}%; height:100%; border-radius:6px;
                                        transition:width 0.6s ease;"></div>
                        </div>
                    </div>""",
                    unsafe_allow_html=True,
                )
                st.markdown(f"**Why this score?**\n\n{dim.rationale}")
                if dim.suggestions:
                    st.markdown("**💡 Suggestions:**")
                    for s in dim.suggestions:
                        st.markdown(f"- {s}")


def render_health_score(health_scores: List[HealthScoreDimension]):
    """Main health score render."""
    st.markdown(
        """<div class="section-header">
            <h2>🏥 Money Health Score</h2>
            <p>6-dimensional assessment of your financial wellness</p>
        </div>""",
        unsafe_allow_html=True,
    )
    if not health_scores:
        st.warning("Health score not yet generated. Run analysis to see your assessment.")
        return

    render_overall_score(health_scores)
    render_health_radar(health_scores)
    st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)
    render_dimension_cards(health_scores)
