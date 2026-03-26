import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { clsx } from 'clsx';

export function OverlapHeatmap({ overlapMatrix, title = 'Stock Overlap Analysis' }) {
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

  // Get intensity color based on weight
  const getColor = (weight) => {
    if (weight >= 0.07) return 'bg-red-500';
    if (weight >= 0.05) return 'bg-orange-400';
    if (weight >= 0.03) return 'bg-yellow-300';
    if (weight > 0) return 'bg-green-200';
    return 'bg-gray-100';
  };

  const getTextColor = (weight) => {
    if (weight >= 0.05) return 'text-white';
    return 'text-gray-700';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Stock overlap across your funds. Higher overlap (red) means less diversification.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
                          className={clsx(
                            'w-14 h-8 rounded flex items-center justify-center text-xs font-medium mx-auto',
                            getColor(weight),
                            getTextColor(weight)
                          )}
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
            <div className="w-4 h-4 bg-green-200 rounded" />
            <span>&lt;3%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-yellow-300 rounded" />
            <span>3-5%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-orange-400 rounded" />
            <span>5-7%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-red-500 rounded" />
            <span>&gt;7%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default OverlapHeatmap;
