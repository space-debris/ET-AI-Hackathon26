import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PieChart, TrendingUp, Layers, DollarSign, Download } from 'lucide-react';
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
import { portfolioApi, runtimeConfig } from '../../services/api';
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

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await portfolioApi.getAnalytics();
        setPortfolio(data);
      } catch (error) {
        console.error('Failed to fetch portfolio:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="space-y-6">
        <RuntimeNotice
          title={
            runtimeConfig.demoModeEnabled
              ? 'Demo mode is enabled for portfolio analytics.'
              : 'Portfolio analytics need a processed statement.'
          }
          description={
            runtimeConfig.demoModeEnabled
              ? 'Synthetic portfolio data is shown only because demo mode is explicitly enabled.'
              : error || 'Upload and process a CAMS or KFintech PDF before this page can render live analytics.'
          }
          variant={runtimeConfig.demoModeEnabled ? 'demo' : error ? 'error' : 'live'}
        />
        <Card>
          <CardContent>
            <EmptyState
              title="No portfolio analysis available"
              description="This page does not invent holdings or returns before a statement is parsed."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const absoluteReturns = portfolio.totalCurrentValue - portfolio.totalInvested;
  const returnsPct = calculateReturns(portfolio.totalInvested, portfolio.totalCurrentValue);

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
            disabled
            title="Report download stays disabled until a real backend report object exists."
          >
            Export PDF
          </Button>
        </div>
        <RuntimeNotice
          title={
            runtimeConfig.demoModeEnabled
              ? 'Demo mode is enabled for this page.'
              : 'This page reflects portfolio analytics only after statement processing succeeds.'
          }
          description={
            runtimeConfig.demoModeEnabled
              ? 'The numbers on this page are synthetic because demo mode was explicitly enabled.'
              : 'If parsing or analytics fail, the page remains empty instead of silently swapping to sample holdings.'
          }
          variant={runtimeConfig.demoModeEnabled ? 'demo' : 'live'}
        />
      </motion.div>

      {/* Key Stats */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Value"
          value={formatCurrency(portfolio.totalCurrentValue)}
          icon={DollarSign}
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
          subtitle="Annual cost impact"
          icon={Layers}
        />
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
            <OverlapHeatmap overlapMatrix={portfolio.overlapMatrix} />
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
                              {formatPercentage(holding.expenseRatio, 2)}
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

      {/* Top Holdings Analysis */}
      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <CardTitle>Top Stock Holdings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {portfolio.holdings.slice(0, 3).map((fund, idx) => (
                <div key={idx} className="border border-gray-100 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 text-sm mb-3">
                    {fund.fundName.split(' ').slice(0, 3).join(' ')}
                  </h4>
                  <div className="space-y-2">
                    {fund.topHoldings.slice(0, 5).map((stock, sIdx) => (
                      <div key={sIdx} className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">{stock.stockName}</span>
                        <span className="text-sm font-medium text-gray-900">
                          {(stock.weight * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

export default PortfolioPage;
