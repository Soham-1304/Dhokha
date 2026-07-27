import React from 'react';

const BANKS = [
  { name: 'HDFC Bank', txns: '42.1k', fraudRate: '12.4%', topSwarm: 'Device Cluster', risk: 'HIGH' },
  { name: 'State Bank of India', txns: '89.4k', fraudRate: '7.8%', topSwarm: 'Fan-Out', risk: 'MEDIUM' },
  { name: 'Axis Bank', txns: '120.5k', fraudRate: '2.1%', topSwarm: 'Mule', risk: 'LOW' }
];

export default function BankIntelligence() {
  return (
    <section className="d-section">
      <div className="d-section-header">
        <h2 className="d-section-title font-display">Bank Network Exposure</h2>
      </div>

      <div className="d-overview-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
        {BANKS.map((b) => (
          <div key={b.name} className="d-metric-panel" style={{ borderTop: `3px solid ${b.risk === 'HIGH' ? 'var(--color-block)' : b.risk === 'MEDIUM' ? 'var(--color-review)' : 'var(--color-safe)'}`, padding: '1rem' }}>
            <span className="d-metric-label font-mono">{b.name}</span>
            <span className="d-metric-value font-display font-mono" style={{ fontSize: '1.4rem' }}>{b.fraudRate}</span>
            <div className="d-metric-sub font-mono" style={{ fontSize: '0.7rem' }}>
              <div>Vol: {b.txns}</div>
              <div>{b.topSwarm}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
