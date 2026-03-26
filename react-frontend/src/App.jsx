import { useMemo, useState } from 'react';
import { analyzePdf } from './lib/api';

const TAB_ITEMS = [
  { key: 'profile', label: 'Profile' },
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'tax', label: 'Tax Insights' },
];

const CHART_COLORS = ['#2f7df5', '#1bb48c', '#f59f30', '#845ef7', '#ef5f7a', '#0ea5b7'];

const toINR = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.max(0, Number(value) || 0));

const toPercent = (value) => `${((Number(value) || 0) * 100).toFixed(2)}%`;
const toSignedPercent = (value) =>
  `${Number(value) > 0 ? '+' : Number(value) < 0 ? '-' : ''}${Math.abs((Number(value) || 0) * 100).toFixed(2)}%`;
const toPercentValue = (value) => `${(Number(value) || 0).toFixed(1)}%`;
const normalizeWeight = (value) => {
  const numeric = Number(value) || 0;
  return numeric > 1 ? numeric / 100 : numeric;
};
const toReadableLabel = (value) =>
  String(value || 'Unknown')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
const shortenName = (value, limit = 42) =>
  value && value.length > limit ? `${value.slice(0, limit - 1)}…` : value || 'Unavailable';

function getFundReturnRatio(holding) {
  if (holding?.xirr != null && Number.isFinite(Number(holding.xirr))) {
    return Number(holding.xirr);
  }
  if (holding?.absolute_return != null && Number.isFinite(Number(holding.absolute_return))) {
    return Number(holding.absolute_return) / 100;
  }

  const invested = Number(holding?.invested_amount) || 0;
  const current = Number(holding?.current_value) || 0;
  return invested > 0 ? (current - invested) / invested : 0;
}

function FinSageLogo({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="56" height="56" rx="16" fill="url(#finsage-grad)" />
      <circle cx="44" cy="20" r="7" fill="rgba(255,255,255,0.34)" />
      <path d="M18 22H46V28H18V22Z" fill="white" fillOpacity="0.95" />
      <path d="M18 33H38V39H18V33Z" fill="white" fillOpacity="0.92" />
      <path d="M18 44H32V50H18V44Z" fill="white" fillOpacity="0.85" />
      <defs>
        <linearGradient id="finsage-grad" x1="10" y1="8" x2="54" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0B67D0" />
          <stop offset="1" stopColor="#54A9FF" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function MetricCard({ label, value, caption, tone = 'blue' }) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      {caption ? <p>{caption}</p> : null}
    </article>
  );
}

function SectionHeader({ eyebrow, title, description, chip }) {
  return (
    <div className="section-header">
      <div>
        {eyebrow ? <span className="section-eyebrow">{eyebrow}</span> : null}
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      {chip ? <span className="section-chip">{chip}</span> : null}
    </div>
  );
}

