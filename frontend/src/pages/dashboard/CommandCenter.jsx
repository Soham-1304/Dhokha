import MetricsStrip from '../../components/dashboard/MetricsStrip';
import SwarmSelector from '../../components/dashboard/SwarmSelector';
import ForceGraph from '../../components/dashboard/ForceGraph';
import ExplainPanel from '../../components/dashboard/ExplainPanel';
import LiveTicker from '../../components/dashboard/LiveTicker';
import SwarmToastContainer from '../../components/dashboard/SwarmToast';

export default function CommandCenter() {
  return (
    <>
      {/* Metrics */}
      <MetricsStrip />

      {/* Main grid */}
      <div className="cc-grid">
        {/* Swarm Selector — col 1, row 1 */}
        <div className="cc-panel" style={{ gridColumn: 1, gridRow: 1 }}>
          <div className="cc-panel-header">
            <span className="cc-panel-title">Pick a Swarm</span>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 8,
              color: 'var(--text-muted)', letterSpacing: '0.5px',
            }}>
              4 TYPES
            </span>
          </div>
          <SwarmSelector />
        </div>

        {/* Graph — col 2, rows 1–2 */}
        <div className="cc-panel cc-graph">
          <div className="cc-panel-header">
            <span className="cc-panel-title">Live Fraud Graph</span>
            <GraphLegend />
          </div>
          <div className="cc-panel-body">
            <ForceGraph />
          </div>
        </div>

        {/* Explain Panel — col 3, row 1 */}
        <div className="cc-panel" style={{ gridColumn: 3, gridRow: 1 }}>
          <div className="cc-panel-header">
            <span className="cc-panel-title">Explainability</span>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 8,
              color: 'var(--text-muted)', letterSpacing: '0.5px',
            }}>
              SHAP
            </span>
          </div>
          <ExplainPanel />
        </div>

        {/* Live Ticker — col 1-3, row 2 */}
        <div className="cc-panel cc-ticker">
          <div className="cc-panel-header">
            <span className="cc-panel-title">Live Transaction Feed</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--string)', boxShadow: '0 0 6px var(--string)', display: 'block', animation: 'pulse-dot 1.8s ease infinite' }} />
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                8 EVENTS
              </span>
            </span>
          </div>
          <LiveTicker />
        </div>
      </div>

      {/* Toast notifications */}
      <SwarmToastContainer />
    </>
  );
}

function GraphLegend() {
  const LEGEND = [
    { color: 'var(--bank-a)', label: 'Bank A' },
    { color: 'var(--bank-b)', label: 'Bank B' },
    { color: 'var(--bank-c)', label: 'Bank C' },
    { color: 'var(--bank-d)', label: 'Bank D' },
    { color: 'var(--bank-device)', label: 'Device' },
    { color: 'var(--bank-identity)', label: 'Identity' },
  ];

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {LEGEND.map(l => (
        <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: l.color, display: 'block' }} />
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.3px' }}>
            {l.label}
          </span>
        </div>
      ))}
    </div>
  );
}
