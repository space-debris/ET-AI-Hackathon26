"""
Generate a synthetic Form 16 knowledge fixture for demos.

Usage:
    python data/generate_dummy_form16_statement.py

This writes a markdown knowledge file that is consumed by the lightweight RAG
pipeline and, when reportlab is installed, also emits a simple PDF copy for
manual demos.
"""

from __future__ import annotations

from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
KNOWLEDGE_DIR = PROJECT_ROOT / "data" / "form16_knowledge"
MARKDOWN_OUTPUT = KNOWLEDGE_DIR / "sample_form16_fy2025_26.md"
PDF_OUTPUT = PROJECT_ROOT / "data" / "sample_form16_fy2025_26.pdf"


MARKDOWN_CONTENT = """# Sample Form 16 FY 2025-26

## Document Profile

Employer: FinSage Labs Private Limited
Employee: Demo Salaried User
PAN: ABCDE1234F
Assessment Year: 2026-27
Financial Year: 2025-26

## Part A - Tax Deduction Summary

Quarterly TDS deposited:

- Q1: Rs 61,000
- Q2: Rs 72,500
- Q3: Rs 76,000
- Q4: Rs 83,000

Total tax deducted at source for the year: Rs 2,92,500

## Part B - Salary Breakdown

Gross salary paid during the year: Rs 24,00,000
- Basic salary: Rs 18,00,000
- House rent allowance received: Rs 3,60,000
- Special allowance and other taxable allowances: Rs 2,40,000

## Exemptions and Relief

House rent allowance exemption claimed in this sample: Rs 0
Standard deduction applied: Rs 75,000

## Deductions Declared In Payroll

- Section 80C investments declared: Rs 1,50,000
- Section 80CCD(1B) NPS declared: Rs 50,000
- Section 24(b) home-loan interest declared: Rs 40,000
- Section 80D medical insurance declared in payroll: Rs 0
- Other deductions reflected in payroll: Rs 0
"""


def write_markdown() -> None:
    KNOWLEDGE_DIR.mkdir(parents=True, exist_ok=True)
    MARKDOWN_OUTPUT.write_text(MARKDOWN_CONTENT, encoding="utf-8")
    print(f"Wrote markdown knowledge fixture: {MARKDOWN_OUTPUT}")


def write_pdf() -> None:
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
    except Exception:
        print("reportlab is not installed; skipping PDF generation.")
        return

    styles = getSampleStyleSheet()
    lines = [line.strip() for line in MARKDOWN_CONTENT.splitlines() if line.strip()]
    story = []
    for line in lines:
        if line.startswith("# "):
            story.append(Paragraph(line[2:], styles["Title"]))
        elif line.startswith("## "):
            story.append(Spacer(1, 8))
            story.append(Paragraph(line[3:], styles["Heading2"]))
        else:
            story.append(Paragraph(line.replace("  ", " "), styles["BodyText"]))
        story.append(Spacer(1, 6))

    doc = SimpleDocTemplate(str(PDF_OUTPUT), pagesize=A4)
    doc.build(story)
    print(f"Wrote demo PDF fixture: {PDF_OUTPUT}")


def main() -> None:
    write_markdown()
    write_pdf()


if __name__ == "__main__":
    main()
