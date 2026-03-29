import axios from 'axios';
import {
  MOCK_PORTFOLIO_ANALYTICS,
  MOCK_REBALANCING_ACTIONS,
  MOCK_FIRE_MILESTONES,
  MOCK_TAX_COMPARISON,
  MOCK_HEALTH_SCORE,
  MOCK_USER_PROFILE,
} from '../utils/mockData';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const DEMO_MODE_ENABLED =
  String(import.meta.env.VITE_ENABLE_DEMO_MODE || '').toLowerCase() === 'true';
const SESSION_STORAGE_KEY = 'finsage-session-id-v2';
const PROFILE_STORAGE_KEY = 'finsage-user-profile-cache-v1';

const getStoredSessionId = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(SESSION_STORAGE_KEY);
};

const setStoredSessionId = (sessionId) => {
  if (!sessionId || typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
};

const setStoredProfile = (profile) => {
  if (!profile || typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    PROFILE_STORAGE_KEY,
    JSON.stringify({
      sessionId: getStoredSessionId(),
      profile,
    })
  );
};

const getStoredProfile = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const cached = JSON.parse(raw);
    const currentSessionId = getStoredSessionId();
    if (cached?.sessionId && currentSessionId && cached.sessionId !== currentSessionId) {
      return null;
    }

    return cached?.profile ?? null;
  } catch {
    return null;
  }
};

const clearStoredAppData = () => {
  if (typeof window === 'undefined') {
    return;
  }

  const keysToDelete = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith('finsage-')) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach((key) => window.localStorage.removeItem(key));
};

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const sessionId = getStoredSessionId();
  if (sessionId) {
    config.headers['X-Session-Id'] = sessionId;
  }
  return config;
});

api.interceptors.response.use((response) => {
  setStoredSessionId(response.headers['x-session-id']);
  return response;
});

// Simulate API delay for realistic UX
const simulateDelay = (ms = 1000) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeHolding = (holding) => ({
  fundName: holding.fundName ?? holding.fund_name ?? '',
  isin: holding.isin ?? null,
  amc: holding.amc ?? null,
  category: holding.category ?? 'other',
  currentValue: holding.currentValue ?? holding.current_value ?? 0,
  investedAmount: holding.investedAmount ?? holding.invested_amount ?? 0,
  unitsHeld: holding.unitsHeld ?? holding.units_held ?? 0,
  currentNav: holding.currentNav ?? holding.current_nav ?? null,
  expenseRatio: holding.expenseRatio ?? holding.expense_ratio ?? 0,
  directExpenseRatio:
    holding.directExpenseRatio ?? holding.direct_expense_ratio ?? null,
  planType: holding.planType ?? holding.plan_type ?? 'regular',
  topHoldings: (holding.topHoldings ?? holding.top_holdings ?? []).map((stock) => ({
    stockName: stock.stockName ?? stock.stock_name ?? '',
    weight: stock.weight ?? 0,
    sector: stock.sector ?? null,
  })),
  holdingPeriodDays: holding.holdingPeriodDays ?? holding.holding_period_days ?? null,
  xirr: holding.xirr ?? null,
  absoluteReturn: holding.absoluteReturn ?? holding.absolute_return ?? null,
});

const normalizePortfolioAnalytics = (payload) => {
  const portfolio =
    payload?.analytics ?? payload?.data ?? payload?.portfolio ?? payload ?? null;
  if (!portfolio) {
    return null;
  }

  return {
    holdings: (portfolio.holdings ?? []).map(normalizeHolding),
    overallXirr: portfolio.overallXirr ?? portfolio.overall_xirr ?? 0,
    fundWiseXirr: portfolio.fundWiseXirr ?? portfolio.fund_wise_xirr ?? {},
    overlapMatrix: portfolio.overlapMatrix ?? portfolio.overlap_matrix ?? {},
    overlapDetails: portfolio.overlapDetails ?? portfolio.overlap_details ?? [],
    expenseRatioDragInr:
      portfolio.expenseRatioDragInr ?? portfolio.expense_ratio_drag_inr ?? 0,
    totalCurrentValue: portfolio.totalCurrentValue ?? portfolio.total_current_value ?? 0,
    totalInvested: portfolio.totalInvested ?? portfolio.total_invested ?? 0,
    categoryAllocation:
      portfolio.categoryAllocation ?? portfolio.category_allocation ?? {},
    amcAllocation: portfolio.amcAllocation ?? portfolio.amc_allocation ?? {},
  };
};

