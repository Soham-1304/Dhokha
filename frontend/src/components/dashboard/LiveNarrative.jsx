import React from 'react';

export default function LiveNarrative({ logs = [] }) {
  return (
    <section className="d-narrative-container">
      <div className="d-narrative-badge font-mono">LIVE INTELLIGENCE FEED</div>
      <div className="d-narrative-list font-mono">
        {logs.length > 0 ? (
          logs.slice(0, 5).map((log, idx) => (
            <div key={idx} className="d-narrative-item">
              <span className="d-narrative-time">{log.time || '--:--:--'}</span>
              <span className="d-narrative-text">{log.text}</span>
            </div>
          ))
        ) : (
          <div className="d-narrative-item text-secondary">
            <span>--:--:--</span>
            <span>System active. Listening to incoming telemetry stream...</span>
          </div>
        )}
      </div>
    </section>
  );
}
