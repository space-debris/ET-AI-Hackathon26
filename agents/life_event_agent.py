"""
Life Event Advisor chat agent with lightweight local RAG over bundled and
uploaded Form 16 knowledge.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
import re
from typing import Any, Dict, List

from shared import config
from shared.schemas import UserFinancialProfile


STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "before", "by", "can", "do",
    "for", "from", "how", "i", "if", "in", "into", "is", "it", "me", "my",
    "of", "on", "or", "should", "that", "the", "this", "to", "what", "when",
    "with", "your",
}

FORM16_FACTS = {
    "gross_salary": 2400000,
    "base_salary": 1800000,
    "hra_received": 360000,
    "other_allowances": 240000,
    "standard_deduction": 75000,
    "section_80c": 150000,
    "nps_contribution": 50000,
    "home_loan_interest": 40000,
    "medical_insurance_premium": 0,
    "tds": 292500,
}

EVENT_RULES = {
    "bonus": {
        "label": "Bonus",
        "reserve_months": 6,
        "tax_reserve_pct": 0.30,
        "doc_check": "Confirm whether the bonus is already reflected in payroll income or the latest payslip before treating it as fully post-tax cash.",
    },
    "inheritance": {
        "label": "Inheritance",
        "reserve_months": 9,
        "tax_reserve_pct": 0.05,
        "doc_check": "Inheritance is not usually a Form 16 item, so focus on ownership documents, nominee updates, and staged deployment instead of payroll tax alone.",
    },
    "marriage": {
        "label": "Marriage",
        "reserve_months": 9,
        "tax_reserve_pct": 0.08,
        "doc_check": "Review health cover, nominee details, and how both partners will use remaining tax headroom before raising fixed commitments.",
    },
    "new_baby": {
        "label": "New Baby",
        "reserve_months": 12,
        "tax_reserve_pct": 0.05,
        "doc_check": "Recheck family floater coverage, term cover, and the higher monthly burn before locking money into long-horizon products.",
    },
    "job_switch": {
        "label": "Job Switch",
        "reserve_months": 9,
        "tax_reserve_pct": 0.10,
        "doc_check": "Reconcile previous-employer income, both Form 16 documents, Form 12B, and total TDS before deploying joining bonus or full-and-final cash.",
    },
}


@dataclass(frozen=True)
class KnowledgeChunk:
    chunk_id: str
    title: str
    section: str
    content: str
    source_path: str
    tokens: frozenset[str]


def _tokenize(text: str) -> frozenset[str]:
    tokens = {
        token
        for token in re.findall(r"[a-zA-Z0-9]+", (text or "").lower())
        if len(token) > 2 and token not in STOPWORDS
    }
    return frozenset(tokens)


def _compact_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _format_inr(value: float) -> str:
    number = str(int(round(max(value, 0.0))))
    if len(number) <= 3:
        return f"₹{number}"

    last_three = number[-3:]
    rest = number[:-3]
    groups: list[str] = []
    while len(rest) > 2:
        groups.insert(0, rest[-2:])
        rest = rest[:-2]
    if rest:
        groups.insert(0, rest)
    return f"₹{','.join(groups + [last_three])}"


def _facts_from_context(uploaded_context: Dict[str, Any] | None) -> Dict[str, float]:
    if not uploaded_context:
        return FORM16_FACTS

    facts = {
        **FORM16_FACTS,
        **(uploaded_context.get("facts") or {}),
    }
    if not facts.get("gross_salary"):
        facts["gross_salary"] = (
            facts.get("base_salary", 0)
            + facts.get("hra_received", 0)
            + facts.get("other_allowances", 0)
        )
    if not facts.get("other_allowances") and facts.get("gross_salary"):
        facts["other_allowances"] = max(
            facts["gross_salary"] - facts.get("base_salary", 0) - facts.get("hra_received", 0),
            0,
        )
    return facts


def _uploaded_chunks(uploaded_context: Dict[str, Any] | None) -> List[KnowledgeChunk]:
    if not uploaded_context:
        return []

    chunks: list[KnowledgeChunk] = []
    for index, item in enumerate(uploaded_context.get("knowledge_chunks") or []):
        title = item.get("title") or uploaded_context.get("document_label") or "Uploaded Form 16"
        section = item.get("section") or f"Uploaded Section {index + 1}"
        content = _compact_whitespace(item.get("content") or item.get("excerpt") or "")
        if not content:
            continue
        chunks.append(
            KnowledgeChunk(
                chunk_id=item.get("chunk_id") or f"uploaded-{index}",
                title=title,
                section=section,
                content=content,
                source_path=item.get("source_path") or "session/form16/upload",
                tokens=_tokenize(f"{title} {section} {content}"),
            )
        )
    return chunks


def _scenario_value(payload: Dict[str, Any], *keys: str, default: float = 0.0) -> float:
    for key in keys:
        if key in payload and payload[key] is not None:
            try:
                return max(float(payload[key]), 0.0)
            except (TypeError, ValueError):
                continue
    return default


def _scenario_text(payload: Dict[str, Any], *keys: str, default: str = "") -> str:
    for key in keys:
        value = payload.get(key)
        if value:
            return str(value)
    return default


@lru_cache(maxsize=1)
def _load_knowledge_chunks() -> tuple[KnowledgeChunk, ...]:
    docs_dir = Path(config.FORM16_KNOWLEDGE_DIR)
    chunks: list[KnowledgeChunk] = []

    if not docs_dir.exists():
        return tuple()

    for path in sorted(docs_dir.glob("*.md")) + sorted(docs_dir.glob("*.txt")):
        title = path.stem.replace("_", " ").title()
        section = "Overview"
        section_lines: list[str] = []
        chunk_index = 0

        def flush() -> None:
            nonlocal chunk_index
            text = _compact_whitespace("\n".join(section_lines))
            if not text:
                return
            chunks.append(
                KnowledgeChunk(
                    chunk_id=f"{path.stem}-{chunk_index}",
                    title=title,
                    section=section,
                    content=text,
                    source_path=str(path.relative_to(config.PROJECT_ROOT)),
                    tokens=_tokenize(f"{title} {section} {text}"),
                )
            )
            chunk_index += 1

        for raw_line in path.read_text(encoding="utf-8").splitlines():
            line = raw_line.rstrip()
            if line.startswith("# "):
                flush()
                section_lines = []
                title = line[2:].strip()
                section = "Overview"
                continue
            if line.startswith("## "):
                flush()
                section_lines = []
                section = line[3:].strip()
                continue
            if not line.strip():
                flush()
                section_lines = []
                continue
            section_lines.append(line)

        flush()

    return tuple(chunks)


class LifeEventAdvisorAgent:
    """Retrieval-backed life-event chat agent grounded in bundled or uploaded docs."""

    def retrieve(
        self,
        question: str,
        profile: UserFinancialProfile,
        scenario: Dict[str, Any],
        uploaded_context: Dict[str, Any] | None = None,
    ) -> List[Dict[str, Any]]:
        event_type = _scenario_text(scenario, "event_type", "eventType", default="bonus")
        extra_terms = [
            event_type.replace("_", " "),
            "form 16",
            "salary",
            "tds",
            "hra" if profile.hra_received else "",
            "80c" if profile.section_80c else "",
            "nps" if profile.nps_contribution else "",
            "job switch" if event_type == "job_switch" else "",
            "bonus" if event_type == "bonus" else "",
        ]
        query = _compact_whitespace(" ".join([question, *extra_terms]))
        query_tokens = _tokenize(query)
        lower_query = query.lower()

        knowledge_pool = [*_uploaded_chunks(uploaded_context), *_load_knowledge_chunks()]
        scored_chunks: list[tuple[float, KnowledgeChunk]] = []
        for chunk in knowledge_pool:
            overlap = len(query_tokens & chunk.tokens)
            score = float(overlap * 4)
            lower_content = chunk.content.lower()
            lower_section = chunk.section.lower()

            for phrase in (
                "form 16",
                "bonus",
                "job switch",
                "hra",
                "80c",
                "nps",
                "home-loan",
                "medical insurance",
                "marriage",
                "new baby",
                "inheritance",
                "tds",
            ):
                if phrase in lower_query and (phrase in lower_content or phrase in lower_section):
                    score += 6

            if "salary" in lower_query and "part b" in lower_section:
                score += 4
            if event_type.replace("_", " ") in lower_content:
                score += 3
            if "sample form 16" in chunk.title.lower():
                score += 1

            if score > 0:
                scored_chunks.append((score, chunk))

        if not scored_chunks:
            fallback = knowledge_pool[: min(config.RAG_TOP_K, 3)]
            return [
                {
                    "title": chunk.title,
                    "section": chunk.section,
                    "excerpt": chunk.content[:240],
                    "source_path": chunk.source_path,
                    "score": 0.0,
                }
                for chunk in fallback
            ]

        scored_chunks.sort(key=lambda item: item[0], reverse=True)
        top_chunks = scored_chunks[: config.RAG_TOP_K]
        return [
            {
                "title": chunk.title,
                "section": chunk.section,
                "excerpt": chunk.content[:240],
                "source_path": chunk.source_path,
                "score": round(score, 1),
            }
            for score, chunk in top_chunks
        ]

    def _build_metrics(self, profile: UserFinancialProfile, scenario: Dict[str, Any]) -> Dict[str, Any]:
        event_type = _scenario_text(scenario, "event_type", "eventType", default="bonus")
        rules = EVENT_RULES.get(event_type, EVENT_RULES["bonus"])
        event_amount = _scenario_value(scenario, "event_amount", "eventAmount")
        current_reserve = _scenario_value(scenario, "current_reserve", "currentReserve")
        debt = _scenario_value(scenario, "high_interest_debt", "highInterestDebt")
        monthly_cost_change = _scenario_value(scenario, "monthly_cost_change", "monthlyCostChange")
        months_until_event = int(_scenario_value(scenario, "months_until_event", "monthsUntilEvent", default=1))
        adjusted_burn = profile.monthly_expenses + monthly_cost_change
        reserve_target = adjusted_burn * rules["reserve_months"]
        reserve_shortfall = max(reserve_target - current_reserve, 0.0)
        tax_reserve = event_amount * rules["tax_reserve_pct"]
        deployable = max(event_amount - tax_reserve, 0.0)
        debt_reset = min(debt, deployable * 0.2)
        investable_after_safety = max(deployable - min(reserve_shortfall, deployable) - debt_reset, 0.0)

        return {
            "event_type": event_type,
            "event_label": rules["label"],
            "doc_check": rules["doc_check"],
            "event_amount": event_amount,
            "current_reserve": current_reserve,
            "reserve_target": reserve_target,
            "reserve_shortfall": reserve_shortfall,
            "tax_reserve": tax_reserve,
            "deployable": deployable,
            "debt": debt,
            "debt_reset": debt_reset,
            "investable_after_safety": investable_after_safety,
            "months_until_event": months_until_event,
        }

    def _build_answer(
        self,
        question: str,
        profile: UserFinancialProfile,
        metrics: Dict[str, Any],
        sources: List[Dict[str, Any]],
        uploaded_context: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        lower_question = question.lower()
        source_sections = ", ".join(
            f"{item['title']} - {item['section']}" for item in sources[:2]
        )
        facts = _facts_from_context(uploaded_context)
        document_label = (
            uploaded_context.get("document_label")
            if uploaded_context
            else "The bundled sample Form 16"
        )

        if facts.get("gross_salary", 0) > 0:
            salary_line = (
                f"{document_label} shows gross salary of {_format_inr(facts['gross_salary'])}, "
                f"made up of basic salary {_format_inr(facts.get('base_salary', 0))}, "
                f"HRA {_format_inr(facts.get('hra_received', 0))}, and other taxable allowances "
                f"of {_format_inr(facts.get('other_allowances', 0))}."
            )
        else:
            salary_line = (
                f"{document_label} provides salary context, but the gross salary line was not cleanly extracted. "
                "Verify the Part B salary summary manually before acting."
            )

        deduction_parts = []
        if facts.get("section_80c", 0) > 0:
            deduction_parts.append(f"80C of {_format_inr(facts['section_80c'])}")
        if facts.get("nps_contribution", 0) > 0:
            deduction_parts.append(f"NPS of {_format_inr(facts['nps_contribution'])}")
        if facts.get("home_loan_interest", 0) > 0:
            deduction_parts.append(
                f"home-loan interest of {_format_inr(facts['home_loan_interest'])}"
            )
        if facts.get("medical_insurance_premium", 0) > 0:
            deduction_parts.append(
                f"medical insurance of {_format_inr(facts['medical_insurance_premium'])}"
            )
        if facts.get("tds", 0) > 0:
            deduction_parts.append(f"TDS of {_format_inr(facts['tds'])}")

        deduction_line = (
            f"It reflects {', '.join(deduction_parts)}."
            if deduction_parts
            else "No clean deduction lines were extracted, so verify 80C, NPS, 80D, home-loan interest, and TDS manually."
        )

        if "job" in lower_question or metrics["event_type"] == "job_switch":
            action_line = (
                f"Before deploying any joining bonus or full-and-final payout, reconcile both employers' "
                f"salary records and total TDS. Keep at least {_format_inr(metrics['tax_reserve'])} as a tax "
                f"and transition buffer, and close the reserve gap of {_format_inr(metrics['reserve_shortfall'])} first."
            )
        elif "inherit" in lower_question or metrics["event_type"] == "inheritance":
            action_line = (
                f"Inheritance is not usually captured in Form 16, so the safer move is to treat it as separate family capital. "
                f"Keep about {_format_inr(metrics['tax_reserve'])} aside for paperwork and friction costs, then top up the "
                f"reserve gap of {_format_inr(metrics['reserve_shortfall'])} before staged investing."
            )
        else:
            action_line = (
                f"For this {metrics['event_label'].lower()} scenario, ring-fence about {_format_inr(metrics['tax_reserve'])} first. "
                f"Your reserve target is {_format_inr(metrics['reserve_target'])}, with a current shortfall of "
                f"{_format_inr(metrics['reserve_shortfall'])}. After safety and debt reset, roughly "
                f"{_format_inr(metrics['investable_after_safety'])} can move toward long-term goals."
            )

        verify_lines = [metrics["doc_check"]]
        if profile.hra_received and (profile.rent_paid or 0) <= 0:
            verify_lines.append(
                "Your current profile shows HRA is received but rent proof is not flowing into the claim, so review whether HRA exemption is still being missed."
            )
        if (profile.home_loan_interest or 0) < config.SECTION_24_LIMIT:
            verify_lines.append(
                "Review whether the full eligible home-loan interest has been declared before the year closes."
            )
        if (profile.medical_insurance_premium or 0) <= 0:
            verify_lines.append(
                "If a health premium exists outside payroll, it may still need to be claimed separately under Section 80D."
            )

        answer = (
            "What the document shows:\n"
            f"- {salary_line}\n"
            f"- {deduction_line}\n\n"
            "What to do now:\n"
            f"- {action_line}\n\n"
            "What to verify:\n"
            + "\n".join(f"- {line}" for line in verify_lines)
        )

        if source_sections:
            answer += f"\n\nGrounded in: {source_sections}."

        highlights = [
            salary_line,
            action_line,
            verify_lines[0],
        ]

        return {
            "answer": answer,
            "highlights": highlights,
        }

    def chat(
        self,
        question: str,
        profile: UserFinancialProfile,
        scenario: Dict[str, Any] | None = None,
        uploaded_context: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        scenario = scenario or {}
        sources = self.retrieve(question, profile, scenario, uploaded_context=uploaded_context)
        metrics = self._build_metrics(profile, scenario)
        response = self._build_answer(
            question,
            profile,
            metrics,
            sources,
            uploaded_context=uploaded_context,
        )

        return {
            **response,
            "sources": sources,
            "retrieved_chunks": len(sources),
            "knowledge_label": (
                uploaded_context.get("knowledge_label")
                if uploaded_context
                else "Bundled sample Form 16 FY 2025-26 + life event playbook"
            ),
            "event_label": metrics["event_label"],
            "metrics": {
                "reserve_target": round(metrics["reserve_target"], 2),
                "reserve_shortfall": round(metrics["reserve_shortfall"], 2),
                "tax_reserve": round(metrics["tax_reserve"], 2),
                "investable_after_safety": round(metrics["investable_after_safety"], 2),
            },
        }
