import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, TrendingUp, Download } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { HealthScoreRadar, HealthScoreDetails } from '../../components/charts/HealthScoreChart';
import { healthApi } from '../../services/api';
import { getScoreColor, getScoreLabel } from '../../utils/helpers';

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

export function HealthScorePage() {
  const [loading, setLoading] = useState(true);
  const [healthData, setHealthData] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await healthApi.getScore();
        setHealthData(data);
      } catch (error) {
        console.error('Failed to fetch health score:', error);
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

  // Calculate improvement potential
  const maxPossible = healthData.dimensions.length * 100;
  const currentTotal = healthData.dimensions.reduce((sum, d) => sum + d.score, 0);
  const improvementPotential = maxPossible - currentTotal;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 rounded-xl">
            <Activity className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Money Health Score</h1>
            <p className="text-gray-500">
              Comprehensive analysis of your portfolio health
            </p>
          </div>
        </div>
        <Button variant="secondary" icon={Download}>
          Download Report
        </Button>
      </motion.div>

      {/* Score Overview */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="text-center bg-gradient-to-br from-purple-50 to-blue-50">
          <CardContent className="py-8">
            <p className="text-sm font-medium text-gray-500 mb-2">Overall Score</p>
            <div
              className="text-6xl font-bold mb-2"
              style={{ color: getScoreColor(healthData.overallScore) }}
            >
              {healthData.overallScore}
            </div>
            <Badge
              variant={
                healthData.overallScore >= 70
                  ? 'success'
                  : healthData.overallScore >= 50
                  ? 'warning'
                  : 'danger'
              }
              size="lg"
            >
              {getScoreLabel(healthData.overallScore)}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Strongest Area</p>
                <p className="text-lg font-semibold text-gray-900">
                  {
                    healthData.dimensions.reduce((max, d) =>
                      d.score > max.score ? d : max
                    ).dimension
                  }
                </p>
                <p className="text-sm text-emerald-600">
                  Score:{' '}
                  {Math.max(...healthData.dimensions.map((d) => d.score))}/100
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-lg">
                <Activity className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Needs Attention</p>
                <p className="text-lg font-semibold text-gray-900">
                  {
                    healthData.dimensions.reduce((min, d) =>
                      d.score < min.score ? d : min
                    ).dimension
                  }
                </p>
                <p className="text-sm text-amber-600">
                  Score:{' '}
                  {Math.min(...healthData.dimensions.map((d) => d.score))}/100
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart */}
        <motion.div variants={item}>
          <HealthScoreRadar
            dimensions={healthData.dimensions}
            overallScore={healthData.overallScore}
          />
        </motion.div>

        {/* Quick Summary */}
        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle>Score Breakdown</CardTitle>
              <CardDescription>
                How you score across each dimension
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {healthData.dimensions
                  .sort((a, b) => b.score - a.score)
                  .map((dimension, idx) => (
                    <div key={idx}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">
                          {dimension.dimension}
                        </span>
                        <span
                          className="text-sm font-bold"
                          style={{ color: getScoreColor(dimension.score) }}
                        >
                          {dimension.score}/100
                        </span>
                      </div>
                      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${dimension.score}%` }}
                          transition={{ duration: 0.8, delay: idx * 0.1 }}
                          className="h-full rounded-full"
                          style={{
                            backgroundColor: getScoreColor(dimension.score),
                          }}
                        />
                      </div>
                    </div>
                  ))}
              </div>

              {/* Improvement Potential */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>Improvement Potential:</strong> By addressing the
                  suggestions below, you could improve your overall score by up
                  to{' '}
                  <strong>
                    {Math.round((improvementPotential / maxPossible) * 100)}
                    points
                  </strong>
                  .
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Detailed Analysis */}
      <motion.div variants={item}>
        <HealthScoreDetails dimensions={healthData.dimensions} />
      </motion.div>

      {/* Action Items Summary */}
      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <CardTitle>Priority Actions</CardTitle>
            <CardDescription>
              Top recommendations to improve your financial health
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {healthData.dimensions
                .filter((d) => d.score < 70)
                .flatMap((d) => d.suggestions.slice(0, 1).map((s) => ({ dimension: d.dimension, suggestion: s })))
                .slice(0, 6)
                .map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 border border-gray-100 rounded-lg hover:border-blue-200 hover:bg-blue-50/50 transition-all"
                  >
                    <Badge variant="default" size="sm" className="mb-2">
                      {item.dimension}
                    </Badge>
                    <p className="text-sm text-gray-700">{item.suggestion}</p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

export default HealthScorePage;
