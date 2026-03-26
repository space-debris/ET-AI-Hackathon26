export default function MetricsGrid({ analytics, transactionCount }) {
  const overallXirr = (analytics?.overall_xirr || 0) * 100;
  const totalValue = analytics?.total_current_value || 0;
  const totalInvested = analytics?.total_invested || 0;

  const cards = [
    { label: 'Transactions', value: transactionCount ?? 0 },
    { label: 'Portfolio Value', value: `INR ${Math.round(totalValue).toLocaleString()}` },
    { label: 'Capital Invested', value: `INR ${Math.round(totalInvested).toLocaleString()}` },
    { label: 'Overall XIRR', value: `${overallXirr.toFixed(2)}%` },
  ];

  return (
    <div className="metrics-grid">
      {cards.map((item) => (
        <article key={item.label} className="metric-card">
          <p className="metric-label">{item.label}</p>
          <p className="metric-value">{item.value}</p>
        </article>
      ))}
    </div>
  );
}
