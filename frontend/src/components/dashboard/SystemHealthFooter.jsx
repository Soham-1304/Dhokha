import React from 'react';

export default function SystemHealthFooter() {
  return (
    <footer className="d-health-footer font-mono">
      <div className="d-health-item">
        <span className="d-health-dot text-safe font-bold">●</span>
        <span>SQLite Persistence</span>
      </div>
      <div className="d-health-item">
        <span className="d-health-dot text-safe font-bold">●</span>
        <span>NetworkX Graph Engine</span>
      </div>
      <div className="d-health-item">
        <span className="d-health-dot text-safe font-bold">●</span>
        <span>ONNX Model Runtime</span>
      </div>
      <div className="d-health-item">
        <span className="d-health-dot text-safe font-bold">●</span>
        <span>WebSocket Stream</span>
      </div>
    </footer>
  );
}
