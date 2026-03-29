import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Milestone,
  PiggyBank,
  Plus,
  Shield,
  Target,
  Trash2,
  Wallet,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { RuntimeNotice } from '../../components/ui/RuntimeNotice';
import { StatCard } from '../../components/ui/StatCard';
import { formatCompactNumber, formatCurrency } from '../../utils/helpers';
import {
  buildPathPlannerRoadmap,
  goalPriorityOptions,
  goalTypeOptions,
  riskProfileOptions,
} from '../../utils/planners';
import { runtimeConfig, userApi } from '../../services/api';

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

const defaultProfile = {
  age: 34,
  annualIncome: 2400000,
  monthlyExpenses: 80000,
  existingInvestments: 2400000,
  liquidEmergencyFund: 300000,
  riskProfile: 'moderate',
  section80C: 150000,
  npsContribution: 50000,
};

const defaultGoals = [
  {
    id: 'goal-home',
    title: 'Home Down Payment',
    goalType: 'home',
    priority: 'high',
    targetAmount: 2500000,
    currentSavings: 600000,
    targetMonths: 36,
  },
  {
    id: 'goal-education',
    title: 'Higher Education',
    goalType: 'education',
    priority: 'medium',
    targetAmount: 1800000,
    currentSavings: 250000,
    targetMonths: 72,
  },
  {
    id: 'goal-retirement',
    title: 'Retirement Top-up',
    goalType: 'retirement',
    priority: 'high',
    targetAmount: 5000000,
    currentSavings: 2400000,
    targetMonths: 180,
  },
];

const coerceInvestments = (value, fallback) => {
  if (typeof value === 'number') {
    return value;
  }
  if (value && typeof value === 'object') {
    return Object.values(value).reduce((sum, item) => sum + (Number(item) || 0), 0);
  }
  return fallback;
};

const makeNewGoal = (index) => ({
  id: `goal-${Date.now()}-${index}`,
  title: `New Goal ${index}`,
  goalType: 'wealth',
  priority: 'medium',
  targetAmount: 1000000,
  currentSavings: 0,
  targetMonths: 60,
});

