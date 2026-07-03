import { useDashboardStore } from '../../store/dashboardStore';

const fmt = (n) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
};

const METRICS = [
  { key: 'txns_per_sec', label: 'Txns / sec', color: 'green', suffix: '' },
  { key: 'active_swarms', label: 'Active Swarms', color: 'red', suffix: '' },
  { key: 'flagged_today', label: 'Flagged Today', color: 'amber', suffix: '' },
  { key: 'avg_latency_ms', label: 'Avg Latency', color: '', suffix: 'ms' },
  { key: 'value_protected_inr', label: 'Value Protected', color: 'green', format: fmt },
  { key: 'false_positive_rate', label: 'False Positive', color: '', suffix: '%' },
];

export default function MetricsStrip() {
  const metrics = useDashboardStore(s => s.metrics);

  return (
    <div className="db-metrics-strip">
      {METRICS.map((m) => {
        const raw = metrics[m.key];
        const display = m.format ? m.format(raw) : `${raw}${m.suffix}`;
        return (
          <div key={m.key} className="db-metric-card">
            <div className="db-metric-label">{m.label}</div>
            <div className={`db-metric-value ${m.color}`}>{display}</div>
          </div>
        );
      })}
    </div>
  );
}
