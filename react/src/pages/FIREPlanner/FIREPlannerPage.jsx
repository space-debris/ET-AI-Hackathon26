import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Flame, Target, Calendar, TrendingUp, Shield, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Slider } from '../../components/ui/Slider';
import { StatCard } from '../../components/ui/StatCard';
import { Spinner } from '../../components/ui/Spinner';
import { FIRETimelineChart, SIPProgressChart } from '../../components/charts/FIREChart';
import { fireApi } from '../../services/api';
import { formatCurrency, formatCompactNumber } from '../../utils/helpers';

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

const riskProfiles = [
  { value: 'conservative', label: 'Conservative' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'aggressive', label: 'Aggressive' },
];

export function FIREPlannerPage() {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [firePlan, setFirePlan] = useState(null);
  const [profile, setProfile] = useState({
    age: 32,
    annualIncome: 1800000,
    monthlyExpenses: 60000,
    existingInvestments: 1600000,
    targetRetirementAge: 50,
    targetMonthlyCorpus: 100000,
    riskProfile: 'moderate',
  });

  const fetchPlan = useCallback(async () => {
    try {
      const data = await fireApi.generatePlan(profile);
      setFirePlan(data);
    } catch (error) {
      console.error('Failed to fetch FIRE plan:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const handleProfileChange = (field, value) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleUpdatePlan = async () => {
    setUpdating(true);
    try {
      const data = await fireApi.updatePlan(profile);
      setFirePlan(data);
    } catch (error) {
      console.error('Failed to update plan:', error);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size="lg" />
      </div>
    );
  }

  const yearsToFire = profile.targetRetirementAge - profile.age;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={item}>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-orange-100 rounded-xl">
            <Flame className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">FIRE Planner</h1>
            <p className="text-gray-500">
              Financial Independence, Retire Early - Plan your journey
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Form */}
        <motion.div variants={item}>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Your Profile</CardTitle>
              <CardDescription>
                Adjust parameters to see how they affect your FIRE timeline
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Input
                label="Current Age"
                type="number"
                value={profile.age}
                onChange={(e) => handleProfileChange('age', parseInt(e.target.value))}
              />

              <Input
                label="Annual Income (₹)"
                type="number"
                value={profile.annualIncome}
                onChange={(e) =>
                  handleProfileChange('annualIncome', parseInt(e.target.value))
                }
              />

              <Input
                label="Monthly Expenses (₹)"
                type="number"
                value={profile.monthlyExpenses}
                onChange={(e) =>
                  handleProfileChange('monthlyExpenses', parseInt(e.target.value))
                }
              />

              <Input
                label="Existing Investments (₹)"
                type="number"
                value={profile.existingInvestments}
                onChange={(e) =>
                  handleProfileChange('existingInvestments', parseInt(e.target.value))
                }
              />

              <Slider
                label="Target Retirement Age"
                value={profile.targetRetirementAge}
                onChange={(v) => handleProfileChange('targetRetirementAge', v)}
                min={40}
                max={65}
                step={1}
                formatValue={(v) => `${v} years`}
              />

              <Input
                label="Target Monthly Income (Post-retirement)"
                type="number"
                value={profile.targetMonthlyCorpus}
                onChange={(e) =>
                  handleProfileChange('targetMonthlyCorpus', parseInt(e.target.value))
                }
              />

              <Select
                label="Risk Profile"
                value={profile.riskProfile}
                onChange={(e) => handleProfileChange('riskProfile', e.target.value)}
                options={riskProfiles}
              />

              <Button
                className="w-full"
                onClick={handleUpdatePlan}
                loading={updating}
                icon={RefreshCw}
              >
                Update Plan
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary Stats */}
          <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="FIRE Date"
              value={`Year ${2026 + yearsToFire}`}
              subtitle={`${yearsToFire} years to go`}
              icon={Calendar}
            />
            <StatCard
              title="Target Corpus"
              value={formatCompactNumber(firePlan.summary.targetCorpus)}
              subtitle="Required nest egg"
              icon={Target}
            />
            <StatCard
              title="Monthly SIP"
              value={formatCurrency(70000)}
              subtitle="Starting amount"
              icon={TrendingUp}
            />
            <StatCard
              title="Insurance Gap"
              value={formatCompactNumber(firePlan.summary.insuranceGap)}
              subtitle="Term life needed"
              icon={Shield}
            />
          </motion.div>

          {/* Timeline Chart */}
          <motion.div variants={item}>
            <FIRETimelineChart
              milestones={firePlan.milestones}
              targetCorpus={firePlan.summary.targetCorpus}
            />
          </motion.div>

          {/* SIP Schedule */}
          <motion.div variants={item}>
            <SIPProgressChart milestones={firePlan.milestones} />
          </motion.div>

          {/* Milestones Table */}
          <motion.div variants={item}>
            <Card>
              <CardHeader>
                <CardTitle>Monthly Milestones</CardTitle>
                <CardDescription>
                  Year-by-year breakdown of your FIRE journey
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                          Year
                        </th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">
                          Equity SIP
                        </th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">
                          Debt SIP
                        </th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">
                          Gold SIP
                        </th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">
                          Corpus
                        </th>
                        <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">
                          Asset Mix
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                          Notes
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {firePlan.milestones.map((milestone, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 font-medium text-gray-900">
                            {milestone.year}
                          </td>
                          <td className="py-3 px-4 text-right text-sm text-gray-600">
                            {formatCurrency(milestone.equitySip)}
                          </td>
                          <td className="py-3 px-4 text-right text-sm text-gray-600">
                            {formatCurrency(milestone.debtSip)}
                          </td>
                          <td className="py-3 px-4 text-right text-sm text-gray-600">
                            {formatCurrency(milestone.goldSip)}
                          </td>
                          <td className="py-3 px-4 text-right text-sm font-semibold text-gray-900">
                            {formatCompactNumber(milestone.totalCorpus)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1">
                              <div
                                className="h-2 rounded-l-full bg-blue-500"
                                style={{ width: `${milestone.equityPct * 0.6}px` }}
                                title={`Equity: ${milestone.equityPct}%`}
                              />
                              <div
                                className="h-2 bg-emerald-500"
                                style={{ width: `${milestone.debtPct * 0.6}px` }}
                                title={`Debt: ${milestone.debtPct}%`}
                              />
                              <div
                                className="h-2 rounded-r-full bg-amber-500"
                                style={{
                                  width: `${(100 - milestone.equityPct - milestone.debtPct) * 0.6}px`,
                                }}
                                title={`Gold: ${100 - milestone.equityPct - milestone.debtPct}%`}
                              />
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-500 max-w-xs truncate">
                            {milestone.notes}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Key Insights */}
          <motion.div variants={item}>
            <Card>
              <CardHeader>
                <CardTitle>Key Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-semibold text-blue-900">Glidepath Strategy</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      Your equity allocation will gradually decrease from 70% to 35% as you
                      approach retirement, reducing risk exposure.
                    </p>
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-lg">
                    <h4 className="font-semibold text-emerald-900">SIP Escalation</h4>
                    <p className="text-sm text-emerald-700 mt-1">
                      1% monthly increase in SIP recommended to account for inflation and
                      salary growth. This significantly accelerates corpus building.
                    </p>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-lg">
                    <h4 className="font-semibold text-amber-900">Emergency Fund</h4>
                    <p className="text-sm text-amber-700 mt-1">
                      Maintain 6 months of expenses (₹{formatCurrency(profile.monthlyExpenses * 6)})
                      in liquid funds before aggressive investing.
                    </p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <h4 className="font-semibold text-purple-900">Insurance Check</h4>
                    <p className="text-sm text-purple-700 mt-1">
                      You need ₹{formatCompactNumber(firePlan.summary.insuranceGap)} term insurance
                      coverage to protect your family during the accumulation phase.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

export default FIREPlannerPage;
