import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Calculator,
  CheckCircle,
  AlertTriangle,
  Lightbulb,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { RuntimeNotice } from '../../components/ui/RuntimeNotice';
import { taxApi, runtimeConfig, userApi } from '../../services/api';
import { formatCurrency } from '../../utils/helpers';
import { clsx } from 'clsx';

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

const metroOptions = [
  { value: 'true', label: 'Metro City' },
  { value: 'false', label: 'Non-Metro City' },
];

const TAX_COMPARISON_CACHE_KEY = 'finsage-tax-comparison-cache-v1';
const SESSION_STORAGE_KEY = 'finsage-session-id-v2';
const defaultTaxProfile = {
  age: 30,
  annualIncome: 2400000,
  existingInvestments: {},
  monthlyExpenses: 40000,
  targetRetirementAge: 60,
  targetMonthlyCorpus: 0,
  riskProfile: 'moderate',
  baseSalary: 1800000,
  hraReceived: 360000,
  rentPaid: 480000,
  metroCity: true,
  section80C: 150000,
  npsContribution: 50000,
  medicalInsurancePremium: 25000,
  homeLoanInterest: 0,
  otherDeductions: 0,
};

const hasOwnValue = (object, key) => Object.prototype.hasOwnProperty.call(object ?? {}, key);

const getProfileSignature = (profile) => JSON.stringify(profile);

const getCurrentSessionId = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(SESSION_STORAGE_KEY);
};

