"""
Form 16 parsing agent for uploaded salary documents.

The parser is intentionally pragmatic: it extracts the salary and deduction
fields that the tax and life-event flows need, then converts the upload into
lightweight retrieval context for the current session.
"""

from __future__ import annotations

from pathlib import Path
import re
import tempfile
from typing import Any

from agents.parser_agent import ParserAgent


FIELD_LABELS = {
    "gross_salary": "Gross Salary",
    "base_salary": "Basic Salary",
    "hra_received": "HRA Received",
    "other_allowances": "Other Allowances",
    "standard_deduction": "Standard Deduction",
    "section_80c": "Section 80C",
    "nps_contribution": "NPS",
    "home_loan_interest": "Home Loan Interest",
    "medical_insurance_premium": "Medical Insurance",
    "tds": "TDS",
}


FIELD_PATTERNS = {
    "gross_salary": [
        r"gross salary(?: paid during the year)?[^0-9]{0,40}rs\.?\s*(?P<amount>[\d,]+(?:\.\d+)?)",
        r"gross salary(?: paid during the year)?[^0-9]{0,40}(?P<amount>[\d,]+(?:\.\d+)?)",
        r"salary as per provisions contained in section 17\(1\)[^0-9]{0,40}(?P<amount>[\d,]+(?:\.\d+)?)",
        r"gross total salary[^0-9]{0,40}(?P<amount>[\d,]+(?:\.\d+)?)",
    ],
    "base_salary": [
        r"basic salary[^0-9]{0,40}(?P<amount>[\d,]+(?:\.\d+)?)",
        r"basic pay[^0-9]{0,40}(?P<amount>[\d,]+(?:\.\d+)?)",
    ],
    "hra_received": [
        r"house rent allowance(?: received)?[^0-9]{0,40}(?P<amount>[\d,]+(?:\.\d+)?)",
        r"\bhra(?: received)?[^0-9]{0,40}(?P<amount>[\d,]+(?:\.\d+)?)",
    ],
    "other_allowances": [
        r"other taxable allowances[^0-9]{0,40}(?P<amount>[\d,]+(?:\.\d+)?)",
        r"special allowance[^0-9]{0,40}(?P<amount>[\d,]+(?:\.\d+)?)",
        r"other allowances[^0-9]{0,40}(?P<amount>[\d,]+(?:\.\d+)?)",
    ],
    "standard_deduction": [
        r"standard deduction[^0-9]{0,40}(?P<amount>[\d,]+(?:\.\d+)?)",
    ],
    "section_80c": [
        r"section\s*80c[^0-9]{0,40}(?P<amount>[\d,]+(?:\.\d+)?)",
        r"\b80c(?: investments| claimed)?[^0-9]{0,40}(?P<amount>[\d,]+(?:\.\d+)?)",
    ],
    "nps_contribution": [
        r"80ccd\(1b\)[^0-9]{0,40}(?P<amount>[\d,]+(?:\.\d+)?)",
        r"\bnps(?: contribution)?[^0-9]{0,40}(?P<amount>[\d,]+(?:\.\d+)?)",
    ],
    "home_loan_interest": [
        r"home loan interest[^0-9]{0,40}(?P<amount>[\d,]+(?:\.\d+)?)",
        r"section\s*24[^0-9]{0,40}(?P<amount>[\d,]+(?:\.\d+)?)",
    ],
    "medical_insurance_premium": [
        r"medical insurance[^0-9]{0,40}(?P<amount>[\d,]+(?:\.\d+)?)",
        r"section\s*80d[^0-9]{0,40}(?P<amount>[\d,]+(?:\.\d+)?)",
    ],
    "tds": [
        r"tax deducted at source[^0-9]{0,40}(?P<amount>[\d,]+(?:\.\d+)?)",
        r"\btds(?: deposited| deducted)?[^0-9]{0,40}(?P<amount>[\d,]+(?:\.\d+)?)",
    ],
}


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _decode_text_file(file_bytes: bytes) -> str:
    for encoding in ("utf-8", "latin-1"):
        try:
            return file_bytes.decode(encoding)
        except UnicodeDecodeError:
            continue
    return file_bytes.decode("utf-8", errors="ignore")


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


