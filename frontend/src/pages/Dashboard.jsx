import { useState, useEffect, useMemo, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { connectEventStream, getTransactions, injectSwarm } from '../api/client';
import { ShieldAlert, AlertTriangle, Flame, Activity, Radio } from 'lucide-react';
import './Dashboard.css';

const formatAmount = (n) => n == null ? '—' : '₹' + Number(n).toLocaleString('en-IN');

const formatTime = (ts) => {
  if (!ts) return '--:--:--';
  return new Date(ts).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
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

export default function Dashboard() {
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
          risk_score: Math.round((payload.confidence || 0) * 100),
          fraud_probability: payload.fraud_probability,
          rule_score: payload.rule_score,
          decision: payload.decision,
          timestamp: payload.timestamp || event.timestamp,
          suspected_swarm_types: payload.suspected_swarm_types || [],
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
        const receiver = t.receiver_account_id || t.receiver_upi || 'shell_acc_01@paytm';
        const receiverClean = receiver.split('@')[0];
        if (!map.has(receiverClean)) {
          map.set(receiverClean, {
            account_id: receiverClean,
            upi: receiver,
            bank_id: t.receiver_bank_id || t.bank_receiver || t.receiver_bank || 'Unknown bank',
            score: score,
            total_amount: t.amount || 0,
            type: score >= 85 ? 'Layering Mule Ring' : 'Velocity Target',
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
      await injectSwarm(type, 5);
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
            Identity Swarm
          </button>
          <button className="d-swarm-btn" onClick={() => handleSimulate('B')} disabled={injecting}>
            Mule Fan-in
          </button>
          <button className="d-swarm-btn" onClick={() => handleSimulate('C')} disabled={injecting}>
            Layering Ring
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

                    const sender = t.sender_account_id || t.sender_upi || 'acc_sender';
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
                <div key={acc.account_id} className="d-fraud-item-card">
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
    </div>
  );
}
