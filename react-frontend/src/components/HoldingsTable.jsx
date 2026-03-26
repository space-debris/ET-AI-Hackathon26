export default function HoldingsTable({ holdings }) {
  if (!holdings || holdings.length === 0) {
    return <p className="muted-text">No holdings found in this statement.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Fund</th>
            <th>Category</th>
            <th>Current Value</th>
            <th>Invested</th>
            <th>XIRR</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((holding) => (
            <tr key={holding.fund_name}>
              <td>{holding.fund_name}</td>
              <td>{holding.category}</td>
              <td>INR {Math.round(holding.current_value).toLocaleString()}</td>
              <td>INR {Math.round(holding.invested_amount).toLocaleString()}</td>
              <td>{holding.xirr ? `${(holding.xirr * 100).toFixed(2)}%` : 'NA'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
