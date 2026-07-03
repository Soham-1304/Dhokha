import useDashboardStore from '../../store/dashboardStore';
import { swarms } from '../../api/mock/swarms';
import { runDemo, resetDemo } from '../../api/mock/demoSimulator';

const typeColors = { A: '#e5484d', B: '#c9a227', C: '#3fb67f', D: '#7c6af0' };

export default function SwarmSelector() {
  const store = useDashboardStore();
  const { activeSwarm, demoPhase } = store;

  const handleSelect = (swarmId) => {
    if (demoPhase === 'running') return;
    runDemo(swarmId, store);
  };

  const handleReset = () => {
    resetDemo(store);
  };

  return (
    <div className="db-panel db-swarm-selector">
      <div className="db-panel-header">
        <span className="db-eyebrow">Swarm Type</span>
      </div>

      <div className="db-swarm-btns">
        {swarms.map(swarm => (
          <button
            key={swarm.id}
            onClick={() => handleSelect(swarm.id)}
            className={`db-swarm-btn ${activeSwarm === swarm.id ? 'active' : ''} ${demoPhase === 'running' ? 'disabled' : ''}`}
            style={{ '--swarm-color': typeColors[swarm.id] }}
            title={swarm.description}
          >
            <span className="db-swarm-btn-label">Type {swarm.id}</span>
            <span className="db-swarm-btn-name">{swarm.label}</span>
            {swarm.isLeadDemo && <span className="db-badge-demo">DEMO</span>}
          </button>
        ))}
      </div>

      <div className="db-swarm-desc">
        {activeSwarm
          ? swarms.find(s => s.id === activeSwarm)?.description
          : 'Select a swarm type to begin the investigation.'}
      </div>

      <button
        className="db-reset-btn"
        onClick={handleReset}
        disabled={demoPhase === 'idle'}
      >
        ↺ Reset Investigation
      </button>

      <div className="db-phase-badge" data-phase={demoPhase}>
        {demoPhase === 'idle' && '● Standby'}
        {demoPhase === 'running' && '◉ Running...'}
        {demoPhase === 'complete' && '✓ Swarm Confirmed'}
      </div>
    </div>
  );
}
