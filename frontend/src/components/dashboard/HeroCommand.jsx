import React from 'react';

export default function HeroCommand({ threatStatus = 'SAFE', activeSwarmCount = 0 }) {
  const isThreat = threatStatus !== 'SAFE' || activeSwarmCount > 0;

  return (
    <section className="d-hero-compact">
      <div className="d-hero-header-left">
        <h1 className="d-hero-title font-display">Fraud Operations Command Center</h1>
        <p className="d-hero-subtitle font-mono">Real-Time Telemetry & Swarm Intelligence</p>
      </div>

      <div className="d-hero-header-right">
        <div className="d-live-badge">
          <div className="d-live-dot" />
          <span>LIVE MONITORING</span>
        </div>

        <div className={`d-threat-banner-compact ${isThreat ? 'threat-active' : 'threat-safe'}`}>
          <span className="d-threat-label font-mono">THREAT STATE:</span>
          <span className="d-threat-value font-mono">
            {isThreat ? (threatStatus !== 'SAFE' ? threatStatus : 'ELEVATED') : 'SAFE'}
          </span>
        </div>
      </div>
    </section>
  );
}