const readCachedTaxComparison = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(TAX_COMPARISON_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeCachedTaxComparison = (profile, taxData) => {
  if (typeof window === 'undefined' || !taxData) {
    return;
  }

  const payload = {
    sessionId: getCurrentSessionId(),
    profileSignature: getProfileSignature(profile),
    taxData,
  };

  window.localStorage.setItem(TAX_COMPARISON_CACHE_KEY, JSON.stringify(payload));
};

const restoreCachedTaxComparison = (profile) => {
  const cached = readCachedTaxComparison();
  if (!cached?.taxData) {
    return null;
  }

  const currentSessionId = getCurrentSessionId();
  if (cached.sessionId && currentSessionId && cached.sessionId !== currentSessionId) {
    return null;
  }

  return cached.profileSignature === getProfileSignature(profile) ? cached.taxData : null;
};

const pickNumber = (savedProfile, key, fallback) => (
  hasOwnValue(savedProfile, key) && savedProfile[key] !== null && savedProfile[key] !== undefined
    ? Number(savedProfile[key]) || 0
    : fallback
);

const hasMeaningfulTaxProfile = (savedProfile) => (
  (savedProfile?.annualIncome ?? 0) > 0 ||
  (savedProfile?.baseSalary ?? 0) > 0 ||
  (savedProfile?.hraReceived ?? 0) > 0 ||
  (savedProfile?.rentPaid ?? 0) > 0 ||
  (savedProfile?.section80C ?? 0) > 0 ||
  (savedProfile?.npsContribution ?? 0) > 0 ||
  (savedProfile?.medicalInsurancePremium ?? 0) > 0 ||
  (savedProfile?.homeLoanInterest ?? 0) > 0 ||
  (savedProfile?.otherDeductions ?? 0) > 0
);

const mergeTaxProfile = (defaults, savedProfile) => ({
  ...defaults,
  age: pickNumber(savedProfile, 'age', defaults.age),
  monthlyExpenses: pickNumber(savedProfile, 'monthlyExpenses', defaults.monthlyExpenses),
  annualIncome: pickNumber(savedProfile, 'annualIncome', defaults.annualIncome),
  existingInvestments: hasOwnValue(savedProfile, 'existingInvestments')
    ? savedProfile.existingInvestments ?? {}
    : defaults.existingInvestments,
  targetRetirementAge: pickNumber(
    savedProfile,
    'targetRetirementAge',
    defaults.targetRetirementAge
  ),
  targetMonthlyCorpus: pickNumber(
    savedProfile,
    'targetMonthlyCorpus',
    defaults.targetMonthlyCorpus
  ),
  riskProfile: hasOwnValue(savedProfile, 'riskProfile')
    ? savedProfile.riskProfile ?? defaults.riskProfile
    : defaults.riskProfile,
  baseSalary: pickNumber(savedProfile, 'baseSalary', defaults.baseSalary),
  hraReceived: pickNumber(savedProfile, 'hraReceived', defaults.hraReceived),
  rentPaid: pickNumber(savedProfile, 'rentPaid', defaults.rentPaid),
  metroCity: hasOwnValue(savedProfile, 'metroCity')
    ? savedProfile.metroCity === true || savedProfile.metroCity === 'true'
    : defaults.metroCity,
  section80C: pickNumber(savedProfile, 'section80C', defaults.section80C),
  npsContribution: pickNumber(savedProfile, 'npsContribution', defaults.npsContribution),
  medicalInsurancePremium: pickNumber(
    savedProfile,
    'medicalInsurancePremium',
    defaults.medicalInsurancePremium
  ),
  homeLoanInterest: pickNumber(savedProfile, 'homeLoanInterest', defaults.homeLoanInterest),
  otherDeductions: pickNumber(savedProfile, 'otherDeductions', defaults.otherDeductions),
});

export function TaxOptimizerPage() {
  const [calculating, setCalculating] = useState(false);
  const [taxData, setTaxData] = useState(null);
  const [error, setError] = useState(null);
  const autoRefreshEnabled = useRef(false);
  const hydratingProfile = useRef(true);
  const lastSyncedProfile = useRef('');
  const [profile, setProfile] = useState(defaultTaxProfile);

  const handleProfileChange = (field, value) => {
    const numericValue = value === '' ? 0 : Number(value);
    setProfile((prev) => ({
      ...prev,
      [field]:
        field === 'metroCity'
          ? value === 'true'
          : Number.isFinite(numericValue)
            ? numericValue
            : 0,
    }));
  };

  useEffect(() => {
    let active = true;

    async function hydrateProfile() {
      try {
        let nextProfile = defaultTaxProfile;
        const savedProfile = await userApi.getProfile();
        if (active && savedProfile && hasMeaningfulTaxProfile(savedProfile)) {
          nextProfile = mergeTaxProfile(defaultTaxProfile, savedProfile);
          setProfile(nextProfile);
        }

        if (!active) {
          return;
        }

        const cachedTaxData = restoreCachedTaxComparison(nextProfile);
        if (cachedTaxData) {
          setTaxData(cachedTaxData);
          autoRefreshEnabled.current = true;
          lastSyncedProfile.current = getProfileSignature(nextProfile);
        }
      } catch {
        if (!active) {
          return;
        }

        const cachedProfile = userApi.getCachedProfile();
        const nextProfile =
          cachedProfile && hasMeaningfulTaxProfile(cachedProfile)
            ? mergeTaxProfile(defaultTaxProfile, cachedProfile)
            : defaultTaxProfile;

        if (cachedProfile && hasMeaningfulTaxProfile(cachedProfile)) {
          setProfile(nextProfile);
          userApi.updateProfile(nextProfile).catch(() => {
            // Keep the local restore even if the backend session cannot be refreshed yet.
          });
        }

        const cachedTaxData = restoreCachedTaxComparison(nextProfile);
        if (cachedTaxData) {
          setTaxData(cachedTaxData);
          autoRefreshEnabled.current = true;
          lastSyncedProfile.current = getProfileSignature(nextProfile);
        }
      } finally {
        hydratingProfile.current = false;
      }
    }

    hydrateProfile();

    return () => {
      active = false;
    };
  }, []);

  const handleCalculate = async () => {
    setCalculating(true);
    setError(null);

    try {
      const data = await taxApi.compareRegimes(profile);
      setTaxData(data);
      writeCachedTaxComparison(profile, data);
      autoRefreshEnabled.current = true;
      lastSyncedProfile.current = getProfileSignature(profile);
    } catch (calculateError) {
      console.error('Failed to calculate tax comparison:', calculateError);
      setTaxData(null);
      setError(calculateError.message);
    } finally {
      setCalculating(false);
    }
  };

  useEffect(() => {
    const profileSignature = getProfileSignature(profile);

    if (
      !autoRefreshEnabled.current ||
      hydratingProfile.current ||
      calculating ||
      lastSyncedProfile.current === profileSignature
    ) {
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      try {
        setCalculating(true);
        setError(null);
        const data = await taxApi.compareRegimes(profile);
        setTaxData(data);
        writeCachedTaxComparison(profile, data);
        lastSyncedProfile.current = profileSignature;
      } catch (calculateError) {
        console.error('Failed to refresh tax comparison:', calculateError);
        setTaxData(null);
        setError(calculateError.message);
      } finally {
        setCalculating(false);
      }
    }, 900);

    return () => window.clearTimeout(timer);
  }, [profile, calculating]);

  const isOldBetter = taxData?.recommendedRegime === 'old';

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      <motion.div variants={item}>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-100 rounded-xl">
            <Calculator className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tax Optimizer</h1>
            <p className="text-gray-500">
              Compare tax regimes using your income, rent, and deduction details.
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div variants={item} className="space-y-3">
        <RuntimeNotice
          title={
            runtimeConfig.demoModeEnabled
              ? 'Demo mode is enabled for tax optimisation.'
              : 'No statement upload is needed here.'
          }
          description={
            runtimeConfig.demoModeEnabled
              ? 'These values are synthetic because VITE_ENABLE_DEMO_MODE=true.'
              : 'Enter your salary, HRA, rent paid, and deductions, then run the comparison to see which regime is better for you.'
          }
          variant={runtimeConfig.demoModeEnabled ? 'demo' : 'live'}
        />
        {error && (
          <RuntimeNotice
            title="Tax comparison failed."
            description={error}
            variant="error"
          />
        )}
      </motion.div>

      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <CardTitle>Your Income Details</CardTitle>
            <CardDescription>
              After the first comparison, changes to these inputs automatically refresh the result.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Input
              label="Annual Income (INR)"
              type="number"
              value={profile.annualIncome}
              onChange={(e) => handleProfileChange('annualIncome', e.target.value)}
            />
            <Input
              label="Base Salary (INR)"
              type="number"
              value={profile.baseSalary}
              onChange={(e) => handleProfileChange('baseSalary', e.target.value)}
            />
            <Input
              label="HRA (INR)"
              type="number"
              value={profile.hraReceived}
              onChange={(e) => handleProfileChange('hraReceived', e.target.value)}
              hint="Annual amount"
            />
            <Input
              label="Rent Paid (INR)"
              type="number"
              value={profile.rentPaid}
              onChange={(e) => handleProfileChange('rentPaid', e.target.value)}
              hint="Annual amount"
            />
            <Select
              label="City Type"
              value={String(profile.metroCity)}
              name="metroCity"
              onChange={(e) => handleProfileChange('metroCity', e.target.value)}
              options={metroOptions}
            />
            <Input
              label="Section 80C (INR)"
              type="number"
              value={profile.section80C}
              onChange={(e) => handleProfileChange('section80C', e.target.value)}
              hint="PPF, EPF, ELSS, LIC"
            />
            <Input
              label="NPS (INR)"
              type="number"
              value={profile.npsContribution}
              onChange={(e) => handleProfileChange('npsContribution', e.target.value)}
            />
            <Input
              label="Insurance (INR)"
              type="number"
              value={profile.medicalInsurancePremium}
              onChange={(e) =>
                handleProfileChange('medicalInsurancePremium', e.target.value)
              }
              hint="Premium paid"
            />
            <Input
              label="Other Deductions (INR)"
              type="number"
              value={profile.otherDeductions}
              onChange={(e) => handleProfileChange('otherDeductions', e.target.value)}
              hint="Any additional eligible deductions"
            />
            <Input
              label="Home Loan (INR)"
              type="number"
              value={profile.homeLoanInterest}
              onChange={(e) => handleProfileChange('homeLoanInterest', e.target.value)}
              hint="Interest paid"
            />
            <div className="flex items-end xl:col-start-4">
              <Button
                className="w-full"
                onClick={handleCalculate}
                loading={calculating}
                icon={RefreshCw}
              >
                {taxData ? 'Recompute Tax Comparison' : 'Compare Regimes'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="space-y-6">
          {!taxData && !calculating && (
            <motion.div variants={item}>
              <Card>
                <CardContent>
                  <EmptyState
                    icon={FileText}
                    title="No tax comparison yet"
                    description="Add your income and deduction details to compare the old and new tax regimes."
                    action={handleCalculate}
                    actionLabel="Compare Regimes"
                  />
                </CardContent>
              </Card>
            </motion.div>
          )}

          {taxData && (
            <>
              <motion.div variants={item}>
                <Card
                  className={clsx(
                    'border-2',
                    isOldBetter ? 'border-emerald-200 bg-emerald-50' : 'border-blue-200 bg-blue-50'
                  )}
                >
                  <CardContent className="py-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className={clsx(
                            'p-3 rounded-full',
                            isOldBetter ? 'bg-emerald-100' : 'bg-blue-100'
                          )}
                        >
                          <CheckCircle
                            className={clsx(
                              'h-8 w-8',
                              isOldBetter ? 'text-emerald-600' : 'text-blue-600'
                            )}
                          />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Recommended Regime</p>
                          <h2 className="text-2xl font-bold text-gray-900">
                            {isOldBetter ? 'Old Tax Regime' : 'New Tax Regime'}
                          </h2>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">You Save</p>
                        <p className="text-3xl font-bold text-emerald-600">
                          {formatCurrency(taxData.savingsAmount)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={item} className="grid md:grid-cols-2 gap-4">
                <Card
                  className={clsx(
                    'border-2 transition-all',
                    isOldBetter ? 'border-emerald-300' : 'border-gray-100'
                  )}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Old Regime</CardTitle>
                      {isOldBetter && <Badge variant="success">Recommended</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {taxData.oldRegimeSteps.map((step, idx) => (
                        <div
                          key={idx}
                          className={clsx(
                            'flex justify-between text-sm gap-4',
                            step.description.includes('Total') || step.description.includes('Final')
                              ? 'font-semibold text-gray-900 pt-2 border-t'
                              : 'text-gray-600'
                          )}
                        >
                          <span>{step.description}</span>
                          <span className={step.amount < 0 ? 'text-emerald-600' : ''}>
                            {step.amount < 0 ? '-' : ''}₹
                            {Math.abs(step.amount).toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500">Final Tax Liability</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(taxData.oldTotalTax)}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className={clsx(
                    'border-2 transition-all',
                    !isOldBetter ? 'border-blue-300' : 'border-gray-100'
                  )}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>New Regime</CardTitle>
                      {!isOldBetter && <Badge variant="primary">Recommended</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {taxData.newRegimeSteps.map((step, idx) => (
                        <div
                          key={idx}
                          className={clsx(
                            'flex justify-between text-sm gap-4',
                            step.description.includes('Total') || step.description.includes('Final')
                              ? 'font-semibold text-gray-900 pt-2 border-t'
                              : 'text-gray-600'
                          )}
                        >
                          <span>{step.description}</span>
                          <span className={step.amount < 0 ? 'text-emerald-600' : ''}>
                            {step.amount < 0 ? '-' : ''}₹
                            {Math.abs(step.amount).toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500">Final Tax Liability</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(taxData.newTotalTax)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {taxData.missedDeductions.length > 0 && (
                <motion.div variants={item}>
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        <CardTitle>Missed Deductions</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {taxData.missedDeductions.map((deduction, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-amber-50 rounded-lg text-sm text-gray-700"
                          >
                            {deduction}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {taxData.additionalInstruments.length > 0 && (
                <motion.div variants={item}>
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-blue-500" />
                        <CardTitle>Tax Saving Opportunities</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {taxData.additionalInstruments.map((instrument, idx) => (
                          <div
                            key={idx}
                            className="p-4 border border-gray-100 rounded-lg hover:border-blue-200 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-gray-900">
                                {instrument.name}
                              </h4>
                              <Badge variant="default" size="sm">
                                {instrument.section}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mt-2">{instrument.rationale}</p>
                            <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-gray-600">
                              <div>
                                <span className="font-medium text-gray-900">Max limit:</span>{' '}
                                {formatCurrency(instrument.maxLimit)}
                              </div>
                              <div>
                                <span className="font-medium text-gray-900">Expected return:</span>{' '}
                                {instrument.expectedReturn}
                              </div>
                              <div>
                                <span className="font-medium text-gray-900">Liquidity:</span>{' '}
                                {instrument.liquidity}
                              </div>
                              <div>
                                <span className="font-medium text-gray-900">Risk:</span>{' '}
                                {instrument.risk}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </>
          )}
      </div>
    </motion.div>
  );
}

export default TaxOptimizerPage;
