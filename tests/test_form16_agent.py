from pathlib import Path

from agents.form16_agent import Form16Agent


def test_form16_agent_extracts_core_salary_and_deductions():
    sample_path = Path("data/form16_knowledge/sample_form16_fy2025_26.md")
    parsed = Form16Agent().parse_upload(
        sample_path.read_bytes(),
        sample_path.name,
    )

    assert parsed["profile_overrides"]["annual_income"] == 2400000.0
    assert parsed["profile_overrides"]["base_salary"] == 1800000.0
    assert parsed["profile_overrides"]["hra_received"] == 360000.0
    assert parsed["profile_overrides"]["section_80c"] == 150000.0
    assert parsed["profile_overrides"]["nps_contribution"] == 50000.0
    assert parsed["profile_overrides"]["home_loan_interest"] == 40000.0
    assert parsed["parsed_field_count"] >= 6
    assert any(chunk["section"] == "Salary Breakdown" for chunk in parsed["knowledge_chunks"])
