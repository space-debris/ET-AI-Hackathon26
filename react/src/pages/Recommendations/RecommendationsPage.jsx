import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingDown,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { portfolioApi } from '../../services/api';
import { formatCurrency, getActionColor } from '../../utils/helpers';
import { clsx } from 'clsx';

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

const actionIcons = {
  hold: CheckCircle,
  exit: TrendingDown,
  reduce: AlertCircle,
  switch: ArrowRight,
  increase: TrendingDown,
};

export function RecommendationsPage() {
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await portfolioApi.getRebalancingPlan();
        setRecommendations(data);
      } catch (error) {
        console.error('Failed to fetch recommendations:', error);
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

  const actionCounts = recommendations.reduce((acc, r) => {
    acc[r.action] = (acc[r.action] || 0) + 1;
    return acc;
  }, {});

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={item}>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-100 rounded-xl">
            <FileText className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Rebalancing Recommendations</h1>
            <p className="text-gray-500">
              AI-powered, tax-aware suggestions for optimizing your portfolio
            </p>
          </div>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(actionCounts).map(([action, count]) => (
          <Card key={action}>
            <CardContent className="py-4 text-center">
              <Badge variant={getActionColor(action)} size="lg" className="mb-2">
                {action.toUpperCase()}
              </Badge>
              <p className="text-2xl font-bold text-gray-900">{count}</p>
              <p className="text-sm text-gray-500">
                {count === 1 ? 'Fund' : 'Funds'}
              </p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Disclaimer */}
      <motion.div variants={item}>
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Compliance Notice</p>
            <p className="text-sm text-amber-700">
              These recommendations are for educational purposes only. Please consult a
              SEBI-registered investment advisor before making any investment decisions.
              Past performance does not guarantee future returns.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Recommendations List */}
      <motion.div variants={item} className="space-y-4">
        {recommendations.map((rec, idx) => {
          const ActionIcon = actionIcons[rec.action] || Clock;
          return (
            <Card key={idx} className="overflow-hidden">
              <div
                className={clsx(
                  'h-1',
                  rec.action === 'hold' && 'bg-emerald-500',
                  rec.action === 'exit' && 'bg-red-500',
                  rec.action === 'reduce' && 'bg-amber-500',
                  rec.action === 'switch' && 'bg-blue-500'
                )}
              />
              <CardContent className="pt-4">
                <div className="flex items-start gap-4">
                  <div
                    className={clsx(
                      'p-3 rounded-lg flex-shrink-0',
                      rec.action === 'hold' && 'bg-emerald-100',
                      rec.action === 'exit' && 'bg-red-100',
                      rec.action === 'reduce' && 'bg-amber-100',
                      rec.action === 'switch' && 'bg-blue-100'
                    )}
                  >
                    <ActionIcon
                      className={clsx(
                        'h-6 w-6',
                        rec.action === 'hold' && 'text-emerald-600',
                        rec.action === 'exit' && 'text-red-600',
                        rec.action === 'reduce' && 'text-amber-600',
                        rec.action === 'switch' && 'text-blue-600'
                      )}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">{rec.fundName}</h3>
                      <Badge variant={getActionColor(rec.action)}>
                        {rec.action.toUpperCase()} {rec.percentage}%
                      </Badge>
                    </div>

                    {rec.targetFund && (
                      <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 rounded-lg">
                        <ArrowRight className="h-4 w-4 text-blue-600" />
                        <span className="text-sm text-blue-700">
                          Switch to: <strong>{rec.targetFund}</strong>
                        </span>
                      </div>
                    )}

                    <p className="text-sm text-gray-600 mb-3">{rec.rationale}</p>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">Tax Impact:</span>
                        <span
                          className={clsx(
                            'font-medium',
                            rec.taxImpact.includes('No') ||
                              rec.taxImpact.includes('LTCG')
                              ? 'text-emerald-600'
                              : 'text-amber-600'
                          )}
                        >
                          {rec.taxImpact}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    <Button variant="ghost" size="sm">
                      Details <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </motion.div>

      {/* Summary Actions */}
      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <CardTitle>Implementation Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Immediate Actions</h4>
                <ul className="space-y-2">
                  {recommendations
                    .filter((r) => r.action === 'switch')
                    .map((r, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        <span>Switch {r.fundName.split(' ')[0]} to Direct plan</span>
                      </li>
                    ))}
                  {recommendations
                    .filter((r) => r.action === 'reduce')
                    .map((r, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-amber-500 rounded-full" />
                        <span>
                          Reduce {r.fundName.split(' ')[0]} by {r.percentage}%
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Expected Benefits</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span>Annual expense savings: ~₹8,500</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span>Reduced stock overlap: 15% less concentration</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span>Better diversification across categories</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

export default RecommendationsPage;
