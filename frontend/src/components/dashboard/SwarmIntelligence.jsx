import React from 'react';
import { useNavigate } from 'react-router-dom';

const SWARMS = [
  { id: 'A', name: 'Identity Fan-Out', desc: 'Single identity creating multiple accounts across providers.' },
  { id: 'B', name: 'Mule Collector', desc: 'High-frequency fan-in of funds into central aggregator mule.' },
  { id: 'C', name: 'Layering Ring', desc: 'Circular rapid fund movement to obscure source origins.' },
  { id: 'D', name: 'Device Cluster', desc: 'Shared hardware fingerprints across multiple distinct accounts.' }
];

export default function SwarmIntelligence() {
  const navigate = useNavigate();

  return (
    <section className="d-section">
      <div className="d-section-header">
        <h2 className="d-section-title font-display">Swarm Typology Intelligence</h2>
      </div>

      <div className="d-swarm-grid">
        {SWARMS.map((s) => (
          <div key={s.id} className="d-swarm-card">
            <div className="d-swarm-head">
              <span className="d-swarm-tag font-mono">TYPE {s.id}</span>
              <span className="d-swarm-title font-display">{s.name}</span>
            </div>
            <p className="d-swarm-desc">{s.desc}</p>
            <div className="d-swarm-meta font-mono">
              <span>Status: <strong className="text-safe">MONITORED</strong></span>
            </div>
            <button
              className="d-btn font-mono"
              onClick={() => navigate('/dashboard/graph')}
            >
              Explore Topology →
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
