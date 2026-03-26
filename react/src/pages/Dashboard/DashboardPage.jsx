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
  AlertCircle,
  Sparkles,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, GradientCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatCard, GradientStatCard } from '../../components/ui/StatCard';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { AllocationPieChart } from '../../components/charts/AllocationChart';
import { portfolioApi, healthApi } from '../../services/api';
import { formatCurrency, formatPercentage, calculateReturns, getScoreColor } from '../../utils/helpers';
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

  useEffect(() => {
    async function fetchData() {
      try {
        const [portfolioData, healthData] = await Promise.all([
          portfolioApi.getAnalytics(),
          healthApi.getScore(),
        ]);
        setPortfolio(portfolioData);
        setHealthScore(healthData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
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

  const absoluteReturns = portfolio.totalCurrentValue - portfolio.totalInvested;
  const returnsPct = calculateReturns(portfolio.totalInvested, portfolio.totalCurrentValue);

  const quickActions = [
    {
      title: 'Upload Statement',
      description: 'Import CAMS/KFintech PDF',
      icon: Upload,
      path: '/upload',
      gradient: 'from-blue-500 to-indigo-600',
      iconBg: 'bg-blue-500',
    },
    {
      title: 'Portfolio X-Ray',
      description: 'Deep analysis & insights',
      icon: PieChart,
      path: '/portfolio',
      gradient: 'from-purple-500 to-pink-600',
      iconBg: 'bg-purple-500',
    },
    {
      title: 'FIRE Calculator',
      description: 'Retirement roadmap',
      icon: Flame,
      path: '/fire-planner',
      gradient: 'from-orange-500 to-red-500',
      iconBg: 'bg-orange-500',
    },
    {
      title: 'Tax Optimizer',
      description: 'Regime comparison',
      icon: Calculator,
      path: '/tax-optimizer',
      gradient: 'from-emerald-500 to-teal-600',
      iconBg: 'bg-emerald-500',
    },
  ];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* Page Header */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-gray-500 text-sm">Good morning,</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-medium rounded-full">
              <Sparkles className="h-3 w-3" /> Premium
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Your Financial Dashboard
          </h1>
        </div>
        <Link to="/upload">
          <Button icon={Upload} iconPosition="left" size="lg">
            Upload Statement
          </Button>
        </Link>
      </motion.div>

      {/* Hero Stats */}
      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="lg:col-span-2">
          <GradientStatCard
            title="Total Portfolio Value"
            value={formatCurrency(portfolio.totalCurrentValue)}
            subtitle={`${returnsPct >= 0 ? '+' : ''}${returnsPct.toFixed(1)}% all time returns`}
            icon={Wallet}
            gradient="primary"
          />
        </div>
        <StatCard
          title="Total Invested"
          value={formatCurrency(portfolio.totalInvested)}
          subtitle="Across 6 funds"
          icon={Target}
          iconColor="purple"
        />
        <StatCard
          title="Absolute Returns"
          value={formatCurrency(absoluteReturns)}
          change={formatPercentage(portfolio.overallXirr)}
          changeType={absoluteReturns >= 0 ? 'positive' : 'negative'}
          trend="XIRR"
          icon={TrendingUp}
          iconColor="green"
        />
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={item}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Quick Actions</h2>
          <span className="text-sm text-gray-400">What would you like to do?</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, idx) => (
            <Link key={idx} to={action.path}>
              <motion.div
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group relative overflow-hidden bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-xl transition-all duration-300"
              >
                {/* Gradient overlay on hover */}
                <div className={clsx(
                  'absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-5 transition-opacity duration-300',
                  action.gradient
                )} />

                <div className="relative">
                  <div className={clsx(
                    'w-12 h-12 rounded-xl flex items-center justify-center mb-4',
                    'bg-gradient-to-br shadow-lg',
                    action.gradient
                  )}>
                    <action.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                    {action.title}
                  </h3>
                  <p className="text-sm text-gray-500">{action.description}</p>

                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Main Content Grid */}
      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Allocation Chart */}
        <div className="lg:col-span-2">
          <AllocationPieChart
            holdings={portfolio.holdings}
            title="Portfolio Allocation"
          />
        </div>

        {/* Right Column - Health Score & Alerts */}
        <div className="space-y-6">
          {/* Health Score Summary */}
          <Card variant="gradient">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-purple-600" />
                <CardTitle>Health Score</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
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
                {healthScore.dimensions.slice(0, 4).map((dim, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{dim.dimension}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${dim.score}%` }}
                          transition={{ duration: 0.8, delay: 0.4 + idx * 0.1 }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: getScoreColor(dim.score) }}
                        />
                      </div>
                      <span className="text-sm font-semibold w-8 text-right" style={{ color: getScoreColor(dim.score) }}>
                        {dim.score}
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
            </CardContent>
          </Card>

          {/* Insights / Alerts */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                <CardTitle>Smart Insights</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <motion.div
                  whileHover={{ x: 4 }}
                  className="flex items-start gap-3 p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-100/50 cursor-pointer"
                >
                  <div className="w-2 h-2 mt-2 bg-amber-500 rounded-full flex-shrink-0 animate-pulse" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">High Stock Overlap</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Reliance in 4 funds — 20%+ exposure
                    </p>
                  </div>
                </motion.div>

                <motion.div
                  whileHover={{ x: 4 }}
                  className="flex items-start gap-3 p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100/50 cursor-pointer"
                >
                  <div className="w-2 h-2 mt-2 bg-blue-500 rounded-full flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Switch to Direct Plans</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Save ₹{Math.round(portfolio.expenseRatioDragInr / 1.5).toLocaleString()}+ annually
                    </p>
                  </div>
                </motion.div>

                <motion.div
                  whileHover={{ x: 4 }}
                  className="flex items-start gap-3 p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-100/50 cursor-pointer"
                >
                  <div className="w-2 h-2 mt-2 bg-emerald-500 rounded-full flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Tax Optimization</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Old regime saves you ₹63,856
                    </p>
                  </div>
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Holdings Table */}
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
                              idx === 4 && 'bg-gradient-to-br from-pink-500 to-pink-600',
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
    </motion.div>
  );
}

export default DashboardPage;
