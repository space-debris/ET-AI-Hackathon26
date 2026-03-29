import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { HeartHandshake, PiggyBank, Shield, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { RuntimeNotice } from '../../components/ui/RuntimeNotice';
import { StatCard } from '../../components/ui/StatCard';
import { formatCompactNumber, formatCurrency } from '../../utils/helpers';
import { buildCoupleMoneyPlan, riskProfileOptions } from '../../utils/planners';
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

const defaultPartnerA = {
  name: 'Partner A',
  annualIncome: 2400000,
  existingInvestments: 2400000,
  baseSalary: 1800000,
  hraReceived: 360000,
  rentPaid: 360000,
  metroCity: true,
  section80C: 150000,
  npsContribution: 50000,
  currentLifeCover: 15000000,
  riskProfile: 'moderate',
};

const defaultPartnerB = {
  name: 'Partner B',
  annualIncome: 1500000,
  existingInvestments: 900000,
  baseSalary: 1100000,
  hraReceived: 180000,
  rentPaid: 180000,
  metroCity: true,
  section80C: 80000,
  npsContribution: 20000,
  currentLifeCover: 10000000,
  riskProfile: 'moderate',
};

const defaultHousehold = {
  monthlyExpenses: 110000,
  liquidEmergencyFund: 300000,
  currentFamilyFloater: 1000000,
  dependents: 0,
};

const coerceInvestments = (value, fallback) => {
  if (typeof value === 'number') {
    return value;
  }
  if (value && typeof value === 'object') {
    return Object.values(value).reduce((sum, item) => sum + (Number(item) || 0), 0);
  }
  return fallback;
};

const metroOptions = [
  { value: 'true', label: 'Metro' },
  { value: 'false', label: 'Non-metro' },
];

export function CoupleMoneyPlannerPage() {
  const [partnerA, setPartnerA] = useState(defaultPartnerA);
  const [partnerB, setPartnerB] = useState(defaultPartnerB);
  const [household, setHousehold] = useState(defaultHousehold);

  useEffect(() => {
    let active = true;

    async function hydrateProfile() {
      try {
        const savedProfile = await userApi.getProfile();
        if (!active || !savedProfile) {
          return;
        }
        setPartnerA((prev) => ({
          ...prev,
          annualIncome: Number(savedProfile.annualIncome) || prev.annualIncome,
          existingInvestments: coerceInvestments(
            savedProfile.existingInvestments,
            prev.existingInvestments
          ),
          baseSalary: Number(savedProfile.baseSalary) || prev.baseSalary,
          hraReceived: Number(savedProfile.hraReceived) || prev.hraReceived,
          rentPaid: Number(savedProfile.rentPaid) || prev.rentPaid,
          metroCity: savedProfile.metroCity ?? prev.metroCity,
          section80C: Number(savedProfile.section80C) || prev.section80C,
          npsContribution: Number(savedProfile.npsContribution) || prev.npsContribution,
          riskProfile: savedProfile.riskProfile || prev.riskProfile,
        }));
        setHousehold((prev) => ({
          ...prev,
          monthlyExpenses: Number(savedProfile.monthlyExpenses) || prev.monthlyExpenses,
        }));
      } catch {
        const cachedProfile = userApi.getCachedProfile();
        if (!active || !cachedProfile) {
          return;
        }
        setPartnerA((prev) => ({
          ...prev,
          annualIncome: Number(cachedProfile.annualIncome) || prev.annualIncome,
          existingInvestments: coerceInvestments(
            cachedProfile.existingInvestments,
            prev.existingInvestments
          ),
          baseSalary: Number(cachedProfile.baseSalary) || prev.baseSalary,
          hraReceived: Number(cachedProfile.hraReceived) || prev.hraReceived,
          rentPaid: Number(cachedProfile.rentPaid) || prev.rentPaid,
          metroCity: cachedProfile.metroCity ?? prev.metroCity,
          section80C: Number(cachedProfile.section80C) || prev.section80C,
          npsContribution: Number(cachedProfile.npsContribution) || prev.npsContribution,
          riskProfile: cachedProfile.riskProfile || prev.riskProfile,
        }));
        setHousehold((prev) => ({
          ...prev,
          monthlyExpenses: Number(cachedProfile.monthlyExpenses) || prev.monthlyExpenses,
        }));
      }
    }

    hydrateProfile();
    return () => {
      active = false;
    };
  }, []);

  const handlePartnerChange = (setter, field, value) => {
    const numericValue = value === '' ? 0 : Number(value);
    setter((prev) => ({
      ...prev,
      [field]:
        field === 'name'
          ? value
          : field === 'riskProfile'
            ? value
            : field === 'metroCity'
              ? value === 'true'
              : Number.isFinite(numericValue)
                ? numericValue
                : 0,
    }));
  };

  const handleHouseholdChange = (field, value) => {
    const numericValue = value === '' ? 0 : Number(value);
    setHousehold((prev) => ({
      ...prev,
      [field]: Number.isFinite(numericValue) ? numericValue : 0,
    }));
  };

  const plan = useMemo(
    () => buildCoupleMoneyPlan(partnerA, partnerB, household),
    [partnerA, partnerB, household]
  );

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      <motion.div variants={item}>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-purple-100 p-3">
            <Users className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Couple&apos;s Money Planner</h1>
            <p className="text-gray-500">
              Build one shared playbook for cash flow, tax headroom, SIP splits, and household protection.
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div variants={item}>
        <RuntimeNotice
          title="This planner recalculates instantly as both partner profiles change."
          description={
            runtimeConfig.demoModeEnabled
              ? 'Demo mode is enabled, but the couple-planning logic still responds to your live inputs.'
              : 'Partner A is prefilled from the saved profile when available, and the household plan is rebuilt locally with every edit.'
          }
          variant={runtimeConfig.demoModeEnabled ? 'demo' : 'live'}
        />
      </motion.div>

      <motion.div variants={item} className="grid gap-6 xl:grid-cols-3">
        {[{ title: 'Partner A', state: partnerA, setter: setPartnerA }, { title: 'Partner B', state: partnerB, setter: setPartnerB }].map((partner) => (
          <Card key={partner.title}>
            <CardHeader>
              <CardTitle>{partner.title}</CardTitle>
              <CardDescription>
                Individual income, deduction headroom, and protection data.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Input
                label="Name"
                value={partner.state.name}
                onChange={(event) => handlePartnerChange(partner.setter, 'name', event.target.value)}
              />
              <Input
                label="Annual Income (INR)"
                type="number"
                value={partner.state.annualIncome}
                onChange={(event) => handlePartnerChange(partner.setter, 'annualIncome', event.target.value)}
              />
              <Input
                label="Existing Investments (INR)"
                type="number"
                value={partner.state.existingInvestments}
                onChange={(event) => handlePartnerChange(partner.setter, 'existingInvestments', event.target.value)}
              />
              <Input
                label="Base Salary (INR)"
                type="number"
                value={partner.state.baseSalary}
                onChange={(event) => handlePartnerChange(partner.setter, 'baseSalary', event.target.value)}
              />
              <Input
                label="HRA Received (INR)"
                type="number"
                value={partner.state.hraReceived}
                onChange={(event) => handlePartnerChange(partner.setter, 'hraReceived', event.target.value)}
              />
              <Input
                label="Rent Paid (INR)"
                type="number"
                value={partner.state.rentPaid}
                onChange={(event) => handlePartnerChange(partner.setter, 'rentPaid', event.target.value)}
              />
              <Select
                label="City Type"
                value={String(partner.state.metroCity)}
                name={`${partner.title}-metroCity`}
                onChange={(event) => handlePartnerChange(partner.setter, 'metroCity', event.target.value)}
                options={metroOptions}
              />
              <Input
                label="80C Claimed (INR)"
                type="number"
                value={partner.state.section80C}
                onChange={(event) => handlePartnerChange(partner.setter, 'section80C', event.target.value)}
              />
              <Input
                label="NPS Claimed (INR)"
                type="number"
                value={partner.state.npsContribution}
                onChange={(event) => handlePartnerChange(partner.setter, 'npsContribution', event.target.value)}
              />
              <Input
                label="Current Life Cover (INR)"
                type="number"
                value={partner.state.currentLifeCover}
                onChange={(event) => handlePartnerChange(partner.setter, 'currentLifeCover', event.target.value)}
              />
              <Select
                label="Risk Profile"
                value={partner.state.riskProfile}
                name={`${partner.title}-riskProfile`}
                onChange={(event) => handlePartnerChange(partner.setter, 'riskProfile', event.target.value)}
                options={riskProfileOptions}
              />
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader>
            <CardTitle>Household Setup</CardTitle>
            <CardDescription>
              Shared monthly burn, emergency corpus, dependents, and health-cover setup.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Input
              label="Monthly Household Expenses (INR)"
              type="number"
              value={household.monthlyExpenses}
              onChange={(event) => handleHouseholdChange('monthlyExpenses', event.target.value)}
            />
            <Input
              label="Liquid Emergency Fund (INR)"
              type="number"
              value={household.liquidEmergencyFund}
              onChange={(event) => handleHouseholdChange('liquidEmergencyFund', event.target.value)}
            />
            <Input
              label="Current Family Floater (INR)"
              type="number"
              value={household.currentFamilyFloater}
              onChange={(event) => handleHouseholdChange('currentFamilyFloater', event.target.value)}
            />
            <Input
              label="Dependents"
              type="number"
              value={household.dependents}
              onChange={(event) => handleHouseholdChange('dependents', event.target.value)}
            />
            <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">
                Household Readout
              </p>
              <p className="mt-2 text-lg font-semibold text-gray-900">
                Combined surplus of {formatCurrency(plan.monthlySurplus)} per month with a recommended shared SIP of {formatCurrency(plan.recommendedGoalSip)}.
              </p>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Keep the next deduction top-up with the partner who has the stronger headroom, while splitting shared goals by contribution capacity rather than a flat 50/50 rule.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Combined Net Worth"
          value={formatCompactNumber(plan.totalInvestments)}
          subtitle="Current investable household assets"
          icon={PiggyBank}
          iconColor="purple"
        />
        <StatCard
          title="Monthly Surplus"
          value={formatCurrency(plan.monthlySurplus)}
          subtitle={`${formatCurrency(plan.monthlyEmergencyTopUp)} kept for reserve build`}
          icon={TrendingUp}
          iconColor="green"
        />
        <StatCard
          title="Suggested Joint SIP"
          value={formatCurrency(plan.recommendedGoalSip)}
          subtitle="Income-weighted split across both partners"
          icon={HeartHandshake}
          iconColor="blue"
        />
        <StatCard
          title="Protection Gap"
          value={formatCompactNumber(plan.totalProtectionGap)}
          subtitle="Life-cover plus family-floater gap"
          icon={Shield}
          iconColor="orange"
        />
      </motion.div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle>Tax-Efficient Split</CardTitle>
              <CardDescription>
                Use deduction headroom and income share together when you split joint goals.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-full bg-gray-100 p-1">
                <div className="flex h-4 overflow-hidden rounded-full">
                  <div
                    className="bg-blue-500"
                    style={{ width: `${plan.suggestedShareA * 100}%` }}
                    title={partnerA.name}
                  />
                  <div
                    className="bg-purple-500"
                    style={{ width: `${plan.suggestedShareB * 100}%` }}
                    title={partnerB.name}
                  />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {plan.partnerCards.map((partner) => (
                  <div key={partner.key} className="rounded-2xl border border-gray-100 bg-gray-50/70 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900">{partner.name}</h4>
                        <p className="text-sm text-gray-500">
                          Suggested share: {partner.sharePct.toFixed(0)}%
                        </p>
                      </div>
                      <p className="text-lg font-bold text-gray-900">
                        {formatCurrency(partner.suggestedSip)}
                      </p>
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-gray-600">
                      <p>Net worth tracked: {formatCompactNumber(partner.invested)}</p>
                      <p>80C headroom: {formatCurrency(partner.eightyCHeadroom)}</p>
                      <p>NPS headroom: {formatCurrency(partner.npsHeadroom)}</p>
                      <p>Approx. HRA opportunity: {formatCurrency(partner.hraOpportunity)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
                    HRA Opportunity
                  </p>
                  <p className="mt-2 text-2xl font-bold text-emerald-950">
                    {formatCompactNumber(plan.totalHraOpportunity)}
                  </p>
                </div>
                <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">
                    80C Headroom
                  </p>
                  <p className="mt-2 text-2xl font-bold text-blue-950">
                    {formatCompactNumber(plan.total80CHeadroom)}
                  </p>
                </div>
                <div className="rounded-2xl border border-purple-100 bg-purple-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-purple-700">
                    NPS Headroom
                  </p>
                  <p className="mt-2 text-2xl font-bold text-purple-950">
                    {formatCompactNumber(plan.totalNpsHeadroom)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle>Insurance Structure</CardTitle>
              <CardDescription>
                Keep term cover individual and medical protection shared.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {plan.partnerCards.map((partner) => (
                <div key={`${partner.key}-cover`} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-gray-900">{partner.name}</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Recommended life cover: {formatCurrency(partner.recommendedLifeCover)}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Gap remaining: {formatCurrency(partner.lifeGap)}
                  </p>
                </div>
              ))}
              <div className="rounded-2xl border border-orange-100 bg-orange-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-700">
                  Family Floater Target
                </p>
                <p className="mt-2 text-2xl font-bold text-orange-950">
                  {formatCurrency(plan.recommendedFamilyFloater)}
                </p>
                <p className="mt-1 text-sm text-orange-900">
                  Gap remaining: {formatCurrency(plan.healthGap)}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle>Joint Money Playbook</CardTitle>
              <CardDescription>
                A practical sequence for emergency funding, deduction use, and SIP ownership.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {plan.playbook.map((move) => (
                <div key={move.title} className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                  <h4 className="text-base font-semibold text-gray-900">{move.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{move.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle>Ownership Model</CardTitle>
              <CardDescription>
                How to separate what should stay individual from what should be managed jointly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {plan.ownershipModel.map((point) => (
                <div key={point} className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                  <p className="text-sm leading-6 text-blue-950">{point}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default CoupleMoneyPlannerPage;
