import { useEffect, useRef, useState } from 'react';
import useDashboardStore from '../../store/dashboardStore';

function AnimatedCounter({ value, prefix = '', suffix = '', decimals = 0 }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    prevRef.current = to;
    if (from === to) return;

    const duration = 600;
    const steps = 30;
    const stepDuration = duration / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const current = from + (to - from) * progress;
      setDisplay(decimals > 0 ? current.toFixed(decimals) : Math.round(current));
      if (step >= steps) clearInterval(timer);
    }, stepDuration);

    return () => clearInterval(timer);
  }, [value, decimals]);

  const formatted = typeof display === 'number'
    ? display.toLocaleString('en-IN')
    : display;

  return <>{prefix}{formatted}{suffix}</>;
}

export default function MetricsStrip() {
  const metrics = useDashboardStore(s => s.metrics);

  return (
    <div className="db-metrics-strip">
      <div className="db-metric">
        <div className="db-metric-num">
          <AnimatedCounter value={metrics.txns_per_sec} suffix="/s" />
        </div>
        <div className="db-metric-lab">Transactions/sec</div>
      </div>
      <div className="db-metric db-metric-alert">
        <div className="db-metric-num">
          <AnimatedCounter value={metrics.active_swarms} />
        </div>
        <div className="db-metric-lab">Active Swarms</div>
      </div>
      <div className="db-metric">
        <div className="db-metric-num">
          ₹<AnimatedCounter value={Math.round(metrics.value_protected_inr / 100000)} suffix="L" />
        </div>
        <div className="db-metric-lab">Value Protected</div>
      </div>
      <div className="db-metric">
        <div className="db-metric-num">
          <AnimatedCounter value={metrics.avg_latency_ms} suffix="ms" />
        </div>
        <div className="db-metric-lab">Avg Score Latency</div>
      </div>
    </div>
  );
}
