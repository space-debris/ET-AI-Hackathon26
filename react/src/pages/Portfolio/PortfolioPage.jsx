import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PieChart, TrendingUp, Layers, IndianRupee, Download } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatCard } from '../../components/ui/StatCard';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { RuntimeNotice } from '../../components/ui/RuntimeNotice';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs';
import {
  AllocationPieChart,
  FundAllocationPieChart,
} from '../../components/charts/AllocationChart';
import { XIRRBarChart, ReturnsComparisonChart } from '../../components/charts/XIRRChart';
import { OverlapHeatmap } from '../../components/charts/OverlapHeatmap';
import { portfolioApi, reportApi, runtimeConfig, userApi } from '../../services/api';
import {
  formatCurrency,
  formatPercentage,
  calculateReturns,
  getCategoryLabel,
  getCategoryColor,
} from '../../utils/helpers';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export function PortfolioPage() {
  const [loading, setLoading] = useState(true);
  const [portfolio, setPortfolio] = useState(null);
  const [error, setError] = useState(null);
  const [reportReady, setReportReady] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        await userApi.getProfile();
      } catch {
        const cachedProfile = userApi.getCachedProfile();
        if (cachedProfile) {
          await userApi.updateProfile(cachedProfile);
        }
      }

      const [portfolioResult, reportResult] = await Promise.allSettled([
        portfolioApi.getAnalytics(),
        reportApi.getReport(),
      ]);

      if (portfolioResult.status === 'fulfilled') {
        setPortfolio(portfolioResult.value);
        setError(null);
      } else {
        console.error('Failed to fetch portfolio:', portfolioResult.reason);
        setError(portfolioResult.reason?.message || 'Portfolio analytics unavailable.');
      }

      if (reportResult.status === 'fulfilled') {
        setReportReady(Boolean(reportResult.value) || portfolioResult.status === 'fulfilled');
      } else {
        console.error('Failed to fetch report metadata:', reportResult.reason);
        setReportReady(portfolioResult.status === 'fulfilled');
      }

      setLoading(false);
    }
    fetchData();
  }, []);

  const handleDownloadReport = async () => {
    try {
      setDownloading(true);
      const blob = await reportApi.downloadReport();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = 'finsage-report.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!portfolio) {
    return (
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
        <motion.div variants={item} className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Portfolio Analysis</h1>
            <p className="mt-1 text-gray-500">
              Explore your holdings, returns, overlap, and cost drag after you upload a statement.
            </p>
          </div>
          <RuntimeNotice
          title={
            runtimeConfig.demoModeEnabled
              ? 'Demo mode is enabled for portfolio analytics.'
              : 'Upload a statement to unlock portfolio analysis.'
          }
          description={
            runtimeConfig.demoModeEnabled
              ? 'Synthetic portfolio data is shown only because demo mode is explicitly enabled.'
              : error || 'Import your CAMS or KFintech PDF to see holdings, XIRR, overlap, and expense insights here.'
          }
          variant={runtimeConfig.demoModeEnabled ? 'demo' : 'live'}
        />
        </motion.div>
        <motion.div variants={item}>
        <Card>
          <CardContent>
            <EmptyState
              title="No portfolio analysis available"
              description="Upload and process your statement to see your funds, returns, overlap, and expense drag."
            />
          </CardContent>
        </Card>
        </motion.div>
      </motion.div>
    );
  }

  const absoluteReturns = portfolio.totalCurrentValue - portfolio.totalInvested;
  const returnsPct = calculateReturns(portfolio.totalInvested, portfolio.totalCurrentValue);
  const overlapSignalsByFund = Object.entries(portfolio.overlapMatrix ?? {}).reduce(
    (acc, [stock, funds]) => {
      Object.keys(funds || {}).forEach((fundName) => {
        acc[fundName] = [...(acc[fundName] || []), stock];
      });
      return acc;
    },
    {}
  );
  const directPlanOpportunities = portfolio.holdings
    .filter(
      (holding) =>
        holding.planType === 'regular' &&
        holding.directExpenseRatio !== null &&
        holding.directExpenseRatio !== undefined &&
        holding.expenseRatio > holding.directExpenseRatio
    )
    .map((holding) => ({
      ...holding,
      annualDrag: holding.currentValue * (holding.expenseRatio - holding.directExpenseRatio),
    }))
    .sort((left, right) => right.annualDrag - left.annualDrag);
  const topExpenseOpportunity = directPlanOpportunities[0] ?? null;
  const overlapCandidates = portfolio.holdings.filter(
    (holding) => (overlapSignalsByFund[holding.fundName] || []).length > 0
  );
  const rankOverlapCandidate = (holding) =>
    ((overlapSignalsByFund[holding.fundName] || []).length * 1000) + (holding.currentValue || 0);
  const taxAwareOverlapCandidate = [...overlapCandidates]
    .filter((holding) => (holding.holdingPeriodDays ?? 0) >= 365)
    .sort((left, right) => rankOverlapCandidate(right) - rankOverlapCandidate(left))[0] || null;
  const stcgDeferredOverlapCount = overlapCandidates.filter(
    (holding) =>
      holding.holdingPeriodDays !== null &&
      holding.holdingPeriodDays !== undefined &&
      holding.holdingPeriodDays < 365
  ).length;
  const topOverlapDetail = portfolio.overlapDetails?.[0] ?? null;
  const topOverlapLabel = topOverlapDetail?.stockName ?? topOverlapDetail?.stock_name ?? Object.keys(portfolio.overlapMatrix ?? {})[0] ?? null;
  const topOverlapFundCount =
    Object.keys(topOverlapDetail?.funds ?? portfolio.overlapMatrix?.[topOverlapLabel] ?? {}).length;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={item} className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Portfolio Analysis</h1>
            <p className="text-gray-500 mt-1">
              Detailed breakdown of your mutual fund portfolio
            </p>
          </div>
          <Button
            variant="secondary"
            icon={Download}
            disabled={!reportReady || downloading}
            onClick={handleDownloadReport}
            title={
              reportReady
                ? 'Download your latest portfolio report.'
                : 'Generate your analysis first to download a report.'
            }
          >
            {downloading ? 'Preparing Report...' : 'Export PDF'}
          </Button>
        </div>
        <RuntimeNotice
          title={
            runtimeConfig.demoModeEnabled
              ? 'Demo mode is enabled for this page.'
              : 'Your latest statement powers the insights on this page.'
          }
          description={
            runtimeConfig.demoModeEnabled
              ? 'The numbers on this page are synthetic because demo mode was explicitly enabled.'
              : 'Review your allocation, fund performance, stock overlap, and annual cost drag in one place.'
          }
          variant={runtimeConfig.demoModeEnabled ? 'demo' : 'live'}
        />
      </motion.div>

      {/* Key Stats */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Value"
          value={formatCurrency(portfolio.totalCurrentValue)}
          icon={IndianRupee}
        />
        <StatCard
          title="Total Invested"
          value={formatCurrency(portfolio.totalInvested)}
          icon={PieChart}
        />
        <StatCard
          title="Absolute Returns"
          value={formatCurrency(absoluteReturns)}
          change={`${returnsPct >= 0 ? '+' : ''}${returnsPct.toFixed(1)}%`}
          changeType={returnsPct >= 0 ? 'positive' : 'negative'}
          icon={TrendingUp}
        />
        <StatCard
          title="Expense Drag"
          value={formatCurrency(portfolio.expenseRatioDragInr)}
          subtitle="Annual drag vs direct plans"
          icon={Layers}
        />
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-blue-100 bg-blue-50/70">
          <CardContent className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">
              Direct-Plan Equivalent Drag
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {formatCurrency(portfolio.expenseRatioDragInr)}
            </p>
            <p className="text-sm leading-6 text-slate-700">
              {directPlanOpportunities.length
                ? `${directPlanOpportunities.length} regular holding(s) still cost more than their direct-plan equivalents. Highest drag: ${topExpenseOpportunity.fundName} at about ${formatCurrency(topExpenseOpportunity.annualDrag)} per year.`
                : 'No regular-plan expense gap is obvious in the current portfolio snapshot.'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-emerald-100 bg-emerald-50/70">
          <CardContent className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
              Tax-Aware Rebalancing
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {taxAwareOverlapCandidate ? taxAwareOverlapCandidate.fundName.split(' ').slice(0, 2).join(' ') : 'Review'}
            </p>
            <p className="text-sm leading-6 text-slate-700">
              {taxAwareOverlapCandidate
                ? `Start with ${taxAwareOverlapCandidate.fundName}: repeated names include ${(overlapSignalsByFund[taxAwareOverlapCandidate.fundName] || []).slice(0, 3).join(', ')} and the holding appears outside the STCG window.`
                : stcgDeferredOverlapCount
                  ? `Repeated positions are visible, but ${stcgDeferredOverlapCount} overlap-heavy holding(s) still appear to be inside the STCG window. Redirect fresh SIPs before trimming if you want to stay tax-aware.`
                  : 'No overlap-driven tax-timing issue is obvious from the latest analytics.'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-100 bg-amber-50/70">
          <CardContent className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
              Strongest Overlap Signal
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {topOverlapLabel || 'None'}
            </p>
            <p className="text-sm leading-6 text-slate-700">
              {topOverlapLabel
                ? `${topOverlapLabel} appears across ${topOverlapFundCount} fund position(s), so it is the clearest stock-level duplication to address first in any overlap reduction plan.`
                : 'No repeated stock-level concentration signal was detected in the latest portfolio run.'}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs for different views */}
      <motion.div variants={item}>
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="returns">Returns</TabsTrigger>
            <TabsTrigger value="overlap">Overlap Analysis</TabsTrigger>
            <TabsTrigger value="holdings">All Holdings</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AllocationPieChart
                holdings={portfolio.holdings}
                title="Category Allocation"
              />
              <FundAllocationPieChart
                holdings={portfolio.holdings}
                title="Fund-wise Allocation"
              />
            </div>
          </TabsContent>

          {/* Returns Tab */}
          <TabsContent value="returns">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <XIRRBarChart
                fundWiseXirr={portfolio.fundWiseXirr}
                overallXirr={portfolio.overallXirr}
              />
              <ReturnsComparisonChart holdings={portfolio.holdings} />
            </div>
          </TabsContent>

          {/* Overlap Tab */}
          <TabsContent value="overlap">
            <OverlapHeatmap
              overlapMatrix={portfolio.overlapMatrix}
              overlapDetails={portfolio.overlapDetails}
              holdings={portfolio.holdings}
            />
          </TabsContent>

          {/* Holdings Tab */}
          <TabsContent value="holdings">
            <Card>
              <CardHeader>
                <CardTitle>All Holdings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                          Fund Name
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                          Category
                        </th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">
                          Invested
                        </th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">
                          Current Value
                        </th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">
                          Returns
                        </th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">
                          XIRR
                        </th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">
                          Expense Ratio
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {portfolio.holdings.map((holding, idx) => {
                        const returns = calculateReturns(
                          holding.investedAmount,
                          holding.currentValue
                        );
                        const xirr = portfolio.fundWiseXirr[holding.fundName] || 0;
                        return (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{
                                    backgroundColor: getCategoryColor(holding.category),
                                  }}
                                />
                                <div>
                                  <p className="font-medium text-gray-900 text-sm">
                                    {holding.fundName}
                                  </p>
                                  <p className="text-xs text-gray-500">{holding.isin}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-2">
                                <Badge variant="default" size="sm">
                                  {getCategoryLabel(holding.category)}
                                </Badge>
                                <Badge
                                  variant={
                                    holding.planType === 'direct' ? 'success' : 'warning'
                                  }
                                  size="sm"
                                >
                                  {holding.planType.toUpperCase()}
                                </Badge>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-right text-sm text-gray-600">
                              {formatCurrency(holding.investedAmount)}
                            </td>
                            <td className="py-4 px-4 text-right text-sm font-medium text-gray-900">
                              {formatCurrency(holding.currentValue)}
                            </td>
                            <td className="py-4 px-4 text-right">
                              <span
                                className={`text-sm font-medium ${
                                  returns >= 0 ? 'text-emerald-600' : 'text-red-600'
                                }`}
                              >
                                {returns >= 0 ? '+' : ''}
                                {returns.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <span className="text-sm font-semibold text-blue-600">
                                {formatPercentage(xirr)}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right text-sm text-gray-600">
                              <div>
                                <p>{formatPercentage(holding.expenseRatio, 2)}</p>
                                {holding.planType === 'direct' ? (
                                  <p className="mt-1 text-xs text-emerald-600">
                                    Direct plan already in place
                                  </p>
                                ) : holding.directExpenseRatio !== null &&
                                  holding.directExpenseRatio !== undefined &&
                                  holding.expenseRatio > holding.directExpenseRatio ? (
                                  <>
                                    <p className="mt-1 text-xs text-gray-500">
                                      Direct equivalent {formatPercentage(holding.directExpenseRatio, 2)}
                                    </p>
                                    <p className="mt-1 text-xs text-amber-600">
                                      Drag {formatCurrency(holding.currentValue * (holding.expenseRatio - holding.directExpenseRatio))}/yr
                                    </p>
                                  </>
                                ) : holding.directExpenseRatio !== null &&
                                  holding.directExpenseRatio !== undefined ? (
                                  <p className="mt-1 text-xs text-gray-500">
                                    Direct equivalent {formatPercentage(holding.directExpenseRatio, 2)}
                                  </p>
                                ) : (
                                  <p className="mt-1 text-xs text-gray-400">
                                    Direct-plan equivalent unavailable
                                  </p>
                                )}
                                {(overlapSignalsByFund[holding.fundName] || []).length > 0 ? (
                                  <p className="mt-1 text-xs text-blue-600">
                                    Overlap: {(overlapSignalsByFund[holding.fundName] || []).slice(0, 2).join(', ')}
                                  </p>
                                ) : null}
                                {holding.holdingPeriodDays !== null && holding.holdingPeriodDays !== undefined ? (
                                  <p className="mt-1 text-xs text-gray-500">
                                    Holding window {holding.holdingPeriodDays} days
                                  </p>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr className="font-semibold">
                        <td className="py-4 px-4 text-gray-900" colSpan={2}>
                          Total
                        </td>
                        <td className="py-4 px-4 text-right text-gray-900">
                          {formatCurrency(portfolio.totalInvested)}
                        </td>
                        <td className="py-4 px-4 text-right text-gray-900">
                          {formatCurrency(portfolio.totalCurrentValue)}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span
                            className={`${
                              returnsPct >= 0 ? 'text-emerald-600' : 'text-red-600'
                            }`}
                          >
                            {returnsPct >= 0 ? '+' : ''}
                            {returnsPct.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right text-blue-600">
                          {formatPercentage(portfolio.overallXirr)}
                        </td>
                        <td className="py-4 px-4 text-right text-gray-500">-</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>

    </motion.div>
  );
}

export default PortfolioPage;
