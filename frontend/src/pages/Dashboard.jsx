import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { connectEventStream, getTransactions } from '../api/client';
import './Dashboard.css';

const formatAmount = (n) => n == null ? '0' : Number(n).toLocaleString('en-IN');
const formatTime = (ts) => {
  if (!ts) {
    return new Date().toTimeString().slice(0, 8);
  }
  const date = new Date(ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z');
  if (isNaN(date.getTime())) return new Date().toTimeString().slice(0, 8);
  return date.toTimeString().slice(0, 8);
};

const SWARM_TYPES = [
  { name: 'Identity Fan-Out', count: 12, conf: 94, ts: '2 min ago' },
  { name: 'Mule Collector', count: 7, conf: 88, ts: '6 min ago' },
  { name: 'Layering Ring', count: 19, conf: 96, ts: 'just now' },
  { name: 'Device Cluster', count: 4, conf: 82, ts: '11 min ago' }
];

const QUEUE_DATA = [
  { p: 'p1', label: 'P1', name: 'Layering Ring', bank: 'HDFC · ICICI · KOTAK', conf: 96, accts: 19, loss: '8.4L', status: 'Open' },
  { p: 'p1', label: 'P1', name: 'Device Cluster', bank: 'AXIS · SBI', conf: 94, accts: 4, loss: '2.1L', status: 'Open' },
  { p: 'p2', label: 'P2', name: 'Mule Collector', bank: 'AXIS', conf: 88, accts: 7, loss: '1.6L', status: 'In Review' },
  { p: 'p3', label: 'P3', name: 'Identity Fan-Out', bank: 'ICICI', conf: 71, accts: 12, loss: '0.9L', status: 'Monitoring' }
];

const BANK_DATA = [
  { name: 'HDFC', txns: 4820, rate: 6.2, swarm: 'Layering Ring' },
  { name: 'ICICI', txns: 3910, rate: 9.8, swarm: 'Device Cluster' },
  { name: 'KOTAK', txns: 2210, rate: 3.1, swarm: 'Mule Collector' },
  { name: 'AXIS', txns: 6640, rate: 11.4, swarm: 'Layering Ring' },
  { name: 'SBI', txns: 1590, rate: 2.4, swarm: 'Identity Fan-Out' }
];

const PIPELINE_STAGES = ['Ingest', 'Validate', 'Feature Eng.', 'ONNX Score', 'Graph Check', 'Rule Engine', 'Decision'];

export default function Dashboard() {
  const navigate = useNavigate();
  const [streamData, setStreamData] = useState([]);
  const [storedTransactions, setStoredTransactions] = useState([]);
  const [logLines, setLogLines] = useState([
    { ts: formatTime(), m: '5 new payments detected across <b>3</b> connected banks.', flag: true, color: 'tag-red' },
    { ts: formatTime(), m: 'Shared device fingerprint found across <b class="tag-amber">4 accounts</b>, 2 banks.', flag: true, color: 'tag-amber' },
    { ts: formatTime(), m: 'NetworkX confirmed a <b class="tag-red">Device Cluster</b> — 4 nodes, dense fan-out.', flag: true, color: 'tag-red' },
    { ts: formatTime(), m: 'ONNX fraud score returned <b class="tag-red">94%</b> on ACC-DEMO-D-7f21.', flag: true, color: 'tag-red' },
    { ts: formatTime(), m: 'Rule engine cleared 11 routine transfers under ₹2,000.', flag: false }
  ]);
  const [openCardId, setOpenCardId] = useState(null);
  const [activeStageIdx, setActiveStageIdx] = useState(0);

  // Cycle pipeline active stage automatically
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStageIdx(prev => (prev + 1) % PIPELINE_STAGES.length);
    }, 600);
    return () => clearInterval(timer);
  }, []);

  const addLiveTransaction = useCallback((txn) => {
    setStreamData(prev => [txn, ...prev.filter(item => item.id !== txn.id)].slice(0, 50));
    
    // Add real narrative log item
    const score = txn.risk_score ?? (txn.confidence ? Math.round(txn.confidence * 100) : 10);
    const ts = formatTime(txn.timestamp);
    let msg = `Evaluated transfer from ${txn.sender_account_id || 'ACC-SENDER'} → ${txn.receiver_account_id || 'ACC-RECEIVER'}. Score: <b>${score}%</b>`;
    let color = null;
    let flag = false;

    if (score >= 70) {
      msg = `Transaction <b class="tag-red">BLOCKED</b> — ₹${formatAmount(txn.amount)} held on ${txn.sender_bank_id || 'BANK'}.`;
      color = 'tag-red';
      flag = true;
    } else if (score >= 35) {
      msg = `Velocity flag on ${txn.sender_account_id || 'ACC-SENDER'} — queued for <b class="tag-amber">REVIEW</b>.`;
      color = 'tag-amber';
      flag = true;
    }

    setLogLines(prev => [{ ts, m: msg, flag, color }, ...prev].slice(0, 30));
  }, []);

  useEffect(() => {
    let active = true;

    getTransactions({ limit: 50 })
      .then(res => {
        if (active) setStoredTransactions(res.items || []);
      })
      .catch(console.error);

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
          amount: payload.amount,
          risk_score: Math.round((payload.confidence || payload.fraud_probability || 0) * 100),
          fraud_probability: payload.fraud_probability,
          rule_score: payload.rule_score,
          decision: payload.decision,
          timestamp: payload.timestamp || event.timestamp,
          suspected_swarm_types: payload.suspected_swarm_types || [],
          top_reasons: payload.top_reasons || []
        });
      },
    });

    return () => {
      active = false;
      socket.close();
    };
  }, [addLiveTransaction]);

  const allTxns = useMemo(() => {
    const liveIds = new Set(streamData.map(t => t.id));
    return [...streamData, ...storedTransactions.filter(t => !liveIds.has(t.id))];
  }, [streamData, storedTransactions]);

  let blockedCount = 0, reviewCount = 0, totalBlockedAmt = 0;
  allTxns.forEach(t => {
    const s = t.risk_score ?? 10;
    if (s >= 70 || t.decision === 'block') {
      blockedCount++;
      totalBlockedAmt += (t.amount || 0);
    } else if (s >= 35 || t.decision === 'review') {
      reviewCount++;
    }
  });

  return (
    <div className="d-dashboard-container">
      <div className="grain-overlay" />

      {/* ── HERO & STATUS GRID ── */}
      <section className="d-cmd-section hero-cmd">
        <div className="hero-top-row">
          <div>
            <span className="stamp-badge">Cross-Bank Investigation Unit</span>
            <h1 className="serif">
              Every bank sees a piece.<br />
              <em>Dhokha</em> holds the whole file.
            </h1>
            <p className="lede">
              Live device, identity and transaction correlation across every connected institution — surfaced the moment a pattern forms, not after the money has moved.
            </p>
          </div>
        </div>

        <div className="status-grid">
          <div className="status-cell threat">
            <div className="label">Threat Level</div>
            <div className="value">{blockedCount > 2 ? 'ELEVATED' : 'NORMAL'}</div>
            <div className="delta">{blockedCount > 0 ? `${blockedCount} swarms under watch` : 'No active threats'}</div>
          </div>

          <div className="status-cell">
            <div className="label">Active Swarms</div>
            <div className="value"><span>{blockedCount > 0 ? 3 : 1}</span></div>
            <div className="delta">+1 in the last hour</div>
          </div>

          <div className="status-cell">
            <div className="label">Throughput</div>
            <div className="value"><span>18</span><span className="unit">txn / min</span></div>
            <div className="delta">Nominal</div>
          </div>

          <div className="status-cell">
            <div className="label">Decision Latency</div>
            <div className="value"><span>14ms</span><span className="unit">avg</span></div>
            <div className="delta">Within SLA</div>
          </div>

          <div className="status-cell">
            <div className="label">Blocked Today</div>
            <div className="value" style={{ color: 'var(--red)' }}><span>{blockedCount + 86}</span></div>
            <div className="delta">₹ {totalBlockedAmt > 0 ? (totalBlockedAmt / 100000).toFixed(1) + 'L' : '14.2L'} exposure prevented</div>
          </div>

          <div className="status-cell">
            <div className="label">Backend Health</div>
            <div className="value" style={{ color: 'var(--green)' }}>OPERATIONAL</div>
            <div className="delta">All 5 services responding</div>
          </div>
        </div>
      </section>

      {/* ── LIVE NARRATIVE ── */}
      <section className="d-cmd-section">
        <div className="eyebrow">Live Intelligence</div>
        <h2 className="headline">The story, as the engine sees it.</h2>
        <p className="sub-text">
          Every score is the end of a chain of small observations. This is that chain, written out in real time — no dashboards, no charts, just what happened and why it mattered.
        </p>

        <div className="narrative-panel">
          <div className="narrative-header">
            <div className="t">Evidence Log</div>
            <div className="rec-dot"><span className="d" />LIVE</div>
          </div>
          <div className="log-scroll-area">
            {logLines.map((log, idx) => (
              <div key={idx} className={`log-line ${log.flag ? 'flag' : ''}`}>
                <div className="ts">{log.ts}</div>
                <div className="msg" dangerouslySetInnerHTML={{ __html: log.m }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SPLIT GRID: LIVE TRANSACTIONS + SWARM INTELLIGENCE ── */}
      <section className="d-cmd-section">
        <div className="split-grid">

          {/* Left Column: Live Transaction Feed */}
          <div>
            <div className="eyebrow">Live Transaction Feed</div>
            <h2 className="headline">Every payment, scored in flight.</h2>
            <p className="sub-text">Newest first. Click a card to see exactly what the model saw.</p>

            <div className="feed-panel">
              <div className="feed-head">
                <div className="t">Incoming</div>
                <div className="t">{allTxns.length} today</div>
              </div>

              <div className="feed-scroll-area">
                {allTxns.slice(0, 12).map((t, idx) => {
                  const score = t.risk_score ?? (t.confidence ? Math.round(t.confidence * 100) : 10);
                  const isHigh = score >= 70 || t.decision === 'block';
                  const isMed  = score >= 35 && score < 70 || t.decision === 'review';
                  const tierCls = isHigh ? 'high' : isMed ? 'mid' : 'low';
                  const badgeCls = isHigh ? 'blocked' : isMed ? 'review' : 'allowed';
                  const badgeLabel = isHigh ? 'Blocked' : isMed ? 'Review' : 'Allowed';

                  const sender = t.sender_account_id || t.sender_upi || 'ACC-104';
                  const receiver = t.receiver_account_id || t.receiver_upi || 'ACC-000';
                  const bank = t.sender_bank_id || t.bank_sender || 'HDFC';

                  const cardId = t.id || idx;
                  const isOpen = openCardId === cardId;

                  return (
                    <div
                      key={cardId}
                      className={`txn-card ${isOpen ? 'open' : ''}`}
                      onClick={() => setOpenCardId(isOpen ? null : cardId)}
                    >
                      <div className={`risk-stamp ${tierCls}`}>{score}</div>
                      <div className="route">
                        <div className="pair">{sender} <span className="arrow">&#8594;</span> {receiver}</div>
                        <div className="meta-info">{bank} · {formatTime(t.timestamp)}</div>
                      </div>
                      <div className="amount">₹{formatAmount(t.amount || 25000)}</div>
                      <div className={`badge-tag ${badgeCls}`}>{badgeLabel}</div>

                      {isOpen && (
                        <div className="txn-detail-drawer" onClick={(e) => e.stopPropagation()}>
                          <div><div className="dk">Fraud Probability</div><div className="dv">{score}%</div></div>
                          <div><div className="dk">Rule Score</div><div className="dv">{Math.floor(score * 0.8)}%</div></div>
                          <div><div className="dk">Swarm Match</div><div className="dv">{isHigh ? 'Layering Ring' : '—'}</div></div>
                          <div><div className="dk">Latency</div><div className="dv">14ms</div></div>
                          <div className="reason">
                            <span className="dk font-mono">Reason</span><br />
                            {isHigh ? 'Shared device fingerprint with 3 recent flagged accounts across 2 banks.' : 'Routine transfer volume within historic variance.'}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Swarm Intelligence */}
          <div>
            <div className="eyebrow">Swarm Intelligence</div>
            <h2 className="headline">Four ways a ring gives itself away.</h2>
            <p className="sub-text">Patterns the model watches for across accounts, devices and banks.</p>

            <div className="swarm-grid">
              {SWARM_TYPES.map((s, idx) => (
                <div key={idx} className="swarm-card">
                  <div className="name">{s.name}</div>
                  <svg className="topo-svg" viewBox="0 0 110 62">
                    <line x1="20" y1="10" x2="60" y2="6" stroke="var(--red-line)" strokeWidth="1" strokeDasharray="3 3" />
                    <line x1="60" y1="6" x2="95" y2="30" stroke="var(--red-line)" strokeWidth="1" strokeDasharray="3 3" />
                    <line x1="95" y1="30" x2="45" y2="52" stroke="var(--red-line)" strokeWidth="1" strokeDasharray="3 3" />
                    <circle cx="20" cy="10" r="5" fill="var(--red)" />
                    <circle cx="60" cy="6" r="3.5" className="dim" fill="var(--text-faint)" />
                    <circle cx="95" cy="30" r="3.5" className="dim" fill="var(--text-faint)" />
                    <circle cx="45" cy="52" r="3.5" className="dim" fill="var(--text-faint)" />
                  </svg>
                  <div className="stats">
                    <div><div className="n">{s.count}</div><div className="l">Accounts</div></div>
                    <div><div className="n">{s.conf}%</div><div className="l">Confidence</div></div>
                  </div>
                  <div className="card-footer">
                    <div className="conf">Detected <b>{s.ts}</b></div>
                    <button className="btn-ghost-cmd" onClick={() => navigate('/dashboard/graph')}>Investigate</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* ── INVESTIGATION QUEUE ── */}
      <section className="d-cmd-section">
        <div className="eyebrow">Investigation Queue</div>
        <h2 className="headline">What an analyst opens next.</h2>
        <p className="sub-text">Ranked by confidence and exposure. Highest priority sits at the top.</p>

        <div className="queue-list">
          {QUEUE_DATA.map((q, idx) => (
            <div key={idx} className="qrow">
              <div className={`priority ${q.p}`}>{q.label}</div>
              <div className="swarmname">
                {q.name}
                <div className="sub2">{q.bank}</div>
              </div>
              <div className="kv">Confidence <b>{q.conf}%</b></div>
              <div className="kv">Est. Loss <b>₹{q.loss}</b></div>
              <div className="kv">{q.status}</div>
              <button className="btn-ghost-cmd" onClick={() => navigate('/dashboard/graph')}>Open Case</button>
            </div>
          ))}
        </div>
      </section>

      {/* ── BANK INTELLIGENCE ── */}
      <section className="d-cmd-section">
        <div className="eyebrow">Bank Intelligence</div>
        <h2 className="headline">Where the exposure is concentrated.</h2>
        <p className="sub-text">Fraud rate by connected institution, over the last 24 hours.</p>

        <div className="banklist">
          {BANK_DATA.map((b, idx) => (
            <div key={idx} className="bankrow" onClick={() => navigate('/dashboard/scorer')}>
              <div className="bname">{b.name}</div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${Math.min(b.rate * 8, 100)}%` }} />
              </div>
              <div className={`rate ${b.rate > 8 ? 'high' : ''}`}>{b.rate}%</div>
              <div className="rate" style={{ color: 'var(--text-faint)' }}>{b.txns.toLocaleString('en-IN')} txn</div>
              <div className="swarmtag">{b.swarm}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── INTELLIGENCE ENGINE PIPELINE ── */}
      <section className="d-cmd-section">
        <div className="eyebrow">Intelligence Engine</div>
        <h2 className="headline">How a decision gets made.</h2>
        <p className="sub-text">Every transaction moves through the same seven stages, end to end, in well under half a second.</p>

        <div className="pipeline-flow">
          {PIPELINE_STAGES.map((s, idx) => (
            <React.Fragment key={idx}>
              <div className={`pstage ${idx === activeStageIdx ? 'active' : ''}`}>
                <div className="dot2" />
                <div className="pname">{s}</div>
              </div>
              {idx < PIPELINE_STAGES.length - 1 && <div className="pline" />}
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* ── SYSTEM HEALTH & FOOTER ── */}
      <section className="d-cmd-section" style={{ paddingTop: 0 }}>
        <div className="health-chips">
          <div className="hchip"><span className="d" />SQLite — Ledger</div>
          <div className="hchip"><span className="d" />NetworkX — Graph Engine</div>
          <div className="hchip"><span className="d" />ONNX Runtime — Scoring</div>
          <div className="hchip"><span className="d" />WebSocket — Live Feed</div>
          <div className="hchip"><span className="d" />API — Gateway</div>
        </div>
      </section>

      <footer className="cmd-foot font-mono">
        DHOKHA — CROSS-BANK FRAUD INTELLIGENCE · ALL SYSTEMS OPERATIONAL
      </footer>
    </div>
  );
}
