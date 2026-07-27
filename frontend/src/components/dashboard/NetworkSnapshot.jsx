import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NetworkSnapshot() {
  const navigate = useNavigate();

  return (
    <section className="d-section">
      <div className="d-section-header">
        <h2 className="d-section-title font-display">Active Graph Topology Snapshot</h2>
      </div>

      <div className="d-network-card">
        <div className="d-network-content">
          <span className="d-network-badge font-mono">LIVE CLUSTER PREVIEW</span>
          <h3 className="font-display">Device Cluster #DEV-99x</h3>
          <p className="d-network-desc font-mono">
            6 accounts connected via single hardware hash across 4 payment aggregators within 3 minutes.
          </p>
          <button className="d-btn font-mono" onClick={() => navigate('/dashboard/graph')}>
            Launch Graph Explorer →
          </button>
        </div>
      </div>
    </section>
  );
}
