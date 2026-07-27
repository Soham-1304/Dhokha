import React from 'react';

export default function ThreatOverview({
  totalTxns = 0,
  blockedCount = 0,
  reviewCount = 0,
  allowedCount = 0,
  activeSwarms = 0,
  avgLatencyMs = 14
}) {
  return (
    <section className="d-section">
      <div className="d-section-header">
        <h2 className="d-section-title font-display">Executive Threat Overview</h2>
      </div>

      <div className="d-overview-grid">
        <div className="d-metric-panel">
          <span className="d-metric-label font-mono">ACTIVE SWARMS</span>
          <span className={`d-metric-value font-display ${activeSwarms > 0 ? 'text-block' : 'text-safe'}`}>
            {activeSwarms}
          </span>
          <span className="d-metric-sub">Detected by NetworkX</span>
        </div>

        <div className="d-metric-panel">
          <span className="d-metric-label font-mono">AVG LATENCY</span>
          <span className="d-metric-value font-display font-mono">{avgLatencyMs}ms</span>
          <span className="d-metric-sub">ONNX Model Inference</span>
        </div>

        <div className="d-metric-panel">
          <span className="d-metric-label font-mono">BLOCKED PAYMENTS</span>
          <span className="d-metric-value font-display text-block font-mono">{blockedCount}</span>
          <span className="d-metric-sub">Fraud Score ≥ 70%</span>
        </div>

        <div className="d-metric-panel">
          <span className="d-metric-label font-mono">UNDER REVIEW</span>
          <span className="d-metric-value font-display text-review font-mono">{reviewCount}</span>
          <span className="d-metric-sub">Score 35% – 69%</span>
        </div>
      </div>
    </section>
  );
}
