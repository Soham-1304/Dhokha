import { FLAGGED_TRANSACTIONS } from '../../api/mock/metrics';
import { useDashboardStore } from '../../store/dashboardStore';

const STATUS_CONFIG = {
  flagged: { cls: 'badge-amber', label: 'FLAGGED' },
  swarm: { cls: 'badge-red', label: 'SWARM' },
  review: { cls: 'badge-blue', label: 'REVIEW' },
  safe: { cls: 'badge-green', label: 'SAFE' },
};

const fmt = (n) => `₹${n.toLocaleString('en-IN')}`;

export default function LiveTicker() {
  const setSelectedNode = useDashboardStore(s => s.setSelectedNode);

  return (
    <div className="cc-panel-body" style={{ overflow: 'hidden' }}>
      {/* Header row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '100px 1fr 1fr 90px 60px 70px 70px',
        gap: 12, padding: '8px 18px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
      }}>
        {['TXN ID', 'FROM', 'TO', 'AMOUNT', 'RISK', 'TYPE', 'STATUS'].map(h => (
          <div key={h} style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 8, letterSpacing: '1px',
            color: 'var(--text-muted)', textTransform: 'uppercase',
          }}>
            {h}
          </div>
        ))}
      </div>
      <div className="ticker-inner">
        {FLAGGED_TRANSACTIONS.map((tx) => {
          const sc = STATUS_CONFIG[tx.status] || STATUS_CONFIG.safe;
          const riskColor = tx.risk > 0.8 ? 'var(--string)' : tx.risk > 0.5 ? 'var(--amber)' : 'var(--text-dim)';
          return (
            <div key={tx.id} className={`ticker-row ${tx.status}`} onClick={() => setSelectedNode(null)}>
              <div className="ticker-id">{tx.id}</div>
              <div className="ticker-from">{tx.from}</div>
              <div className="ticker-to">{tx.to}</div>
              <div className="ticker-amount">{tx.amount ? fmt(tx.amount) : '—'}</div>
              <div className="ticker-risk" style={{ color: riskColor }}>{(tx.risk * 100).toFixed(0)}%</div>
              <div className="ticker-type">{tx.type}</div>
              <div className="ticker-status">
                <span className={`status-badge ${sc.cls}`}>{sc.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
