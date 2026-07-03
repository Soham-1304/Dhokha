import { useDashboardStore } from '../../store/dashboardStore';
import { runSwarmDemo } from '../../api/mock/demoSimulator';
import { useRef } from 'react';
import { RotateCcw } from 'lucide-react';

const SWARM_TYPES = [
  { id: 'A', label: 'Identity Fan-Out', sub: '1 PAN → N banks' },
  { id: 'B', label: 'Mule Fan-In', sub: 'N victims → 1 collector' },
  { id: 'C', label: 'Layering Ring', sub: 'Multi-hop chain' },
  { id: 'D', label: 'Device Cluster', sub: '1 device → N accounts', lead: true },
];

export default function SwarmSelector() {
  const { activeSwarm, selectSwarm, resetDemo, setNodeState, pulseEdge, setConfirmedSwarm, tickMetrics, addToast, setDemoPhase } = useDashboardStore();
  const cleanupRef = useRef(null);

  const handleSelect = (type) => {
    if (cleanupRef.current) cleanupRef.current();
    selectSwarm(type);

    const cancel = runSwarmDemo(type, {
      onEdgePulse: (link) => pulseEdge(link),
      onNodeFlag: (nodeId, state) => setNodeState(nodeId, state),
      onSwarmConfirmed: (info) => setConfirmedSwarm(info),
      onMetricTick: (delta) => tickMetrics(delta),
      onToast: (toast) => addToast(toast),
      onPhaseChange: (phase) => setDemoPhase(phase),
    });

    cleanupRef.current = cancel;
  };

  const handleReset = () => {
    if (cleanupRef.current) cleanupRef.current();
    resetDemo();
  };

  return (
    <div className="cc-panel-body" style={{ padding: '14px 14px 12px', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {SWARM_TYPES.map((s) => (
        <button
          key={s.id}
          className={`swarm-btn ${activeSwarm === s.id ? 'active' : ''}`}
          onClick={() => handleSelect(s.id)}
        >
          <span className="swarm-btn-id">{s.id}</span>
          <div className="swarm-btn-info">
            <div className="swarm-btn-label">{s.label}</div>
            <div className="swarm-btn-sub">{s.sub}</div>
          </div>
          {s.lead && (
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 7,
              color: 'var(--string)', background: 'var(--string-dim)',
              padding: '2px 6px', borderRadius: 20, letterSpacing: '0.5px',
              flexShrink: 0,
            }}>
              DEMO
            </span>
          )}
        </button>
      ))}
      <button className="reset-btn" onClick={handleReset}>
        <RotateCcw size={11} />
        Reset
      </button>

      {/* Phase indicator */}
      <PhaseIndicator />
    </div>
  );
}

function PhaseIndicator() {
  const phase = useDashboardStore(s => s.demoPhase);
  const confirmedSwarm = useDashboardStore(s => s.confirmedSwarm);

  if (phase === 'idle') return null;

  const PHASE_CONFIG = {
    starting: { label: 'Firing transactions…', color: 'var(--brass)', bg: 'var(--brass-dim)' },
    stage1: { label: 'Stage 1 scoring…', color: 'var(--amber)', bg: 'var(--amber-dim)' },
    stage2: { label: 'Swarm confirmed', color: 'var(--string)', bg: 'var(--string-dim)' },
    done: { label: 'Demo complete', color: 'var(--safe)', bg: 'var(--safe-dim)' },
  };

  const cfg = PHASE_CONFIG[phase] || PHASE_CONFIG.starting;

  return (
    <div style={{
      marginTop: 12, padding: '10px 12px',
      background: cfg.bg, border: `1px solid ${cfg.color}44`,
      borderRadius: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: confirmedSwarm ? 6 : 0 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, flexShrink: 0, display: 'block' }} />
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: cfg.color, letterSpacing: '0.5px' }}>
          {cfg.label}
        </span>
      </div>
      {confirmedSwarm && (
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.4 }}>
          {confirmedSwarm.nodeCount} nodes · 3 banks
        </div>
      )}
    </div>
  );
}