const normalizeRebalancingAction = (action) => ({
  fundName: action.fundName ?? action.fund_name ?? '',
  action: action.action ?? 'hold',
  percentage: action.percentage ?? null,
  amountInr: action.amountInr ?? action.amount_inr ?? null,
  targetFund: action.targetFund ?? action.target_fund ?? null,
  taxImpact: action.taxImpact ?? action.tax_impact ?? '',
  rationale: action.rationale ?? '',
  priority: action.priority ?? null,
});

const normalizeFireMilestone = (milestone) => ({
  month: milestone.month ?? 1,
  year: milestone.year ?? new Date().getFullYear(),
  equitySip: milestone.equitySip ?? milestone.equity_sip ?? 0,
  debtSip: milestone.debtSip ?? milestone.debt_sip ?? 0,
  goldSip: milestone.goldSip ?? milestone.gold_sip ?? 0,
  totalSip:
    milestone.totalSip ??
    milestone.total_sip ??
    (milestone.equitySip ?? milestone.equity_sip ?? 0) +
      (milestone.debtSip ?? milestone.debt_sip ?? 0) +
      (milestone.goldSip ?? milestone.gold_sip ?? 0),
  totalCorpus:
    milestone.totalCorpus ??
    milestone.total_corpus ??
    milestone.projectedCorpus ??
    milestone.projected_corpus ??
    0,
  equityPct: milestone.equityPct ?? milestone.equity_pct ?? 0,
  debtPct: milestone.debtPct ?? milestone.debt_pct ?? 0,
  goldPct:
    milestone.goldPct ??
    milestone.gold_pct ??
    Math.max(
      0,
      100 - (milestone.equityPct ?? milestone.equity_pct ?? 0) - (milestone.debtPct ?? milestone.debt_pct ?? 0)
    ),
  notes: milestone.notes ?? '',
});

const normalizeInsuranceGap = (insuranceGap) => {
  if (!insuranceGap) {
    return null;
  }

  if (typeof insuranceGap === 'number') {
    return {
      totalGap: insuranceGap,
      lifeCoverGap: insuranceGap,
      recommendedLifeCover: null,
      currentAssetBuffer: null,
      incomeMultiple: null,
      expenseRunwayMonths: null,
      coverageRatioPct: null,
      formula: null,
      healthCoverRecommendation: null,
      summary: `Additional cover needed: ₹${insuranceGap.toLocaleString('en-IN')}`,
    };
  }

  return {
    totalGap:
      insuranceGap.totalGap ??
      insuranceGap.total_gap ??
      insuranceGap.coverGap ??
      insuranceGap.cover_gap ??
      insuranceGap.life_cover_gap ??
      0,
    lifeCoverGap:
      insuranceGap.lifeCoverGap ??
      insuranceGap.life_cover_gap ??
      insuranceGap.totalGap ??
      insuranceGap.total_gap ??
      insuranceGap.coverGap ??
      insuranceGap.cover_gap ??
      0,
    recommendedLifeCover:
      insuranceGap.recommendedLifeCover ??
      insuranceGap.recommended_life_cover ??
      null,
    currentAssetBuffer:
      insuranceGap.currentAssetBuffer ??
      insuranceGap.current_asset_buffer ??
      null,
    incomeMultiple:
      insuranceGap.incomeMultiple ??
      insuranceGap.income_multiple ??
      null,
    expenseRunwayMonths:
      insuranceGap.expenseRunwayMonths ??
      insuranceGap.expense_runway_months ??
      null,
    coverageRatioPct:
      insuranceGap.coverageRatioPct ??
      insuranceGap.coverage_ratio_pct ??
      null,
    formula:
      insuranceGap.formula ??
      null,
    healthCoverRecommendation:
      insuranceGap.healthCoverRecommendation ??
      insuranceGap.health_cover_recommendation ??
      null,
    summary:
      insuranceGap.summary ??
      insuranceGap.notes ??
      insuranceGap.recommendation ??
      null,
    ...insuranceGap,
  };
};

const formatExpectedRetirementDate = (value) => {
  if (!value || typeof value !== 'string') {
    return value;
  }

  const match = value.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!match) {
    return value;
  }

  const [, year, month] = match;
  const parsedMonth = Number.parseInt(month, 10);
  if (Number.isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
    return year;
  }

  return new Date(Number.parseInt(year, 10), parsedMonth - 1, 1).toLocaleString('en-IN', {
    month: 'short',
    year: 'numeric',
  });
};

