"""
FinSage AI — Configuration
============================
Central configuration file for all agents and modules.
API keys loaded from .env file. Shared constants for the entire pipeline.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# =============================================================================
# Project Paths
# =============================================================================

PROJECT_ROOT = Path(__file__).parent.parent.resolve()
DATA_DIR = PROJECT_ROOT / "data"
PROMPTS_DIR = PROJECT_ROOT / "prompts"
CHROMA_PERSIST_DIR = str(DATA_DIR / "chromadb")
FUND_FACTSHEETS_DIR = str(DATA_DIR / "fund_factsheets")

# =============================================================================
# LLM Configuration
# =============================================================================

def _parse_api_keys(raw_value: str) -> list[str]:
    return [item.strip() for item in raw_value.split(",") if item.strip()]


def _dedupe_preserve_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    unique: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        unique.append(value)
    return unique


GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_API_KEY_SECONDARY = os.getenv("GEMINI_API_KEY_SECONDARY", os.getenv("GEMINI_API_KEY_2", ""))
GEMINI_API_KEYS = _dedupe_preserve_order(
    [
        *([GEMINI_API_KEY] if GEMINI_API_KEY else []),
        *([GEMINI_API_KEY_SECONDARY] if GEMINI_API_KEY_SECONDARY else []),
        *_parse_api_keys(os.getenv("GEMINI_API_KEYS", "")),
    ]
)
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")
GEMINI_TEMPERATURE = float(os.getenv("GEMINI_TEMPERATURE", "0.3"))
GEMINI_MAX_OUTPUT_TOKENS = int(os.getenv("GEMINI_MAX_OUTPUT_TOKENS", "8192"))

# Retry settings for LLM calls
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))
RETRY_DELAY_SECONDS = float(os.getenv("RETRY_DELAY_SECONDS", "2.0"))

# =============================================================================
# Financial Constants
# =============================================================================

# STCG threshold: equity funds held < 365 days trigger short-term capital gains
STCG_THRESHOLD_DAYS = 365

# Tax rates (FY 2025-26)
STCG_TAX_RATE = 0.20        # 20% for equity STCG (Budget 2024)
LTCG_TAX_RATE = 0.125       # 12.5% for equity LTCG above ₹1.25L (Budget 2024)
LTCG_EXEMPTION_LIMIT = 125000  # ₹1.25 lakh LTCG exemption

# FIRE Planning assumptions (defaults, user can override)
ASSUMED_INFLATION_RATE = 0.06        # 6% annual inflation
ASSUMED_EQUITY_RETURN = 0.12         # 12% nominal equity return
ASSUMED_DEBT_RETURN = 0.07           # 7% nominal debt return
ASSUMED_GOLD_RETURN = 0.08           # 8% nominal gold return
SAFE_WITHDRAWAL_RATE = 0.03         # 3% SWR (conservative for India)
LIFE_EXPECTANCY = 85                 # Plan for corpus to last until age 85

# =============================================================================
# Income Tax Slabs — FY 2025-26
# =============================================================================

# Old Regime Tax Slabs (with standard deduction of ₹75,000)
OLD_REGIME_SLABS = [
    (250000, 0.00),     # Up to ₹2.5L: nil
    (500000, 0.05),     # ₹2.5L - ₹5L: 5%
    (1000000, 0.20),    # ₹5L - ₹10L: 20%
    (float("inf"), 0.30),  # Above ₹10L: 30%
]

# New Regime Tax Slabs (FY 2025-26, Union Budget 2025)
NEW_REGIME_SLABS = [
    (400000, 0.00),     # Up to ₹4L: nil
    (800000, 0.05),     # ₹4L - ₹8L: 5%
    (1200000, 0.10),    # ₹8L - ₹12L: 10%
    (1600000, 0.15),    # ₹12L - ₹16L: 15%
    (2000000, 0.20),    # ₹16L - ₹20L: 20%
    (2400000, 0.25),    # ₹20L - ₹24L: 25%
    (float("inf"), 0.30),  # Above ₹24L: 30%
]

# Standard deduction
STANDARD_DEDUCTION_OLD = 75000    # ₹75,000 (revised in Budget 2025)
STANDARD_DEDUCTION_NEW = 75000    # ₹75,000

# Section limits
SECTION_80C_LIMIT = 150000        # ₹1.5L
SECTION_80CCD_1B_LIMIT = 50000   # ₹50K additional NPS
SECTION_80D_LIMIT_SELF = 25000   # ₹25K (health insurance, self)
SECTION_80D_LIMIT_PARENTS = 50000  # ₹50K (health insurance, senior citizen parents)
SECTION_80TTA_LIMIT = 10000       # ₹10K (savings account interest)
SECTION_24_LIMIT = 200000         # ₹2L (home loan interest)
HRA_METRO_PERCENTAGE = 0.50      # 50% of basic for metro cities
HRA_NON_METRO_PERCENTAGE = 0.40  # 40% of basic for non-metro

# Health & Education Cess
CESS_RATE = 0.04  # 4%

# Rebate under Section 87A
REBATE_87A_OLD_LIMIT = 500000     # Rebate if taxable income ≤ ₹5L (old regime)
REBATE_87A_OLD_AMOUNT = 12500     # Max rebate ₹12,500
REBATE_87A_NEW_LIMIT = 1200000    # Rebate if taxable income ≤ ₹12L (new regime, Budget 2025)
REBATE_87A_NEW_AMOUNT = 60000     # Max rebate ₹60,000 (Budget 2025)

# =============================================================================
# SEBI / Compliance Constants
# =============================================================================

SEBI_DISCLAIMER = (
    "DISCLAIMER: This analysis is generated by an AI system for educational and "
    "informational purposes only. It does NOT constitute financial advice, investment "
    "recommendations, or solicitation to buy/sell any securities. The information provided "
    "should not be relied upon as the sole basis for any investment decision. Past performance "
    "does not guarantee future results. Mutual fund investments are subject to market risks. "
    "Please read all scheme-related documents carefully before investing. Consult a "
    "SEBI-registered investment advisor for personalised financial advice. "
    "Regulatory compliance: SEBI | AMFI | RBI guidelines followed."
)

# Phrases that indicate inappropriate financial advice (compliance agent scans for these)
BANNED_PHRASES = [
    "guaranteed returns",
    "guaranteed profit",
    "risk-free",
    "risk free",
    "you must buy",
    "you must invest",
    "you should definitely",
    "no risk",
    "zero risk",
    "assured returns",
    "100% safe",
    "will definitely increase",
    "will certainly grow",
    "cannot lose money",
    "sure shot",
    "foolproof investment",
    "I recommend you buy",
    "I advise you to purchase",
    "you need to invest in",
]

# Softening replacements for compliance
COMPLIANCE_REPLACEMENTS = {
    "you should": "you may consider",
    "you must": "it may be worth exploring",
    "definitely": "potentially",
    "always": "generally",
    "never": "rarely",
    "best investment": "a potentially suitable option",
    "worst investment": "a potentially less suitable option",
    "guaranteed": "historically observed",
}

# =============================================================================
# ChromaDB / RAG Configuration
# =============================================================================

EMBEDDING_MODEL = "all-MiniLM-L6-v2"  # sentence-transformers model
CHROMA_COLLECTION_NAME = "fund_factsheets"
RAG_TOP_K = 5  # Number of relevant chunks to retrieve

# =============================================================================
# Application Settings
# =============================================================================

STREAMLIT_PORT = 8501
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
DEBUG_MODE = os.getenv("DEBUG_MODE", "false").lower() == "true"
