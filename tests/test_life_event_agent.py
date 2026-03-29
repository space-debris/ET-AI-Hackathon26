from agents.life_event_agent import LifeEventAdvisorAgent
from shared.schemas import RiskProfile, UserFinancialProfile


def _sample_profile():
    return UserFinancialProfile(
        age=34,
        annual_income=2400000,
        monthly_expenses=80000,
        existing_investments={"MF": 1800000, "PPF": 600000},
        target_retirement_age=50,
        target_monthly_corpus=150000,
        risk_profile=RiskProfile.MODERATE,
        base_salary=1800000,
        hra_received=360000,
        rent_paid=0,
        section_80c=150000,
        nps_contribution=50000,
        home_loan_interest=40000,
        medical_insurance_premium=0,
    )


def test_bonus_chat_uses_form16_salary_context():
    agent = LifeEventAdvisorAgent()
    response = agent.chat(
        question="Does the sample Form 16 already show the salary and HRA picture before I use a bonus?",
        profile=_sample_profile(),
        scenario={
            "eventType": "bonus",
            "eventAmount": 600000,
            "currentReserve": 250000,
            "highInterestDebt": 150000,
            "monthsUntilEvent": 1,
        },
    )

    assert response["retrieved_chunks"] >= 2
    assert any(source["section"] == "Part B - Salary Breakdown" for source in response["sources"])
    assert "gross salary of ₹24,00,000" in response["answer"]
    assert "HRA ₹3,60,000" in response["answer"]
    assert response["metrics"]["tax_reserve"] == 180000.0


def test_job_switch_chat_retrieves_dual_employer_guidance():
    agent = LifeEventAdvisorAgent()
    response = agent.chat(
        question="I may switch jobs this year. What should I check in Form 16 first?",
        profile=_sample_profile(),
        scenario={
            "eventType": "job_switch",
            "eventAmount": 400000,
            "currentReserve": 200000,
            "highInterestDebt": 0,
            "monthsUntilEvent": 3,
        },
    )

    assert any("Job Switch and Dual Employer Cases" == source["section"] for source in response["sources"])
    assert "both employers" in response["answer"].lower()
    assert "tds" in response["answer"].lower()
    assert response["event_label"] == "Job Switch"
