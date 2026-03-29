import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingDown,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { RuntimeNotice } from '../../components/ui/RuntimeNotice';
import { portfolioApi, runtimeConfig, userApi } from '../../services/api';
import { formatCurrency, formatFundDisplayName, formatPercentage, getActionColor } from '../../utils/helpers';
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
  const [portfolio, setPortfolio] = useState(null);
  const [error, setError] = useState(null);
  const [expandedRecommendation, setExpandedRecommendation] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        try {
          await userApi.getProfile();
        } catch {
          const cachedProfile = userApi.getCachedProfile();
          if (cachedProfile) {
            await userApi.updateProfile(cachedProfile);
          }
        }

        const [rebalancingResult, portfolioResult] = await Promise.allSettled([
          portfolioApi.getRebalancingPlan(),
          portfolioApi.getAnalytics(),
        ]);

        if (rebalancingResult.status === 'fulfilled') {
          setRecommendations(rebalancingResult.value);
        } else {
          throw rebalancingResult.reason;
        }

        if (portfolioResult.status === 'fulfilled') {
          setPortfolio(portfolioResult.value);
        } else {
          console.error('Portfolio context unavailable for recommendations:', portfolioResult.reason);
        }
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
                View fund-level suggestions based on your portfolio analysis.
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div variants={item}>
        <RuntimeNotice
          title={
            runtimeConfig.demoModeEnabled
              ? 'Demo mode is enabled for rebalancing.'
              : 'Complete your portfolio analysis to unlock recommendations.'
          }
          description={
            runtimeConfig.demoModeEnabled
              ? 'Synthetic recommendations are shown only because demo mode is explicitly enabled.'
              : error || 'Upload and analyse your statement first to see rebalancing suggestions, tax context, and next steps.'
          }
          variant={runtimeConfig.demoModeEnabled ? 'demo' : 'live'}
        />
        </motion.div>
        <Card>
          <CardContent>
            <EmptyState
              title="No rebalancing recommendations available"
              description="Upload a statement and run portfolio analysis to see fund-level recommendations."
            />
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const actionCounts = recommendations.reduce((acc, recommendation) => {
    acc[recommendation.action] = (acc[recommendation.action] || 0) + 1;
    return acc;
  }, {});
  const switchCount = recommendations.filter((item) => item.action === 'switch').length;
  const reduceCount = recommendations.filter((item) => item.action === 'reduce').length;
  const taxAwareCount = recommendations.filter((item) => item.taxImpact).length;
  const holdingsByFund = new Map((portfolio?.holdings ?? []).map((holding) => [holding.fundName, holding]));
  const overlapSignalsByFund = Object.entries(portfolio?.overlapMatrix ?? {}).reduce(
    (acc, [stock, funds]) => {
      Object.keys(funds || {}).forEach((fundName) => {
        acc[fundName] = [...(acc[fundName] || []), stock];
      });
      return acc;
    },
    {}
  );
  const getRecommendationContext = (recommendation) => {
    const holding = holdingsByFund.get(recommendation.fundName);
    const overlapSignals = overlapSignalsByFund[recommendation.fundName] || [];
    const hasDirectGap = Boolean(
      holding &&
      holding.planType === 'regular' &&
      holding.directExpenseRatio !== null &&
      holding.directExpenseRatio !== undefined &&
      holding.expenseRatio > holding.directExpenseRatio
    );
    const annualDrag = hasDirectGap
      ? holding.currentValue * (holding.expenseRatio - holding.directExpenseRatio)
      : 0;
    const taxSafeNow = holding
      ? holding.holdingPeriodDays !== null && holding.holdingPeriodDays !== undefined
        ? holding.holdingPeriodDays >= 365
        : /outside the STCG window|LTCG|No immediate tax action|No tax impact/i.test(recommendation.taxImpact || '')
      : /outside the STCG window|LTCG|No immediate tax action|No tax impact/i.test(recommendation.taxImpact || '');
    const hasStcgCaution = holding
      ? holding.holdingPeriodDays !== null && holding.holdingPeriodDays !== undefined
        ? holding.holdingPeriodDays < 365
        : /STCG|wait until|short-term/i.test(recommendation.taxImpact || '')
      : /STCG|wait until|short-term/i.test(recommendation.taxImpact || '');

    return {
      holding,
      overlapSignals,
      hasDirectGap,
      annualDrag,
      taxSafeNow,
      hasStcgCaution,
    };
  };
  const recommendationContexts = recommendations.map((recommendation) => ({
    recommendation,
    context: getRecommendationContext(recommendation),
  }));
  const directPlanSavings = recommendationContexts.reduce(
    (sum, item) => sum + item.context.annualDrag,
    0
  );
  const overlapManagedCount = recommendationContexts.filter(
    (item) => item.context.overlapSignals.length > 0 || item.recommendation.action === 'reduce'
  ).length;
  const taxSafeNowCount = recommendationContexts.filter((item) => item.context.taxSafeNow).length;
  const getTargetDisplayName = (recommendation, context) => {
    if (recommendation.targetFund) {
      return formatFundDisplayName(recommendation.targetFund, { includePlan: true });
    }
    if (recommendation.action === 'switch' && context?.hasDirectGap) {
      return `${formatFundDisplayName(recommendation.fundName)} (Direct Plan)`;
    }
    return null;
  };

  const getNextStep = (recommendation, context) => {
    const targetDisplayName = getTargetDisplayName(recommendation, context);
    if (recommendation.action === 'switch' && recommendation.targetFund) {
      if (context.hasStcgCaution) {
        return `Hold new money back from ${formatFundDisplayName(recommendation.fundName)} for now and review ${targetDisplayName} once the one-year window clears if you want to avoid STCG.`;
      }
      return `Review the direct alternative ${targetDisplayName} before making the switch.`;
    }
    if (recommendation.action === 'switch' && targetDisplayName) {
      if (context.hasStcgCaution) {
        return `Hold new money back from ${formatFundDisplayName(recommendation.fundName)} for now and review ${targetDisplayName} once the one-year window clears if you want to avoid STCG.`;
      }
      return `Review ${targetDisplayName} before making the switch.`;
    }
    if (recommendation.action === 'reduce') {
      if (context.hasStcgCaution) {
        return `Pause fresh SIPs here first, then trim${recommendation.percentage ? ` by about ${recommendation.percentage}%` : ''} after the short-term tax window clears.`;
      }
      return `Trim exposure gradually${recommendation.percentage ? ` by about ${recommendation.percentage}%` : ''} while keeping the rest invested.`;
    }
    if (recommendation.action === 'hold') {
      return 'Continue monitoring this fund in the next review cycle without making an immediate change.';
    }
    if (recommendation.action === 'exit') {
      return 'Review capital gains and liquidity first, then plan an orderly exit if it still fits your goal.';
    }
    return 'Review this suggestion alongside your goal horizon and tax position before acting.';
  };

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
              View fund-level suggestions based on your portfolio analysis.
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div variants={item}>
        <RuntimeNotice
          title={
            runtimeConfig.demoModeEnabled
              ? 'Demo mode is enabled for this page.'
              : 'These recommendations are based on your latest portfolio analysis.'
          }
          description={
            runtimeConfig.demoModeEnabled
              ? 'These recommendations are synthetic because demo mode was explicitly enabled.'
              : 'Review suggested actions, tax impact, and rationale before deciding what to change.'
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

      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-blue-100 bg-blue-50/70">
          <CardContent className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">
              Direct-Plan Savings
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {portfolio ? formatCurrency(directPlanSavings) : `${switchCount} actions`}
            </p>
            <p className="text-sm leading-6 text-slate-700">
              {portfolio
                ? 'Annual expense drag identified across switch-ready or switch-later regular plans.'
                : 'Switch actions already point to direct-plan equivalents where the cost gap is material.'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-emerald-100 bg-emerald-50/70">
          <CardContent className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
              Tax-Safe First Moves
            </p>
            <p className="text-2xl font-bold text-slate-900">{taxSafeNowCount}</p>
            <p className="text-sm leading-6 text-slate-700">
              Recommendation(s) look actionable now without a short-term tax warning.
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-100 bg-amber-50/70">
          <CardContent className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
              Overlap-Led Changes
            </p>
            <p className="text-2xl font-bold text-slate-900">{overlapManagedCount}</p>
            <p className="text-sm leading-6 text-slate-700">
              Recommendation(s) explicitly tie back to repeated stock exposure or concentration.
            </p>
          </CardContent>
        </Card>
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
          const isExpanded = expandedRecommendation === idx;
          const context = getRecommendationContext(recommendation);
          const targetDisplayName = getTargetDisplayName(recommendation, context);
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
                      <h3 className="font-semibold text-gray-900">{formatFundDisplayName(recommendation.fundName)}</h3>
                      <Badge variant={getActionColor(recommendation.action)}>
                        {recommendation.action.toUpperCase()}
                        {recommendation.percentage ? ` ${recommendation.percentage}%` : ''}
                      </Badge>
                    </div>

                    {targetDisplayName && (
                      <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 rounded-lg">
                        <ArrowRight className="h-4 w-4 text-blue-600" />
                        <span className="text-sm text-blue-700">
                          Switch to: <strong>{targetDisplayName}</strong>
                        </span>
                      </div>
                    )}

                    <p className="text-sm text-gray-600 mb-3">{recommendation.rationale}</p>

                    <div className="mb-3 flex flex-wrap gap-2">
                      {context.overlapSignals.length ? (
                        <Badge variant="warning" size="sm">
                          Overlap: {context.overlapSignals.slice(0, 2).join(', ')}
                        </Badge>
                      ) : null}
                      {context.hasDirectGap ? (
                        <Badge variant="primary" size="sm">
                          Direct-plan drag: {formatCurrency(context.annualDrag)}/yr
                        </Badge>
                      ) : null}
                      {context.taxSafeNow ? (
                        <Badge variant="success" size="sm">
                          Tax-safe to review now
                        </Badge>
                      ) : null}
                      {context.hasStcgCaution ? (
                        <Badge variant="warning" size="sm">
                          Wait to avoid STCG
                        </Badge>
                      ) : null}
                    </div>

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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedRecommendation(isExpanded ? null : idx)}
                      aria-expanded={isExpanded}
                      aria-controls={`recommendation-details-${idx}`}
                    >
                      {isExpanded ? 'Hide details' : 'Details'}
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 ml-1" />
                      ) : (
                        <ChevronDown className="h-4 w-4 ml-1" />
                      )}
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div
                    id={`recommendation-details-${idx}`}
                    className="mt-4 border-t border-gray-100 pt-4 grid gap-4 md:grid-cols-2"
                  >
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Action Summary
                      </p>
                      <div className="mt-3 space-y-2 text-sm text-slate-700">
                        <p>
                          <span className="font-medium text-slate-900">Fund:</span>{' '}
                          {formatFundDisplayName(recommendation.fundName)}
                        </p>
                        <p>
                          <span className="font-medium text-slate-900">Suggested action:</span>{' '}
                          {recommendation.action.toUpperCase()}
                          {recommendation.percentage ? ` ${recommendation.percentage}%` : ''}
                        </p>
                        {targetDisplayName && (
                          <p>
                            <span className="font-medium text-slate-900">Target fund:</span>{' '}
                            {targetDisplayName}
                          </p>
                        )}
                        {recommendation.amountInr ? (
                          <p>
                            <span className="font-medium text-slate-900">Indicative amount:</span>{' '}
                            {formatCurrency(recommendation.amountInr)}
                          </p>
                        ) : null}
                        {recommendation.priority ? (
                          <p>
                            <span className="font-medium text-slate-900">Priority:</span> P
                            {recommendation.priority}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-xl bg-blue-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
                        Why It Matters
                      </p>
                      <p className="mt-3 text-sm leading-6 text-slate-700">
                        {recommendation.rationale || 'No additional rationale was provided.'}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Overlap And Cost Context
                      </p>
                      <div className="mt-3 space-y-2 text-sm text-slate-700">
                        <p>
                          <span className="font-medium text-slate-900">Repeated stocks:</span>{' '}
                          {context.overlapSignals.length
                            ? context.overlapSignals.join(', ')
                            : 'No explicit overlap signal linked to this action.'}
                        </p>
                        <p>
                          <span className="font-medium text-slate-900">Plan type:</span>{' '}
                          {context.holding ? context.holding.planType.toUpperCase() : 'Unavailable'}
                        </p>
                        {context.hasDirectGap ? (
                          <>
                            <p>
                              <span className="font-medium text-slate-900">Expense ratio:</span>{' '}
                              {formatPercentage(context.holding.expenseRatio, 2)} vs direct {formatPercentage(context.holding.directExpenseRatio, 2)}
                            </p>
                            <p>
                              <span className="font-medium text-slate-900">Estimated annual drag:</span>{' '}
                              {formatCurrency(context.annualDrag)}
                            </p>
                          </>
                        ) : null}
                        {context.holding?.holdingPeriodDays !== null &&
                        context.holding?.holdingPeriodDays !== undefined ? (
                          <p>
                            <span className="font-medium text-slate-900">Holding period:</span>{' '}
                            {context.holding.holdingPeriodDays} days
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-xl bg-emerald-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
                        Tax Consideration
                      </p>
                      <p className="mt-3 text-sm leading-6 text-slate-700">
                        {recommendation.taxImpact || 'No tax note was provided for this recommendation.'}
                      </p>
                    </div>

                    <div className="rounded-xl bg-amber-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                        Suggested Next Step
                      </p>
                      <p className="mt-3 text-sm leading-6 text-slate-700">
                        {getNextStep(recommendation, context)}
                      </p>
                    </div>
                  </div>
                )}
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
                        <span>
                          Switch {formatFundDisplayName(item.fundName)} to {getTargetDisplayName(item, getRecommendationContext(item)) || 'the direct-plan equivalent'} and review the tax note before execution.
                        </span>
                      </li>
                    ))}
                  {recommendations
                    .filter((item) => item.action === 'reduce')
                    .map((item, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-amber-500 rounded-full" />
                        <span>
                          Reduce {formatFundDisplayName(item.fundName)}
                          {item.percentage ? ` by ${item.percentage}%` : ''} with the tax timing in mind.
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
                    <span>{reduceCount} reduce action(s) address overlap or concentration at fund level.</span>
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
