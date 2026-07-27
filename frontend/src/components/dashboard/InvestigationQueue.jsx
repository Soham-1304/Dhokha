import React from 'react';
import { useNavigate } from 'react-router-dom';

const CASES = [
  { id: 'CASE-891', swarm: 'Device Cluster', accounts: 6, banks: 4, loss: '₹12,40,000', conf: '96%', status: 'HIGH PRIORITY' },
  { id: 'CASE-884', swarm: 'Layering Ring', accounts: 4, banks: 2, loss: '₹4,50,000', conf: '88%', status: 'UNDER REVIEW' },
  { id: 'CASE-872', swarm: 'Mule Collector', accounts: 8, banks: 5, loss: '₹18,90,000', conf: '92%', status: 'ESCALATED' }
];

export default function InvestigationQueue() {
  const navigate = useNavigate();

  return (
    <section className="d-section">
      <div className="d-section-header">
        <h2 className="d-section-title font-display">Active Investigation Queue</h2>
        <span className="d-section-count font-mono">{CASES.length} Active Cases</span>
      </div>

      <div className="d-feed-stack">
        {CASES.map((c) => (
          <div key={c.id} className="d-feed-card blocked">
            <div className="d-feed-card-main">
              <div className="d-feed-left">
                <span className="d-risk-pill blocked font-mono">{c.status}</span>
                <div className="d-feed-users font-mono">
                  <strong>{c.id}</strong> • {c.swarm} ({c.accounts} Accounts across {c.banks} Banks)
                </div>
              </div>
              <div className="d-feed-right">
                <div className="d-feed-amount font-mono text-block">{c.loss}</div>
                <button
                  className="d-btn font-mono"
                  onClick={() => navigate('/dashboard/graph')}
                >
                  Investigate →
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
