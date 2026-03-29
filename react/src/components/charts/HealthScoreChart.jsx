import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { getScoreColor, getScoreLabel, humanizeLabel } from '../../utils/helpers';

export function HealthScoreRadar({ dimensions, overallScore }) {
  const data = dimensions.map((d) => ({
    dimension: d.dimension,
    score: d.score,
    fullMark: 100,
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      const dimension = dimensions.find((dim) => dim.dimension === d.dimension);
      return (
        <div className="bg-white px-4 py-3 shadow-lg rounded-lg border border-gray-100 max-w-xs">
          <p className="font-semibold text-gray-900">{d.dimension}</p>
          <p className="font-semibold text-gray-900">{humanizeLabel(d.dimension)}</p>
          <p className="text-2xl font-bold" style={{ color: getScoreColor(d.score) }}>
            {d.score}/100
          </p>
          {dimension && (
            <p className="mt-2 text-sm text-gray-500">{dimension.rationale}</p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Money Health Score</CardTitle>
            <CardDescription>
              Your portfolio health across 6 key dimensions
            </CardDescription>
          </div>
          <div className="text-center">
            <div
              className="text-4xl font-bold"
              style={{ color: getScoreColor(overallScore) }}
            >
              {overallScore}
            </div>
            <Badge variant={overallScore >= 70 ? 'success' : overallScore >= 50 ? 'warning' : 'danger'}>
              {getScoreLabel(overallScore)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80 min-w-0 min-h-[20rem]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis
                dataKey="dimension"
                tickFormatter={(value) => humanizeLabel(value)}
                tick={{ fontSize: 12, fill: '#6b7280' }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 100]}
                tick={{ fontSize: 10 }}
              />
              <Radar
                name="Score"
                dataKey="score"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.3}
                animationDuration={800}
              />
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function HealthScoreDetails({ dimensions }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Detailed Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {dimensions.map((dimension, idx) => (
            <div key={idx} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900">{humanizeLabel(dimension.dimension)}</h4>
                <div className="flex items-center gap-2">
                  <span
                    className="text-lg font-bold"
                    style={{ color: getScoreColor(dimension.score) }}
                  >
                    {dimension.score}
                  </span>
                  <span className="text-sm text-gray-400">/100</span>
                </div>
              </div>

              {/* Score bar */}
              <div className="w-full h-2 bg-gray-100 rounded-full mb-3">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${dimension.score}%`,
                    backgroundColor: getScoreColor(dimension.score),
                  }}
                />
              </div>

              <p className="text-sm text-gray-600 mb-3">{dimension.rationale}</p>

              {dimension.suggestions && dimension.suggestions.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-500 uppercase mb-2">
                    Suggestions
                  </p>
                  <ul className="space-y-1">
                    {dimension.suggestions.map((suggestion, sIdx) => (
                      <li
                        key={sIdx}
                        className="text-sm text-gray-700 flex items-start gap-2"
                      >
                        <span className="text-blue-500 mt-1">•</span>
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default HealthScoreRadar;
