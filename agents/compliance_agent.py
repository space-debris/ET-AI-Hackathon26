"""
FinSage AI — Compliance Agent (Mayur)
=======================================
Rule-based compliance scanning agent (no LLM needed — faster, deterministic).

Responsibilities:
1. Scan advisory report for banned/absolute phrases
2. Soften inappropriate language while preserving recommendations
3. Add SEBI/AMFI disclaimers to all output sections
4. Flag but NOT remove problematic items — transparency is key

Design:
- Pure Python — regex-based scanning, no LLM costs or latency
- Deterministic output — same input always gives same compliance result
- Non-destructive — flagged items are marked, not deleted

Dependencies: shared/schemas.py, shared/config.py
"""

import re
import logging
from datetime import datetime
from typing import List, Tuple, Dict, Any

from shared import config
from shared.schemas import (
    AdvisoryReport,
    FinalReport,
    RebalancingAction,
    HealthScoreDimension,
    PipelineState,
)

logger = logging.getLogger(__name__)


class ComplianceAgent:
    """
    Agent 4: Rule-based regulatory compliance scanner.

    Scans advisory output for:
    - Banned phrases (guaranteed returns, risk-free, etc.)
    - Absolute language that implies financial advice certainty
    - Missing disclaimers

    Softens language where needed and adds SEBI disclaimers.
    All flagged items are logged for audit trail transparency.

    Owner: Mayur
    """

    # Compile regex patterns once at class level for performance
    BANNED_PATTERNS = [
        re.compile(re.escape(phrase), re.IGNORECASE)
        for phrase in config.BANNED_PHRASES
    ]

    # Additional regex patterns for absolute language
    ABSOLUTE_PATTERNS = [
        (re.compile(r"\byou\s+should\b", re.IGNORECASE), "you may consider"),
        (re.compile(r"\byou\s+must\b", re.IGNORECASE), "it may be worth exploring"),
        (re.compile(r"\bdefinitely\b", re.IGNORECASE), "potentially"),
        (re.compile(r"\balways\b", re.IGNORECASE), "generally"),
        (re.compile(r"\bnever\b", re.IGNORECASE), "rarely"),
        (re.compile(r"\bbest\s+investment\b", re.IGNORECASE), "a potentially suitable option"),
        (re.compile(r"\bworst\s+investment\b", re.IGNORECASE), "a potentially less suitable option"),
        (re.compile(r"\bguaranteed\b", re.IGNORECASE), "historically observed"),
        (re.compile(r"\bwill\s+certainly\b", re.IGNORECASE), "may potentially"),
        (re.compile(r"\bwill\s+definitely\b", re.IGNORECASE), "could potentially"),
        (re.compile(r"\bno\s+doubt\b", re.IGNORECASE), "with reasonable confidence"),
        (re.compile(r"\brisk[\s-]*free\b", re.IGNORECASE), "relatively lower-risk"),
    ]

    def __init__(self):
        self.compliance_log: List[str] = []

    def _log(self, message: str):
        """Add to compliance audit log."""
        timestamp = datetime.now().strftime("%H:%M:%S")
        entry = f"[{timestamp}] {message}"
        self.compliance_log.append(entry)
        logger.info(f"Compliance: {message}")

    # =========================================================================
    # Text Scanning
    # =========================================================================

    def _scan_text(self, text: str, source: str) -> Tuple[List[str], str]:
        """
        Scan a text for banned phrases and absolute language.

        Args:
            text: The text to scan
            source: Description of where this text came from (for logging)

        Returns:
            (flagged_items, softened_text)
        """
        flagged = []
        cleaned = text

        # 1. Check for banned phrases
        for pattern in self.BANNED_PATTERNS:
            matches = pattern.findall(cleaned)
            for match in matches:
                flag = f"BANNED PHRASE in {source}: \"{match}\""
                flagged.append(flag)
                self._log(flag)

        # 2. Soften absolute language
        for pattern, replacement in self.ABSOLUTE_PATTERNS:
            matches = pattern.findall(cleaned)
            if matches:
                for match in matches:
                    flag = f"SOFTENED in {source}: \"{match}\" → \"{replacement}\""
                    flagged.append(flag)
                    self._log(flag)
                cleaned = pattern.sub(replacement, cleaned)

        return flagged, cleaned

    def _scan_string_fields(
        self, obj: Any, path: str = ""
    ) -> Tuple[List[str], Dict[str, str]]:
        """
        Recursively scan all string fields in a Pydantic model or dict.

        Returns:
            (flagged_items, {field_path: cleaned_text})
        """
        all_flagged = []
        replacements = {}

        if isinstance(obj, str):
            flagged, cleaned = self._scan_text(obj, path)
            all_flagged.extend(flagged)
            if cleaned != obj:
                replacements[path] = cleaned
        elif isinstance(obj, dict):
            for key, value in obj.items():
                child_flagged, child_replacements = self._scan_string_fields(
                    value, f"{path}.{key}" if path else key
                )
                all_flagged.extend(child_flagged)
                replacements.update(child_replacements)
        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                child_flagged, child_replacements = self._scan_string_fields(
                    item, f"{path}[{i}]"
                )
                all_flagged.extend(child_flagged)
                replacements.update(child_replacements)
        elif hasattr(obj, "model_dump"):
            # Pydantic model
            data = obj.model_dump()
            child_flagged, child_replacements = self._scan_string_fields(data, path)
            all_flagged.extend(child_flagged)
            replacements.update(child_replacements)

        return all_flagged, replacements

    # =========================================================================
    # Report Scanning
    # =========================================================================

    def scan_and_flag(
        self, report: AdvisoryReport
    ) -> Tuple[List[str], AdvisoryReport]:
        """
        Scan an advisory report for compliance issues.

        Softens language in-place and returns list of flagged items.
        Does NOT remove content — only softens and flags.

        Args:
            report: The advisory report to scan

        Returns:
            (flagged_items, cleaned_report)
        """
        self._log("Starting compliance scan of AdvisoryReport")
        all_flagged = []

        # Convert to dict for scanning + modification
        report_dict = report.model_dump()

        # Scan rebalancing actions
        for i, action_data in enumerate(report_dict.get("rebalancing_plan", [])):
            for field in ["rationale", "tax_impact"]:
                if field in action_data and action_data[field]:
                    flagged, cleaned = self._scan_text(
                        action_data[field],
                        f"rebalancing_plan[{i}].{field}",
                    )
                    all_flagged.extend(flagged)
                    report_dict["rebalancing_plan"][i][field] = cleaned

        # Scan FIRE plan
        fire_plan = report_dict.get("fire_plan")
        if fire_plan:
            # Scan milestone notes
            for i, milestone in enumerate(fire_plan.get("milestones", [])):
                if milestone.get("notes"):
                    flagged, cleaned = self._scan_text(
                        milestone["notes"],
                        f"fire_plan.milestones[{i}].notes",
                    )
                    all_flagged.extend(flagged)
                    fire_plan["milestones"][i]["notes"] = cleaned

            # Scan at_current_trajectory
            if fire_plan.get("at_current_trajectory"):
                flagged, cleaned = self._scan_text(
                    fire_plan["at_current_trajectory"],
                    "fire_plan.at_current_trajectory",
                )
                all_flagged.extend(flagged)
                fire_plan["at_current_trajectory"] = cleaned

        # Scan health score
        for i, dim in enumerate(report_dict.get("health_score", [])):
            if dim.get("rationale"):
                flagged, cleaned = self._scan_text(
                    dim["rationale"], f"health_score[{i}].rationale"
                )
                all_flagged.extend(flagged)
                report_dict["health_score"][i]["rationale"] = cleaned
            for j, sug in enumerate(dim.get("suggestions", [])):
                flagged, cleaned = self._scan_text(
                    sug, f"health_score[{i}].suggestions[{j}]"
                )
                all_flagged.extend(flagged)
                report_dict["health_score"][i]["suggestions"][j] = cleaned

        # Scan tax analysis
        tax = report_dict.get("tax_analysis")
        if tax:
            for i, step in enumerate(tax.get("old_regime_steps", [])):
                if step.get("description"):
                    flagged, cleaned = self._scan_text(
                        step["description"],
                        f"tax_analysis.old_regime_steps[{i}].description",
                    )
                    all_flagged.extend(flagged)
                    tax["old_regime_steps"][i]["description"] = cleaned

            for i, inst in enumerate(tax.get("additional_instruments", [])):
                if inst.get("rationale"):
                    flagged, cleaned = self._scan_text(
                        inst["rationale"],
                        f"tax_analysis.additional_instruments[{i}].rationale",
                    )
                    all_flagged.extend(flagged)
                    tax["additional_instruments"][i]["rationale"] = cleaned

        # Scan audit trail
        for i, entry in enumerate(report_dict.get("audit_trail", [])):
            flagged, cleaned = self._scan_text(entry, f"audit_trail[{i}]")
            all_flagged.extend(flagged)
            report_dict["audit_trail"][i] = cleaned

        self._log(f"Scan complete: {len(all_flagged)} items flagged")

        # Reconstruct the report
        cleaned_report = AdvisoryReport(**report_dict)
        return all_flagged, cleaned_report

    # =========================================================================
    # Disclaimer Addition
    # =========================================================================

    def add_disclaimers(self, report: AdvisoryReport) -> FinalReport:
        """
        Convert AdvisoryReport to FinalReport by adding compliance metadata.

        Adds:
        - SEBI disclaimer
        - Compliance cleared status
        - Flagged items list
        - Compliance audit log

        Args:
            report: The (possibly already scanned) advisory report

        Returns:
            FinalReport with compliance fields populated
        """
        self._log("Adding disclaimers and generating FinalReport")

        # Scan if not already scanned
        flagged_items, cleaned_report = self.scan_and_flag(report)

        compliance_cleared = len(
            [f for f in flagged_items if "BANNED PHRASE" in f]
        ) == 0

        if compliance_cleared:
            self._log("COMPLIANCE PASSED: No banned phrases found")
        else:
            banned_count = len([f for f in flagged_items if "BANNED PHRASE" in f])
            self._log(
                f"COMPLIANCE WARNING: {banned_count} banned phrases found and flagged"
            )

        # Build FinalReport
        report_data = cleaned_report.model_dump()
        final_report = FinalReport(
            **report_data,
            compliance_cleared=compliance_cleared,
            disclaimer=config.SEBI_DISCLAIMER,
            flagged_items=flagged_items,
            compliance_audit=self.compliance_log.copy(),
        )

        self._log("FinalReport generated successfully")
        return final_report

    # =========================================================================
    # LangGraph Node Function
    # =========================================================================

    def run(self, state: dict) -> dict:
        """
        LangGraph node function.

        Reads advisory_report from state, applies compliance scanning,
        and produces final_report.

        Args:
            state: PipelineState as dict (LangGraph convention)

        Returns:
            Partial state update with final_report populated
        """
        logger.info("ComplianceAgent: Starting compliance review...")
        self.compliance_log = []  # Reset log for this run
        errors = state.get("errors", [])

        advisory_data = state.get("advisory_report")
        if not advisory_data:
            err = "ComplianceAgent: No advisory_report in state — nothing to review"
            logger.error(err)
            errors.append(err)
            return {
                "final_report": None,
                "current_agent": "compliance_agent",
                "errors": errors,
                "pipeline_status": "failed",
            }

        try:
            # Parse advisory report
            if isinstance(advisory_data, dict):
                advisory_report = AdvisoryReport(**advisory_data)
            elif isinstance(advisory_data, AdvisoryReport):
                advisory_report = advisory_data
            else:
                raise ValueError(
                    f"Unexpected advisory_report type: {type(advisory_data)}"
                )

            # Run compliance pipeline
            final_report = self.add_disclaimers(advisory_report)

            logger.info(
                f"ComplianceAgent: Complete. "
                f"Cleared={final_report.compliance_cleared}, "
                f"{len(final_report.flagged_items)} items flagged"
            )

            return {
                "final_report": final_report.model_dump(),
                "current_agent": "compliance_agent",
                "pipeline_status": "completed",
                "errors": errors,
            }

        except Exception as e:
            err = f"ComplianceAgent: Failed — {e}"
            logger.error(err)
            errors.append(err)
            return {
                "final_report": None,
                "current_agent": "compliance_agent",
                "pipeline_status": "failed",
                "errors": errors,
            }
