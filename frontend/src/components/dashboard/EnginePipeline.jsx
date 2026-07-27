import React from 'react';

const STAGES = ['Validation', 'Feature Eng', 'ONNX Runtime', 'NetworkX Engine', 'Rule Evaluation', 'Decision'];

export default function EnginePipeline({ isActive = false }) {
  return (
    <section className="d-section">
      <div className="d-section-header">
        <h2 className="d-section-title font-display">Intelligence Engine Pipeline</h2>
        <span className="d-section-count font-mono">{isActive ? '⚡ PROCESSING SCORING TELEMETRY' : 'READY'}</span>
      </div>

      <div className="d-pipeline-container">
        {STAGES.map((s, idx) => (
          <React.Fragment key={s}>
            <div className={`d-pipeline-stage ${isActive ? 'active' : ''}`}>
              <div className="d-pipeline-icon font-mono">{idx + 1}</div>
              <span className="font-mono">{s}</span>
            </div>
            {idx < STAGES.length - 1 && <div className="d-pipeline-arrow" />}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}
