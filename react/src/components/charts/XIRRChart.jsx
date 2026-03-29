import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import {
  formatCompactNumber,
  formatPercentage,
  formatPercentagePoints,
} from '../../utils/helpers';

export function XIRRBarChart({ fundWiseXirr, overallXirr, title = 'Fund-wise XIRR' }) {
  const data = Object.entries(fundWiseXirr).map(([fundName, xirr]) => ({
    name: fundName.split(' ').slice(0, 2).join(' '),
    fullName: fundName,
    xirr: xirr * 100,
    fill: xirr >= overallXirr ? '#22c55e' : xirr >= 0.1 ? '#3b82f6' : '#f59e0b',
  }));

  // Sort by XIRR descending
  data.sort((a, b) => b.xirr - a.xirr);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-white px-4 py-3 shadow-lg rounded-lg border border-gray-100">
          <p className="font-semibold text-gray-900 text-sm">{d.fullName}</p>
          <p className="text-lg font-bold" style={{ color: d.fill }}>
            {d.xirr.toFixed(1)}% XIRR
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>{title}</CardTitle>
          <span className="text-sm text-gray-500">
            Portfolio XIRR: <span className="font-semibold text-gray-900">{formatPercentage(overallXirr)}</span>
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis
                type="number"
                domain={[0, Math.max(...data.map((d) => d.xirr)) * 1.1]}
                tickFormatter={(value) => formatPercentagePoints(value)}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={80}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                x={overallXirr * 100}
                stroke="#6b7280"
                strokeDasharray="5 5"
                label={{ value: 'Avg', position: 'top', fontSize: 10 }}
              />
              <Bar dataKey="xirr" radius={[0, 4, 4, 0]} animationDuration={800}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function ReturnsComparisonChart({ holdings }) {
  const data = holdings.map((h) => ({
    name: h.fundName.split(' ').slice(0, 2).join(' '),
    invested: h.investedAmount,
    current: h.currentValue,
    returns: ((h.currentValue - h.investedAmount) / h.investedAmount) * 100,
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-white px-4 py-3 shadow-lg rounded-lg border border-gray-100">
          <p className="font-semibold text-gray-900">{d.name}</p>
          <div className="mt-2 space-y-1 text-sm">
            <p>Invested: <span className="font-medium">{formatCompactNumber(d.invested)}</span></p>
            <p>Current: <span className="font-medium">{formatCompactNumber(d.current)}</span></p>
            <p>Returns: <span className={`font-bold ${d.returns >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {d.returns.toFixed(1)}%
            </span></p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invested vs Current Value</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                tickLine={false}
                tick={{ fontSize: 11 }}
                interval={0}
                angle={-15}
                textAnchor="end"
              />
              <YAxis
                tickFormatter={(value) => formatCompactNumber(value)}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="invested" fill="#94a3b8" name="Invested" radius={[4, 4, 0, 0]} />
              <Bar dataKey="current" fill="#3b82f6" name="Current" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export default XIRRBarChart;
