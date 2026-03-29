const LIFE_EVENT_CONFIG = {
  bonus: {
    label: 'Bonus',
    reserveMonths: 6,
    taxReservePct: 0.3,
    bucketWeights: { reserve: 0.2, debt: 0.2, protection: 0.1, growth: 0.5 },
    growthLabel: 'Long-term investing',
    headline: 'Use the bonus to strengthen runway before stepping up long-term SIPs.',
    guardrails: [
      'Keep aside tax before treating the bonus as fully deployable cash.',
      'Do not raise fixed lifestyle costs until the reserve and debt reset are handled.',
      'Review direct-plan switches before adding fresh SIPs to already overlapping funds.',
    ],
  },
  inheritance: {
    label: 'Inheritance',
    reserveMonths: 9,
    taxReservePct: 0.05,
    bucketWeights: { reserve: 0.3, debt: 0.15, protection: 0.15, growth: 0.4 },
    growthLabel: 'Staged deployment',
    headline: 'Treat inherited money as family capital first, then deploy it gradually.',
    guardrails: [
      'Park a meaningful slice in liquid or ultra-short duration assets until paperwork is fully clear.',
      'Avoid a one-shot market entry; phase deployment over 6-12 months.',
      'Update nominees, wills, and insurance beneficiaries alongside the asset transfer.',
    ],
  },
  marriage: {
    label: 'Marriage',
    reserveMonths: 9,
    taxReservePct: 0.08,
    bucketWeights: { reserve: 0.3, debt: 0.15, protection: 0.2, growth: 0.35 },
    growthLabel: 'Joint goal corpus',
    headline: 'Prioritise shared cash-flow stability and joint protection before adding new goals.',
    guardrails: [
      'Build the post-marriage reserve before expanding EMIs or fixed commitments.',
      'Move to a family floater if the household depends on one shared health cover setup.',
      'Document account ownership, nominees, and expense sharing early.',
    ],
  },
  new_baby: {
    label: 'New Baby',
    reserveMonths: 12,
    taxReservePct: 0.05,
    bucketWeights: { reserve: 0.35, debt: 0.1, protection: 0.25, growth: 0.3 },
    growthLabel: 'Child goal corpus',
    headline: 'The first money move after a new baby is resilience: runway, cover, then investing.',
    guardrails: [
      'Upgrade health cover and review term insurance before committing to a child corpus SIP.',
      'Assume monthly costs rise faster than expected in the first 12 months.',
      'Keep a larger liquid buffer even if long-term returns look tempting.',
    ],
  },
  job_switch: {
    label: 'Job Switch',
    reserveMonths: 9,
    taxReservePct: 0.1,
    bucketWeights: { reserve: 0.4, debt: 0.1, protection: 0.1, growth: 0.4 },
    growthLabel: 'Transition investing',
    headline: 'During a job transition, protect flexibility first and deploy the rest only after cash flow stabilises.',
    guardrails: [
      'Do not lock too much into illiquid products until the new salary and benefits settle.',
      'Track EPF, gratuity, and insurance continuity during the move.',
      'Treat sign-on or severance cash separately from regular income until the first few salary cycles close cleanly.',
    ],
  },
};

const RISK_PROFILE_OPTIONS = [
  { value: 'conservative', label: 'Conservative' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'aggressive', label: 'Aggressive' },
];

const SECTION_80C_LIMIT = 150000;
const SECTION_80CCD_1B_LIMIT = 50000;

