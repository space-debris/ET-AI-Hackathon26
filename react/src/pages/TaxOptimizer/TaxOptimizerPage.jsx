import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Calculator,
  TrendingDown,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Lightbulb,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { taxApi } from '../../services/api';
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
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [taxData, setTaxData] = useState(null);
  const [profile, setProfile] = useState({
    annualIncome: 1800000,
    hra: 360000,
    section80C: 150000,
    npsContribution: 50000,
    homeLoanInterest: 200000,
    healthInsurance: 0,
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await taxApi.compareRegimes(profile);
        setTaxData(data);
      } catch (error) {
        console.error('Failed to fetch tax data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleProfileChange = (field, value) => {
    setProfile((prev) => ({ ...prev, [field]: parseInt(value) || 0 }));
  };

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const data = await taxApi.compareRegimes(profile);
      setTaxData(data);
    } catch (error) {
      console.error('Failed to calculate:', error);
    } finally {
      setCalculating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size="lg" />
      </div>
    );
  }

  const isOldBetter = taxData.recommendedRegime === 'old';

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
          <div className="p-3 bg-emerald-100 rounded-xl">
            <Calculator className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tax Optimizer</h1>
            <p className="text-gray-500">
              Compare Old vs New tax regime and find the best option for you
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Form */}
        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle>Your Income Details</CardTitle>
              <CardDescription>
                Enter your income and deductions for accurate comparison
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Annual Salary (₹)"
                type="number"
                value={profile.annualIncome}
                onChange={(e) => handleProfileChange('annualIncome', e.target.value)}
              />
              <Input
                label="HRA Received (₹/year)"
                type="number"
                value={profile.hra}
                onChange={(e) => handleProfileChange('hra', e.target.value)}
              />
              <Input
                label="Section 80C (₹)"
                type="number"
                value={profile.section80C}
                onChange={(e) => handleProfileChange('section80C', e.target.value)}
                hint="ELSS, EPF, PPF, etc. (Max: ₹1.5L)"
              />
              <Input
                label="NPS Contribution (₹)"
                type="number"
                value={profile.npsContribution}
                onChange={(e) => handleProfileChange('npsContribution', e.target.value)}
                hint="80CCD(1B) - Additional ₹50K"
              />
              <Input
                label="Home Loan Interest (₹)"
                type="number"
                value={profile.homeLoanInterest}
                onChange={(e) => handleProfileChange('homeLoanInterest', e.target.value)}
                hint="Section 24(b) - Max ₹2L"
              />
              <Input
                label="Health Insurance Premium (₹)"
                type="number"
                value={profile.healthInsurance}
                onChange={(e) => handleProfileChange('healthInsurance', e.target.value)}
                hint="Section 80D - Max ₹25K"
              />
              <Button
                className="w-full"
                onClick={handleCalculate}
                loading={calculating}
              >
                Compare Regimes
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recommendation Banner */}
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

          {/* Comparison Cards */}
          <motion.div variants={item} className="grid md:grid-cols-2 gap-4">
            {/* Old Regime */}
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
                        'flex justify-between text-sm',
                        step.description.includes('Total') ||
                          step.description.includes('Final')
                          ? 'font-semibold text-gray-900 pt-2 border-t'
                          : 'text-gray-600'
                      )}
                    >
                      <span>{step.description}</span>
                      <span
                        className={step.amount < 0 ? 'text-emerald-600' : ''}
                      >
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

            {/* New Regime */}
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
                        'flex justify-between text-sm',
                        step.description.includes('Total') ||
                          step.description.includes('Final')
                          ? 'font-semibold text-gray-900 pt-2 border-t'
                          : 'text-gray-600'
                      )}
                    >
                      <span>{step.description}</span>
                      <span
                        className={step.amount < 0 ? 'text-emerald-600' : ''}
                      >
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

          {/* Missed Deductions */}
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
                        className="flex items-center justify-between p-3 bg-amber-50 rounded-lg"
                      >
                        <span className="text-sm text-gray-700">{deduction.item}</span>
                        <span className="text-sm font-semibold text-amber-700">
                          Save up to {formatCurrency(deduction.potentialSaving)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Additional Suggestions */}
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
                      className="flex items-start gap-4 p-4 border border-gray-100 rounded-lg hover:border-blue-200 transition-colors"
                    >
                      <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0">
                        <TrendingDown className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-900">
                            {instrument.instrument}
                          </h4>
                          <Badge variant="default" size="sm">
                            {instrument.section}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {instrument.recommendation}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm text-gray-500">Tax Saved</p>
                        <p className="font-bold text-emerald-600">
                          {formatCurrency(instrument.taxSaved)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

export default TaxOptimizerPage;
