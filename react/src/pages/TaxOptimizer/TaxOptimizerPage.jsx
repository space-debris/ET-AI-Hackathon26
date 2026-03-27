import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Calculator,
  CheckCircle,
  AlertTriangle,
  Lightbulb,
  FileText,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { RuntimeNotice } from '../../components/ui/RuntimeNotice';
import { taxApi, runtimeConfig } from '../../services/api';
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

export function TaxOptimizerPage() {
  const [calculating, setCalculating] = useState(false);
  const [taxData, setTaxData] = useState(null);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState({
    annualIncome: 2400000,
    baseSalary: 1800000,
    hraReceived: 360000,
    rentPaid: 480000,
    section80C: 150000,
    npsContribution: 50000,
    medicalInsurancePremium: 25000,
    homeLoanInterest: 0,
  });

  const handleProfileChange = (field, value) => {
    setProfile((prev) => ({ ...prev, [field]: parseInt(value, 10) || 0 }));
  };

  const handleCalculate = async () => {
    setCalculating(true);
    setError(null);

    try {
      const data = await taxApi.compareRegimes(profile);
      setTaxData(data);
    } catch (calculateError) {
      console.error('Failed to calculate tax comparison:', calculateError);
      setTaxData(null);
      setError(calculateError.message);
    } finally {
      setCalculating(false);
    }
  };

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
              Profile-only tax regime comparison with backend-calculated steps.
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div variants={item} className="space-y-3">
        <RuntimeNotice
          title={
            runtimeConfig.demoModeEnabled
              ? 'Demo mode is enabled for tax optimisation.'
              : 'Statement upload is not required for tax optimisation.'
          }
          description={
            runtimeConfig.demoModeEnabled
              ? 'These values are synthetic because VITE_ENABLE_DEMO_MODE=true.'
              : 'Enter salary, HRA, rent, and deductions. The page remains blank until you run the comparison.'
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle>Your Income Details</CardTitle>
              <CardDescription>
                `rent_paid` is included here and sent to the backend contract.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                label="HRA Received (INR / year)"
                type="number"
                value={profile.hraReceived}
                onChange={(e) => handleProfileChange('hraReceived', e.target.value)}
              />
              <Input
                label="Rent Paid (INR / year)"
                type="number"
                value={profile.rentPaid}
                onChange={(e) => handleProfileChange('rentPaid', e.target.value)}
              />
              <Input
                label="Section 80C (INR)"
                type="number"
                value={profile.section80C}
                onChange={(e) => handleProfileChange('section80C', e.target.value)}
                hint="PPF, EPF, ELSS, LIC"
              />
              <Input
                label="NPS Contribution (INR)"
                type="number"
                value={profile.npsContribution}
                onChange={(e) => handleProfileChange('npsContribution', e.target.value)}
              />
              <Input
                label="Medical Insurance Premium (INR)"
                type="number"
                value={profile.medicalInsurancePremium}
                onChange={(e) =>
                  handleProfileChange('medicalInsurancePremium', e.target.value)
                }
              />
              <Input
                label="Home Loan Interest (INR)"
                type="number"
                value={profile.homeLoanInterest}
                onChange={(e) => handleProfileChange('homeLoanInterest', e.target.value)}
              />
              <Button
                className="w-full"
                onClick={handleCalculate}
                loading={calculating}
              >
                {taxData ? 'Recompute Tax Comparison' : 'Compare Regimes'}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <div className="lg:col-span-2 space-y-6">
          {!taxData && !calculating && (
            <motion.div variants={item}>
              <Card>
                <CardContent>
                  <EmptyState
                    icon={FileText}
                    title="No tax comparison yet"
                    description="Run the comparison to see old and new regime calculations. This scenario does not require a PDF."
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
      </div>
    </motion.div>
  );
}

export default TaxOptimizerPage;