const normalizeFirePlan = (payload) => {
  const fire =
    payload?.fire ??
    payload?.firePlan ??
    payload?.fire_plan ??
    payload?.data ??
    payload ??
    null;
  if (!fire) {
    return null;
  }

  const summary = fire.summary ?? {};

  return {
    currentCorpus:
      fire.currentCorpus ?? fire.current_corpus ?? summary.currentCorpus ?? summary.current_corpus ?? 0,
    targetCorpus:
      fire.targetCorpus ?? fire.target_corpus ?? summary.targetCorpus ?? summary.target_corpus ?? 0,
    yearsToRetirement:
      fire.yearsToRetirement ??
      fire.years_to_retirement ??
      summary.yearsToRetirement ??
      summary.years_to_fire ??
      null,
    expectedRetirementDate:
      formatExpectedRetirementDate(
        fire.expectedRetirementDate ??
        fire.expected_retirement_date ??
        summary.expectedRetirementDate ??
        null
      ),
    monthlySipRequired:
      fire.monthlySipRequired ??
      fire.monthly_sip_required ??
      summary.monthlySipRequired ??
      summary.monthly_sip_required ??
      summary.monthlyTarget ??
      summary.monthly_target ??
      0,
    milestones: (fire.milestones ?? []).map(normalizeFireMilestone),
    insuranceGap: normalizeInsuranceGap(
      fire.insuranceGap ??
        fire.insurance_gap ??
        summary.insuranceGap ??
        summary.insurance_gap ??
        null
    ),
    assumptions: fire.assumptions ?? {},
    atCurrentTrajectory:
      fire.atCurrentTrajectory ?? fire.at_current_trajectory ?? null,
  };
};

const normalizeTaxStep = (step) => ({
  description: step.description ?? '',
  amount: step.amount ?? 0,
  section: step.section ?? null,
});

const normalizeTaxInstrument = (instrument) => ({
  name: instrument.name ?? instrument.instrument ?? '',
  section: instrument.section ?? '',
  maxLimit: instrument.maxLimit ?? instrument.max_limit ?? instrument.maxBenefit ?? 0,
  expectedReturn:
    instrument.expectedReturn ?? instrument.expected_return ?? 'Varies',
  liquidity: instrument.liquidity ?? 'Varies',
  risk: instrument.risk ?? 'Varies',
  rationale:
    instrument.rationale ?? instrument.recommendation ?? '',
  taxSaved: instrument.taxSaved ?? instrument.tax_saved ?? null,
});

const normalizeTaxComparison = (payload) => {
  const tax = payload?.tax ?? payload?.taxAnalysis ?? payload?.tax_analysis ?? payload?.data ?? payload ?? null;
  if (!tax) {
    return null;
  }

  return {
    grossIncome: tax.grossIncome ?? tax.gross_income ?? 0,
    oldRegimeSteps: (tax.oldRegimeSteps ?? tax.old_regime_steps ?? []).map(normalizeTaxStep),
    oldTaxableIncome: tax.oldTaxableIncome ?? tax.old_taxable_income ?? 0,
    oldTotalTax: tax.oldTotalTax ?? tax.old_total_tax ?? 0,
    newRegimeSteps: (tax.newRegimeSteps ?? tax.new_regime_steps ?? []).map(normalizeTaxStep),
    newTaxableIncome: tax.newTaxableIncome ?? tax.new_taxable_income ?? 0,
    newTotalTax: tax.newTotalTax ?? tax.new_total_tax ?? 0,
    recommendedRegime: tax.recommendedRegime ?? tax.recommended_regime ?? '',
    savingsAmount: tax.savingsAmount ?? tax.savings_amount ?? 0,
    missedDeductions: (tax.missedDeductions ?? tax.missed_deductions ?? []).map((item) =>
      typeof item === 'string' ? item : item.item ?? ''
    ).filter(Boolean),
    additionalInstruments: (tax.additionalInstruments ?? tax.additional_instruments ?? []).map(
      normalizeTaxInstrument
    ),
  };
};

const normalizeHealthDimension = (dimension) => ({
  dimension: dimension.dimension ?? '',
  score: dimension.score ?? 0,
  rationale: dimension.rationale ?? '',
  suggestions: dimension.suggestions ?? [],
});

const normalizeHealthScore = (payload) => {
  const health =
    payload?.healthScore ??
    payload?.health_score ??
    payload?.data ??
    payload ??
    null;
  if (!health) {
    return null;
  }

  const dimensions = (health.dimensions ?? health.healthScore ?? health.health_score ?? health ?? []).map(
    normalizeHealthDimension
  );

  return {
    dimensions,
    overallScore:
      health.overallScore ??
      health.overall_score ??
      (dimensions.length
        ? Math.round(dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length)
        : 0),
  };
};

