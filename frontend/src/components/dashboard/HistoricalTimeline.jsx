import React from 'react';

export default function HistoricalTimeline() {
  return (
    <section className="d-section">
      <div className="d-section-header">
        <h2 className="d-section-title font-display">24-Hour Threat Density Timeline</h2>
      </div>

      <div className="d-timeline-card">
        <div className="d-timeline-bars">
          {Array.from({ length: 48 }).map((_, idx) => {
            const heightPct = Math.floor(20 + Math.random() * 80);
            const isSpike = heightPct > 75;
            return (
              <div
                key={idx}
                className={`d-timeline-bar ${isSpike ? 'spike' : ''}`}
                style={{ height: `${heightPct}%` }}
                title={`Hour ${Math.floor(idx / 2)}:00 — ${isSpike ? 'Swarm Detected' : 'Normal Volume'}`}
              />
            );
          })}
        </div>
        <div className="d-timeline-axis font-mono">
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>24:00</span>
        </div>
      </div>
    </section>
  );
}
