import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Flame,
  Target,
  Calendar,
  TrendingUp,
  Shield,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Slider } from '../../components/ui/Slider';
import { StatCard } from '../../components/ui/StatCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { RuntimeNotice } from '../../components/ui/RuntimeNotice';
import { FIRETimelineChart, SIPProgressChart } from '../../components/charts/FIREChart';
import { fireApi, runtimeConfig, userApi } from '../../services/api';
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

const hasMeaningfulFireProfile = (savedProfile) => (
  (savedProfile?.age ?? 0) > 0 ||
  (savedProfile?.annualIncome ?? 0) > 0 ||
  (savedProfile?.monthlyExpenses ?? 0) > 0 ||
  (savedProfile?.existingInvestments ?? 0) > 0 ||
  (savedProfile?.targetRetirementAge ?? 0) > 0 ||
  (savedProfile?.targetMonthlyCorpus ?? 0) > 0
);

const mergeFireProfile = (defaults, savedProfile) => ({
  ...defaults,
  age: (savedProfile?.age ?? 0) > 0 ? savedProfile.age : defaults.age,
  annualIncome:
    (savedProfile?.annualIncome ?? 0) > 0 ? savedProfile.annualIncome : defaults.annualIncome,
  monthlyExpenses:
    (savedProfile?.monthlyExpenses ?? 0) > 0
      ? savedProfile.monthlyExpenses
      : defaults.monthlyExpenses,
  existingInvestments:
    (savedProfile?.existingInvestments ?? 0) > 0
      ? savedProfile.existingInvestments
      : defaults.existingInvestments,
  targetRetirementAge:
    (savedProfile?.targetRetirementAge ?? 0) > 0
      ? savedProfile.targetRetirementAge
      : defaults.targetRetirementAge,
  targetMonthlyCorpus:
    (savedProfile?.targetMonthlyCorpus ?? 0) > 0
      ? savedProfile.targetMonthlyCorpus
      : defaults.targetMonthlyCorpus,
  riskProfile: savedProfile?.riskProfile ?? defaults.riskProfile,
});