class Form16Agent:
    """Parse uploaded Form 16 files into profile fields and retrieval context."""

    def _extract_text(self, file_bytes: bytes, filename: str) -> str:
        suffix = Path(filename).suffix.lower()
        if suffix == ".pdf":
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
                temp_file.write(file_bytes)
                temp_path = temp_file.name
            try:
                return ParserAgent().parse_pdf(temp_path)
            finally:
                Path(temp_path).unlink(missing_ok=True)

        return _decode_text_file(file_bytes)

    def _extract_fields(self, raw_text: str) -> dict[str, float]:
        fields: dict[str, float] = {}
        for key, patterns in FIELD_PATTERNS.items():
            for pattern in patterns:
                match = re.search(pattern, raw_text, flags=re.IGNORECASE)
                if not match:
                    continue
                fields[key] = float(match.group("amount").replace(",", ""))
                break
        return fields

    def _build_profile_overrides(self, fields: dict[str, float]) -> dict[str, Any]:
        annual_income = fields.get("gross_salary")
        if annual_income is None:
            annual_income = (
                fields.get("base_salary", 0.0)
                + fields.get("hra_received", 0.0)
                + fields.get("other_allowances", 0.0)
            ) or None

        overrides: dict[str, Any] = {}
        if annual_income:
            overrides["annual_income"] = annual_income
        if fields.get("base_salary") is not None:
            overrides["base_salary"] = fields["base_salary"]
        if fields.get("hra_received") is not None:
            overrides["hra_received"] = fields["hra_received"]
        if fields.get("section_80c") is not None:
            overrides["section_80c"] = fields["section_80c"]
        if fields.get("nps_contribution") is not None:
            overrides["nps_contribution"] = fields["nps_contribution"]
        if fields.get("home_loan_interest") is not None:
            overrides["home_loan_interest"] = fields["home_loan_interest"]
        if fields.get("medical_insurance_premium") is not None:
            overrides["medical_insurance_premium"] = fields["medical_insurance_premium"]
        return overrides

    def _build_extracted_fields(self, fields: dict[str, float]) -> list[dict[str, Any]]:
        return [
            {
                "key": key,
                "label": FIELD_LABELS[key],
                "amount": amount,
            }
            for key, amount in fields.items()
            if key in FIELD_LABELS
        ]

    def _build_knowledge_chunks(
        self,
        filename: str,
        fields: dict[str, float],
        raw_text: str,
    ) -> list[dict[str, str]]:
        title = f"Uploaded Form 16 - {filename}"
        chunks: list[dict[str, str]] = []

        salary_bits = []
        if fields.get("gross_salary") is not None:
            salary_bits.append(f"Gross salary is {_format_inr(fields['gross_salary'])}.")
        if fields.get("base_salary") is not None:
            salary_bits.append(f"Basic salary is {_format_inr(fields['base_salary'])}.")
        if fields.get("hra_received") is not None:
            salary_bits.append(f"HRA received is {_format_inr(fields['hra_received'])}.")
        if fields.get("other_allowances") is not None:
            salary_bits.append(
                f"Other taxable allowances are {_format_inr(fields['other_allowances'])}."
            )
        if salary_bits:
            chunks.append(
                {
                    "chunk_id": "salary-breakdown",
                    "title": title,
                    "section": "Salary Breakdown",
                    "content": " ".join(salary_bits),
                    "source_path": f"session/form16/{filename}#salary-breakdown",
                }
            )

        deduction_bits = []
        if fields.get("section_80c") is not None:
            deduction_bits.append(f"Section 80C is {_format_inr(fields['section_80c'])}.")
        if fields.get("nps_contribution") is not None:
            deduction_bits.append(f"NPS is {_format_inr(fields['nps_contribution'])}.")
        if fields.get("medical_insurance_premium") is not None:
            deduction_bits.append(
                f"Medical insurance is {_format_inr(fields['medical_insurance_premium'])}."
            )
        if fields.get("home_loan_interest") is not None:
            deduction_bits.append(
                f"Home loan interest is {_format_inr(fields['home_loan_interest'])}."
            )
        if fields.get("standard_deduction") is not None:
            deduction_bits.append(
                f"Standard deduction is {_format_inr(fields['standard_deduction'])}."
            )
        if deduction_bits:
            chunks.append(
                {
                    "chunk_id": "deductions",
                    "title": title,
                    "section": "Deductions",
                    "content": " ".join(deduction_bits),
                    "source_path": f"session/form16/{filename}#deductions",
                }
            )

        if fields.get("tds") is not None:
            chunks.append(
                {
                    "chunk_id": "tax-paid",
                    "title": title,
                    "section": "Tax Paid",
                    "content": f"Tax deducted at source is {_format_inr(fields['tds'])}.",
                    "source_path": f"session/form16/{filename}#tax-paid",
                }
            )

        raw_excerpt = _normalize_text(raw_text)[:800]
        if raw_excerpt:
            chunks.append(
                {
                    "chunk_id": "raw-upload",
                    "title": title,
                    "section": "Raw Upload",
                    "content": raw_excerpt,
                    "source_path": f"session/form16/{filename}#raw-upload",
                }
            )

        return chunks

    def parse_upload(self, file_bytes: bytes, filename: str) -> dict[str, Any]:
        raw_text = self._extract_text(file_bytes, filename)
        if not raw_text.strip():
            raise ValueError("Could not extract readable text from the uploaded Form 16.")

        fields = self._extract_fields(raw_text)
        knowledge_chunks = self._build_knowledge_chunks(filename, fields, raw_text)
        if not knowledge_chunks:
            raise ValueError("The uploaded Form 16 did not produce usable salary context.")

        extracted_fields = self._build_extracted_fields(fields)
        return {
            "filename": filename,
            "document_label": f"Uploaded Form 16 ({filename})",
            "knowledge_label": f"Uploaded Form 16 ({filename}) + life event playbook",
            "facts": fields,
            "profile_overrides": self._build_profile_overrides(fields),
            "extracted_fields": extracted_fields,
            "knowledge_chunks": knowledge_chunks,
            "summary": (
                "Parsed salary, deduction, and TDS fields from the uploaded Form 16."
                if extracted_fields
                else "Uploaded Form 16 text was captured for retrieval, but only limited fields were extracted."
            ),
            "parsed_field_count": len(extracted_fields),
            "source_count": len(knowledge_chunks),
        }