const growthTiltByRisk = {
  conservative: 30,
  moderate: 50,
  aggressive: 65,
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const asAmount = (value) => Math.max(Number(value) || 0, 0);

export const lifeEventOptions = Object.entries(LIFE_EVENT_CONFIG).map(([value, item]) => ({
  value,
  label: item.label,
}));

export const riskProfileOptions = [...RISK_PROFILE_OPTIONS];

export const goalPriorityOptions = [
  { value: 'high', label: 'High Priority' },
  { value: 'medium', label: 'Medium Priority' },
  { value: 'low', label: 'Low Priority' },
];

export const goalTypeOptions = [
  { value: 'retirement', label: 'Retirement' },
  { value: 'home', label: 'Home / Down Payment' },
  { value: 'education', label: 'Education' },
  { value: 'travel', label: 'Travel / Lifestyle' },
  { value: 'wealth', label: 'Wealth Building' },
];

export function calculateHraExemption(person = {}) {
  const baseSalary = asAmount(person.baseSalary);
  const hraReceived = asAmount(person.hraReceived);
  const rentPaid = asAmount(person.rentPaid);
  const metroCity = person.metroCity !== false;

  if (!baseSalary || !hraReceived || !rentPaid) {
    return 0;
  }

  const rentLessTenPct = Math.max(rentPaid - baseSalary * 0.1, 0);
  const salaryCap = baseSalary * (metroCity ? 0.5 : 0.4);

  return Math.max(0, Math.min(hraReceived, rentLessTenPct, salaryCap));
}

export function buildLifeEventPlan(profile = {}, inputs = {}) {
  const eventType = inputs.eventType || 'bonus';
  const config = LIFE_EVENT_CONFIG[eventType] || LIFE_EVENT_CONFIG.bonus;
  const annualIncome = asAmount(profile.annualIncome);
  const monthlyExpenses = asAmount(profile.monthlyExpenses);
  const eventAmount = asAmount(inputs.eventAmount);
  const currentReserve = asAmount(inputs.currentReserve);
  const highInterestDebt = asAmount(inputs.highInterestDebt);
  const monthlyCostChange = asAmount(inputs.monthlyCostChange);
  const monthsUntilEvent = clamp(Number(inputs.monthsUntilEvent) || 1, 1, 36);
  const riskProfile = profile.riskProfile || 'moderate';

  const adjustedMonthlyBurn = monthlyExpenses + monthlyCostChange;
  const reserveTarget = adjustedMonthlyBurn * config.reserveMonths;
  const reserveShortfall = Math.max(reserveTarget - currentReserve, 0);
  const taxReserve = Math.min(eventAmount * config.taxReservePct, eventAmount);
  const deployableAmount = Math.max(eventAmount - taxReserve, 0);
  const protectionNeed = Math.max(
    adjustedMonthlyBurn * (eventType === 'new_baby' ? 3 : 2),
    annualIncome * (eventType === 'job_switch' ? 0.04 : 0.02)
  );

  let reserveAllocation = Math.min(
    reserveShortfall,
    deployableAmount * Math.max(config.bucketWeights.reserve, reserveShortfall > 0 ? 0.3 : 0)
  );
  let debtAllocation = Math.min(highInterestDebt, deployableAmount * config.bucketWeights.debt);
  let protectionAllocation = Math.min(
    protectionNeed,
    deployableAmount * config.bucketWeights.protection
  );
  let growthAllocation = Math.max(
    deployableAmount - reserveAllocation - debtAllocation - protectionAllocation,
    0
  );

  const allocated = reserveAllocation + debtAllocation + protectionAllocation + growthAllocation;
  const leftover = Math.max(deployableAmount - allocated, 0);
  growthAllocation += leftover;

  const safetyTilt = clamp(
    monthsUntilEvent <= 3
      ? 85
      : monthsUntilEvent <= 12
        ? 65
        : 100 - growthTiltByRisk[riskProfile],
    25,
    85
  );
  const growthTilt = 100 - safetyTilt;

  const buckets = [
    {
      key: 'tax',
      label: 'Tax / paperwork reserve',
      amount: taxReserve,
      sharePct: eventAmount > 0 ? (taxReserve / eventAmount) * 100 : 0,
      tone: 'amber',
      detail:
        eventType === 'bonus'
          ? 'Keep tax aside before stepping up spending or SIPs.'
          : 'Ring-fence admin and transition costs before deploying the balance.',
    },
    {
      key: 'reserve',
      label: 'Emergency buffer',
      amount: reserveAllocation,
      sharePct: eventAmount > 0 ? (reserveAllocation / eventAmount) * 100 : 0,
      tone: 'blue',
      detail: `Top up household liquidity toward a ${config.reserveMonths}-month runway.`,
    },
    {
      key: 'debt',
      label: 'Debt reset',
      amount: debtAllocation,
      sharePct: eventAmount > 0 ? (debtAllocation / eventAmount) * 100 : 0,
      tone: 'rose',
      detail: 'Use this slice to attack high-interest debt before chasing returns.',
    },
    {
      key: 'protection',
      label: 'Protection upgrade',
      amount: protectionAllocation,
      sharePct: eventAmount > 0 ? (protectionAllocation / eventAmount) * 100 : 0,
      tone: 'emerald',
      detail: 'Reserve cash for insurance, health cover, or near-term family commitments.',
    },
    {
      key: 'growth',
      label: config.growthLabel,
      amount: growthAllocation,
      sharePct: eventAmount > 0 ? (growthAllocation / eventAmount) * 100 : 0,
      tone: 'purple',
      detail: `Deploy the long-term portion with roughly ${growthTilt}% growth assets and ${safetyTilt}% safety assets.`,
    },
  ].filter((bucket) => bucket.amount > 0 || bucket.key === 'growth');

  const firstMove = reserveShortfall > 0
    ? `Top up the emergency buffer by at least ₹${reserveAllocation.toLocaleString('en-IN')} before making long-term commitments.`
    : highInterestDebt > 0
      ? `Use ₹${debtAllocation.toLocaleString('en-IN')} to reduce expensive debt before increasing SIPs.`
      : `Stage about ₹${growthAllocation.toLocaleString('en-IN')} into long-term goals instead of deploying everything at once.`;

  const checklist = [
    {
      phase: 'Now',
      timing: 'This week',
      title: 'Protect cash-flow resilience first',
      detail: firstMove,
    },
    {
      phase: 'Before event',
      timing: `Within ${monthsUntilEvent} month${monthsUntilEvent === 1 ? '' : 's'}`,
      title: 'Set up the right holding pattern',
      detail: `Keep the deployable bucket tilted ${safetyTilt}% toward liquid/debt assets until the event window closes, then release the long-term allocation gradually.`,
    },
    {
      phase: 'After event',
      timing: 'Post-trigger review',
      title: 'Redirect excess cash to long-term goals',
      detail: `Once the event settles, review nominees, protection cover, and redirect the remaining ₹${growthAllocation.toLocaleString('en-IN')} toward ${config.growthLabel.toLowerCase()}.`,
    },
  ];

  const summary = `${config.label} scenario: keep ₹${taxReserve.toLocaleString('en-IN')} ring-fenced first, use the event to close a ₹${reserveShortfall.toLocaleString('en-IN')} reserve gap where possible, and deploy the remaining balance with a ${growthTilt}% growth tilt only after the near-term window clears.`;

  return {
    eventLabel: config.label,
    headline: config.headline,
    summary,
    eventAmount,
    taxReserve,
    deployableAmount,
    reserveTarget,
    reserveShortfall,
    adjustedMonthlyBurn,
    monthsUntilEvent,
    growthTilt,
    safetyTilt,
    buckets,
    firstMove,
    checklist,
    guardrails: config.guardrails,
  };
}

export function buildCoupleMoneyPlan(partnerA = {}, partnerB = {}, household = {}) {
  const incomeA = asAmount(partnerA.annualIncome);
  const incomeB = asAmount(partnerB.annualIncome);
  const investedA = asAmount(partnerA.existingInvestments);
  const investedB = asAmount(partnerB.existingInvestments);
  const monthlyExpenses = asAmount(household.monthlyExpenses);
  const liquidEmergencyFund = asAmount(household.liquidEmergencyFund);
  const currentFamilyFloater = asAmount(household.currentFamilyFloater);
  const dependents = clamp(Number(household.dependents) || 0, 0, 6);

  const totalIncome = incomeA + incomeB;
  const totalInvestments = investedA + investedB;
  const monthlyHouseholdIncome = totalIncome / 12;
  const monthlySurplus = Math.max(monthlyHouseholdIncome - monthlyExpenses, 0);
  const emergencyMonths = dependents > 0 ? 9 : 6;
  const emergencyTarget = monthlyExpenses * emergencyMonths;
  const emergencyGap = Math.max(emergencyTarget - liquidEmergencyFund, 0);
  const monthlyEmergencyTopUp = emergencyGap > 0 ? Math.min(monthlySurplus * 0.3, emergencyGap / 12) : 0;
  const recommendedGoalSip = Math.max(monthlySurplus - monthlyEmergencyTopUp, 0);

  const eightyCHeadroomA = Math.max(SECTION_80C_LIMIT - asAmount(partnerA.section80C), 0);
  const eightyCHeadroomB = Math.max(SECTION_80C_LIMIT - asAmount(partnerB.section80C), 0);
  const npsHeadroomA = Math.max(SECTION_80CCD_1B_LIMIT - asAmount(partnerA.npsContribution), 0);
  const npsHeadroomB = Math.max(SECTION_80CCD_1B_LIMIT - asAmount(partnerB.npsContribution), 0);
  const hraOpportunityA = calculateHraExemption(partnerA);
  const hraOpportunityB = calculateHraExemption(partnerB);

  const deductionOpportunityA = eightyCHeadroomA + npsHeadroomA + hraOpportunityA;
  const deductionOpportunityB = eightyCHeadroomB + npsHeadroomB + hraOpportunityB;
  const totalOpportunityScore = deductionOpportunityA + deductionOpportunityB || 1;

  const baseShareA = totalIncome > 0 ? incomeA / totalIncome : 0.5;
  const taxAdjustmentA = (deductionOpportunityA - deductionOpportunityB) / totalOpportunityScore * 0.08;
  const suggestedShareA = clamp(baseShareA + taxAdjustmentA, 0.25, 0.75);
  const suggestedShareB = 1 - suggestedShareA;

  const suggestedSipA = recommendedGoalSip * suggestedShareA;
  const suggestedSipB = recommendedGoalSip * suggestedShareB;

  const recommendedLifeCoverA = incomeA * 10;
  const recommendedLifeCoverB = incomeB * 10;
  const currentLifeCoverA = asAmount(partnerA.currentLifeCover);
  const currentLifeCoverB = asAmount(partnerB.currentLifeCover);
  const lifeGapA = Math.max(recommendedLifeCoverA - currentLifeCoverA, 0);
  const lifeGapB = Math.max(recommendedLifeCoverB - currentLifeCoverB, 0);
  const recommendedFamilyFloater = 1000000 + (dependents > 0 ? 500000 : 0) + (monthlyExpenses > 100000 ? 500000 : 0);
  const healthGap = Math.max(recommendedFamilyFloater - currentFamilyFloater, 0);
  const totalProtectionGap = lifeGapA + lifeGapB + healthGap;

  const leadTaxPartner = deductionOpportunityA >= deductionOpportunityB
    ? (partnerA.name || 'Partner A')
    : (partnerB.name || 'Partner B');

  const partnerCards = [
    {
      key: 'a',
      name: partnerA.name || 'Partner A',
      annualIncome: incomeA,
      invested: investedA,
      sharePct: suggestedShareA * 100,
      suggestedSip: suggestedSipA,
      eightyCHeadroom: eightyCHeadroomA,
      npsHeadroom: npsHeadroomA,
      hraOpportunity: hraOpportunityA,
      currentLifeCover: currentLifeCoverA,
      recommendedLifeCover: recommendedLifeCoverA,
      lifeGap: lifeGapA,
    },
    {
      key: 'b',
      name: partnerB.name || 'Partner B',
      annualIncome: incomeB,
      invested: investedB,
      sharePct: suggestedShareB * 100,
      suggestedSip: suggestedSipB,
      eightyCHeadroom: eightyCHeadroomB,
      npsHeadroom: npsHeadroomB,
      hraOpportunity: hraOpportunityB,
      currentLifeCover: currentLifeCoverB,
      recommendedLifeCover: recommendedLifeCoverB,
      lifeGap: lifeGapB,
    },
  ];

  const playbook = [
    {
      title: 'Joint safety first',
      detail: emergencyGap > 0
        ? `Build the missing ₹${emergencyGap.toLocaleString('en-IN')} emergency corpus in a joint liquid reserve before pushing every rupee into goal SIPs.`
        : 'Your liquid emergency reserve is already close to the household target, so new surplus can flow to long-term goals faster.',
    },
    {
      title: 'Use the better deduction owner first',
      detail: `${leadTaxPartner} currently has the larger tax-efficiency headroom, so route the next 80C/NPS top-up there before splitting evenly.`,
    },
    {
      title: 'Split shared SIPs by capacity, not emotion',
      detail: `Use an income-and-headroom weighted split of ${Math.round(suggestedShareA * 100)}% / ${Math.round(suggestedShareB * 100)}% for shared goal SIPs to keep the household plan fair and tax-aware.`,
    },
    {
      title: 'Keep life cover individual, health cover joint',
      detail: `Term cover should stay tied to each income stream, while the family floater can be managed as a shared policy with a target cover of ₹${recommendedFamilyFloater.toLocaleString('en-IN')}.`,
    },
  ];

  const ownershipModel = [
    `Keep the emergency fund and near-term goal corpus in a joint or clearly visible shared account structure.`,
    `Hold term insurance individually: ${partnerA.name || 'Partner A'} should target ₹${recommendedLifeCoverA.toLocaleString('en-IN')} and ${partnerB.name || 'Partner B'} should target ₹${recommendedLifeCoverB.toLocaleString('en-IN')}.`,
    `Use a family floater of about ₹${recommendedFamilyFloater.toLocaleString('en-IN')} for household medical events; keep employer cover as extra backup, not the core plan.`,
    `Review HRA, 80C, and NPS headroom yearly so tax-saving products sit with the partner who can use the deduction best.`,
  ];

  return {
    totalIncome,
    totalInvestments,
    monthlyHouseholdIncome,
    monthlySurplus,
    emergencyTarget,
    emergencyGap,
    recommendedGoalSip,
    monthlyEmergencyTopUp,
    totalProtectionGap,
    suggestedShareA,
    suggestedShareB,
    totalHraOpportunity: hraOpportunityA + hraOpportunityB,
    total80CHeadroom: eightyCHeadroomA + eightyCHeadroomB,
    totalNpsHeadroom: npsHeadroomA + npsHeadroomB,
    recommendedFamilyFloater,
    healthGap,
    partnerCards,
    playbook,
    ownershipModel,
  };
}

const GOAL_PRIORITY_WEIGHTS = {
  high: 1.4,
  medium: 1,
  low: 0.7,
};

const emergencyMonthsByRisk = {
  conservative: 9,
  moderate: 8,
  aggressive: 6,
};

const monthFormatter = new Intl.DateTimeFormat('en-IN', {
  month: 'short',
  year: 'numeric',
});

const getGoalAssetMix = (horizonMonths, riskProfile) => {
  if (horizonMonths <= 24) {
    return {
      equityPct: 10,
      debtPct: 85,
      goldPct: 5,
      label: 'Capital preservation tilt',
    };
  }

  if (horizonMonths <= 60) {
    const byRisk = {
      conservative: { equityPct: 30, debtPct: 60, goldPct: 10, label: 'Balanced accumulation' },
      moderate: { equityPct: 45, debtPct: 45, goldPct: 10, label: 'Balanced growth' },
      aggressive: { equityPct: 55, debtPct: 35, goldPct: 10, label: 'Growth with cushion' },
    };
    return byRisk[riskProfile] || byRisk.moderate;
  }

  const byRisk = {
    conservative: { equityPct: 50, debtPct: 40, goldPct: 10, label: 'Long-horizon balanced' },
    moderate: { equityPct: 65, debtPct: 25, goldPct: 10, label: 'Long-horizon growth' },
    aggressive: { equityPct: 75, debtPct: 15, goldPct: 10, label: 'High-growth long horizon' },
  };
  return byRisk[riskProfile] || byRisk.moderate;
};

export function buildPathPlannerRoadmap(profile = {}, goals = []) {
  const age = clamp(Number(profile.age) || 0, 18, 80);
  const annualIncome = asAmount(profile.annualIncome);
  const monthlyExpenses = asAmount(profile.monthlyExpenses);
  const existingInvestments = asAmount(profile.existingInvestments);
  const liquidEmergencyFund = asAmount(profile.liquidEmergencyFund);
  const riskProfile = profile.riskProfile || 'moderate';
  const section80C = asAmount(profile.section80C);
  const npsContribution = asAmount(profile.npsContribution);
  const monthlyIncome = annualIncome / 12;
  const monthlySurplus = Math.max(monthlyIncome - monthlyExpenses, 0);
  const emergencyTargetMonths = emergencyMonthsByRisk[riskProfile] || emergencyMonthsByRisk.moderate;
  const emergencyTarget = monthlyExpenses * emergencyTargetMonths;
  const emergencyGap = Math.max(emergencyTarget - liquidEmergencyFund, 0);
  const recommendedLifeCover = annualIncome * 10;
  const insuranceGap = Math.max(recommendedLifeCover - existingInvestments, 0);
  const eightyCHeadroom = Math.max(SECTION_80C_LIMIT - section80C, 0);
  const npsHeadroom = Math.max(SECTION_80CCD_1B_LIMIT - npsContribution, 0);
  const totalTaxHeadroom = eightyCHeadroom + npsHeadroom;

  const validGoals = goals
    .map((goal, index) => ({
      id: goal.id || `goal-${index + 1}`,
      title: goal.title || `Goal ${index + 1}`,
      goalType: goal.goalType || 'wealth',
      priority: goal.priority || 'medium',
      targetAmount: asAmount(goal.targetAmount),
      currentSavings: asAmount(goal.currentSavings),
      targetMonths: clamp(Number(goal.targetMonths) || 12, 6, 360),
    }))
    .filter((goal) => goal.targetAmount > 0);

  const maxHorizon = validGoals.length
    ? Math.max(...validGoals.map((goal) => goal.targetMonths))
    : 12;
  const roadmapMonths = clamp(maxHorizon, 12, 24);

  const weightedGoals = validGoals.map((goal) => {
    const gap = Math.max(goal.targetAmount - goal.currentSavings, 0);
    const progressPct = goal.targetAmount > 0
      ? clamp((goal.currentSavings / goal.targetAmount) * 100, 0, 100)
      : 0;
    const urgencyWeight = goal.targetMonths <= 24 ? 1.35 : goal.targetMonths <= 60 ? 1.1 : 0.9;
    const priorityWeight = GOAL_PRIORITY_WEIGHTS[goal.priority] || GOAL_PRIORITY_WEIGHTS.medium;
    const gapWeight = goal.targetAmount > 0 ? clamp(gap / goal.targetAmount, 0.35, 1.1) : 1;
    const weight = priorityWeight * urgencyWeight * gapWeight;
    const assetMix = getGoalAssetMix(goal.targetMonths, riskProfile);
    return {
      ...goal,
      gap,
      progressPct,
      weight,
      assetMix,
    };
  });

  const totalGoalWeight = weightedGoals.reduce((sum, goal) => sum + goal.weight, 0) || 1;
  const firstMonthEmergencyTopUp = emergencyGap > 0 ? Math.min(emergencyGap / 12, monthlySurplus * 0.25) : 0;
  const firstMonthTaxTopUp = totalTaxHeadroom > 0 ? Math.min(totalTaxHeadroom / 12, monthlySurplus * 0.15) : 0;
  const firstMonthGoalBudget = Math.max(monthlySurplus - firstMonthEmergencyTopUp - firstMonthTaxTopUp, 0);

  const goalCards = weightedGoals.map((goal) => {
    const monthlySip = firstMonthGoalBudget * (goal.weight / totalGoalWeight);
    const projectedCorpus = goal.currentSavings + monthlySip * goal.targetMonths;
    return {
      ...goal,
      monthlySip,
      projectedCorpus,
      projectedShortfall: Math.max(goal.targetAmount - projectedCorpus, 0),
    };
  });

  let remainingEmergencyGap = emergencyGap;
  let remainingTaxHeadroom = totalTaxHeadroom;

  const roadmap = Array.from({ length: roadmapMonths }, (_, index) => {
    const monthDate = new Date();
    monthDate.setDate(1);
    monthDate.setMonth(monthDate.getMonth() + index);

    const emergencyTopUp = remainingEmergencyGap > 0
      ? Math.min(remainingEmergencyGap, monthlySurplus * 0.25)
      : 0;
    remainingEmergencyGap = Math.max(remainingEmergencyGap - emergencyTopUp, 0);

    const taxTopUp = index < 12 && remainingTaxHeadroom > 0
      ? Math.min(remainingTaxHeadroom, monthlySurplus * 0.15)
      : 0;
    remainingTaxHeadroom = Math.max(remainingTaxHeadroom - taxTopUp, 0);

    const goalBudget = Math.max(monthlySurplus - emergencyTopUp - taxTopUp, 0);
    const goalAllocations = goalCards.map((goal) => ({
      id: goal.id,
      title: goal.title,
      amount: goalBudget * (goal.weight / totalGoalWeight),
      assetMix: goal.assetMix,
      targetMonthsRemaining: Math.max(goal.targetMonths - index, 1),
    }));
    const leadGoal = [...goalAllocations].sort((left, right) => right.amount - left.amount)[0] || null;

    let protectionAction = 'Protection already has room in the current plan.';
    if (index === 0 && insuranceGap > 0) {
      protectionAction = `Apply for term cover to close the ${Math.round(insuranceGap / 100000) / 10} Cr protection gap.`;
    } else if (index === 1 && insuranceGap > 0) {
      protectionAction = 'Review nominees, health cover, and emergency contacts after the policy top-up.';
    }

    const assetShift = leadGoal
      ? `${leadGoal.assetMix.label}: ${leadGoal.assetMix.equityPct}% equity / ${leadGoal.assetMix.debtPct}% debt / ${leadGoal.assetMix.goldPct}% gold`
      : 'No active goal mix yet.';

    return {
      monthLabel: monthFormatter.format(monthDate),
      emergencyTopUp,
      taxTopUp,
      totalGoalSip: goalBudget,
      leadGoal: leadGoal?.title || 'No active goal',
      leadGoalContribution: leadGoal?.amount || 0,
      assetShift,
      protectionAction,
      notes: remainingEmergencyGap > 0
        ? 'Keep building liquidity before stepping up long-horizon risk.'
        : remainingTaxHeadroom > 0
          ? 'Continue filling deduction headroom while goal SIPs are running.'
          : 'Most surplus can now flow directly into the highest-priority goals.',
      goalAllocations,
    };
  });

  const actionChecklist = [
    emergencyGap > 0
      ? `Build the missing emergency buffer of ₹${emergencyGap.toLocaleString('en-IN')} before increasing risky allocations.`
      : 'Emergency liquidity is already close to target, so surplus can flow faster into goals.',
    insuranceGap > 0
      ? `Secure about ₹${recommendedLifeCover.toLocaleString('en-IN')} of life cover; the current cushion still leaves a gap of ₹${insuranceGap.toLocaleString('en-IN')}.`
      : 'Current assets broadly cover the 10x income protection rule.',
    totalTaxHeadroom > 0
      ? `Use the remaining ₹${totalTaxHeadroom.toLocaleString('en-IN')} of 80C/NPS headroom through the year instead of leaving it to the last month.`
      : 'Most core 80C and NPS headroom is already used, so tax moves are less urgent right now.',
    goalCards.length
      ? `Lead with ${goalCards[0].title} only if you can still protect liquidity and cover first; the plan is intentionally not goal-only.`
      : 'Add at least one concrete life goal to generate a targeted monthly roadmap.',
  ];

  return {
    age,
    monthlyIncome,
    monthlySurplus,
    emergencyTargetMonths,
    emergencyTarget,
    emergencyGap,
    recommendedLifeCover,
    insuranceGap,
    totalTaxHeadroom,
    eightyCHeadroom,
    npsHeadroom,
    goalCards,
    roadmap,
    actionChecklist,
  };
}
