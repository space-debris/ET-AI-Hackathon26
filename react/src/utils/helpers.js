// Utility functions for formatting

const CATEGORY_COLORS = {
  large_cap: '#2563eb',
  mid_cap: '#7c3aed',
  small_cap: '#ec4899',
  flexi_cap: '#10b981',
  multi_cap: '#14b8a6',
  elss: '#f59e0b',
  debt_short_duration: '#0ea5e9',
  debt_medium_duration: '#06b6d4',
  debt_long_duration: '#0891b2',
  liquid: '#22c55e',
  hybrid_aggressive: '#f97316',
  hybrid_conservative: '#fb7185',
  index_fund: '#6366f1',
  sectoral: '#ef4444',
  international: '#8b5cf6',
  other: '#64748b',
};

const CATEGORY_LABELS = {
  large_cap: 'Large Cap',
  mid_cap: 'Mid Cap',
  small_cap: 'Small Cap',
  flexi_cap: 'Flexi Cap',
  multi_cap: 'Multi Cap',
  elss: 'ELSS',
  debt_short_duration: 'Short Duration Debt',
  debt_medium_duration: 'Medium Duration Debt',
  debt_long_duration: 'Long Duration Debt',
  liquid: 'Liquid',
  hybrid_aggressive: 'Aggressive Hybrid',
  hybrid_conservative: 'Conservative Hybrid',
  index_fund: 'Index Fund',
  sectoral: 'Sectoral',
  international: 'International',
  other: 'Other',
};

const FUND_PALETTE = [
  '#2563eb',
  '#7c3aed',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#14b8a6',
  '#ef4444',
  '#6366f1',
];

export function formatCurrency(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num, decimals = 0) {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatPercentage(value, decimals = 1) {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatPercentagePoints(value, decimals = 1) {
  return `${Number(value).toFixed(decimals)}%`;
}

export function humanizeLabel(value) {
  if (!value) {
    return '';
  }

  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatDate(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatCompactNumber(num) {
  if (num >= 10000000) {
    return `₹${(num / 10000000).toFixed(1)}Cr`;
  } else if (num >= 100000) {
    return `₹${(num / 100000).toFixed(1)}L`;
  } else if (num >= 1000) {
    return `₹${(num / 1000).toFixed(1)}K`;
  }
  return `₹${num}`;
}

export function calculateReturns(invested, current) {
  return ((current - invested) / invested) * 100;
}

export function calculateAbsoluteReturns(invested, current) {
  return current - invested;
}

export function getCategoryColor(category) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.other;
}

export function getCategoryLabel(category) {
  return CATEGORY_LABELS[category] || category;
}

export function getFundColor(seed, fallbackCategory = 'other') {
  if (!seed) {
    return getCategoryColor(fallbackCategory);
  }

  const hash = String(seed)
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return FUND_PALETTE[hash % FUND_PALETTE.length] || getCategoryColor(fallbackCategory);
}

export function getActionColor(action) {
  const colors = {
    hold: 'success',
    exit: 'danger',
    reduce: 'warning',
    switch: 'primary',
    increase: 'purple',
  };
  return colors[action] || 'default';
}

export function getScoreColor(score) {
  if (score >= 80) return '#22c55e'; // green
  if (score >= 60) return '#eab308'; // yellow
  if (score >= 40) return '#f97316'; // orange
  return '#ef4444'; // red
}

export function getScoreLabel(score) {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Needs Improvement';
  return 'Poor';
}
