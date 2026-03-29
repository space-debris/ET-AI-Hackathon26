import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { formatCompactNumber, formatCurrency } from '../../utils/helpers';

const timelineChartMargin = { top: 10, right: 64, left: 24, bottom: 8 };
const sipChartMargin = { top: 10, right: 32, left: 24, bottom: 8 };
const insuranceChartMargin = { top: 10, right: 24, left: 24, bottom: 8 };

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
        <div className="h-96 min-w-0 min-h-[24rem]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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
        <div className="h-64 min-w-0 min-h-[16rem]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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

export function InsuranceGapChart({ insuranceGap }) {
  const recommendedLifeCover = insuranceGap?.recommendedLifeCover ?? 0;
  const currentAssetBuffer = insuranceGap?.currentAssetBuffer ?? 0;
  const totalGap = insuranceGap?.totalGap ?? 0;
  const expenseRunwayMonths = insuranceGap?.expenseRunwayMonths ?? 0;
  const coverageRatioPct = insuranceGap?.coverageRatioPct ?? (
    recommendedLifeCover > 0 ? (currentAssetBuffer / recommendedLifeCover) * 100 : 0
  );

  const data = [
    {
      label: 'Recommended cover',
      value: recommendedLifeCover,
      fill: '#2563eb',
      detail: '10x income rule',
    },
    {
      label: 'Current asset buffer',
      value: currentAssetBuffer,
      fill: '#14b8a6',
      detail: 'Existing investable corpus',
    },
    {
      label: 'Remaining gap',
      value: totalGap,
      fill: '#f97316',
      detail: 'Additional protection needed',
    },
  ];
  const exactEquation = `${formatCurrency(recommendedLifeCover)} - ${formatCurrency(currentAssetBuffer)} = ${formatCurrency(totalGap)}`;

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      return (
        <div className="bg-white px-4 py-3 shadow-lg rounded-lg border border-gray-100">
          <p className="font-semibold text-gray-900">{point.label}</p>
          <p className="mt-1 text-sm text-gray-600">{point.detail}</p>
          <p className="mt-2 text-sm font-semibold text-gray-900">
            {formatCurrency(point.value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Insurance Gap Analysis</CardTitle>
        <CardDescription>
          A visual breakdown of the protection gap behind the FIRE summary card
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
          <div className="h-72 min-w-0 min-h-[18rem]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart
                data={data}
                layout="vertical"
                margin={insuranceChartMargin}
                barCategoryGap={18}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(value) => formatCompactNumber(value)}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={140}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[0, 12, 12, 0]} maxBarSize={32}>
                  {data.map((entry) => (
                    <Cell key={entry.label} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid gap-3 content-start sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">
                Cover Rule
              </p>
              <p className="mt-2 text-2xl font-bold text-blue-950">
                {insuranceGap?.incomeMultiple ?? 10}x income
              </p>
              <p className="mt-1 text-sm text-blue-800">
                {formatCurrency(recommendedLifeCover)} suggested life cover target
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
                Current Buffer
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-950">
                {formatCompactNumber(currentAssetBuffer)}
              </p>
              <p className="mt-1 text-sm text-emerald-800">
                About {coverageRatioPct.toFixed(1)}% of the target cover is already cushioned by
                current investments
              </p>
            </div>

            <div className="rounded-2xl border border-orange-100 bg-orange-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-700">
                Runway
              </p>
              <p className="mt-2 text-2xl font-bold text-orange-950">
                {expenseRunwayMonths.toFixed(1)} months
              </p>
              <p className="mt-1 text-sm text-orange-800">
                Current assets can fund about {expenseRunwayMonths.toFixed(1)} months of today&apos;s
                expenses at the current burn rate
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(240px,0.65fr)]">
          <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">
              Formula Used
            </p>
            <p className="mt-2 text-sm leading-6 text-gray-700">
              {insuranceGap?.formula ?? 'Insurance gap formula unavailable.'}
            </p>
            <p className="mt-2 text-sm font-semibold text-gray-900">
              Exact gap: {exactEquation}
            </p>
            <p className="mt-2 text-sm text-gray-500">
              This planner currently treats your existing investments as the family buffer because
              the form does not yet capture current term-life cover separately.
            </p>
            <p className="mt-1 text-xs text-gray-400">
              The summary card uses compact rounding, so {formatCurrency(totalGap)} appears as{' '}
              {formatCompactNumber(totalGap)}.
            </p>
          </div>

          <div className="rounded-2xl border border-purple-100 bg-purple-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-purple-700">
              Health Cover Note
            </p>
            <p className="mt-2 text-sm leading-6 text-purple-900">
              {insuranceGap?.healthCoverRecommendation ?? 'Health cover guidance unavailable.'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default FIRETimelineChart;
