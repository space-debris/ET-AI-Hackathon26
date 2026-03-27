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
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { RuntimeNotice } from '../../components/ui/RuntimeNotice';
import { portfolioApi, runtimeConfig } from '../../services/api';
import { getActionColor } from '../../utils/helpers';
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
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await portfolioApi.getRebalancingPlan();
        setRecommendations(data);
      } catch (fetchError) {
        console.error('Failed to fetch recommendations:', fetchError);
        setError(fetchError.message);
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

  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="space-y-6">
        <RuntimeNotice
          title={
            runtimeConfig.demoModeEnabled
              ? 'Demo mode is enabled for rebalancing.'
              : 'Rebalancing needs a completed portfolio analysis.'
          }
          description={
            runtimeConfig.demoModeEnabled
              ? 'Synthetic recommendations are shown only because demo mode is explicitly enabled.'
              : error || 'No recommendation list is shown until a real statement has been processed.'
          }
          variant={runtimeConfig.demoModeEnabled ? 'demo' : error ? 'error' : 'live'}
        />
        <Card>
          <CardContent>
            <EmptyState
              title="No rebalancing recommendations available"
              description="This page does not fabricate actions before analytics exist."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const actionCounts = recommendations.reduce((acc, recommendation) => {
    acc[recommendation.action] = (acc[recommendation.action] || 0) + 1;
    return acc;
  }, {});
  const switchCount = recommendations.filter((item) => item.action === 'switch').length;
  const reduceCount = recommendations.filter((item) => item.action === 'reduce').length;
  const taxAwareCount = recommendations.filter((item) => item.taxImpact).length;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      <motion.div variants={item}>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-100 rounded-xl">
            <FileText className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Rebalancing Recommendations</h1>
            <p className="text-gray-500">
              Fund-level actions should come from backend advisory output, not frontend heuristics.
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div variants={item}>
        <RuntimeNotice
          title={
            runtimeConfig.demoModeEnabled
              ? 'Demo mode is enabled for this page.'
              : 'This page should remain empty if backend advisory output is unavailable.'
          }
          description={
            runtimeConfig.demoModeEnabled
              ? 'These recommendations are synthetic because demo mode was explicitly enabled.'
              : 'No silent fallback to sample fund actions should occur in live mode.'
          }
          variant={runtimeConfig.demoModeEnabled ? 'demo' : 'live'}
        />
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(actionCounts).map(([action, count]) => (
          <Card key={action}>
            <CardContent className="py-4 text-center">
              <Badge variant={getActionColor(action)} size="lg" className="mb-2">
                {action.toUpperCase()}
              </Badge>
              <p className="text-2xl font-bold text-gray-900">{count}</p>
              <p className="text-sm text-gray-500">{count === 1 ? 'Fund' : 'Funds'}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      <motion.div variants={item}>
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Compliance Notice</p>
            <p className="text-sm text-amber-700">
              These recommendations are for educational purposes only. Consult a
              SEBI-registered investment advisor before acting on them.
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div variants={item} className="space-y-4">
        {recommendations.map((recommendation, idx) => {
          const ActionIcon = actionIcons[recommendation.action] || Clock;
          return (
            <Card key={idx} className="overflow-hidden">
              <div
                className={clsx(
                  'h-1',
                  recommendation.action === 'hold' && 'bg-emerald-500',
                  recommendation.action === 'exit' && 'bg-red-500',
                  recommendation.action === 'reduce' && 'bg-amber-500',
                  recommendation.action === 'switch' && 'bg-blue-500'
                )}
              />
              <CardContent className="pt-4">
                <div className="flex items-start gap-4">
                  <div
                    className={clsx(
                      'p-3 rounded-lg flex-shrink-0',
                      recommendation.action === 'hold' && 'bg-emerald-100',
                      recommendation.action === 'exit' && 'bg-red-100',
                      recommendation.action === 'reduce' && 'bg-amber-100',
                      recommendation.action === 'switch' && 'bg-blue-100'
                    )}
                  >
                    <ActionIcon
                      className={clsx(
                        'h-6 w-6',
                        recommendation.action === 'hold' && 'text-emerald-600',
                        recommendation.action === 'exit' && 'text-red-600',
                        recommendation.action === 'reduce' && 'text-amber-600',
                        recommendation.action === 'switch' && 'text-blue-600'
                      )}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">{recommendation.fundName}</h3>
                      <Badge variant={getActionColor(recommendation.action)}>
                        {recommendation.action.toUpperCase()}
                        {recommendation.percentage ? ` ${recommendation.percentage}%` : ''}
                      </Badge>
                    </div>

                    {recommendation.targetFund && (
                      <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 rounded-lg">
                        <ArrowRight className="h-4 w-4 text-blue-600" />
                        <span className="text-sm text-blue-700">
                          Switch to: <strong>{recommendation.targetFund}</strong>
                        </span>
                      </div>
                    )}

                    <p className="text-sm text-gray-600 mb-3">{recommendation.rationale}</p>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">Tax Impact:</span>
                        <span
                          className={clsx(
                            'font-medium',
                            recommendation.taxImpact.includes('No') ||
                              recommendation.taxImpact.includes('LTCG')
                              ? 'text-emerald-600'
                              : 'text-amber-600'
                          )}
                        >
                          {recommendation.taxImpact || 'Not provided'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    <Button variant="ghost" size="sm" disabled>
                      Details <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </motion.div>

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
                    .filter((item) => item.action === 'switch')
                    .map((item, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        <span>Switch {item.fundName.split(' ')[0]} as recommended by the backend.</span>
                      </li>
                    ))}
                  {recommendations
                    .filter((item) => item.action === 'reduce')
                    .map((item, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-amber-500 rounded-full" />
                        <span>
                          Reduce {item.fundName.split(' ')[0]}
                          {item.percentage ? ` by ${item.percentage}%` : ''}.
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Observed Signals</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span>{switchCount} switch action(s) explicitly target alternative funds.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span>{reduceCount} reduce action(s) address overlap or concentration.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span>{taxAwareCount} recommendation(s) include tax-impact context.</span>
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