export function FIREPlannerPage() {
  const [updating, setUpdating] = useState(false);
  const [firePlan, setFirePlan] = useState(null);
  const [error, setError] = useState(null);
  const autoRefreshEnabled = useRef(false);
  const hydratingProfile = useRef(true);
  const lastSyncedProfile = useRef('');
  const [profile, setProfile] = useState({
    age: 34,
    annualIncome: 2400000,
    monthlyExpenses: 80000,
    existingInvestments: 2400000,
    targetRetirementAge: 50,
    targetMonthlyCorpus: 150000,
    riskProfile: 'moderate',
  });

  const handleProfileChange = (field, value) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    let active = true;

    async function hydrateProfile() {
      try {
        const savedProfile = await userApi.getProfile();
        if (!active || !savedProfile || !hasMeaningfulFireProfile(savedProfile)) {
          return;
        }
        setProfile((prev) => mergeFireProfile(prev, savedProfile));
      } catch {
        // Keep the default validation profile if no session profile exists yet.
      } finally {
        hydratingProfile.current = false;
      }
    }

    hydrateProfile();

    return () => {
      active = false;
    };
  }, []);

  const handleRunPlan = async () => {
    setUpdating(true);
    setError(null);

    try {
      const data = firePlan
        ? await fireApi.updatePlan(profile)
        : await fireApi.generatePlan(profile);
      setFirePlan(data);
      autoRefreshEnabled.current = true;
      lastSyncedProfile.current = JSON.stringify(profile);
    } catch (runError) {
      console.error('Failed to run FIRE plan:', runError);
      setFirePlan(null);
      setError(runError.message);
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    const profileSignature = JSON.stringify(profile);

    if (
      !autoRefreshEnabled.current ||
      hydratingProfile.current ||
      updating ||
      lastSyncedProfile.current === profileSignature
    ) {
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      try {
        setUpdating(true);
        setError(null);
        const data = await fireApi.updatePlan(profile);
        setFirePlan(data);
        lastSyncedProfile.current = profileSignature;
      } catch (runError) {
        console.error('Failed to refresh FIRE plan:', runError);
        setFirePlan(null);
        setError(runError.message);
      } finally {
        setUpdating(false);
      }
    }, 900);

    return () => window.clearTimeout(timer);
  }, [profile, updating]);

  const yearsToFire = profile.targetRetirementAge - profile.age;
  const insuranceGapValue = firePlan?.insuranceGap?.totalGap ?? 0;
  const firstMilestone = firePlan?.milestones?.[0] ?? null;
  const lastMilestone =
    firePlan?.milestones?.[firePlan.milestones.length - 1] ?? null;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      <motion.div variants={item}>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-orange-100 rounded-xl">
            <Flame className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">FIRE Planner</h1>
            <p className="text-gray-500">
              Build your retirement roadmap using profile details only.
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div variants={item} className="space-y-3">
        <RuntimeNotice
          title={
            runtimeConfig.demoModeEnabled
              ? 'Demo mode is enabled for FIRE planning.'
              : 'You can plan for FIRE without uploading a statement.'
          }
          description={
            runtimeConfig.demoModeEnabled
              ? 'This page uses explicit synthetic data only when VITE_ENABLE_DEMO_MODE=true.'
              : 'Fill in your age, income, expenses, and target retirement age to generate a personalised plan.'
          }
          variant={runtimeConfig.demoModeEnabled ? 'demo' : 'live'}
        />
        {error && (
          <RuntimeNotice
            title="FIRE plan generation failed."
            description={error}
            variant="error"
          />
        )}
      </motion.div>

      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <CardTitle>Your Profile</CardTitle>
            <CardDescription>
              Once you generate a plan, future profile changes refresh the output automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Input
              label="Current Age"
              type="number"
              value={profile.age}
              onChange={(e) => handleProfileChange('age', parseInt(e.target.value, 10) || 0)}
            />

            <Input
              label="Annual Income (INR)"
              type="number"
              value={profile.annualIncome}
              onChange={(e) =>
                handleProfileChange('annualIncome', parseInt(e.target.value, 10) || 0)
              }
            />

            <Input
              label="Monthly Expenses (INR)"
              type="number"
              value={profile.monthlyExpenses}
              onChange={(e) =>
                handleProfileChange('monthlyExpenses', parseInt(e.target.value, 10) || 0)
              }
            />

            <Input
              label="Existing Investments (INR)"
              type="number"
              value={profile.existingInvestments}
              onChange={(e) =>
                handleProfileChange(
                  'existingInvestments',
                  parseInt(e.target.value, 10) || 0
                )
              }
            />

            <div className="md:col-span-2 xl:col-span-2">
              <Slider
                label="Target Retirement Age"
                value={profile.targetRetirementAge}
                onChange={(value) => handleProfileChange('targetRetirementAge', value)}
                min={40}
                max={65}
                step={1}
                formatValue={(value) => `${value} years`}
              />
            </div>

            <Input
              label="Target Monthly Need (INR)"
              type="number"
              value={profile.targetMonthlyCorpus}
              onChange={(e) =>
                handleProfileChange(
                  'targetMonthlyCorpus',
                  parseInt(e.target.value, 10) || 0
                )
              }
              hint="Post-retirement monthly need"
            />

            <Select
              label="Risk Profile"
              value={profile.riskProfile}
              name="riskProfile"
              onChange={(e) => handleProfileChange('riskProfile', e.target.value)}
              options={riskProfiles}
            />

            <div className="md:col-span-2 xl:col-span-4 flex justify-end">
              <Button
                className="w-full md:w-auto"
                onClick={handleRunPlan}
                loading={updating}
                icon={RefreshCw}
              >
                {firePlan ? 'Recompute Plan' : 'Generate Plan'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="space-y-6">
          {!firePlan && !updating && (
            <motion.div variants={item}>
              <Card>
                <CardContent>
                  <EmptyState
                    icon={FileText}
                    title="No FIRE plan generated yet"
                    description="Add your profile details to see your target corpus, required SIP, and milestone roadmap."
                    action={handleRunPlan}
                    actionLabel="Generate Plan"
                  />
                </CardContent>
              </Card>
            </motion.div>
          )}

          {firePlan && (
            <>
              <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="FIRE Date"
                  value={firePlan.expectedRetirementDate || `Year ${2026 + yearsToFire}`}
                  subtitle={`${firePlan.yearsToRetirement ?? yearsToFire} years to go`}
                  icon={Calendar}
                />
                <StatCard
                  title="Target Corpus"
                  value={formatCompactNumber(firePlan.targetCorpus)}
                  subtitle="Required nest egg"
                  icon={Target}
                />
                <StatCard
                  title="Monthly SIP"
                  value={formatCurrency(firePlan.monthlySipRequired)}
                  subtitle="Required contribution"
                  icon={TrendingUp}
                />
                <StatCard
                  title="Insurance Gap"
                  value={
                    insuranceGapValue ? formatCompactNumber(insuranceGapValue) : 'Not provided'
                  }
                  subtitle="Protection gap"
                  icon={Shield}
                />
              </motion.div>

              <motion.div variants={item}>
                <FIRETimelineChart
                  milestones={firePlan.milestones}
                  targetCorpus={firePlan.targetCorpus}
                />
              </motion.div>

              <motion.div variants={item}>
                <SIPProgressChart milestones={firePlan.milestones} />
              </motion.div>

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
                                    style={{ width: `${milestone.goldPct * 0.6}px` }}
                                    title={`Gold: ${milestone.goldPct}%`}
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
                          Equity allocation shifts from {firstMilestone?.equityPct ?? 0}% to{' '}
                          {lastMilestone?.equityPct ?? 0}% in the current plan.
                        </p>
                      </div>
                      <div className="p-4 bg-emerald-50 rounded-lg">
                        <h4 className="font-semibold text-emerald-900">Required SIP</h4>
                        <p className="text-sm text-emerald-700 mt-1">
                          The current plan needs about {formatCurrency(firePlan.monthlySipRequired)}
                          {' '}per month to target {formatCompactNumber(firePlan.targetCorpus)}.
                        </p>
                      </div>
                      <div className="p-4 bg-amber-50 rounded-lg">
                        <h4 className="font-semibold text-amber-900">Emergency Fund</h4>
                        <p className="text-sm text-amber-700 mt-1">
                          Keep about {formatCurrency(profile.monthlyExpenses * 6)} liquid before
                          increasing risk.
                        </p>
                      </div>
                      <div className="p-4 bg-purple-50 rounded-lg">
                        <h4 className="font-semibold text-purple-900">Insurance Check</h4>
                        <p className="text-sm text-purple-700 mt-1">
                          {insuranceGapValue
                            ? `Additional cover needed: ${formatCompactNumber(insuranceGapValue)}.`
                            : 'The current response did not include an insurance gap estimate.'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </>
          )}
      </div>
    </motion.div>
  );
}

export default FIREPlannerPage;
