import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { formatCompactNumber } from '../../utils/helpers';

const timelineChartMargin = { top: 10, right: 64, left: 24, bottom: 8 };
const sipChartMargin = { top: 10, right: 32, left: 24, bottom: 8 };

export function FIRETimelineChart({ milestones, targetCorpus }) {
  const data = milestones.map((m) => ({
    year: m.year,
    month: m.month,
    label: `${m.year}`,
    equity: m.totalCorpus * (m.equityPct / 100),
    debt: m.totalCorpus * (m.debtPct / 100),
    gold: m.totalCorpus * ((100 - m.equityPct - m.debtPct) / 100),
    total: m.totalCorpus,
    equityPct: m.equityPct,
    debtPct: m.debtPct,
    notes: m.notes,
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-white px-4 py-3 shadow-lg rounded-lg border border-gray-100">
          <p className="font-semibold text-gray-900">Year {d.year}</p>
          <div className="mt-2 space-y-1 text-sm">
            <p>Total Corpus: <span className="font-bold text-gray-900">{formatCompactNumber(d.total)}</span></p>
            <p className="flex items-center gap-2">
              <span className="w-3 h-3 bg-blue-500 rounded-full" />
              Equity: {formatCompactNumber(d.equity)} ({d.equityPct}%)
            </p>
            <p className="flex items-center gap-2">
              <span className="w-3 h-3 bg-emerald-500 rounded-full" />
              Debt: {formatCompactNumber(d.debt)} ({d.debtPct}%)
            </p>
            <p className="flex items-center gap-2">
              <span className="w-3 h-3 bg-amber-500 rounded-full" />
              Gold: {formatCompactNumber(d.gold)}
            </p>
          </div>
          {d.notes && (
            <p className="mt-2 text-xs text-gray-500 italic">{d.notes}</p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>FIRE Journey Timeline</CardTitle>
        <CardDescription>
          Corpus growth with asset allocation glidepath over time
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={timelineChartMargin}>
              <defs>
                <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="colorDebt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="colorGold" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                minTickGap={12}
              />
              <YAxis
                tickFormatter={(v) => formatCompactNumber(v)}
                tickLine={false}
                axisLine={false}
                width={84}
                tickMargin={10}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={targetCorpus}
                stroke="#ef4444"
                strokeDasharray="5 5"
                label={{
                  value: 'Target',
                  position: 'insideTopRight',
                  fill: '#ef4444',
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="equity"
                stackId="1"
                stroke="#3b82f6"
                fill="url(#colorEquity)"
                animationDuration={1000}
              />
              <Area
                type="monotone"
                dataKey="debt"
                stackId="1"
                stroke="#10b981"
                fill="url(#colorDebt)"
                animationDuration={1000}
              />
              <Area
                type="monotone"
                dataKey="gold"
                stackId="1"
                stroke="#f59e0b"
                fill="url(#colorGold)"
                animationDuration={1000}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded" />
            <span className="text-gray-600">Equity</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-emerald-500 rounded" />
            <span className="text-gray-600">Debt</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-amber-500 rounded" />
            <span className="text-gray-600">Gold</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-red-500" />
            <span className="text-gray-600">Target</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SIPProgressChart({ milestones }) {
  const data = milestones.map((m) => ({
    year: m.year,
    equity: m.equitySip,
    debt: m.debtSip,
    gold: m.goldSip,
    total: m.equitySip + m.debtSip + m.goldSip,
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-white px-4 py-3 shadow-lg rounded-lg border border-gray-100">
          <p className="font-semibold text-gray-900">Year {d.year}</p>
          <div className="mt-2 space-y-1 text-sm">
            <p>Monthly SIP: <span className="font-bold">₹{(d.total / 1000).toFixed(0)}K</span></p>
            <p>Equity SIP: ₹{(d.equity / 1000).toFixed(0)}K</p>
            <p>Debt SIP: ₹{(d.debt / 1000).toFixed(0)}K</p>
            <p>Gold SIP: ₹{(d.gold / 1000).toFixed(0)}K</p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly SIP Schedule</CardTitle>
        <CardDescription>
          Recommended SIP amounts that adjust over your FIRE journey
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={sipChartMargin}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="year"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                minTickGap={12}
              />
              <YAxis
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`}
                tickLine={false}
                axisLine={false}
                width={76}
                tickMargin={10}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="stepAfter"
                dataKey="equity"
                stackId="1"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.6}
              />
              <Area
                type="stepAfter"
                dataKey="debt"
                stackId="1"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.6}
              />
              <Area
                type="stepAfter"
                dataKey="gold"
                stackId="1"
                stroke="#f59e0b"
                fill="#f59e0b"
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export default FIRETimelineChart;