const normalizePipelineResult = (payload) => ({
  portfolio: normalizePortfolioAnalytics(payload?.portfolio ?? payload?.analytics ?? payload),
  rebalancing: (payload?.rebalancing ?? payload?.rebalancing_plan ?? []).map(
    normalizeRebalancingAction
  ),
  healthScore: normalizeHealthScore(payload?.healthScore ?? payload?.health_score ?? payload),
  fire: normalizeFirePlan(payload?.fire ?? payload?.fire_plan ?? payload),
  tax: normalizeTaxComparison(payload?.tax ?? payload?.tax_analysis ?? payload),
});

const toExistingInvestmentsMap = (existingInvestments) => {
  if (existingInvestments && typeof existingInvestments === 'object' && !Array.isArray(existingInvestments)) {
    return existingInvestments;
  }

  if (typeof existingInvestments === 'number') {
    return { MF: existingInvestments };
  }

  return {};
};

const assignIfPresent = (target, value, key) => {
  if (value !== undefined && value !== null) {
    target[key] = value;
  }
};

const toFrontendProfile = (profile = {}) => ({
  age: profile.age ?? 0,
  annualIncome: profile.annualIncome ?? profile.annual_income ?? 0,
  monthlyExpenses: profile.monthlyExpenses ?? profile.monthly_expenses ?? 0,
  existingInvestments:
    profile.existingInvestments ?? profile.existing_investments ?? {},
  targetRetirementAge:
    profile.targetRetirementAge ?? profile.target_retirement_age ?? 0,
  targetMonthlyCorpus:
    profile.targetMonthlyCorpus ?? profile.target_monthly_corpus ?? 0,
  riskProfile: profile.riskProfile ?? profile.risk_profile ?? 'moderate',
  baseSalary: profile.baseSalary ?? profile.base_salary ?? 0,
  hraReceived: profile.hraReceived ?? profile.hra_received ?? profile.hra ?? 0,
  rentPaid: profile.rentPaid ?? profile.rent_paid ?? 0,
  metroCity: profile.metroCity ?? profile.metro_city ?? true,
  section80C: profile.section80C ?? profile.section_80c ?? 0,
  npsContribution: profile.npsContribution ?? profile.nps_contribution ?? 0,
  homeLoanInterest: profile.homeLoanInterest ?? profile.home_loan_interest ?? 0,
  medicalInsurancePremium:
    profile.medicalInsurancePremium ?? profile.medical_insurance_premium ?? 0,
  otherDeductions: profile.otherDeductions ?? profile.other_deductions ?? 0,
});

const toPartialFrontendProfile = (profile = {}) => {
  const normalized = {};
  assignIfPresent(
    normalized,
    profile.annualIncome ?? profile.annual_income,
    'annualIncome'
  );
  assignIfPresent(
    normalized,
    profile.baseSalary ?? profile.base_salary,
    'baseSalary'
  );
  assignIfPresent(
    normalized,
    profile.hraReceived ?? profile.hra_received ?? profile.hra,
    'hraReceived'
  );
  assignIfPresent(
    normalized,
    profile.section80C ?? profile.section_80c,
    'section80C'
  );
  assignIfPresent(
    normalized,
    profile.npsContribution ?? profile.nps_contribution,
    'npsContribution'
  );
  assignIfPresent(
    normalized,
    profile.homeLoanInterest ?? profile.home_loan_interest,
    'homeLoanInterest'
  );
  assignIfPresent(
    normalized,
    profile.medicalInsurancePremium ?? profile.medical_insurance_premium,
    'medicalInsurancePremium'
  );
  return normalized;
};

const toBackendProfile = (profile = {}) => ({
  age: profile.age,
  annual_income: profile.annualIncome ?? profile.annual_income ?? 0,
  monthly_expenses: profile.monthlyExpenses ?? profile.monthly_expenses ?? 0,
  existing_investments: toExistingInvestmentsMap(
    profile.existingInvestments ?? profile.existing_investments
  ),
  target_retirement_age:
    profile.targetRetirementAge ?? profile.target_retirement_age ?? 60,
  target_monthly_corpus:
    profile.targetMonthlyCorpus ?? profile.target_monthly_corpus ?? 0,
  risk_profile: profile.riskProfile ?? profile.risk_profile ?? 'moderate',
  base_salary: profile.baseSalary ?? profile.base_salary ?? null,
  hra_received: profile.hraReceived ?? profile.hra_received ?? profile.hra ?? null,
  rent_paid: profile.rentPaid ?? profile.rent_paid ?? null,
  metro_city: profile.metroCity ?? profile.metro_city ?? true,
  section_80c: profile.section80C ?? profile.section_80c ?? null,
  nps_contribution: profile.npsContribution ?? profile.nps_contribution ?? null,
  home_loan_interest:
    profile.homeLoanInterest ?? profile.home_loan_interest ?? null,
  medical_insurance_premium:
    profile.medicalInsurancePremium ??
    profile.medical_insurance_premium ??
    profile.healthInsurance ??
    null,
  other_deductions: profile.otherDeductions ?? profile.other_deductions ?? null,
});

