import React from 'react';

const INSIGHTS = [
  { title: 'Highest Velocity Mule', label: 'ACC-104@axisbank', detail: '45 transactions in 2 minutes', risk: 'HIGH' },
  { title: 'Most Shared Device Hash', label: 'DEV-88x991', detail: 'Used across 8 distinct accounts', risk: 'HIGH' },
  { title: 'Fastest Growing Swarm', label: 'Layering Ring C-4', detail: '+12 nodes connected in 1 hour', risk: 'MEDIUM' }
];

export default function IntelligenceInsights() {
  return (
    <section className="d-section">
      <div className="d-section-header">
        <h2 className="d-section-title font-display">Automated Intelligence Cues</h2>
      </div>

      <div className="d-overview-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {INSIGHTS.map((item) => (
          <div key={item.title} className="d-metric-panel">
            <span className="d-metric-label font-mono">{item.title}</span>
            <span className="d-metric-value font-mono text-block" style={{ fontSize: '1.4rem' }}>{item.label}</span>
            <span className="d-metric-sub font-mono">{item.detail}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
