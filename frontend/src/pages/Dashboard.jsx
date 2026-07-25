import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { connectEventStream, getTransactions, injectSwarm } from '../api/client';
import { ShieldAlert, AlertTriangle, Flame, Activity, Radio, X, Network, ShieldX, Zap, CheckCircle2 } from 'lucide-react';
import './Dashboard.css';

const formatAmount = (n) => n == null ? '—' : '₹' + Number(n).toLocaleString('en-IN');

const formatTime = (ts) => {
  if (!ts) return '--:--:--';
  let str = String(ts).trim();
  if (str.includes(' ') && !str.includes('T')) {
    str = str.replace(' ', 'T') + 'Z';
  } else if (!str.endsWith('Z') && !str.includes('+') && !str.includes('z')) {
    str = str + 'Z';
  }
  const date = new Date(str);
  if (isNaN(date.getTime())) return '--:--:--';
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
  });
};

const SWARM_TITLES = {
  A: 'Type A — Identity Fan-Out',
  B: 'Type B — Mule Collector Fan-In',
  C: 'Type C — Layering Chain',
  D: 'Type D — Shared Device Cluster',
};

// Recharts Donut Pie Component — Polished & High-Contrast
function RechartsDonut({ highCount, medCount, lowCount, total }) {
  const [activeIndex, setActiveIndex] = useState(null);

  const safeTotal = total || 1;
  const highPct = Math.round((highCount / safeTotal) * 100);
  const medPct  = Math.round((medCount  / safeTotal) * 100);
  const lowPct  = Math.max(0, 100 - highPct - medPct);

  const chartData = useMemo(() => [
    { name: 'Fraud',    value: highCount, color: '#e5484d', pct: highPct },
    { name: 'Moderate', value: medCount,  color: '#f5a623', pct: medPct },
    { name: 'Good',     value: lowCount,  color: '#3fb67f', pct: lowPct },
  ].filter(d => d.value > 0), [highCount, medCount, lowCount, highPct, medPct, lowPct]);

  const activeItem = activeIndex !== null && chartData[activeIndex] ? chartData[activeIndex] : null;

  return (
    <div className="d-donut-card-layout">
      <div className="d-recharts-wrap">
        <ResponsiveContainer width="100%" height={210}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={64}
              outerRadius={90}
              paddingAngle={4}
              dataKey="value"
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              stroke="none"
              animationDuration={500}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  opacity={activeIndex === null || activeIndex === index ? 1 : 0.4}
                  style={{
                    outline: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center Readout inside Donut Hole */}
        <div className="d-recharts-center">
          <div className="d-recharts-val" style={{ color: activeItem ? activeItem.color : 'var(--text, #eeeae1)' }}>
            {activeItem ? activeItem.value : total}
          </div>
          <div className="d-recharts-lbl" style={{ color: activeItem ? activeItem.color : 'var(--text-dim, #7a756c)' }}>
            {activeItem ? activeItem.name.toUpperCase() : 'TOTAL MONITORED'}
          </div>
          <div className="d-recharts-sub">
            {activeItem ? `${activeItem.pct}% of total` : 'Transactions'}
          </div>
        </div>
      </div>

      {/* Sleek Horizontal Legend Strip */}
      <div className="d-legend-strip">
        <div
          className={`d-legend-pill ${activeIndex === 0 ? 'active' : ''}`}
          onMouseEnter={() => setActiveIndex(0)}
          onMouseLeave={() => setActiveIndex(null)}
        >
          <span className="d-pill-dot" style={{ background: '#e5484d' }} />
          <span className="d-pill-label">Fraud</span>
          <span className="d-pill-val" style={{ color: '#e5484d' }}>{highCount} ({highPct}%)</span>
        </div>

        <div
          className={`d-legend-pill ${activeIndex === 1 ? 'active' : ''}`}
          onMouseEnter={() => setActiveIndex(1)}
          onMouseLeave={() => setActiveIndex(null)}
        >
          <span className="d-pill-dot" style={{ background: '#f5a623' }} />
          <span className="d-pill-label">Moderate</span>
          <span className="d-pill-val" style={{ color: '#f5a623' }}>{medCount} ({medPct}%)</span>
        </div>

        <div
          className={`d-legend-pill ${activeIndex === 2 ? 'active' : ''}`}
          onMouseEnter={() => setActiveIndex(2)}
          onMouseLeave={() => setActiveIndex(null)}
        >
          <span className="d-pill-dot" style={{ background: '#3fb67f' }} />
          <span className="d-pill-label">Good</span>
          <span className="d-pill-val" style={{ color: '#3fb67f' }}>{lowCount} ({lowPct}%)</span>
        </div>
      </div>
    </div>
  );
}

// Rich Transaction Intelligence Dossier Modal
function TransactionDetailModal({ txn, onClose, getScore }) {
  const navigate = useNavigate();
  if (!txn) return null;

  const score = getScore(txn);
  const isHigh = score >= 70 || txn.decision === 'block';
  const isMed  = score >= 35 && score < 70 || txn.decision === 'review';

  const sender = txn.sender_account_id || txn.sender_upi || 'ACC-005';
  const receiver = txn.receiver_account_id || txn.receiver_upi || 'ACC-000';
  const senderBank = txn.sender_bank_id || txn.bank_sender || 'HDFC Bank';
  const receiverBank = txn.receiver_bank_id || txn.bank_receiver || 'Paytm Payments';
  const decision = txn.decision ? txn.decision.toUpperCase() : (isHigh ? 'BLOCK' : isMed ? 'REVIEW' : 'ALLOW');
  
  const swarmTypes = txn.suspected_swarm_types || txn.triggered_rules || [];
  const inSwarmRing = swarmTypes.length > 0 || isHigh;
  const swarmName = swarmTypes.length > 0 ? (SWARM_TITLES[swarmTypes[0]] || `Type ${swarmTypes[0]} Swarm`) : (isHigh ? 'Layering Mule Ring' : null);

  return (
    <div className="d-modal-overlay" onClick={onClose}>
      <div className="d-modal-card animate-in" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="d-modal-header">
          <div className="d-modal-title">
            <ShieldAlert size={18} className="d-modal-icon" />
            <span>TRANSACTION DOSSIER • {txn.id || 'TXN-LIVE-882'}</span>
          </div>
          <button className="d-modal-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Hero Score Banner */}
        <div className={`d-modal-hero ${isHigh ? 'hero-red' : isMed ? 'hero-yellow' : 'hero-green'}`}>
          <div className="d-modal-hero-left">
            <div className="d-modal-score-num">{score}</div>
            <div className="d-modal-score-meta">
              <span className="d-modal-score-lbl">RISK PROBABILITY SCORE</span>
              <span className="d-modal-score-sub">{score}% Fraud Confidence Metric</span>
            </div>
          </div>
          <div className={`d-modal-decision-badge ${decision.toLowerCase()}`}>
            {decision}
          </div>
        </div>

        {/* Swarm Ring Status Banner */}
        <div style={{
          padding: '10px 16px',
          margin: '0 20px 16px',
          borderRadius: 8,
          background: inSwarmRing ? 'rgba(229, 72, 77, 0.12)' : 'rgba(63, 182, 127, 0.12)',
          border: `1px solid ${inSwarmRing ? 'rgba(229, 72, 77, 0.3)' : 'rgba(63, 182, 127, 0.3)'}`,
          display: 'flex',
          alignItems: 'center',
          justify: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {inSwarmRing ? <AlertTriangle size={16} style={{ color: '#e5484d' }} /> : <CheckCircle2 size={16} style={{ color: '#3fb67f' }} />}
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: inSwarmRing ? '#e5484d' : '#3fb67f' }}>
              {inSwarmRing ? 'FLAGGED IN FRAUD SWARM RING' : 'STANDALONE TRANSACTION'}
            </span>
          </div>
          {swarmName && (
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', background: 'rgba(229, 72, 77, 0.2)', color: '#e5484d', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
              {swarmName}
            </span>
          )}
        </div>

        {/* Telemetry Parameters Grid */}
        <div className="d-modal-grid">
          <div className="d-modal-field">
            <label>SENDER ACCOUNT</label>
            <div className="d-modal-val mono">{sender}</div>
            <div className="d-modal-subval">{senderBank} • Node</div>
          </div>

          <div className="d-modal-field">
            <label>RECIPIENT ACCOUNT</label>
            <div className="d-modal-val mono" style={{ color: isHigh ? '#e5484d' : 'inherit' }}>{receiver}</div>
            <div className="d-modal-subval">{receiverBank} • {isHigh ? 'Flagged Mule Target' : 'Recipient'}</div>
          </div>

          <div className="d-modal-field">
            <label>TRANSACTION AMOUNT</label>
            <div className="d-modal-val amount">{formatAmount(txn.amount)}</div>
            <div className="d-modal-subval">Instant UPI Transfer Path</div>
          </div>

          <div className="d-modal-field">
            <label>TIMESTAMP</label>
            <div className="d-modal-val mono">{formatTime(txn.timestamp)}</div>
            <div className="d-modal-subval">Real-time Stream Telemetry</div>
          </div>

          <div className="d-modal-field">
            <label>DEVICE HARDWARE HASH</label>
            <div className="d-modal-val mono">{txn.device_fingerprint || 'DEV-X7F2-ANDROID'}</div>
            <div className="d-modal-subval">Hardware Fingerprint</div>
          </div>

          <div className="d-modal-field">
            <label>CHANNEL & LATENCY</label>
            <div className="d-modal-val mono">{txn.channel || 'UPI'} • {Math.round(txn.latency_ms || 18)}ms</div>
            <div className="d-modal-subval">LightGBM / ONNX Scoring</div>
          </div>
        </div>

        {/* Feature Weights (SHAP Explanations) */}
        <div className="d-modal-reasons-section">
          <div className="d-modal-section-title">ENGINE RISK SIGNALS (SHAP EXPLANATION)</div>
          <div className="d-modal-reasons-list">
            {txn.top_reasons?.length > 0 ? (
              txn.top_reasons.map((r, i) => (
                <div className="d-reason-item" key={i}>
                  <span className="d-reason-dot red" />
                  <div className="d-reason-info">
                    <span className="d-reason-name">RISK SIGNAL #{i + 1}</span>
                    <span className="d-reason-desc">{r}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="d-reason-item">
                <span className="d-reason-dot green" />
                <div className="d-reason-info">
                  <span className="d-reason-name">NORMAL TRANSACTION</span>
                  <span className="d-reason-desc">Matches historical sender baseline. Device and IP trusted.</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="d-modal-footer">
          <button
            className="d-btn-graph"
            onClick={() => {
              onClose();
              navigate('/dashboard/graph', { state: { txn } });
            }}
          >
            <Network size={14} />
            <span>Open in Graph Explorer</span>
          </button>

          <button className="d-btn-block" onClick={onClose}>
            <ShieldX size={14} />
            <span>Block Account Entity</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [streamData, setStreamData] = useState([]);
  const [storedTransactions, setStoredTransactions] = useState([]);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [injecting, setInjecting] = useState(false);

  const addLiveTransaction = useCallback(transaction => {
    if (!transaction?.id) return;
    setStreamData(prev => [
      transaction,
      ...prev.filter(item => item.id !== transaction.id),
    ].slice(0, 50));
  }, []);

  // Load persisted history once, then prepend new transactions from the shared event stream.
  useEffect(() => {
    let active = true;
    getTransactions({ limit: 100 })
      .then(response => {
        if (active) setStoredTransactions(response.items || []);
      })
      .catch(error => console.error('Transaction history failed to load:', error));

    const socket = connectEventStream({
      onEvent: event => {
        if (!['transaction_scored', 'swarm_candidate'].includes(event.event_type) || !event.payload) return;
        const payload = event.payload;
        addLiveTransaction({
          id: payload.transaction_id,
          sender_account_id: payload.sender_account_id,
          receiver_account_id: payload.receiver_account_id,
          sender_bank_id: payload.sender_bank_id,
          receiver_bank_id: payload.receiver_bank_id,
          amount: payload.amount ?? null,
          risk_score: Math.round((payload.confidence || payload.fraud_probability || 0) * 100),
          fraud_probability: payload.fraud_probability,
          rule_score: payload.rule_score,
          decision: payload.decision,
          timestamp: payload.timestamp || event.timestamp,
          suspected_swarm_types: payload.suspected_swarm_types || [],
          top_reasons: payload.top_reasons || [],
          device_fingerprint: payload.device_fingerprint,
          channel: payload.channel,
          _live: true,
        });
      },
    });
    return () => {
      active = false;
      socket.close();
    };
  }, [addLiveTransaction]);

  const allTxns = useMemo(() => {
    const liveIds = new Set(streamData.map(transaction => transaction.id));
    return [
      ...streamData,
      ...storedTransactions.filter(transaction => !liveIds.has(transaction.id)),
    ];
  }, [streamData, storedTransactions]);

  // Score reader
  const getScore = (t) => {
    if (!t) return 10;
    if (typeof t.risk_score === 'number') return t.risk_score;
    if (typeof t.fraud_score === 'number') return t.fraud_score > 1 ? t.fraud_score : Math.round(t.fraud_score * 100);
    if (typeof t.confidence === 'number') return Math.round(t.confidence * 100);
    if (typeof t.fraud_probability === 'number') return Math.round(t.fraud_probability * 100);
    return 10;
  };

  // Risk Counts
  const { highCount, medCount, lowCount, totalCount } = useMemo(() => {
    let high = 0, med = 0, low = 0;
    allTxns.forEach(t => {
      const score = getScore(t);
      if (score >= 70 || t.decision === 'block') high++;
      else if (score >= 35 || t.decision === 'review') med++;
      else low++;
    });
    return { highCount: high, medCount: med, lowCount: low, totalCount: allTxns.length };
  }, [allTxns]);

  // Flagged Fraud Accounts
  const flaggedAccounts = useMemo(() => {
    const map = new Map();
    allTxns.forEach(t => {
      const score = getScore(t);
      if (score >= 60 || t.decision === 'block' || t.decision === 'review') {
        const receiver = t.receiver_account_id || t.receiver_upi || 'ACC-000';
        const receiverClean = receiver.split('@')[0];
        if (!map.has(receiverClean)) {
          map.set(receiverClean, {
            account_id: receiverClean,
            upi: receiver,
            bank_id: t.receiver_bank_id || t.bank_receiver || 'Paytm Payments',
            score: score,
            total_amount: t.amount || 0,
            type: score >= 85 ? 'Layering Mule Ring' : 'Velocity Target',
            rawTxn: t
          });
        } else {
          const item = map.get(receiverClean);
          item.total_amount += (t.amount || 0);
          if (score > item.score) item.score = score;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => b.score - a.score).slice(0, 4);
  }, [allTxns]);

  const handleSimulate = async (type) => {
    setInjecting(true);
    try {
      const res = await injectSwarm(type, 5);
      // Fetch latest stored transactions from backend SQLite DB
      const response = await getTransactions({ limit: 100 });
      setStoredTransactions(response.items || []);
      // If scenario returned account IDs, select the first target transaction
      if (res.decisions?.[0]) {
        setSelectedTxn(res.decisions[0]);
      }
    } catch (error) {
      console.error('Live swarm injection failed:', error);
    } finally {
      setTimeout(() => setInjecting(false), 400);
    }
  };

  return (
    <div className="d-root">
      {/* Header Bar */}
      <header className="d-topbar">
        <div className="d-topbar-brand">
          <ShieldAlert size={20} className="d-brand-icon" />
          <span className="d-brand-name">DHOKHA<span className="d-brand-dot">.</span>COMMAND</span>
          <div className="d-live-chip">
            <Radio size={10} className="d-live-dot" />
            <span>LIVE MONITORING</span>
          </div>
        </div>

        <div className="d-swarm-triggers">
          <span className="d-swarm-lbl">SIMULATE ATTACK:</span>
          <button className="d-swarm-btn" onClick={() => handleSimulate('A')} disabled={injecting}>
            A: Fan-Out
          </button>
          <button className="d-swarm-btn" onClick={() => handleSimulate('B')} disabled={injecting}>
            B: Mule Fan-In
          </button>
          <button className="d-swarm-btn" onClick={() => handleSimulate('C')} disabled={injecting}>
            C: Layering Ring
          </button>
          <button className="d-swarm-btn" onClick={() => handleSimulate('D')} disabled={injecting}>
            D: Device Cluster
          </button>
        </div>
      </header>

      {/* Main 50 / 50 Cards Grid */}
      <div className="d-content-grid">

        {/* ── LEFT 50%: SIMPLIFIED TRANSACTIONS TABLE CARD ── */}
        <section className="d-card-column">
          <div className="d-card-wrapper">
            <div className="d-card-header">
              <div className="d-card-title">
                <Activity size={16} />
                <span>LIVE TRANSACTIONS</span>
              </div>
              <div className="d-badge-count">{streamData.length} Live · {storedTransactions.length} Stored</div>
            </div>

            <div className="d-table-wrapper">
              <table className="d-table">
                <thead>
                  <tr>
                    <th style={{ width: '80px', textAlign: 'center' }}>SCORE</th>
                    <th>USER</th>
                    <th style={{ textAlign: 'right' }}>AMOUNT</th>
                    <th style={{ textAlign: 'right' }}>TIME</th>
                  </tr>
                </thead>
                <tbody>
                  {allTxns.map((t, idx) => {
                    const score = getScore(t);
                    const isHigh = score >= 70 || t.decision === 'block';
                    const isMed  = score >= 35 && score < 70 || t.decision === 'review';

                    const sender = t.sender_account_id || t.sender_upi || 'ACC-005';
                    const senderClean = sender.split('@')[0];
                    const isSel = selectedTxn?.id === t.id;

                    return (
                      <tr
                        key={t.id || idx}
                        className={`d-row ${isSel ? 'd-row-selected' : ''}`}
                        onClick={() => setSelectedTxn(t)}
                      >
                        <td style={{ textAlign: 'center' }}>
                          <div className={`d-score-circle ${isHigh ? 'circle-red' : isMed ? 'circle-yellow' : 'circle-green'}`}>
                            {score}
                          </div>
                        </td>
                        <td>
                          <div className="d-user-cell" title={sender}>
                            <span className="d-user-name">{senderClean}</span>
                          </div>
                        </td>
                        <td className="d-amount-cell">
                          {formatAmount(t.amount)}
                        </td>
                        <td className="d-time-cell">
                          {formatTime(t.timestamp)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── RIGHT 50%: RECHARTS DONUT CARD + FLAGGED ACCOUNTS CARD ── */}
        <section className="d-card-column d-column-right">

          {/* TOP 50%: RECHARTS DONUT */}
          <div className="d-card-wrapper d-card-top">
            <div className="d-card-header">
              <div className="d-card-title">
                <Flame size={16} />
                <span>RISK DISTRIBUTION</span>
              </div>
            </div>

            <div className="d-card-body d-center-chart-body">
              <RechartsDonut
                highCount={highCount}
                medCount={medCount}
                lowCount={lowCount}
                total={totalCount}
              />
            </div>
          </div>

          {/* BOTTOM 50%: FLAGGED FRAUD ACCOUNTS */}
          <div className="d-card-wrapper d-card-bottom">
            <div className="d-card-header">
              <div className="d-card-title">
                <AlertTriangle size={16} style={{ color: '#e5484d' }} />
                <span>FLAGGED FRAUD ACCOUNTS</span>
              </div>
              <div className="d-badge-red">{flaggedAccounts.length} Flagged</div>
            </div>

            <div className="d-fraud-cards-container">
              {flaggedAccounts.map((acc) => (
                <div
                  key={acc.account_id}
                  className="d-fraud-item-card"
                  onClick={() => setSelectedTxn(acc.rawTxn || { id: acc.account_id, amount: acc.total_amount, sender_account_id: 'ACC-005', receiver_account_id: acc.account_id, risk_score: acc.score, decision: 'block', suspected_swarm_types: ['B'] })}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="d-fraud-item-left">
                    <div className="d-fraud-acct-title">{acc.account_id}</div>
                    <div className="d-fraud-meta-line">
                      <span>{acc.bank_id}</span>
                      <span className="d-bullet">•</span>
                      <span className="d-fraud-tag">{acc.type}</span>
                    </div>
                  </div>
                  <div className="d-fraud-item-right">
                    <div className="d-fraud-val">{formatAmount(acc.total_amount)}</div>
                    <div className="d-fraud-badge">RISK {acc.score}/100</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </section>
      </div>

      {/* ── SECOND STAGE: DETAILED TRANSACTION DOSSIER MODAL ── */}
      {selectedTxn && (
        <TransactionDetailModal
          txn={selectedTxn}
          onClose={() => setSelectedTxn(null)}
          getScore={getScore}
        />
      )}
    </div>
  );
}
