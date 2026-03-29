import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Clock3,
  FileText,
  MessageSquare,
  Send,
  Shield,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { RuntimeNotice } from '../../components/ui/RuntimeNotice';
import { StatCard } from '../../components/ui/StatCard';
import { formatCompactNumber, formatCurrency } from '../../utils/helpers';
import { buildLifeEventPlan, lifeEventOptions, riskProfileOptions } from '../../utils/planners';
import { lifeEventApi, runtimeConfig, userApi } from '../../services/api';

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
  riskProfile: 'moderate',
};

const defaultScenario = {
  eventType: 'bonus',
  eventAmount: 600000,
  monthsUntilEvent: 1,
  currentReserve: 250000,
  highInterestDebt: 150000,
  monthlyCostChange: 0,
};

const starterQuestions = [
  'Does the sample Form 16 already show the full salary and HRA picture?',
  'What should I verify in Form 16 before I deploy a bonus?',
  'If I switch jobs this year, what tax checks come first?',
];

const initialAssistantMessage = {
  role: 'assistant',
  answer:
    'I am grounded on the bundled sample Form 16 and a life-event playbook. Ask about bonus, job switch, marriage, new baby, inheritance, or what to verify in salary tax documents before acting.',
  highlights: [],
  sources: [],
  retrievedChunks: 0,
  knowledgeLabel: 'Bundled sample Form 16 FY 2025-26 + life event playbook',
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

export function LifeEventAdvisorPage() {
  const [profile, setProfile] = useState(defaultProfile);
  const [scenario, setScenario] = useState(defaultScenario);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState(null);
  const [messages, setMessages] = useState([initialAssistantMessage]);

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

  const handleScenarioChange = (field, value) => {
    const numericValue = value === '' ? 0 : Number(value);
    setScenario((prev) => ({
      ...prev,
      [field]:
        field === 'eventType'
          ? value
          : Number.isFinite(numericValue)
            ? numericValue
            : 0,
    }));
  };

  const plan = useMemo(
    () => buildLifeEventPlan(profile, scenario),
    [profile, scenario]
  );

  const handleAskAdvisor = async (promptOverride) => {
    const prompt = (promptOverride ?? chatInput).trim();
    if (!prompt || chatLoading) {
      return;
    }

    setChatError(null);
    setChatLoading(true);
    setMessages((prev) => [...prev, { role: 'user', text: prompt }]);

    try {
      const response = await lifeEventApi.askAdvisor({
        question: prompt,
        profile,
        scenario,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          answer: response.answer,
          highlights: response.highlights ?? [],
          sources: response.sources ?? [],
          retrievedChunks: response.retrievedChunks ?? 0,
          knowledgeLabel: response.knowledgeLabel ?? '',
          metrics: response.metrics ?? null,
        },
      ]);
      setChatInput('');
    } catch (advisorError) {
      setChatError(advisorError.message);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      <motion.div variants={item}>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-pink-100 p-3">
            <Sparkles className="h-6 w-6 text-pink-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Life Event Advisor</h1>
            <p className="text-gray-500">
              Stress-test bonus, inheritance, marriage, new-baby, and job-switch decisions before you deploy cash.
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div variants={item}>
        <RuntimeNotice
          title="This planner updates instantly as the event changes."
          description={
            runtimeConfig.demoModeEnabled
              ? 'Demo mode is enabled, but the event allocations still react to your live inputs.'
              : 'We use your saved profile as a starting point, then rebuild the event playbook locally with every edit.'
          }
          variant={runtimeConfig.demoModeEnabled ? 'demo' : 'live'}
        />
      </motion.div>

      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <CardTitle>Event Inputs</CardTitle>
            <CardDescription>
              Use the saved profile as a base and model the event amount, debt reset, and extra monthly cost.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
            <Select
              label="Risk Profile"
              value={profile.riskProfile}
              name="riskProfile"
              onChange={(event) => handleProfileChange('riskProfile', event.target.value)}
              options={riskProfileOptions}
            />

            <Select
              label="Life Event"
              value={scenario.eventType}
              name="eventType"
              onChange={(event) => handleScenarioChange('eventType', event.target.value)}
              options={lifeEventOptions}
            />
            <Input
              label="Event Amount (INR)"
              type="number"
              value={scenario.eventAmount}
              onChange={(event) => handleScenarioChange('eventAmount', event.target.value)}
            />
            <Input
              label="Current Liquid Reserve (INR)"
              type="number"
              value={scenario.currentReserve}
              onChange={(event) => handleScenarioChange('currentReserve', event.target.value)}
              hint="Cash, savings, and liquid funds you can access quickly"
            />
            <Input
              label="High-Interest Debt (INR)"
              type="number"
              value={scenario.highInterestDebt}
              onChange={(event) => handleScenarioChange('highInterestDebt', event.target.value)}
            />

            <Input
              label="Months Until Event"
              type="number"
              value={scenario.monthsUntilEvent}
              onChange={(event) => handleScenarioChange('monthsUntilEvent', event.target.value)}
            />
            <Input
              label="Monthly Cost Change (INR)"
              type="number"
              value={scenario.monthlyCostChange}
              onChange={(event) => handleScenarioChange('monthlyCostChange', event.target.value)}
              hint="Expected new EMI, childcare, or household cost after the event"
            />
            <div className="md:col-span-2 xl:col-span-2 rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">
                Planner Readout
              </p>
              <p className="mt-2 text-lg font-semibold text-gray-900">{plan.headline}</p>
              <p className="mt-2 text-sm leading-6 text-gray-600">{plan.summary}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Event Amount"
          value={formatCurrency(plan.eventAmount)}
          subtitle={plan.eventLabel}
          icon={Wallet}
          iconColor="purple"
        />
        <StatCard
          title="Deployable After Ring-Fencing"
          value={formatCompactNumber(plan.deployableAmount)}
          subtitle="Usable after tax/paperwork reserve"
          icon={TrendingUp}
          iconColor="green"
        />
        <StatCard
          title="Reserve Target"
          value={formatCompactNumber(plan.reserveTarget)}
          subtitle={`${formatCompactNumber(plan.reserveShortfall)} still missing today`}
          icon={Shield}
          iconColor="blue"
        />
        <StatCard
          title="Review Window"
          value={`${plan.monthsUntilEvent} mo`}
          subtitle={`${plan.growthTilt}% growth / ${plan.safetyTilt}% safety tilt`}
          icon={Clock3}
          iconColor="orange"
        />
      </motion.div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle>Recommended Allocation Split</CardTitle>
              <CardDescription>
                The event amount is split across immediate protection, debt reset, and long-term deployment.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {plan.buckets.map((bucket) => (
                <div key={bucket.key} className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{bucket.label}</p>
                      <p className="mt-1 text-sm text-gray-500">{bucket.detail}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-xl font-bold text-gray-900">{formatCurrency(bucket.amount)}</p>
                      <p className="text-sm text-gray-400">{bucket.sharePct.toFixed(1)}% of event amount</p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-white">
                    <div
                      className={
                        bucket.tone === 'amber'
                          ? 'h-2 rounded-full bg-amber-400'
                          : bucket.tone === 'blue'
                            ? 'h-2 rounded-full bg-blue-500'
                            : bucket.tone === 'rose'
                              ? 'h-2 rounded-full bg-rose-500'
                              : bucket.tone === 'emerald'
                                ? 'h-2 rounded-full bg-emerald-500'
                                : 'h-2 rounded-full bg-purple-500'
                      }
                      style={{ width: `${Math.max(bucket.sharePct, 4)}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle>AI Guardrails</CardTitle>
              <CardDescription>
                The first move and the constraints to respect before deploying the event proceeds.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">
                  First Move
                </p>
                <p className="mt-2 text-sm leading-6 text-blue-950">{plan.firstMove}</p>
              </div>
              {plan.guardrails.map((guardrail) => (
                <div key={guardrail} className="flex gap-3 rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <p className="text-sm leading-6 text-amber-950">{guardrail}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <CardTitle>Trigger-Based Checklist</CardTitle>
            <CardDescription>
              A simple before/during/after sequence so the event becomes a financial upgrade instead of a leak.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-3">
            {plan.checklist.map((step) => (
              <div key={step.phase} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-400">
                  {step.phase}
                </p>
                <h4 className="mt-2 text-lg font-semibold text-gray-900">{step.title}</h4>
                <p className="mt-1 text-sm font-medium text-pink-600">{step.timing}</p>
                <p className="mt-3 text-sm leading-6 text-gray-600">{step.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={item}>
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Life Event Advisor Chat</CardTitle>
              <CardDescription>
                Ask grounded questions against the bundled sample Form 16 and the current life-event scenario.
              </CardDescription>
            </div>
            <Badge variant="purple" size="sm" dot>
              RAG-backed sample Form 16
            </Badge>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl border border-purple-100 bg-purple-50/70 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-white p-2 shadow-sm">
                    <FileText className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-purple-950">
                      Bundled salary document
                    </p>
                    <p className="mt-1 text-sm text-purple-900/80">
                      Sample Form 16 FY 2025-26 with salary, HRA, deduction, and TDS context for retrieval-grounded answers.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 md:min-w-[280px]">
                  <div className="rounded-xl bg-white/90 p-3 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-purple-500">
                      Gross Salary
                    </p>
                    <p className="mt-1 text-lg font-bold text-purple-950">₹24.0L</p>
                  </div>
                  <div className="rounded-xl bg-white/90 p-3 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-purple-500">
                      TDS
                    </p>
                    <p className="mt-1 text-lg font-bold text-purple-950">₹2.93L</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {starterQuestions.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handleAskAdvisor(prompt)}
                      className="rounded-full border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-600 transition hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                <div className="space-y-4 rounded-3xl border border-gray-100 bg-gray-50/60 p-4">
                  {messages.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      className={
                        message.role === 'user'
                          ? 'ml-auto max-w-3xl rounded-2xl bg-blue-600 px-4 py-3 text-sm leading-6 text-white'
                          : 'max-w-3xl rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-sm'
                      }
                    >
                      {message.role === 'user' ? (
                        <p>{message.text}</p>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-purple-600" />
                            <p className="text-sm font-semibold text-gray-900">Advisor response</p>
                            {message.retrievedChunks ? (
                              <Badge variant="indigo" size="sm">
                                {message.retrievedChunks} section{message.retrievedChunks === 1 ? '' : 's'} retrieved
                              </Badge>
                            ) : null}
                          </div>
                          <p className="whitespace-pre-line text-sm leading-6 text-gray-700">
                            {message.answer}
                          </p>

                          {message.highlights?.length ? (
                            <div className="grid gap-3 md:grid-cols-3">
                              {message.highlights.map((highlight) => (
                                <div
                                  key={highlight}
                                  className="rounded-2xl border border-purple-100 bg-purple-50/60 p-3 text-sm leading-6 text-purple-950"
                                >
                                  {highlight}
                                </div>
                              ))}
                            </div>
                          ) : null}

                          {message.sources?.length ? (
                            <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">
                                  Retrieved Sources
                                </p>
                                {message.knowledgeLabel ? (
                                  <span className="text-xs text-gray-400">{message.knowledgeLabel}</span>
                                ) : null}
                              </div>
                              {message.sources.map((source) => (
                                <div
                                  key={`${source.title}-${source.section}-${source.excerpt}`}
                                  className="rounded-2xl border border-white bg-white px-4 py-3 shadow-sm"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-semibold text-gray-900">{source.title}</p>
                                    <Badge variant="default" size="sm">{source.section}</Badge>
                                  </div>
                                  <p className="mt-2 text-sm leading-6 text-gray-600">{source.excerpt}</p>
                                  <p className="mt-2 text-xs text-gray-400">{source.source_path}</p>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ))}

                  {chatLoading ? (
                    <div className="max-w-3xl rounded-2xl border border-purple-100 bg-white px-4 py-4 shadow-sm">
                      <p className="text-sm text-gray-500">
                        Retrieving Form 16 context and building a grounded response...
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-4">
                <Textarea
                  label="Ask the advisor"
                  rows={7}
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Example: I may switch jobs in 3 months. What should I check in Form 16 and how much cash should I keep aside first?"
                  hint="The answer is grounded on the bundled sample Form 16 plus life-event notes, then tailored to your current scenario."
                />
                {chatError ? (
                  <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {chatError}
                  </div>
                ) : null}
                <Button
                  onClick={() => handleAskAdvisor()}
                  loading={chatLoading}
                  icon={Send}
                  iconPosition="right"
                  fullWidth
                >
                  Ask Advisor
                </Button>

                <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">
                    Current Scenario Snapshot
                  </p>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-blue-950">
                    <p>Event type: {plan.eventLabel}</p>
                    <p>Event amount: {formatCurrency(plan.eventAmount)}</p>
                    <p>Reserve target: {formatCurrency(plan.reserveTarget)}</p>
                    <p>Reserve shortfall: {formatCurrency(plan.reserveShortfall)}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

export default LifeEventAdvisorPage;
