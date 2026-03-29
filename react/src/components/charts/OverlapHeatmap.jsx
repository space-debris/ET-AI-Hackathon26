import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { formatCurrency, formatFundDisplayName, formatPercentagePoints } from '../../utils/helpers';

export function OverlapHeatmap({
  overlapMatrix,
  overlapDetails = [],
  holdings = [],
  title = 'Stock Overlap Analysis',
}) {
  // Get unique stocks and funds
  const stocks = Object.keys(overlapMatrix);
  const allFunds = new Set();

  stocks.forEach((stock) => {
    Object.keys(overlapMatrix[stock]).forEach((fund) => allFunds.add(fund));
  });

  const funds = Array.from(allFunds).map((f) =>
    f.split(' ').slice(0, 2).join(' ')
  );
  const fullFundNames = Array.from(allFunds);
  const overlapSignalsByFund = fullFundNames.reduce((acc, fund) => {
    acc[fund] = [];
    return acc;
  }, {});

  stocks.forEach((stock) => {
    Object.keys(overlapMatrix[stock] || {}).forEach((fund) => {
      overlapSignalsByFund[fund] = [...(overlapSignalsByFund[fund] || []), stock];
    });
  });

  const weightedOverlapScore = overlapDetails.length
    ? overlapDetails.reduce(
        (sum, detail) => sum + ((detail.totalPortfolioExposure ?? detail.total_portfolio_exposure ?? 0) * 100),
        0
      )
    : stocks.length
      ? stocks.reduce(
          (sum, stock) =>
            sum +
            Object.values(overlapMatrix[stock] || {}).reduce((inner, weight) => inner + (weight * 100), 0),
          0
        ) / stocks.length
      : 0;
  const topSignal = overlapDetails.length
    ? overlapDetails[0]
    : stocks[0]
      ? { stockName: stocks[0], funds: overlapMatrix[stocks[0]] }
      : null;
  const overlapSeverity =
    weightedOverlapScore >= 15 ? 'High' : weightedOverlapScore >= 8 ? 'Moderate' : 'Contained';
  const overlapGuidance = stocks.length
    ? weightedOverlapScore >= 15
      ? 'Our AI system sees concentrated duplication. Avoid adding fresh SIPs to the same repeated names until you reduce overlap in the most similar funds.'
      : weightedOverlapScore >= 8
        ? 'Our AI system sees meaningful overlap. Prefer directing new money toward categories or funds that do not repeat the same large positions.'
        : 'Our AI system sees some overlap, but it is still manageable. Monitor the repeated names before making aggressive rebalancing changes.'
    : 'Our AI system does not see any repeated stock positions in the current portfolio snapshot.';
  const overlapAction = topSignal
    ? `Start with ${topSignal.stockName ?? topSignal.stock_name}: it is the clearest repeated signal across ${Object.keys(topSignal.funds || {}).length} funds.`
    : 'No overlap action is needed right now.';
  const overlappingHoldings = holdings.filter(
    (holding) => (overlapSignalsByFund[holding.fundName] || []).length > 0
  );
  const rankCandidate = (holding) =>
    ((overlapSignalsByFund[holding.fundName] || []).length * 1000) +
    (holding.currentValue || 0) +
    Math.max(
      0,
      ((holding.expenseRatio ?? 0) - (holding.directExpenseRatio ?? holding.expenseRatio ?? 0)) * 1000000
    );
  const stcgSafeCandidate = [...overlappingHoldings]
    .filter((holding) => (holding.holdingPeriodDays ?? 0) >= 365)
    .sort((left, right) => rankCandidate(right) - rankCandidate(left))[0] || null;
  const stcgDeferredCandidate = [...overlappingHoldings]
    .filter(
      (holding) =>
        holding.holdingPeriodDays !== null &&
        holding.holdingPeriodDays !== undefined &&
        holding.holdingPeriodDays < 365
    )
    .sort((left, right) => rankCandidate(right) - rankCandidate(left))[0] || null;
  const directPlanCandidate = [...overlappingHoldings]
    .filter(
      (holding) =>
        holding.planType === 'regular' &&
        holding.directExpenseRatio !== null &&
        holding.directExpenseRatio !== undefined &&
        holding.expenseRatio > holding.directExpenseRatio
    )
    .sort(
      (left, right) =>
        ((right.currentValue || 0) * (right.expenseRatio - right.directExpenseRatio)) -
        ((left.currentValue || 0) * (left.expenseRatio - left.directExpenseRatio))
    )[0] || null;
  const taxAwareMove = stcgSafeCandidate
    ? `Start with ${formatFundDisplayName(stcgSafeCandidate.fundName)}: repeated names include ${(overlapSignalsByFund[stcgSafeCandidate.fundName] || []).slice(0, 3).join(', ')} and the holding looks outside the STCG window.${
        directPlanCandidate?.fundName === stcgSafeCandidate.fundName
          ? ` A switch to the direct plan could also save about ${formatCurrency(stcgSafeCandidate.currentValue * (stcgSafeCandidate.expenseRatio - stcgSafeCandidate.directExpenseRatio))} a year.`
          : ''
      }`
    : stocks.length
      ? 'No obvious long-held overlap candidate is visible yet. Redirect new SIPs away from the repeated names first, then review trims once the short-term tax window clears.'
      : 'No tax-aware overlap action is needed right now.';
  const stcgDeferralNote = stcgDeferredCandidate
    ? `Avoid trimming ${formatFundDisplayName(stcgDeferredCandidate.fundName)} immediately if you want to avoid STCG. It still overlaps on ${(overlapSignalsByFund[stcgDeferredCandidate.fundName] || []).slice(0, 2).join(', ')} but looks to be inside the one-year holding window.`
    : stcgSafeCandidate
      ? `No immediate STCG deferral is needed for ${formatFundDisplayName(stcgSafeCandidate.fundName)}. It looks outside the one-year holding window, so you can focus on overlap and direct-plan savings instead of waiting for tax timing.`
      : directPlanCandidate
        ? `${formatFundDisplayName(directPlanCandidate.fundName)} still has a regular-plan cost gap of ${formatPercentagePoints((directPlanCandidate.expenseRatio - directPlanCandidate.directExpenseRatio) * 100, 2)} versus direct, but no clear STCG holding-period blocker is visible in the top overlap candidate right now.`
      : 'No near-term STCG deferral signal is obvious from the current portfolio snapshot.';

  const getCellStyle = (weight) => {
    if (weight >= 0.08) return { backgroundColor: '#b91c1c', color: '#fff' };
    if (weight >= 0.06) return { backgroundColor: '#dc2626', color: '#fff' };
    if (weight >= 0.045) return { backgroundColor: '#7c2d12', color: '#fff' };
    if (weight >= 0.03) return { backgroundColor: '#6d28d9', color: '#fff' };
    if (weight > 0) return { backgroundColor: '#ddd6fe', color: '#4c1d95' };
    return { backgroundColor: '#f8fafc', color: '#94a3b8' };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Stock overlap across your funds. Darker cells mean stronger duplication and lower diversification.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {stocks.length ? (
          <div className="mb-6 space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-red-100 bg-red-50/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-500">
                Overlap Score
              </p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {weightedOverlapScore.toFixed(1)}%
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Weighted overlap across duplicated stock positions.
              </p>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-500">
                Overlapping Stocks
              </p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{stocks.length}</p>
              <p className="mt-1 text-sm text-gray-500">
                Stocks repeated across at least two funds.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-500">
                Strongest Signal
              </p>
              <p className="mt-2 text-lg font-bold text-gray-900">
                {topSignal?.stockName ?? topSignal?.stock_name ?? 'N/A'}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Seen in {topSignal ? Object.keys(topSignal.funds || {}).length : 0} fund positions.
              </p>
            </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(135deg,#f5f3ff_0%,#eef2ff_48%,#fff1f2_100%)] p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-600">
                    AI Overlap Summary
                  </p>
                  <h4 className="mt-2 text-lg font-semibold text-slate-900">
                    {overlapSeverity} overlap concentration detected
                  </h4>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
                    {overlapGuidance}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/80 px-4 py-3 shadow-sm ring-1 ring-slate-200">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    First Move
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {overlapAction}
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-600">
                  Tax-Aware First Move
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {taxAwareMove}
                </p>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Defer For STCG
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {stcgDeferralNote}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm text-emerald-700">
            No overlapping stock positions were detected in the current analytics payload.
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Stock
                </th>
                {funds.map((fund, idx) => (
                  <th
                    key={idx}
                    className="px-2 py-2 text-center text-xs font-medium text-gray-500"
                    title={fullFundNames[idx]}
                  >
                    <div className="w-16 truncate">{fund}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stocks.map((stock, stockIdx) => (
                <tr key={stockIdx}>
                  <td className="px-2 py-2 text-sm font-medium text-gray-900">
                    {stock}
                  </td>
                  {fullFundNames.map((fund, fundIdx) => {
                    const weight = overlapMatrix[stock][fund] || 0;
                    return (
                      <td key={fundIdx} className="px-2 py-2 text-center">
                        <div
                          className="mx-auto flex h-9 w-16 items-center justify-center rounded-xl text-xs font-semibold shadow-sm ring-1 ring-white/50"
                          style={getCellStyle(weight)}
                          title={`${stock} in ${fund}: ${(weight * 100).toFixed(1)}%`}
                        >
                          {weight > 0 ? `${(weight * 100).toFixed(1)}%` : '-'}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
          <span className="font-medium">Overlap level:</span>
          <div className="flex items-center gap-1">
            <div className="h-4 w-4 rounded bg-[#ddd6fe]" />
            <span>&lt;3%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-4 w-4 rounded bg-[#6d28d9]" />
            <span>3-4.5%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-4 w-4 rounded bg-[#dc2626]" />
            <span>4.5-8%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-4 w-4 rounded bg-[#b91c1c]" />
            <span>&gt;8%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default OverlapHeatmap;