const withApiErrorContext = (message, error) => {
  const details =
    error?.response?.data?.detail ??
    error?.response?.data?.message ??
    error?.message ??
    'Unknown error';
  const wrappedError = new Error(`${message} ${details}`.trim());
  wrappedError.cause = error;
  wrappedError.code = error?.code ?? error?.response?.status ?? 'API_ERROR';
  return wrappedError;
};

const buildDemoLifeEventChatResponse = ({ question, profile, scenario }) => {
  const eventAmount = Number(scenario?.eventAmount ?? 0);
  const monthlyExpenses = Number(profile?.monthlyExpenses ?? 0);
  const currentReserve = Number(scenario?.currentReserve ?? 0);
  const reserveTarget = monthlyExpenses * 6;
  const reserveShortfall = Math.max(reserveTarget - currentReserve, 0);
  const taxReserve = eventAmount * 0.3;

  return {
    answer: [
      'What the document shows:',
      '- The bundled sample Form 16 shows gross salary of ₹24,00,000 with basic salary ₹18,00,000, HRA ₹3,60,000, and ₹2,40,000 of other taxable allowances.',
      '- The same sample reflects 80C ₹1,50,000, NPS ₹50,000, and only ₹40,000 of home-loan interest in payroll.',
      '',
      'What to do now:',
      `- Keep about ₹${taxReserve.toLocaleString('en-IN', { maximumFractionDigits: 0 })} ring-fenced first, then close the reserve gap of ₹${reserveShortfall.toLocaleString('en-IN', { maximumFractionDigits: 0 })} before long-term deployment.`,
      '',
      'What to verify:',
      '- Confirm whether the event cash is already reflected in salary income and TDS before treating it as fully post-tax money.',
    ].join('\n'),
    highlights: [
      'Sample Form 16 gross salary: ₹24,00,000',
      `Suggested tax reserve: ₹${taxReserve.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      'Check whether payroll already captured the event in salary and TDS.',
    ],
    sources: [
      {
        title: 'Sample Form 16 FY 2025-26',
        section: 'Part B - Salary Breakdown',
        excerpt: 'Gross salary paid during the year: Rs 24,00,000. Basic salary: Rs 18,00,000. House rent allowance received: Rs 3,60,000.',
        source_path: 'data/form16_knowledge/sample_form16_fy2025_26.md',
        score: 18,
      },
      {
        title: 'Form 16 Life Event Playbook',
        section: 'Bonus and Variable Pay',
        excerpt: 'When a salaried user receives a bonus, the first document check is whether the bonus has already been included in salary income and TDS.',
        source_path: 'data/form16_knowledge/life_event_form16_playbook.md',
        score: 16,
      },
    ],
    retrievedChunks: 2,
    knowledgeLabel: 'Bundled sample Form 16 FY 2025-26 + life event playbook',
    eventLabel: scenario?.eventType ?? 'bonus',
    metrics: {
      reserveTarget,
      reserveShortfall,
      taxReserve,
      investableAfterSafety: Math.max(eventAmount - taxReserve - reserveShortfall, 0),
    },
    question,
  };
};

const buildDemoForm16UploadResponse = (fileName = 'sample_form16_fy2025_26.md') => ({
  filename: fileName,
  documentLabel: `Uploaded Form 16 (${fileName})`,
  knowledgeLabel: `Uploaded Form 16 (${fileName}) + life event playbook`,
  summary: 'Parsed salary, deduction, and TDS fields from the uploaded Form 16.',
  parsedFieldCount: 8,
  sourceCount: 4,
  extractedFields: [
    { key: 'gross_salary', label: 'Gross Salary', amount: 2400000 },
    { key: 'base_salary', label: 'Basic Salary', amount: 1800000 },
    { key: 'hra_received', label: 'HRA Received', amount: 360000 },
    { key: 'section_80c', label: 'Section 80C', amount: 150000 },
    { key: 'nps_contribution', label: 'NPS', amount: 50000 },
    { key: 'home_loan_interest', label: 'Home Loan Interest', amount: 40000 },
    { key: 'tds', label: 'TDS', amount: 292500 },
  ],
  profileOverrides: {
    annualIncome: 2400000,
    baseSalary: 1800000,
    hraReceived: 360000,
    section80C: 150000,
    npsContribution: 50000,
    homeLoanInterest: 40000,
    medicalInsurancePremium: 0,
  },
});

const normalizeForm16Upload = (payload) => {
  const form16 = payload?.form16 ?? payload?.data ?? payload ?? null;
  if (!form16) {
    return null;
  }

  return {
    filename: form16.filename ?? '',
    documentLabel: form16.documentLabel ?? form16.document_label ?? '',
    knowledgeLabel: form16.knowledgeLabel ?? form16.knowledge_label ?? '',
    summary: form16.summary ?? payload?.message ?? '',
    parsedFieldCount: form16.parsedFieldCount ?? form16.parsed_field_count ?? 0,
    sourceCount: form16.sourceCount ?? form16.source_count ?? 0,
    extractedFields: (form16.extractedFields ?? form16.extracted_fields ?? []).map((item) => ({
      key: item.key ?? '',
      label: item.label ?? item.key ?? '',
      amount: item.amount ?? 0,
    })),
    profileOverrides: toPartialFrontendProfile(
      form16.profileOverrides ?? form16.profile_overrides ?? {}
    ),
  };
};

export const runtimeConfig = {
  demoModeEnabled: DEMO_MODE_ENABLED,
  backendBaseUrl: API_BASE_URL,
};

// Portfolio API
export const portfolioApi = {
  async uploadStatement(file) {
    if (DEMO_MODE_ENABLED) {
      await simulateDelay(2000);
      return {
        success: true,
        mode: 'demo',
        message: 'Demo statement processed successfully',
        data: normalizePortfolioAnalytics(MOCK_PORTFOLIO_ANALYTICS),
      };
    }

    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await api.post('/portfolio/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return {
        ...response.data,
        data: normalizePortfolioAnalytics(response.data),
      };
    } catch (error) {
      throw withApiErrorContext('Statement processing failed.', error);
    }
  },

  async getAnalytics() {
    if (DEMO_MODE_ENABLED) {
      await simulateDelay(500);
      return normalizePortfolioAnalytics(MOCK_PORTFOLIO_ANALYTICS);
    }

    try {
      const response = await api.get('/portfolio/analytics');
      return normalizePortfolioAnalytics(response.data);
    } catch (error) {
      if (error?.response?.status === 404) {
        const noDataError = new Error(
          'Upload and process a CAMS or KFintech statement first to see your portfolio insights.'
        );
        noDataError.code = 404;
        throw noDataError;
      }
      throw withApiErrorContext('Portfolio analytics unavailable.', error);
    }
  },

  async getRebalancingPlan() {
    if (DEMO_MODE_ENABLED) {
      await simulateDelay(800);
      return MOCK_REBALANCING_ACTIONS.map(normalizeRebalancingAction);
    }

    try {
      const response = await api.get('/portfolio/rebalancing');
      return (response.data?.rebalancing_plan ?? response.data ?? []).map(
        normalizeRebalancingAction
      );
    } catch (error) {
      if (error?.response?.status === 404) {
        throw new Error('Upload and analyse your statement first to see rebalancing suggestions, tax context, and next steps.');
      }
      if (error?.response?.status === 409) {
        throw new Error('Upload your statement and save a profile on the FIRE or Tax page first to unlock rebalancing recommendations.');
      }
      throw withApiErrorContext('Rebalancing recommendations unavailable.', error);
    }
  },
};

// FIRE Planner API
export const fireApi = {
  async generatePlan(profile) {
    if (DEMO_MODE_ENABLED) {
      await simulateDelay(1500);
      const recommendedLifeCover = (profile?.annualIncome ?? 0) * 10;
      const currentAssetBuffer = profile?.existingInvestments ?? 0;
      const totalGap = Math.max(recommendedLifeCover - currentAssetBuffer, 0);
      return normalizeFirePlan({
        milestones: MOCK_FIRE_MILESTONES,
        summary: {
          targetCorpus: 24000000,
          yearsToFire: 14,
          monthlySipRequired: 70000,
          insuranceGap: {
            totalGap,
            lifeCoverGap: totalGap,
            recommendedLifeCover,
            currentAssetBuffer,
            incomeMultiple: 10,
            expenseRunwayMonths:
              profile?.monthlyExpenses > 0
                ? Number((currentAssetBuffer / profile.monthlyExpenses).toFixed(1))
                : 0,
            coverageRatioPct:
              recommendedLifeCover > 0
                ? Number(((currentAssetBuffer / recommendedLifeCover) * 100).toFixed(1))
                : 0,
            formula: `10x annual income (${recommendedLifeCover.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}) minus current investment buffer (${currentAssetBuffer.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })})`,
            healthCoverRecommendation: 'Maintain at least a ₹10L family floater health policy.',
          },
        },
      });
    }

    try {
      const response = await api.post('/fire/generate', toBackendProfile(profile), {
        timeout: 20000,
      });
      setStoredProfile(profile);
      return normalizeFirePlan(response.data);
    } catch (error) {
      throw withApiErrorContext('FIRE plan generation failed.', error);
    }
  },

  async updatePlan(updatedProfile) {
    if (DEMO_MODE_ENABLED) {
      await simulateDelay(800);
      const adjustmentFactor = updatedProfile.targetRetirementAge === 55 ? 1.2 : 1;
      const recommendedLifeCover = (updatedProfile?.annualIncome ?? 0) * 10;
      const currentAssetBuffer = updatedProfile?.existingInvestments ?? 0;
      const totalGap = Math.max(recommendedLifeCover - currentAssetBuffer, 0);
      return normalizeFirePlan({
        milestones: MOCK_FIRE_MILESTONES.map((m) => ({
          ...m,
          totalCorpus: Math.round(m.totalCorpus * adjustmentFactor),
        })),
        summary: {
          targetCorpus: Math.round(24000000 * adjustmentFactor),
          yearsToFire: updatedProfile.targetRetirementAge - updatedProfile.age,
          monthlySipRequired: Math.round(70000 / adjustmentFactor),
          insuranceGap: {
            totalGap,
            lifeCoverGap: totalGap,
            recommendedLifeCover,
            currentAssetBuffer,
            incomeMultiple: 10,
            expenseRunwayMonths:
              updatedProfile?.monthlyExpenses > 0
                ? Number((currentAssetBuffer / updatedProfile.monthlyExpenses).toFixed(1))
                : 0,
            coverageRatioPct:
              recommendedLifeCover > 0
                ? Number(((currentAssetBuffer / recommendedLifeCover) * 100).toFixed(1))
                : 0,
            formula: `10x annual income (${recommendedLifeCover.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}) minus current investment buffer (${currentAssetBuffer.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })})`,
            healthCoverRecommendation: 'Maintain at least a ₹10L family floater health policy.',
          },
        },
      });
    }

    try {
      const response = await api.put('/fire/update', toBackendProfile(updatedProfile), {
        timeout: 20000,
      });
      setStoredProfile(updatedProfile);
      return normalizeFirePlan(response.data);
    } catch (error) {
      throw withApiErrorContext('FIRE plan update failed.', error);
    }
  },
};

// Tax Optimizer API
export const taxApi = {
  async uploadForm16(file) {
    if (DEMO_MODE_ENABLED) {
      await simulateDelay(1000);
      return buildDemoForm16UploadResponse(file?.name);
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/form16/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return normalizeForm16Upload(response.data);
    } catch (error) {
      throw withApiErrorContext('Form 16 upload failed.', error);
    }
  },

  async compareRegimes(profile) {
    if (DEMO_MODE_ENABLED) {
      await simulateDelay(1200);
      return normalizeTaxComparison(MOCK_TAX_COMPARISON);
    }

    try {
      const response = await api.post('/tax/compare', toBackendProfile(profile));
      setStoredProfile(profile);
      return normalizeTaxComparison(response.data);
    } catch (error) {
      throw withApiErrorContext('Tax comparison failed.', error);
    }
  },

  async getOptimizations(profile) {
    if (DEMO_MODE_ENABLED) {
      await simulateDelay(800);
      return {
        suggestions: normalizeTaxComparison(MOCK_TAX_COMPARISON).additionalInstruments,
        totalPotentialSaving: 23400,
      };
    }

    try {
      const response = await api.post('/tax/optimize', toBackendProfile(profile));
      return response.data;
    } catch (error) {
      throw withApiErrorContext('Tax optimizations unavailable.', error);
    }
  },
};

export const lifeEventApi = {
  async askAdvisor({ question, profile, scenario }) {
    if (DEMO_MODE_ENABLED) {
      await simulateDelay(600);
      return buildDemoLifeEventChatResponse({ question, profile, scenario });
    }

    try {
      const response = await api.post('/life-events/chat', {
        question,
        profile: toBackendProfile(profile),
        scenario,
      });
      const data = response.data ?? {};
      return {
        answer: data.answer ?? '',
        highlights: data.highlights ?? [],
        sources: data.sources ?? [],
        retrievedChunks: data.retrievedChunks ?? data.retrieved_chunks ?? 0,
        knowledgeLabel: data.knowledgeLabel ?? data.knowledge_label ?? '',
        eventLabel: data.eventLabel ?? data.event_label ?? '',
        metrics: {
          reserveTarget:
            data.metrics?.reserveTarget ??
            data.metrics?.reserve_target ??
            0,
          reserveShortfall:
            data.metrics?.reserveShortfall ??
            data.metrics?.reserve_shortfall ??
            0,
          taxReserve:
            data.metrics?.taxReserve ??
            data.metrics?.tax_reserve ??
            0,
          investableAfterSafety:
            data.metrics?.investableAfterSafety ??
            data.metrics?.investable_after_safety ??
            0,
        },
      };
    } catch (error) {
      const detail = error?.response?.data?.detail ?? '';
      if (
        error?.response?.status === 404 &&
        detail.toLowerCase().includes('unsupported endpoint')
      ) {
        const restartError = new Error(
          'Life-event advisor route is unavailable in the running backend. Restart the API server so it loads the new /api/life-events/chat endpoint.'
        );
        restartError.code = 404;
        throw restartError;
      }
      throw withApiErrorContext('Life-event advisor unavailable.', error);
    }
  },
};

// Health Score API
export const healthApi = {
  async getScore() {
    if (DEMO_MODE_ENABLED) {
      await simulateDelay(600);
      return normalizeHealthScore({
        dimensions: MOCK_HEALTH_SCORE,
      });
    }

    try {
      const response = await api.get('/health/score');
      return normalizeHealthScore(response.data);
    } catch (error) {
      if (error?.response?.status === 404) {
        throw new Error('Upload and analyse a statement first to generate your score, risk signals, and focus areas.');
      }
      if (error?.response?.status === 409) {
        throw new Error('Upload your statement and save a profile on the FIRE or Tax page first to generate a health score.');
      }
      throw withApiErrorContext('Health score unavailable.', error);
    }
  },
};

// User Profile API
export const userApi = {
  async getProfile() {
    if (DEMO_MODE_ENABLED) {
      await simulateDelay(300);
      return MOCK_USER_PROFILE;
    }

    try {
      const response = await api.get('/user/profile');
      const profile = toFrontendProfile(response.data?.profile ?? response.data);
      setStoredProfile(profile);
      return profile;
    } catch (error) {
      throw withApiErrorContext('User profile unavailable.', error);
    }
  },

  async updateProfile(profile) {
    if (DEMO_MODE_ENABLED) {
      await simulateDelay(500);
      return { success: true, data: profile };
    }

    try {
      const response = await api.put('/user/profile', toBackendProfile(profile));
      setStoredProfile(profile);
      return response.data;
    } catch (error) {
      throw withApiErrorContext('User profile update failed.', error);
    }
  },

  getCachedProfile() {
    return getStoredProfile();
  },

  rememberProfile(profile) {
    setStoredProfile(profile);
  },

  async clearAllData() {
    if (DEMO_MODE_ENABLED) {
      clearStoredAppData();
      return { success: true };
    }

    try {
      const response = await api.delete('/session');
      clearStoredAppData();
      return response.data;
    } catch (error) {
      throw withApiErrorContext('Failed to delete saved data.', error);
    }
  },
};

export const reportApi = {
  async getReport() {
    if (DEMO_MODE_ENABLED) {
      return null;
    }

    try {
      const response = await api.get('/report');
      return response.data?.report ?? response.data ?? null;
    } catch (error) {
      if (error?.response?.status === 404) {
        return null;
      }
      throw withApiErrorContext('Report metadata unavailable.', error);
    }
  },

  async downloadReport() {
    const response = await api.get('/report/download', {
      responseType: 'blob',
    });
    return response.data;
  },
};

// Run full pipeline
export const pipelineApi = {
  async runAnalysis(file, profile) {
    if (DEMO_MODE_ENABLED) {
      await simulateDelay(3000);
      return normalizePipelineResult({
        portfolio: MOCK_PORTFOLIO_ANALYTICS,
        rebalancing: MOCK_REBALANCING_ACTIONS,
        healthScore: MOCK_HEALTH_SCORE,
        fire: {
          milestones: MOCK_FIRE_MILESTONES,
          summary: {
            targetCorpus: 24000000,
            yearsToFire: 14,
            monthlySipRequired: 70000,
          },
        },
        tax: MOCK_TAX_COMPARISON,
      });
    }

    const formData = new FormData();
    if (file) formData.append('file', file);
    formData.append('profile', JSON.stringify(toBackendProfile(profile)));

    try {
      const response = await api.post('/pipeline/run', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return normalizePipelineResult(response.data);
    } catch (error) {
      throw withApiErrorContext('End-to-end analysis failed.', error);
    }
  },
};

export default api;