function AllocationDonut({ title, subtitle, items, centerLabel, centerValue, emptyMessage }) {
  if (!items.length) {
    return (
      <article className="chart-card">
        <div className="chart-head">
          <h4>{title}</h4>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <p className="empty-state">{emptyMessage}</p>
      </article>
    );
  }

  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
  let cursor = 0;
  const gradientStops = items
    .map((item) => {
      const start = cursor;
      cursor += (item.value / total) * 360;
      return `${item.color} ${start.toFixed(2)}deg ${cursor.toFixed(2)}deg`;
    })
    .join(', ');

  return (
    <article className="chart-card">
      <div className="chart-head">
        <h4>{title}</h4>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="donut-layout">
        <div className="donut-chart" style={{ background: `conic-gradient(${gradientStops})` }}>
          <div className="donut-hole">
            <span>{centerLabel}</span>
            <strong>{centerValue}</strong>
          </div>
        </div>
        <div className="legend-list">
          {items.map((item) => (
            <div key={item.label} className="legend-item">
              <span className="legend-dot" style={{ background: item.color }} />
              <div>
                <strong>{item.label}</strong>
                <span>{toPercentValue(item.value)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function RankedBars({ title, subtitle, items, emptyMessage, valueFormatter, subtitleFormatter }) {
  if (!items.length) {
    return (
      <article className="chart-card">
        <div className="chart-head">
          <h4>{title}</h4>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <p className="empty-state">{emptyMessage}</p>
      </article>
    );
  }

  const max = Math.max(...items.map((item) => Math.abs(item.value)), 1);

  return (
    <article className="chart-card">
      <div className="chart-head">
        <h4>{title}</h4>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="ranked-bars">
        {items.map((item) => (
          <div key={item.label} className="rank-row">
            <div className="rank-copy">
              <strong>{item.label}</strong>
              {subtitleFormatter ? <span>{subtitleFormatter(item)}</span> : null}
            </div>
            <div className="rank-track">
              <div
                className={`rank-fill ${item.negative ? 'negative' : ''}`}
                style={{
                  width: `${Math.max(10, (Math.abs(item.value) / max) * 100)}%`,
                  background: item.color || undefined,
                }}
              />
            </div>
            <span className="rank-value">{valueFormatter(item.value, item)}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function ProjectionBars({ invested, current, projected }) {
  const bars = [
    { label: 'Invested', value: invested, color: 'linear-gradient(180deg, #96bfff, #4a90f7)' },
    { label: 'Current', value: current, color: 'linear-gradient(180deg, #61b8ff, #1f77e0)' },
    { label: 'Projected', value: projected, color: 'linear-gradient(180deg, #66d0b0, #119f73)' },
  ];
  const max = Math.max(...bars.map((bar) => bar.value), 1);

  return (
    <div className="projection-bars">
      {bars.map((bar) => (
        <div key={bar.label} className="projection-col">
          <span>{bar.label}</span>
          <div className="projection-track">
            <div
              className="projection-fill"
              style={{
                height: `${Math.max(18, (bar.value / max) * 100)}%`,
                background: bar.color,
              }}
            />
          </div>
          <strong>{toINR(bar.value)}</strong>
        </div>
      ))}
    </div>
  );
}

function oldRegimeTax(taxableIncome) {
  if (taxableIncome <= 0) return 0;
  let tax = 0;
  const slabs = [
    { upto: 250000, rate: 0 },
    { upto: 500000, rate: 0.05 },
    { upto: 1000000, rate: 0.2 },
    { upto: Infinity, rate: 0.3 },
  ];

  let lower = 0;
  slabs.forEach((slab) => {
    if (taxableIncome > lower) {
      const upper = Math.min(taxableIncome, slab.upto);
      tax += (upper - lower) * slab.rate;
      lower = slab.upto;
    }
  });
  return tax;
}

function newRegimeTax(taxableIncome) {
  if (taxableIncome <= 0) return 0;
  let tax = 0;
  const slabs = [
    { upto: 400000, rate: 0 },
    { upto: 800000, rate: 0.05 },
    { upto: 1200000, rate: 0.1 },
    { upto: 1600000, rate: 0.15 },
    { upto: 2000000, rate: 0.2 },
    { upto: 2400000, rate: 0.25 },
    { upto: Infinity, rate: 0.3 },
  ];

  let lower = 0;
  slabs.forEach((slab) => {
    if (taxableIncome > lower) {
      const upper = Math.min(taxableIncome, slab.upto);
      tax += (upper - lower) * slab.rate;
      lower = slab.upto;
    }
  });
  return tax;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('profile');
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [common, setCommon] = useState({
    age: 30,
    retirementAge: 60,
    annualIncome: 1800000,
    monthlyInvestment: 15000,
    other80C: 0,
    riskAppetite: 'Moderate',
    includeTaxOptimization: true,
  });

  const analytics = result?.analytics || null;
  const holdings = analytics?.holdings || [];
  const categoryAllocation = analytics?.category_allocation || {};
  const overlapDetails = analytics?.overlap_details || [];
  const yearsToRetirement = Math.max(0, Number(common.retirementAge) - Number(common.age));

  const projectedCorpus = useMemo(() => {
    if (!analytics || yearsToRetirement <= 0) return 0;
    const currentValue = Number(analytics.total_current_value) || 0;
    const yearly = (Number(common.monthlyInvestment) || 0) * 12;
    const growth = Math.max(0, Number(analytics.overall_xirr) || 0);

    let corpus = currentValue;
    for (let year = 0; year < yearsToRetirement; year += 1) {
      corpus = (corpus + yearly) * (1 + growth);
    }
    return corpus;
  }, [analytics, yearsToRetirement, common.monthlyInvestment]);

  const taxComparison = useMemo(() => {
    const grossIncome = Math.max(0, Number(common.annualIncome) || 0);
    const standardOld = 50000;
    const standardNew = 75000;
    const invested = Number(analytics?.total_invested) || 0;
    const eligible80C = Math.min(150000, Math.max(0, Number(common.other80C) + invested));

    const oldTaxable = Math.max(0, grossIncome - standardOld - eligible80C);
    const oldBase = oldRegimeTax(oldTaxable);
    const oldCess = oldBase * 0.04;
    const oldTotal = oldBase + oldCess;

    const newTaxable = Math.max(0, grossIncome - standardNew);
    const newBase = newRegimeTax(newTaxable);
    const newCess = newBase * 0.04;
    const newTotal = newBase + newCess;

    return {
      grossIncome,
      eligible80C,
      old: { taxable: oldTaxable, base: oldBase, cess: oldCess, total: oldTotal },
      newer: { taxable: newTaxable, base: newBase, cess: newCess, total: newTotal },
    };
  }, [common.annualIncome, common.other80C, analytics?.total_invested]);

  const recommendedRegime =
    taxComparison.old.total <= taxComparison.newer.total ? 'Old Regime' : 'New Regime';

  const categoryItems = useMemo(
    () =>
      Object.entries(categoryAllocation)
        .map(([label, value], index) => ({
          label: toReadableLabel(label),
          value: Number(value) || 0,
          color: CHART_COLORS[index % CHART_COLORS.length],
        }))
        .filter((item) => item.value > 0)
        .sort((a, b) => b.value - a.value),
    [categoryAllocation],
  );

  const amcItems = useMemo(() => {
    const rawMap =
      analytics?.amc_allocation && Object.keys(analytics.amc_allocation).length
        ? analytics.amc_allocation
        : holdings.reduce((acc, holding) => {
            const key = holding.amc || 'Unknown AMC';
            const current = Number(holding.current_value) || 0;
            acc[key] = (acc[key] || 0) + current;
            return acc;
          }, {});

    const sourceItems = Object.entries(rawMap).map(([label, value]) => ({
      label: toReadableLabel(label),
      rawValue: Number(value) || 0,
    }));

    const total = sourceItems.reduce((sum, item) => sum + item.rawValue, 0);

    return sourceItems
      .map((item, index) => ({
        label: item.label,
        value: total > 100 ? (item.rawValue / total) * 100 : item.rawValue,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [analytics?.amc_allocation, holdings]);

  const fundValueItems = useMemo(
    () =>
      [...holdings]
        .sort((a, b) => (Number(b.current_value) || 0) - (Number(a.current_value) || 0))
        .slice(0, 5)
        .map((holding, index) => ({
          label: shortenName(holding.fund_name, 46),
          value: Number(holding.current_value) || 0,
          color: CHART_COLORS[index % CHART_COLORS.length],
          subtitle: `${toReadableLabel(holding.category)} • ${toSignedPercent(getFundReturnRatio(holding))}`,
        })),
    [holdings],
  );

  const performanceItems = useMemo(
    () =>
      [...holdings]
        .map((holding, index) => ({
          label: shortenName(holding.fund_name, 40),
          value: getFundReturnRatio(holding) * 100,
          negative: getFundReturnRatio(holding) < 0,
          color:
            getFundReturnRatio(holding) < 0
              ? 'linear-gradient(90deg, #ff9a9e, #ef5f7a)'
              : `linear-gradient(90deg, ${CHART_COLORS[index % CHART_COLORS.length]}, #76b6ff)`,
          subtitle: `${toINR(holding.current_value)} current value`,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6),
    [holdings],
  );

  const overlapItems = useMemo(
    () =>
      [...overlapDetails]
        .map((item, index) => ({
          label: shortenName(item.stock_name, 34),
          value: (Number(item.total_portfolio_exposure) || 0) * 100,
          color: CHART_COLORS[index % CHART_COLORS.length],
          subtitle: `${Object.keys(item.funds || {}).length} funds involved`,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5),
    [overlapDetails],
  );

  const stockExposureItems = useMemo(() => {
    const totalPortfolioValue = Number(analytics?.total_current_value) || 0;
    if (!totalPortfolioValue) return [];

    const exposureMap = holdings.reduce((acc, holding) => {
      const currentValue = Number(holding.current_value) || 0;
      const shareOfPortfolio = currentValue / totalPortfolioValue;

      (holding.top_holdings || []).forEach((stock) => {
        const weight = normalizeWeight(stock.weight);
        if (weight <= 0) return;
        acc[stock.stock_name] = (acc[stock.stock_name] || 0) + shareOfPortfolio * weight * 100;
      });

      return acc;
    }, {});

    return Object.entries(exposureMap)
      .map(([label, value], index) => ({
        label: shortenName(label, 32),
        value: Number(value) || 0,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [analytics?.total_current_value, holdings]);

  const profileStory = useMemo(() => {
    if (!analytics) return null;

    const totalCurrentValue = Number(analytics.total_current_value) || 0;
    const totalInvested = Number(analytics.total_invested) || 0;
    const gain = totalCurrentValue - totalInvested;
    const gainRatio = totalInvested > 0 ? gain / totalInvested : 0;
    const bestCategory = categoryItems[0];
    const biggestFund = [...holdings].sort(
      (a, b) => (Number(b.current_value) || 0) - (Number(a.current_value) || 0),
    )[0];
    const directCount = holdings.filter((holding) => holding.plan_type === 'direct').length;
    const regularCount = holdings.length - directCount;

    return {
      gain,
      gainRatio,
      projectionMultiple: totalCurrentValue > 0 ? projectedCorpus / totalCurrentValue : 0,
      bestCategory,
      biggestFund,
      directCount,
      regularCount,
      expenseDragShare:
        totalCurrentValue > 0
          ? ((Number(analytics.expense_ratio_drag_inr) || 0) / totalCurrentValue) * 100
          : 0,
    };
  }, [analytics, categoryItems, holdings, projectedCorpus]);

  const handleAnalyze = async () => {
    if (!file) {
      setError('Please select a CAMS PDF first.');
      return;
    }

    try {
      setError('');
      setLoading(true);
      const userProfile = {
        risk_appetite: common.riskAppetite,
        investment_horizon_years: yearsToRetirement,
        monthly_investment: Number(common.monthlyInvestment) || 0,
        fire_goal_amount: 0,
        include_tax_optimization: common.includeTaxOptimization,
      };
      const response = await analyzePdf(file, userProfile);
      setResult(response);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'Failed to analyze statement.');
    } finally {
      setLoading(false);
    }
  };

  if (!onboardingDone) {
    return (
      <div className="planner-shell">
        <section className="onboarding-card">
          <div className="onboarding-head">
            <FinSageLogo className="brand-logo-lg" />
            <div>
              <h1>FinSage Portfolio Planner</h1>
              <p>Enter common details once. Backend analysis reuses these preferences.</p>
            </div>
          </div>

          <div className="form-grid">
            <label>
              <span>Age</span>
              <input
                type="number"
                value={common.age}
                onChange={(e) => setCommon((prev) => ({ ...prev, age: Number(e.target.value) || 0 }))}
              />
            </label>
            <label>
              <span>Retirement Age</span>
              <input
                type="number"
                value={common.retirementAge}
                onChange={(e) =>
                  setCommon((prev) => ({ ...prev, retirementAge: Number(e.target.value) || 0 }))
                }
              />
            </label>
            <label>
              <span>Annual Income (INR)</span>
              <input
                type="number"
                value={common.annualIncome}
                onChange={(e) =>
                  setCommon((prev) => ({ ...prev, annualIncome: Number(e.target.value) || 0 }))
                }
              />
            </label>
            <label>
              <span>Monthly Investment (INR)</span>
              <input
                type="number"
                value={common.monthlyInvestment}
                onChange={(e) =>
                  setCommon((prev) => ({ ...prev, monthlyInvestment: Number(e.target.value) || 0 }))
                }
              />
            </label>
            <label>
              <span>Risk Appetite</span>
              <input
                type="text"
                value={common.riskAppetite}
                onChange={(e) => setCommon((prev) => ({ ...prev, riskAppetite: e.target.value }))}
              />
            </label>
            <label>
              <span>Other 80C Investments (INR)</span>
              <input
                type="number"
                value={common.other80C}
                onChange={(e) =>
                  setCommon((prev) => ({ ...prev, other80C: Number(e.target.value) || 0 }))
                }
              />
            </label>
          </div>

          {Number(common.retirementAge) <= Number(common.age) ? (
            <p className="error-text">Retirement age must be greater than current age.</p>
          ) : null}

          <div className="onboarding-actions">
            <button
              type="button"
              className="primary-btn"
              onClick={() => setOnboardingDone(true)}
              disabled={Number(common.retirementAge) <= Number(common.age)}
            >
              Continue to Dashboard
            </button>
          </div>
        </section>
      </div>
    );
  }

  const taxSavings = Math.abs(taxComparison.old.total - taxComparison.newer.total);
  const betterWithOld = recommendedRegime === 'Old Regime';
  const comparisonMax = Math.max(taxComparison.old.total, taxComparison.newer.total, 1);

  return (
    <div className="planner-shell">
      <nav className="top-nav">
        <div className="nav-content">
          <div className="brand">
            <FinSageLogo className="brand-logo-sm" />
            <span>FinSage</span>
          </div>
          <div className="nav-tabs">
            {TAB_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`tab-btn ${activeTab === item.key ? 'active' : ''}`}
                onClick={() => setActiveTab(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button type="button" className="secondary-btn" onClick={() => setOnboardingDone(false)}>
            Edit Onboarding
          </button>
        </div>
      </nav>

      <main className="planner-layout">
        <section className="main-pane">
          <header className="top-header">
            <div className="header-title-wrap">
              <span className="section-eyebrow">Live Analysis Workspace</span>
              <h2>Portfolio Analysis Dashboard</h2>
              <p className="header-subtitle">
                Upload a CAMS statement to unlock a richer dashboard across profile, portfolio, and tax views.
              </p>
            </div>

            <div className="analysis-launcher">
              <div className="launcher-row">
                <div className="file-picker">
                  <label htmlFor="cams-upload" className="file-picker-btn">
                    Choose CAMS PDF
                  </label>
                  <input
                    id="cams-upload"
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    hidden
                  />
                  <p className="file-name">{file ? file.name : 'No statement selected'}</p>
                </div>

                <div className="launcher-actions">
                  <button type="button" className="primary-btn mini" onClick={handleAnalyze} disabled={loading}>
                    {loading ? 'Analyzing...' : 'Analyze PDF'}
                  </button>
                </div>
              </div>
            </div>

            {error ? <p className="error-text">{error}</p> : null}
          </header>

          {!analytics ? (
            <section className="panel empty-panel">
              <SectionHeader
                eyebrow="Ready When You Are"
                title="Run analysis to populate the dashboard"
                description="The UI is prepared for visual portfolio insights, but it only renders real data after a statement is uploaded and parsed."
              />
              <div className="empty-illustration">
                <div className="empty-orbit" />
                <div className="empty-copy">
                  <strong>What will appear next</strong>
                  <p>Allocation donuts, concentration bars, fund performance rankings, overlap hotspots, and a clearer tax comparison.</p>
                </div>
              </div>
            </section>
          ) : null}

          {analytics && activeTab === 'profile' ? (
            <div className="tab-stack">
              <section className="panel">
                <SectionHeader
                  eyebrow="Profile Snapshot"
                  title="Portfolio momentum and retirement readiness"
                  description="A front-end interpretation of the backend numbers, designed to surface progress, concentration, and portfolio shape at a glance."
                  chip={`${result.transaction_count} transactions parsed`}
                />
                <div className="metric-grid">
                  <MetricCard
                    label="Current Portfolio Value"
                    value={toINR(analytics.total_current_value)}
                    caption={`${holdings.length} active funds tracked`}
                    tone="blue"
                  />
                  <MetricCard
                    label="Net Wealth Created"
                    value={toINR(profileStory?.gain || 0)}
                    caption={`${toSignedPercent(profileStory?.gainRatio || 0)} vs invested capital`}
                    tone={(profileStory?.gain || 0) >= 0 ? 'emerald' : 'coral'}
                  />
                  <MetricCard
                    label="Overall XIRR"
                    value={toPercent(analytics.overall_xirr)}
                    caption={`${yearsToRetirement} year runway to retirement`}
                    tone="violet"
                  />
                  <MetricCard
                    label="Projected Retirement Corpus"
                    value={toINR(projectedCorpus)}
                    caption={`${(profileStory?.projectionMultiple || 0).toFixed(1)}x from current value`}
                    tone="amber"
                  />
                </div>
              </section>

              <section className="panel story-panel">
                <div className="story-grid">
                  <article className="story-card story-card-hero">
                    <span className="story-eyebrow">Readiness Projection</span>
                    <h4>{toINR(projectedCorpus)}</h4>
                    <p>
                      If the current SIP pace of {toINR(common.monthlyInvestment)} continues and the portfolio compounds near{' '}
                      {toPercent(analytics.overall_xirr)}, the portfolio could scale materially over the next {yearsToRetirement}{' '}
                      years.
                    </p>
                    <ProjectionBars
                      invested={analytics.total_invested}
                      current={analytics.total_current_value}
                      projected={projectedCorpus}
                    />
                  </article>

                  <article className="story-card">
                    <span className="story-eyebrow">Portfolio Pulse</span>
                    <div className="signal-list">
                      <div className="signal-row">
                        <span>Dominant category</span>
                        <strong>
                          {profileStory?.bestCategory ? profileStory.bestCategory.label : 'Unavailable'}
                        </strong>
                        <em>
                          {profileStory?.bestCategory ? toPercentValue(profileStory.bestCategory.value) : 'No category data'}
                        </em>
                      </div>
                      <div className="signal-row">
                        <span>Largest fund</span>
                        <strong>
                          {profileStory?.biggestFund ? shortenName(profileStory.biggestFund.fund_name, 40) : 'Unavailable'}
                        </strong>
                        <em>
                          {profileStory?.biggestFund ? toINR(profileStory.biggestFund.current_value) : 'No fund data'}
                        </em>
                      </div>
                      <div className="signal-row">
                        <span>Expense drag estimate</span>
                        <strong>{toINR(analytics.expense_ratio_drag_inr)}</strong>
                        <em>{toPercentValue(profileStory?.expenseDragShare || 0)} of current value</em>
                      </div>
                      <div className="signal-row">
                        <span>Plan mix</span>
                        <strong>
                          {profileStory?.directCount || 0} direct / {profileStory?.regularCount || 0} regular
                        </strong>
                        <em>{toINR(common.monthlyInvestment)} monthly contribution assumption</em>
                      </div>
                      <div className="signal-row">
                        <span>Backend raw text size</span>
                        <strong>{result.raw_text_length.toLocaleString()} chars</strong>
                        <em>Useful for parser confidence checks</em>
                      </div>
                    </div>
                  </article>
                </div>
              </section>

              <section className="panel">
                <div className="viz-grid">
                  <AllocationDonut
                    title="Category Mix"
                    subtitle="Quick view of portfolio spread by fund category"
                    items={categoryItems.slice(0, 5)}
                    centerLabel="Largest bucket"
                    centerValue={categoryItems[0] ? toPercentValue(categoryItems[0].value) : '0%'}
                    emptyMessage="Category allocation unavailable for this statement."
                  />
                  <RankedBars
                    title="Top Funds by Current Value"
                    subtitle="Largest positions that shape current portfolio behavior"
                    items={fundValueItems}
                    emptyMessage="No holdings available for visualization."
                    valueFormatter={(value) => toINR(value)}
                    subtitleFormatter={(item) => item.subtitle}
                  />
                </div>
              </section>
            </div>
          ) : null}

          {analytics && activeTab === 'portfolio' ? (
            <div className="tab-stack">
              <section className="panel">
                <SectionHeader
                  eyebrow="Portfolio Drill Down"
                  title="Allocation, performance, and concentration"
                  description="This view layers additional presentation logic on the same backend analytics so the statement analysis reads more like a professional dashboard."
                  chip={`${overlapDetails.length} overlap flags`}
                />
                <div className="metric-grid">
                  <MetricCard
                    label="Total Current Value"
                    value={toINR(analytics.total_current_value)}
                    caption={`${toINR(analytics.total_invested)} invested`}
                    tone="blue"
                  />
                  <MetricCard
                    label="Expense Drag"
                    value={toINR(analytics.expense_ratio_drag_inr)}
                    caption="Estimated annual cost difference vs direct alternatives"
                    tone="amber"
                  />
                  <MetricCard
                    label="Category Buckets"
                    value={String(categoryItems.length)}
                    caption={categoryItems[0] ? `${categoryItems[0].label} leads the mix` : 'No category mapping found'}
                    tone="violet"
                  />
                  <MetricCard
                    label="AMC Spread"
                    value={String(amcItems.length)}
                    caption={amcItems[0] ? `${amcItems[0].label} has the highest share` : 'AMC allocation unavailable'}
                    tone="emerald"
                  />
                </div>
              </section>

              <section className="panel">
                <div className="viz-grid">
                  <AllocationDonut
                    title="Category Allocation"
                    subtitle="Share of current portfolio value by fund bucket"
                    items={categoryItems.slice(0, 6)}
                    centerLabel="Top category"
                    centerValue={categoryItems[0] ? categoryItems[0].label : 'Unavailable'}
                    emptyMessage="Category allocation unavailable for this statement."
                  />
                  <RankedBars
                    title="AMC Concentration"
                    subtitle="Institution exposure concentration across asset managers"
                    items={amcItems}
                    emptyMessage="AMC allocation data unavailable."
                    valueFormatter={(value) => toPercentValue(value)}
                    subtitleFormatter={() => 'Portfolio share'}
                  />
                </div>
              </section>

              <section className="panel">
                <div className="viz-grid">
                  <RankedBars
                    title="Fund Performance Board"
                    subtitle="Funds ranked by XIRR when available, otherwise by absolute return"
                    items={performanceItems}
                    emptyMessage="Performance data unavailable."
                    valueFormatter={(value) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`}
                    subtitleFormatter={(item) => item.subtitle}
                  />
                  <RankedBars
                    title="Overlap Hotspots"
                    subtitle="Stocks appearing across multiple funds"
                    items={overlapItems}
                    emptyMessage="No meaningful overlap detected from the available factsheet data."
                    valueFormatter={(value) => toPercentValue(value)}
                    subtitleFormatter={(item) => item.subtitle}
                  />
                </div>
              </section>

              <section className="panel">
                <div className="viz-grid">
                  <RankedBars
                    title="Underlying Stock Exposure"
                    subtitle="Aggregated top-stock presence across the current mutual fund book"
                    items={stockExposureItems}
                    emptyMessage="Underlying stock holdings were not available in the statement factsheet lookup."
                    valueFormatter={(value) => toPercentValue(value)}
                  />
                  <article className="chart-card">
                    <div className="chart-head">
                      <h4>Holdings Ledger</h4>
                      <p>Full backend holdings table with cleaner presentation</p>
                    </div>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Fund</th>
                            <th>Category</th>
                            <th>Current Value</th>
                            <th>Invested</th>
                            <th>Return</th>
                          </tr>
                        </thead>
                        <tbody>
                          {holdings.map((holding) => {
                            const returnRatio = getFundReturnRatio(holding);
                            return (
                              <tr key={`${holding.fund_name}-${holding.isin || 'na'}`}>
                                <td className="fund-cell">
                                  <strong>{holding.fund_name}</strong>
                                  <span>{holding.amc || 'AMC unavailable'}</span>
                                </td>
                                <td>
                                  <span className="table-badge">{toReadableLabel(holding.category)}</span>
                                </td>
                                <td>{toINR(holding.current_value)}</td>
                                <td>{toINR(holding.invested_amount)}</td>
                                <td className={returnRatio < 0 ? 'negative-text' : 'positive-text'}>
                                  {toSignedPercent(returnRatio)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </article>
                </div>
              </section>
            </div>
          ) : null}

          {analytics && activeTab === 'tax' ? (
            <div className="tab-stack">
              <section className="panel">
                <SectionHeader
                  eyebrow="Tax Inputs"
                  title="Scenario controls for regime comparison"
                  description="Only the UI presentation changes here. The tax cards below re-express the same frontend comparison logic with more structured visuals."
                  chip={`${recommendedRegime} recommended`}
                />
                <div className="form-grid compact">
                  <label>
                    <span>Annual Income (INR)</span>
                    <input
                      type="number"
                      value={common.annualIncome}
                      onChange={(e) =>
                        setCommon((prev) => ({ ...prev, annualIncome: Number(e.target.value) || 0 }))
                      }
                    />
                  </label>
                  <label>
                    <span>Other 80C (INR)</span>
                    <input
                      type="number"
                      value={common.other80C}
                      onChange={(e) =>
                        setCommon((prev) => ({ ...prev, other80C: Number(e.target.value) || 0 }))
                      }
                    />
                  </label>
                  <label>
                    <span>Backend Invested Amount (INR)</span>
                    <input type="number" value={Math.round(analytics.total_invested)} disabled />
                  </label>
                </div>
              </section>

              <section className="panel">
                <div className="tax-hero-grid">
                  <article className={`tax-card ${betterWithOld ? 'recommended-card' : ''}`}>
                    <span className="story-eyebrow">Old Regime</span>
                    <h4>{toINR(taxComparison.old.total)}</h4>
                    <p>After standard deduction and eligible 80C benefits, this route taxes {toINR(taxComparison.old.taxable)} of income.</p>
                    <div className="tax-rate-pill">
                      Effective rate {(taxComparison.old.total / Math.max(taxComparison.grossIncome, 1) * 100).toFixed(1)}%
                    </div>
                  </article>
                  <article className={`tax-card ${!betterWithOld ? 'recommended-card new' : 'new'}`}>
                    <span className="story-eyebrow">New Regime</span>
                    <h4>{toINR(taxComparison.newer.total)}</h4>
                    <p>This route uses the higher standard deduction but skips 80C-based relief in the current UI logic.</p>
                    <div className="tax-rate-pill">
                      Effective rate {(taxComparison.newer.total / Math.max(taxComparison.grossIncome, 1) * 100).toFixed(1)}%
                    </div>
                  </article>
                  <article className="tax-card savings-card">
                    <span className="story-eyebrow">Decision Signal</span>
                    <h4>{recommendedRegime}</h4>
                    <p>Potential difference between the two routes based on the current inputs.</p>
                    <strong>{toINR(taxSavings)}</strong>
                  </article>
                </div>

                <div className="compare-rail">
                  <div className="compare-track">
                    <div className="compare-fill old" style={{ width: `${(taxComparison.old.total / comparisonMax) * 100}%` }}>
                      Old
                    </div>
                  </div>
                  <div className="compare-track">
                    <div
                      className="compare-fill new"
                      style={{ width: `${(taxComparison.newer.total / comparisonMax) * 100}%` }}
                    >
                      New
                    </div>
                  </div>
                </div>
              </section>

              <section className="panel">
                <div className="step-grid">
                  <article>
                    <h4>Old Regime Steps</h4>
                    <ol>
                      <li>Gross income: {toINR(taxComparison.grossIncome)}</li>
                      <li>Less standard deduction: {toINR(50000)}</li>
                      <li>Less eligible 80C (incl. invested): {toINR(taxComparison.eligible80C)}</li>
                      <li>Taxable income: {toINR(taxComparison.old.taxable)}</li>
                      <li>Base tax: {toINR(taxComparison.old.base)}</li>
                      <li>Cess (4%): {toINR(taxComparison.old.cess)}</li>
                      <li>Total tax: {toINR(taxComparison.old.total)}</li>
                    </ol>
                  </article>
                  <article>
                    <h4>New Regime Steps</h4>
                    <ol>
                      <li>Gross income: {toINR(taxComparison.grossIncome)}</li>
                      <li>Less standard deduction: {toINR(75000)}</li>
                      <li>Taxable income: {toINR(taxComparison.newer.taxable)}</li>
                      <li>Base tax: {toINR(taxComparison.newer.base)}</li>
                      <li>Cess (4%): {toINR(taxComparison.newer.cess)}</li>
                      <li>Total tax: {toINR(taxComparison.newer.total)}</li>
                    </ol>
                  </article>
                </div>
              </section>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
