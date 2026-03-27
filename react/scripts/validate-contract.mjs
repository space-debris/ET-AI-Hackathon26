import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOCK_PORTFOLIO_ANALYTICS, MOCK_TAX_COMPARISON } from '../src/utils/mockData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const apiSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'api.js'), 'utf8');
const taxPageSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'pages', 'TaxOptimizer', 'TaxOptimizerPage.jsx'),
  'utf8'
);

const failures = [];

if (!apiSource.includes('VITE_ENABLE_DEMO_MODE')) {
  failures.push('API service must gate demo mode behind VITE_ENABLE_DEMO_MODE.');
}

if (apiSource.includes('const USE_MOCK_DATA = true')) {
  failures.push('API service still contains unconditional USE_MOCK_DATA=true.');
}

if (!taxPageSource.includes('rentPaid')) {
  failures.push('Tax page must capture rentPaid in frontend state.');
}

if (!taxPageSource.includes('baseSalary')) {
  failures.push('Tax page must capture baseSalary in frontend state.');
}

if (MOCK_PORTFOLIO_ANALYTICS.holdings.length !== 6) {
  failures.push(`Expected 6 mock holdings, found ${MOCK_PORTFOLIO_ANALYTICS.holdings.length}.`);
}

if (MOCK_PORTFOLIO_ANALYTICS.overallXirr !== 0.121) {
  failures.push(`Expected mock overall XIRR of 0.121, found ${MOCK_PORTFOLIO_ANALYTICS.overallXirr}.`);
}

if (MOCK_PORTFOLIO_ANALYTICS.expenseRatioDragInr !== 5644.85) {
  failures.push(
    `Expected mock expense drag of 5644.85, found ${MOCK_PORTFOLIO_ANALYTICS.expenseRatioDragInr}.`
  );
}

if (MOCK_TAX_COMPARISON.oldTotalTax !== 366600) {
  failures.push(`Expected mock old regime tax of 366600, found ${MOCK_TAX_COMPARISON.oldTotalTax}.`);
}

if (MOCK_TAX_COMPARISON.newTotalTax !== 292500) {
  failures.push(`Expected mock new regime tax of 292500, found ${MOCK_TAX_COMPARISON.newTotalTax}.`);
}

if (MOCK_TAX_COMPARISON.savingsAmount !== 74100) {
  failures.push(`Expected mock savings of 74100, found ${MOCK_TAX_COMPARISON.savingsAmount}.`);
}

if (failures.length > 0) {
  console.error('Contract validation failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Contract validation passed.');
