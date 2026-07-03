import { useDashboardStore } from '../../store/dashboardStore';
import { SHAP_DATA } from '../../api/mock/metrics';
import { MousePointer2 } from 'lucide-react';

const BANK_LABEL = {
  'Bank A': { color: 'var(--bank-a)', label: 'Bank A' },
  'Bank B': { color: 'var(--bank-b)', label: 'Bank B' },
  'Bank C': { color: 'var(--bank-c)', label: 'Bank C' },
  'Bank D': { color: 'var(--bank-d)', label: 'Bank D' },
  'Device': { color: 'var(--bank-device)', label: 'Device' },
  'Identity': { color: 'var(--bank-identity)', label: 'Identity' },
};

export default function ExplainPanel() {
  const selectedNode = useDashboardStore(s => s.selectedNode);
  const nodeStates = useDashboardStore(s => s.nodeStates);

  if (!selectedNode) {
    return (
      <div className="explain-empty">
        <div className="explain-empty-icon">
          <MousePointer2 size={18} strokeWidth={1.5} color="var(--text-muted)" />
        </div>
        <div className="explain-empty-text">
          Click any node in the graph to view explainability
        </div>
      </div>
    );
  }

  const state = nodeStates[selectedNode.id] || 'safe';
  const shap = SHAP_DATA[selectedNode.id] || SHAP_DATA.default;
  const bank = BANK_LABEL[selectedNode.bank] || { color: 'var(--text-dim)', label: selectedNode.bank };

  const riskPct = Math.round(selectedNode.risk * 100);
  const stage1 = Math.round(selectedNode.risk * 60);
  const stage2 = Math.round(selectedNode.risk * 40);

  const stateBadge = {
    safe: { cls: 'badge-green', label: 'SAFE' },
    flagged: { cls: 'badge-amber', label: 'FLAGGED' },
    swarm: { cls: 'badge-red', label: 'SWARM' },
  }[state] || { cls: 'badge-green', label: 'SAFE' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Node header */}
      <div className="explain-node-header">
        <div className="explain-node-id">{selectedNode.label}</div>
        <div className="explain-node-meta">
          {selectedNode.city || selectedNode.fingerprint || selectedNode.pan || '—'}
        </div>
        <div className="explain-badges">
          <span className="badge" style={{ color: bank.color, borderColor: `${bank.color}44`, background: `${bank.color}15` }}>
            {bank.label}
          </span>
          <span className={`badge ${stateBadge.cls}`}>{stateBadge.label}</span>
          {selectedNode.type === 'device' && <span className="badge badge-red">DEVICE NODE</span>}
          {selectedNode.type === 'mule' && <span className="badge badge-red">MULE</span>}
        </div>
      </div>

      {/* Confidence */}
      <div className="explain-confidence">
        <div className="conf-row">
          <div className="conf-label">Risk Score</div>
          <div className="conf-value" style={{ color: riskPct > 70 ? 'var(--string)' : riskPct > 40 ? 'var(--amber)' : 'var(--safe)' }}>
            {riskPct}%
          </div>
        </div>
        <div className="conf-bar-track">
          <div
            className="conf-bar-fill"
            style={{
              width: `${riskPct}%`,
              background: riskPct > 70 ? 'var(--string)' : riskPct > 40 ? 'var(--amber)' : 'var(--safe)',
            }}
          />
        </div>
        <div className="conf-breakdown">
          <div className="conf-part">
            <div className="conf-part-label">Stage 1</div>
            <div className="conf-part-val" style={{ color: 'var(--brass)' }}>{stage1}%</div>
          </div>
          <div className="conf-part">
            <div className="conf-part-label">Stage 2</div>
            <div className="conf-part-val" style={{ color: 'var(--string)' }}>{stage2}%</div>
          </div>
        </div>
      </div>

      {/* SHAP bars */}
      <div className="explain-shap">
        <div className="shap-title">Feature Contributions (SHAP)</div>
        {shap.map((feat, i) => {
          const absPct = Math.abs(feat.value) / 0.5 * 100;
          return (
            <div key={i} className="shap-row">
              <div className="shap-feature-row">
                <div className="shap-feature-name">{feat.feature}</div>
                <div className="shap-feature-val" style={{ color: feat.positive ? 'var(--string)' : 'var(--safe)' }}>
                  {feat.positive ? '+' : ''}{feat.value.toFixed(2)}
                </div>
              </div>
              <div className="shap-bar-track">
                <div
                  className="shap-bar-fill"
                  style={{
                    width: `${Math.min(absPct, 100)}%`,
                    background: feat.positive ? 'var(--string)' : 'var(--safe)',
                  }}
                />
              </div>
            </div>
          );
        })}

        {selectedNode.balance && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div className="shap-title">Account Details</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {[
                { label: 'Balance', value: `₹${selectedNode.balance?.toLocaleString('en-IN')}` },
                { label: 'Bank', value: selectedNode.bank },
                { label: 'Type', value: selectedNode.type?.toUpperCase() },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {row.label}
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--text-dim)' }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
