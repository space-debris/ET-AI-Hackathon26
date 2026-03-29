import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  PieChart,
  Flame,
  Calculator,
  Activity,
  Upload,
  ArrowRight,
  Wallet,
  Target,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatCard, GradientStatCard } from '../../components/ui/StatCard';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { RuntimeNotice } from '../../components/ui/RuntimeNotice';
import { AllocationPieChart } from '../../components/charts/AllocationChart';
import { portfolioApi, healthApi, runtimeConfig } from '../../services/api';
import {
  formatCurrency,
  formatPercentage,
  calculateReturns,
  getCategoryLabel,
  getScoreColor,
  humanizeLabel,
} from '../../utils/helpers';
import { clsx } from 'clsx';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
  },
};

export function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [portfolio, setPortfolio] = useState(null);
  const [healthScore, setHealthScore] = useState(null);
  const [noticeVariant, setNoticeVariant] = useState('live');
  const [noticeDescription, setNoticeDescription] = useState('');
  const [showNotice, setShowNotice] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const [portfolioResult, healthResult] = await Promise.allSettled([
        portfolioApi.getAnalytics(),
        healthApi.getScore(),
      ]);

      if (portfolioResult.status === 'fulfilled') {
        setPortfolio(portfolioResult.value);
      } else {
        console.error('Failed to fetch portfolio data:', portfolioResult.reason);
        const message = portfolioResult.reason?.message || 'Portfolio analytics unavailable.';
        const isEmptySession =
          portfolioResult.reason?.code === 404 ||
          message.toLowerCase().includes('cached for this session');
        if (isEmptySession) {
          setShowNotice(false);
          setNoticeVariant('live');
          setNoticeDescription('');
        } else {
          setShowNotice(true);
          setNoticeVariant('error');
          setNoticeDescription(message);
        }
      }

      if (healthResult.status === 'fulfilled') {
        setHealthScore(healthResult.value);
      }

      setLoading(false);
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-500 font-medium">Loading your portfolio...</p>
        </div>
      </div>
    );
  }

  const quickActions = [
    {
      title: 'Upload Statement',
      description: 'Start by importing your CAMS or KFintech PDF',
      icon: Upload,
      path: '/upload',
      gradient: 'from-blue-500 to-indigo-600',
    },
    {
      title: 'Portfolio X-Ray',
      description: 'Review allocation, overlap, XIRR, and expense drag',
      icon: PieChart,
      path: '/portfolio',
      gradient: 'from-purple-500 to-pink-600',
    },
    {
      title: 'FIRE Calculator',
      description: 'Build a retirement roadmap from your profile',
      icon: Flame,
      path: '/fire-planner',
      gradient: 'from-orange-500 to-red-500',
    },
    {
      title: 'Tax Optimizer',
      description: 'Compare old vs new regime and spot savings',
      icon: Calculator,
      path: '/tax-optimizer',
      gradient: 'from-emerald-500 to-teal-600',
    },
  ];

  const healthDimensions = healthScore?.dimensions ?? [];
  const showRuntimeNotice = runtimeConfig.demoModeEnabled || showNotice;
  const overlapSignalCount = portfolio ? Object.keys(portfolio.overlapMatrix ?? {}).length : 0;
  const regularPlanCount = portfolio
    ? portfolio.holdings.filter((holding) => holding.planType !== 'direct').length
    : 0;
  const directPlanCount = portfolio
    ? portfolio.holdings.filter((holding) => holding.planType === 'direct').length
    : 0;
  const strongestHealthDimension = healthDimensions.length
    ? [...healthDimensions].sort((left, right) => right.score - left.score)[0]
    : null;
  const topHolding = portfolio
    ? [...portfolio.holdings].sort((left, right) => right.currentValue - left.currentValue)[0] ?? null
    : null;
  const largestCategory = portfolio
    ? Object.entries(portfolio.categoryAllocation ?? {}).sort((left, right) => right[1] - left[1])[0] ?? null
    : null;
  const leadCategory = portfolio
    ? Object.entries(portfolio.categoryAllocation ?? {})
        .filter(([category]) => category !== 'other')
        .sort((left, right) => right[1] - left[1])[0] ?? largestCategory
    : null;
  const portfolioGain = portfolio
    ? portfolio.totalCurrentValue - portfolio.totalInvested
    : 0;
  const portfolioGainRate =
    portfolio && portfolio.totalInvested > 0
      ? portfolioGain / portfolio.totalInvested
      : 0;
  const leadCategoryLabel = leadCategory
    ? leadCategory[0] === 'other'
      ? 'Diversified / Other'
      : getCategoryLabel(leadCategory[0])
    : 'Category mix unavailable';

  const smartInsights = portfolio
    ? [
        {
          title: 'High Stock Overlap',
          body: Object.keys(portfolio.overlapMatrix).length
            ? `${Object.keys(portfolio.overlapMatrix)[0]} appears in ${Object.keys(
                portfolio.overlapMatrix[Object.keys(portfolio.overlapMatrix)[0]]
              ).length} funds in the current analysis.`
            : 'No stock overlap signal is present in the current analytics payload.',
          tone: 'amber',
        },
        {
          title: 'Switch to Direct Plans',
          body: `Annual expense drag in the current portfolio is ${formatCurrency(
            portfolio.expenseRatioDragInr
          )}.`,
          tone: 'blue',
        },
        {
          title: 'Health Focus Area',
          body: healthDimensions.length
            ? `${healthDimensions[0].dimension} is scoring ${healthDimensions[0].score}/100 in the current analysis.`
            : 'No health-score payload is available yet.',
          tone: 'emerald',
        },
      ]
    : [];

  const smartInsightStats = portfolio
    ? [
        {
          label: 'Funds tracked',
          value: String(portfolio.holdings.length),
          tone: 'blue',
        },
        {
          label: 'Overlap signals',
          value: String(overlapSignalCount),
          tone: 'amber',
        },
        {
          label: strongestHealthDimension ? 'Best score' : 'Regular plans',
          value: strongestHealthDimension
            ? `${strongestHealthDimension.score}/100`
            : String(regularPlanCount),
          tone: 'emerald',
        },
      ]
    : [];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Your Financial Dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-gray-500">
            Start with your profile or upload a CAMS or KFintech statement to unlock portfolio insights, tax comparisons, health score, and your FIRE roadmap.
          </p>
        </div>
        <Link to="/upload">
          <Button icon={Upload} iconPosition="left" size="lg">
            Upload Statement
          </Button>
        </Link>
      </motion.div>

      {showRuntimeNotice && (
        <motion.div variants={item}>
          <RuntimeNotice
            title={
              runtimeConfig.demoModeEnabled
                ? 'Demo mode is enabled for this dashboard.'
                : 'We could not load your latest dashboard data.'
            }
            description={
              runtimeConfig.demoModeEnabled
                ? 'Synthetic data appears only because demo mode was explicitly enabled.'
                : noticeDescription
            }
            variant={runtimeConfig.demoModeEnabled ? 'demo' : noticeVariant}
          />
        </motion.div>
      )}

      <motion.div variants={item}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Quick Actions</h2>
          <span className="text-sm text-gray-400">Choose how you want to get started</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action, idx) => (
            <Link key={idx} to={action.path} className="h-full">
              <motion.div
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group relative flex h-full min-h-[124px] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-sm transition-all duration-300 hover:shadow-xl"
              >
                <div className={clsx(
                  'absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-5 transition-opacity duration-300',
                  action.gradient
                )} />

                <div className="relative flex h-full flex-col items-start">
                  <div className={clsx(
                    'mb-2 flex h-10 w-10 items-center justify-center rounded-xl',
                    'bg-gradient-to-br shadow-lg',
                    action.gradient
                  )}>
                    <action.icon className="h-[18px] w-[18px] text-white" />
                  </div>
                  <div className="pr-7">
                    <h3 className="text-[1.02rem] font-semibold leading-tight text-gray-900 transition-colors group-hover:text-blue-600">
                      {action.title}
                    </h3>
                    <p className="mt-1 text-sm leading-5 text-gray-500">{action.description}</p>
                  </div>

                  <div className="absolute right-0 top-0 opacity-0 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0 group-hover:opacity-100">
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      </motion.div>

      {!portfolio && (
        <motion.div variants={item}>
          <Card>
            <CardContent>
              <EmptyState
                title="Your dashboard will fill in as you go"
                description="Upload a statement for portfolio insights, or start right away with the FIRE Planner and Tax Optimizer using profile details only."
              />
            </CardContent>
          </Card>
        </motion.div>
      )}

      {portfolio && (
        <>
          <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            <div className="lg:col-span-2">
              <GradientStatCard
                title="Total Portfolio Value"
                value={formatCurrency(portfolio.totalCurrentValue)}
                subtitle={`${calculateReturns(portfolio.totalInvested, portfolio.totalCurrentValue).toFixed(1)}% all time returns`}
                icon={Wallet}
                gradient="primary"
              />
            </div>
            <StatCard
              title="Total Invested"
              value={formatCurrency(portfolio.totalInvested)}
              subtitle={`Across ${portfolio.holdings.length} funds`}
              icon={Target}
              iconColor="purple"
            />
            <StatCard
              title="Absolute Returns"
              value={formatCurrency(portfolio.totalCurrentValue - portfolio.totalInvested)}
              change={formatPercentage(portfolio.overallXirr)}
              changeType={portfolio.totalCurrentValue >= portfolio.totalInvested ? 'positive' : 'negative'}
              trend="XIRR"
              icon={TrendingUp}
              iconColor="green"
            />
          </motion.div>

          <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <AllocationPieChart
                holdings={portfolio.holdings}
                title="Portfolio Allocation"
              />
            </div>

            <div>
              <Card variant="gradient">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-purple-600" />
                    <CardTitle>Health Score</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {healthScore ? (
                    <>
                      <div className="text-center mb-6">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', bounce: 0.4, delay: 0.2 }}
                          className="relative inline-flex items-center justify-center"
                        >
                          <svg className="w-32 h-32">
                            <circle
                              className="text-gray-100"
                              strokeWidth="8"
                              stroke="currentColor"
                              fill="transparent"
                              r="56"
                              cx="64"
                              cy="64"
                            />
                            <circle
                              className="text-purple-500"
                              strokeWidth="8"
                              strokeLinecap="round"
                              stroke="currentColor"
                              fill="transparent"
                              r="56"
                              cx="64"
                              cy="64"
                              strokeDasharray={`${healthScore.overallScore * 3.52} 352`}
                              strokeDashoffset="0"
                              transform="rotate(-90 64 64)"
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span
                              className="text-4xl font-bold"
                              style={{ color: getScoreColor(healthScore.overallScore) }}
                            >
                              {healthScore.overallScore}
                            </span>
                            <span className="text-xs text-gray-400 font-medium">/ 100</span>
                          </div>
                        </motion.div>
                      </div>

                      <div className="space-y-3">
                        {healthScore.dimensions.slice(0, 4).map((dimension, idx) => (
                          <div key={idx} className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">
                              {humanizeLabel(dimension.dimension)}
                            </span>
                            <div className="flex items-center gap-3">
                              <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${dimension.score}%` }}
                                  transition={{ duration: 0.8, delay: 0.4 + idx * 0.1 }}
                                  className="h-full rounded-full"
                                  style={{ backgroundColor: getScoreColor(dimension.score) }}
                                />
                              </div>
                              <span className="text-sm font-semibold w-8 text-right" style={{ color: getScoreColor(dimension.score) }}>
                                {dimension.score}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <Link to="/health-score">
                        <Button variant="ghost" fullWidth className="mt-5">
                          View Full Analysis
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </Link>
                    </>
                  ) : (
                    <EmptyState
                      title="Health score unavailable"
                      description="Run a portfolio analysis to generate your health score and improvement areas."
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </motion.div>

          <motion.div variants={item}>
            <Card className="overflow-hidden border-gray-100 bg-gradient-to-r from-white via-slate-50 to-blue-50/40">
              <CardHeader>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-amber-500" />
                      <CardTitle>Smart Insights</CardTitle>
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      One quick read of your portfolio mix, momentum, costs, and next actions.
                    </p>
                  </div>
                  <div
                    className={clsx(
                      'inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold',
                      portfolioGain >= 0
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-red-50 text-red-700'
                    )}
                  >
                    {portfolioGain >= 0 ? '+' : '-'}
                    {formatCurrency(Math.abs(portfolioGain))} net gain
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 lg:grid-cols-[1.25fr_0.95fr]">
                  <div className="space-y-3">
                    {smartInsights.map((insight, idx) => (
                      <motion.div
                        key={idx}
                        whileHover={{ x: 4 }}
                        className={clsx(
                          'flex items-start gap-3 rounded-xl border p-4',
                          insight.tone === 'amber' && 'border-amber-100/70 bg-gradient-to-r from-amber-50 to-orange-50',
                          insight.tone === 'blue' && 'border-blue-100/70 bg-gradient-to-r from-blue-50 to-indigo-50',
                          insight.tone === 'emerald' && 'border-emerald-100/70 bg-gradient-to-r from-emerald-50 to-teal-50'
                        )}
                      >
                        <div
                          className={clsx(
                            'mt-2 h-2 w-2 rounded-full flex-shrink-0',
                            insight.tone === 'amber' && 'bg-amber-500',
                            insight.tone === 'blue' && 'bg-blue-500',
                            insight.tone === 'emerald' && 'bg-emerald-500'
                          )}
                        />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{insight.title}</p>
                          <p className="mt-0.5 text-sm text-gray-500">{insight.body}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-blue-100 bg-white/90 p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-gray-400">
                        <Wallet className="h-4 w-4 text-blue-500" />
                        <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">
                          Top Fund
                        </span>
                      </div>
                      <p className="mt-3 line-clamp-2 text-base font-semibold leading-7 text-gray-900">
                        {topHolding ? topHolding.fundName : 'Not available'}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {topHolding
                          ? `${formatCurrency(topHolding.currentValue)} currently allocated here`
                          : 'Upload a statement to populate fund-level insights.'}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-amber-100 bg-white/90 p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-gray-400">
                        <Target className="h-4 w-4 text-amber-500" />
                        <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">
                          Category Tilt
                        </span>
                      </div>
                      <p className="mt-3 text-base font-semibold text-gray-900">
                        {leadCategoryLabel}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {leadCategory
                          ? `${leadCategory[1].toFixed(1)}% of the portfolio is concentrated here.`
                          : 'Category allocation will appear after analytics loads.'}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-emerald-100 bg-white/90 p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-gray-400">
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                        <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">
                          Momentum
                        </span>
                      </div>
                      <p className="mt-3 text-base font-semibold text-gray-900">
                        {formatPercentage(portfolio.overallXirr)} XIRR
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {portfolioGain >= 0 ? '+' : ''}
                        {formatPercentage(portfolioGainRate)} since invested capital started compounding.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-purple-100 bg-white/90 p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-gray-400">
                        <PieChart className="h-4 w-4 text-purple-500" />
                        <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">
                          Plan Mix
                        </span>
                      </div>
                      <p className="mt-3 text-base font-semibold text-gray-900">
                        {directPlanCount} direct / {regularPlanCount} regular
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {regularPlanCount > 0
                          ? `${formatCurrency(portfolio.expenseRatioDragInr)} annual drag is still worth reviewing.`
                          : 'No regular-plan drag is showing up in this snapshot.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white/70 p-4">
                  <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
                    <div className="grid grid-cols-3 gap-3">
                      {smartInsightStats.map((stat) => (
                        <div
                          key={stat.label}
                          className={clsx(
                            'rounded-xl border px-3 py-3',
                            stat.tone === 'amber' && 'border-amber-100 bg-amber-50/70',
                            stat.tone === 'blue' && 'border-blue-100 bg-blue-50/70',
                            stat.tone === 'emerald' && 'border-emerald-100 bg-emerald-50/70'
                          )}
                        >
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
                            {stat.label}
                          </p>
                          <p className="mt-2 text-lg font-bold text-gray-900">{stat.value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-3 md:min-w-[250px]">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Action lane</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {regularPlanCount > 0
                            ? `${regularPlanCount} fund${regularPlanCount === 1 ? '' : 's'} still look like regular plans.`
                            : 'Your current snapshot has no regular-plan signal to review.'}
                        </p>
                      </div>
                      <Link to="/portfolio" className="shrink-0">
                        <Button variant="ghost" size="sm">
                          Open Portfolio
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Your Mutual Funds</CardTitle>
                    <p className="text-sm text-gray-500 mt-1">Performance breakdown by fund</p>
                  </div>
                  <Link to="/portfolio">
                    <Button variant="secondary" size="sm" icon={ArrowRight} iconPosition="right">
                      View All
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-6 px-6">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Fund Name</th>
                        <th className="text-right py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Invested</th>
                        <th className="text-right py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Current</th>
                        <th className="text-right py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Returns</th>
                        <th className="text-right py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">XIRR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {portfolio.holdings.slice(0, 5).map((holding, idx) => {
                        const returns = calculateReturns(holding.investedAmount, holding.currentValue);
                        const xirr = portfolio.fundWiseXirr[holding.fundName] || 0;
                        return (
                          <motion.tr
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.5 + idx * 0.05 }}
                            className="group hover:bg-gray-50/50 transition-colors"
                          >
                            <td className="py-4">
                              <div className="flex items-center gap-3">
                                <div className={clsx(
                                  'w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm',
                                  idx === 0 && 'bg-gradient-to-br from-blue-500 to-blue-600',
                                  idx === 1 && 'bg-gradient-to-br from-purple-500 to-purple-600',
                                  idx === 2 && 'bg-gradient-to-br from-emerald-500 to-emerald-600',
                                  idx === 3 && 'bg-gradient-to-br from-orange-500 to-orange-600',
                                  idx === 4 && 'bg-gradient-to-br from-pink-500 to-pink-600'
                                )}>
                                  {holding.fundName.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">
                                    {holding.fundName.split(' ').slice(0, 3).join(' ')}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <Badge variant="default" size="sm">
                                      {holding.category.replace('_', ' ')}
                                    </Badge>
                                    <Badge
                                      variant={holding.planType === 'direct' ? 'success' : 'warning'}
                                      size="sm"
                                    >
                                      {holding.planType}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="text-right py-4 text-sm text-gray-600 font-medium number-display">
                              {formatCurrency(holding.investedAmount)}
                            </td>
                            <td className="text-right py-4 text-sm font-semibold text-gray-900 number-display">
                              {formatCurrency(holding.currentValue)}
                            </td>
                            <td className="text-right py-4">
                              <span className={clsx(
                                'inline-flex items-center px-2 py-1 rounded-lg text-sm font-semibold',
                                returns >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                              )}>
                                {returns >= 0 ? '+' : ''}{returns.toFixed(1)}%
                              </span>
                            </td>
                            <td className="text-right py-4">
                              <span className="text-sm font-bold text-blue-600 number-display">
                                {formatPercentage(xirr)}
                              </span>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}

export default DashboardPage;