export function PathPlannerPage() {
  const [profile, setProfile] = useState(defaultProfile);
  const [goals, setGoals] = useState(defaultGoals);

  useEffect(() => {
    let active = true;

    async function hydrateProfile() {
      try {
        const savedProfile = await userApi.getProfile();
        if (!active || !savedProfile) {
          return;
        }
        setProfile((prev) => ({
          ...prev,
          age: Number(savedProfile.age) || prev.age,
          annualIncome: Number(savedProfile.annualIncome) || prev.annualIncome,
          monthlyExpenses: Number(savedProfile.monthlyExpenses) || prev.monthlyExpenses,
          existingInvestments: coerceInvestments(
            savedProfile.existingInvestments,
            prev.existingInvestments
          ),
          riskProfile: savedProfile.riskProfile || prev.riskProfile,
          section80C: Number(savedProfile.section80C) || prev.section80C,
          npsContribution: Number(savedProfile.npsContribution) || prev.npsContribution,
        }));
      } catch {
        const cachedProfile = userApi.getCachedProfile();
        if (!active || !cachedProfile) {
          return;
        }
        setProfile((prev) => ({
          ...prev,
          age: Number(cachedProfile.age) || prev.age,
          annualIncome: Number(cachedProfile.annualIncome) || prev.annualIncome,
          monthlyExpenses: Number(cachedProfile.monthlyExpenses) || prev.monthlyExpenses,
          existingInvestments: coerceInvestments(
            cachedProfile.existingInvestments,
            prev.existingInvestments
          ),
          riskProfile: cachedProfile.riskProfile || prev.riskProfile,
          section80C: Number(cachedProfile.section80C) || prev.section80C,
          npsContribution: Number(cachedProfile.npsContribution) || prev.npsContribution,
        }));
      }
    }

    hydrateProfile();
    return () => {
      active = false;
    };
  }, []);

  const handleProfileChange = (field, value) => {
    const numericValue = value === '' ? 0 : Number(value);
    setProfile((prev) => ({
      ...prev,
      [field]:
        field === 'riskProfile'
          ? value
          : Number.isFinite(numericValue)
            ? numericValue
            : 0,
    }));
  };

  const handleGoalChange = (goalId, field, value) => {
    const numericValue = value === '' ? 0 : Number(value);
    setGoals((prev) =>
      prev.map((goal) => (
        goal.id === goalId
          ? {
              ...goal,
              [field]:
                field === 'title' || field === 'goalType' || field === 'priority'
                  ? value
                  : Number.isFinite(numericValue)
                    ? numericValue
                    : 0,
            }
          : goal
      ))
    );
  };

  const handleAddGoal = () => {
    setGoals((prev) => [...prev, makeNewGoal(prev.length + 1)]);
  };

  const handleRemoveGoal = (goalId) => {
    setGoals((prev) => (prev.length > 1 ? prev.filter((goal) => goal.id !== goalId) : prev));
  };

  const plan = useMemo(
    () => buildPathPlannerRoadmap(profile, goals),
    [profile, goals]
  );

  const sortedGoalCards = [...plan.goalCards].sort((left, right) => right.monthlySip - left.monthlySip);

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      <motion.div variants={item}>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-100 p-3">
            <Milestone className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Path Planner</h1>
            <p className="text-gray-500">
              Turn income, expenses, existing assets, and life goals into a month-by-month action roadmap.
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div variants={item}>
        <RuntimeNotice
          title="This planner updates instantly as profile or goal inputs change."
          description={
            runtimeConfig.demoModeEnabled
              ? 'Demo mode is enabled, but the multi-goal planning logic still reacts to your live inputs.'
              : 'We start from your saved profile when available, then rebuild the monthly goal roadmap locally after every edit.'
          }
          variant={runtimeConfig.demoModeEnabled ? 'demo' : 'live'}
        />
      </motion.div>

      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <CardTitle>Planning Inputs</CardTitle>
            <CardDescription>
              Add goals with target timelines and the planner will spread monthly surplus across emergency, tax, protection, and goal SIPs.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Input
              label="Current Age"
              type="number"
              value={profile.age}
              onChange={(event) => handleProfileChange('age', event.target.value)}
            />
            <Input
              label="Annual Income (INR)"
              type="number"
              value={profile.annualIncome}
              onChange={(event) => handleProfileChange('annualIncome', event.target.value)}
            />
            <Input
              label="Monthly Expenses (INR)"
              type="number"
              value={profile.monthlyExpenses}
              onChange={(event) => handleProfileChange('monthlyExpenses', event.target.value)}
            />
            <Input
              label="Existing Investments (INR)"
              type="number"
              value={profile.existingInvestments}
              onChange={(event) => handleProfileChange('existingInvestments', event.target.value)}
            />
            <Input
              label="Liquid Emergency Fund (INR)"
              type="number"
              value={profile.liquidEmergencyFund}
              onChange={(event) => handleProfileChange('liquidEmergencyFund', event.target.value)}
            />
            <Input
              label="80C Used (INR)"
              type="number"
              value={profile.section80C}
              onChange={(event) => handleProfileChange('section80C', event.target.value)}
            />
            <Input
              label="NPS Used (INR)"
              type="number"
              value={profile.npsContribution}
              onChange={(event) => handleProfileChange('npsContribution', event.target.value)}
            />
            <Select
              label="Risk Profile"
              value={profile.riskProfile}
              name="riskProfile"
              onChange={(event) => handleProfileChange('riskProfile', event.target.value)}
              options={riskProfileOptions}
            />
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={item}>
        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Life Goals</CardTitle>
              <CardDescription>
                Each goal gets a monthly SIP suggestion and a horizon-based asset mix.
              </CardDescription>
            </div>
            <Button variant="secondary" icon={Plus} onClick={handleAddGoal}>
              Add Goal
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {goals.map((goal) => (
              <div key={goal.id} className="rounded-2xl border border-gray-100 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-900">{goal.title}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    onClick={() => handleRemoveGoal(goal.id)}
                    disabled={goals.length === 1}
                  >
                    Remove
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                  <Input
                    label="Goal Name"
                    value={goal.title}
                    onChange={(event) => handleGoalChange(goal.id, 'title', event.target.value)}
                  />
                  <Select
                    label="Goal Type"
                    value={goal.goalType}
                    name={`${goal.id}-goalType`}
                    onChange={(event) => handleGoalChange(goal.id, 'goalType', event.target.value)}
                    options={goalTypeOptions}
                  />
                  <Select
                    label="Priority"
                    value={goal.priority}
                    name={`${goal.id}-priority`}
                    onChange={(event) => handleGoalChange(goal.id, 'priority', event.target.value)}
                    options={goalPriorityOptions}
                  />
                  <Input
                    label="Target Amount (INR)"
                    type="number"
                    value={goal.targetAmount}
                    onChange={(event) => handleGoalChange(goal.id, 'targetAmount', event.target.value)}
                  />
                  <Input
                    label="Current Savings (INR)"
                    type="number"
                    value={goal.currentSavings}
                    onChange={(event) => handleGoalChange(goal.id, 'currentSavings', event.target.value)}
                  />
                  <Input
                    label="Time to Goal (Months)"
                    type="number"
                    value={goal.targetMonths}
                    onChange={(event) => handleGoalChange(goal.id, 'targetMonths', event.target.value)}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={item} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Monthly Surplus"
          value={formatCurrency(plan.monthlySurplus)}
          subtitle="Available before goal splits"
          icon={Wallet}
        />
        <StatCard
          title="Emergency Target"
          value={formatCompactNumber(plan.emergencyTarget)}
          subtitle={`${plan.emergencyTargetMonths} months of expenses`}
          icon={PiggyBank}
        />
        <StatCard
          title="Insurance Gap"
          value={formatCompactNumber(plan.insuranceGap)}
          subtitle="10x income rule gap"
          icon={Shield}
        />
        <StatCard
          title="Tax Headroom"
          value={formatCurrency(plan.totalTaxHeadroom)}
          subtitle="80C + NPS room left"
          icon={Target}
        />
      </motion.div>

      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <CardTitle>Goal SIP Blueprint</CardTitle>
            <CardDescription>
              Recommended monthly SIPs by goal, based on urgency, priority, and current progress.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            {sortedGoalCards.map((goal) => (
              <div key={goal.id} className="rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-gray-900">{goal.title}</p>
                    <p className="text-sm text-gray-500">
                      {goal.assetMix.label} • {goal.targetMonths} months to goal
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Suggested SIP</p>
                    <p className="text-xl font-semibold text-gray-900">
                      {formatCurrency(goal.monthlySip)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl bg-gray-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                      Gap to Goal
                    </p>
                    <p className="mt-2 text-lg font-semibold text-gray-900">
                      {formatCurrency(goal.gap)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                      Projected Shortfall
                    </p>
                    <p className="mt-2 text-lg font-semibold text-gray-900">
                      {formatCurrency(goal.projectedShortfall)}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-gray-600">
                  Asset mix: {goal.assetMix.equityPct}% equity / {goal.assetMix.debtPct}% debt / {goal.assetMix.goldPct}% gold.
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <CardTitle>Month-by-Month Roadmap</CardTitle>
            <CardDescription>
              The first 12-24 months of how surplus should move across liquidity, tax, protection, and goals.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px]">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Month</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Emergency</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Tax Move</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Goal SIPs</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Lead Goal</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Protection & Asset Shift</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {plan.roadmap.map((row) => (
                    <tr key={row.monthLabel} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{row.monthLabel}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600">
                        {formatCurrency(row.emergencyTopUp)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600">
                        {formatCurrency(row.taxTopUp)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                        {formatCurrency(row.totalGoalSip)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <p className="font-medium text-gray-900">{row.leadGoal}</p>
                        <p>{formatCurrency(row.leadGoalContribution)} this month</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <p>{row.protectionAction}</p>
                        <p className="mt-1 text-gray-500">{row.assetShift}</p>
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
            <CardTitle>Action Checklist</CardTitle>
            <CardDescription>
              The planner keeps protection, taxes, and liquidity in front of pure investing.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {plan.actionChecklist.map((line) => (
              <div key={line} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                {line}
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

export default PathPlannerPage;
