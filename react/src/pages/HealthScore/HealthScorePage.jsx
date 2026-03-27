import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, TrendingUp, Download } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { RuntimeNotice } from '../../components/ui/RuntimeNotice';
import { HealthScoreRadar, HealthScoreDetails } from '../../components/charts/HealthScoreChart';
import { healthApi, runtimeConfig } from '../../services/api';
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
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await healthApi.getScore();
        setHealthData(data);
      } catch (fetchError) {
        console.error('Failed to fetch health score:', fetchError);
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

  if (!healthData) {
    return (
      <div className="space-y-6">
        <RuntimeNotice
          title={
            runtimeConfig.demoModeEnabled
              ? 'Demo mode is enabled for health scoring.'
              : 'Health score data is unavailable.'
          }
          description={
            runtimeConfig.demoModeEnabled
              ? 'Synthetic health-score output is shown only when demo mode is explicitly enabled.'
              : error || 'Run a portfolio analysis first. The page stays empty instead of showing fallback scores.'
          }
          variant={runtimeConfig.demoModeEnabled ? 'demo' : error ? 'error' : 'live'}
        />
        <Card>
          <CardContent>
            <EmptyState
              title="No health score available"
              description="This page does not render a fake score before real analysis data exists."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const maxPossible = healthData.dimensions.length * 100;
  const currentTotal = healthData.dimensions.reduce((sum, dimension) => sum + dimension.score, 0);
  const improvementPotential = maxPossible - currentTotal;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      <motion.div variants={item} className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 rounded-xl">
            <Activity className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Money Health Score</h1>
            <p className="text-gray-500">Current analysis-backed health breakdown</p>
          </div>
        </div>
        <Button
          variant="secondary"
          icon={Download}
          disabled
          title="Report download stays disabled until a real backend report object exists."
        >
          Download Report
        </Button>
      </motion.div>

      <motion.div variants={item}>
        <RuntimeNotice
          title={
            runtimeConfig.demoModeEnabled
              ? 'Demo mode is enabled for this page.'
              : 'Scores and suggestions are data-backed when present.'
          }
          description={
            runtimeConfig.demoModeEnabled
              ? 'The score shown here is synthetic because demo mode was explicitly enabled.'
              : 'If the backend response is missing, the page remains blank instead of showing placeholder commentary.'
          }
          variant={runtimeConfig.demoModeEnabled ? 'demo' : 'live'}
        />
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="text-center bg-gradient-to-br from-purple-50 to-cyan-50">
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
                    healthData.dimensions.reduce((max, dimension) =>
                      dimension.score > max.score ? dimension : max
                    ).dimension
                  }
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
                    healthData.dimensions.reduce((min, dimension) =>
                      dimension.score < min.score ? dimension : min
                    ).dimension
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={item}>
          <HealthScoreRadar
            dimensions={healthData.dimensions}
            overallScore={healthData.overallScore}
          />
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle>Score Breakdown</CardTitle>
              <CardDescription>Dimension-wise scores from the current analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {healthData.dimensions
                  .slice()
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
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${dimension.score}%`,
                            backgroundColor: getScoreColor(dimension.score),
                          }}
                        />
                      </div>
                    </div>
                  ))}
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-blue-700">
                Improvement potential from the current score mix is about{' '}
                <strong>{Math.round((improvementPotential / maxPossible) * 100)} points</strong>.
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div variants={item}>
        <HealthScoreDetails dimensions={healthData.dimensions} />
      </motion.div>
    </motion.div>
  );
}

export default HealthScorePage;
