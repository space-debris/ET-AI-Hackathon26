export default function GlassCard({ title, children, className = '' }) {
  return (
    <section className={`glass-card ${className}`.trim()}>
      <div className="card-body">
        {title ? <h2 className="card-title">{title}</h2> : null}
        {children}
      </div>
    </section>
  );
}
