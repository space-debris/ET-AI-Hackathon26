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
const SESSION_STORAGE_KEY = 'finsage-session-id';

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
    summary:
      insuranceGap.summary ??
      insuranceGap.notes ??
      insuranceGap.recommendation ??
      null,
    ...insuranceGap,
  };
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
      fire.expectedRetirementDate ??
      fire.expected_retirement_date ??
      summary.expectedRetirementDate ??
      null,
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

const toBackendProfile = (profile = {}) => ({
  age: profile.age,
  annual_income: profile.annualIncome ?? profile.annual_income ?? 0,
  monthly_expenses: profile.monthlyExpenses ?? profile.monthly_expenses ?? 0,
  existing_investments: toExistingInvestmentsMap(
    profile.existingInvestments ?? profile.existing_investments
  ),
  target_retirement_age:
    profile.targetRetirementAge ?? profile.target_retirement_age ?? null,
  target_monthly_corpus:
    profile.targetMonthlyCorpus ?? profile.target_monthly_corpus ?? null,
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
      throw withApiErrorContext('Rebalancing recommendations unavailable.', error);
    }
  },
};

// FIRE Planner API
export const fireApi = {
  async generatePlan(profile) {
    if (DEMO_MODE_ENABLED) {
      await simulateDelay(1500);
      return normalizeFirePlan({
        milestones: MOCK_FIRE_MILESTONES,
        summary: {
          targetCorpus: 24000000,
          yearsToFire: 14,
          monthlySipRequired: 70000,
          insuranceGap: 5000000,
        },
      });
    }

    try {
      const response = await api.post('/fire/generate', toBackendProfile(profile));
      return normalizeFirePlan(response.data);
    } catch (error) {
      throw withApiErrorContext('FIRE plan generation failed.', error);
    }
  },

  async updatePlan(updatedProfile) {
    if (DEMO_MODE_ENABLED) {
      await simulateDelay(800);
      const adjustmentFactor = updatedProfile.targetRetirementAge === 55 ? 1.2 : 1;
      return normalizeFirePlan({
        milestones: MOCK_FIRE_MILESTONES.map((m) => ({
          ...m,
          totalCorpus: Math.round(m.totalCorpus * adjustmentFactor),
        })),
        summary: {
          targetCorpus: Math.round(24000000 * adjustmentFactor),
          yearsToFire: updatedProfile.targetRetirementAge - updatedProfile.age,
          monthlySipRequired: Math.round(70000 / adjustmentFactor),
          insuranceGap: 5000000,
        },
      });
    }

    try {
      const response = await api.put('/fire/update', toBackendProfile(updatedProfile));
      return normalizeFirePlan(response.data);
    } catch (error) {
      throw withApiErrorContext('FIRE plan update failed.', error);
    }
  },
};

// Tax Optimizer API
export const taxApi = {
  async compareRegimes(profile) {
    if (DEMO_MODE_ENABLED) {
      await simulateDelay(1200);
      return normalizeTaxComparison(MOCK_TAX_COMPARISON);
    }

    try {
      const response = await api.post('/tax/compare', toBackendProfile(profile));
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
      return toFrontendProfile(response.data?.profile ?? response.data);
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
      return response.data;
    } catch (error) {
      throw withApiErrorContext('User profile update failed.', error);
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
