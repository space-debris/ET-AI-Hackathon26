// Utility functions for formatting

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
  const colors = {
    large_cap: '#3b82f6', // blue
    mid_cap: '#8b5cf6', // purple
    small_cap: '#ec4899', // pink
    flexi_cap: '#10b981', // green
    elss: '#f59e0b', // amber
    debt: '#6366f1', // indigo
    hybrid: '#14b8a6', // teal
  };
  return colors[category] || '#6b7280';
}

export function getCategoryLabel(category) {
  const labels = {
    large_cap: 'Large Cap',
    mid_cap: 'Mid Cap',
    small_cap: 'Small Cap',
    flexi_cap: 'Flexi Cap',
    elss: 'ELSS',
    debt: 'Debt',
    hybrid: 'Hybrid',
  };
  return labels[category] || category;
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
