import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as d3 from 'd3';
import { 
  Clock, 
  ArrowRight,
  Shield,
  FileText
} from 'lucide-react';
import { transactions, stats } from '../data/mockData';
import './Dashboard.css';

const formatAmount = (n) => '₹' + n.toLocaleString('en-IN');

const formatTime = (ts) => {
  return new Date(ts).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};

// Mini D3 Live Graph (clean graphite nodes connected by red threads)
function MiniLiveGraph({ txn }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !txn) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight || 280;

    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g');

    const nodes = [
      { id: txn.sender_upi, label: txn.sender_upi.split('@')[0], type: 'sender' },
      { id: txn.receiver_upi, label: txn.receiver_upi.split('@')[0], type: 'receiver' },
      { id: txn.device_id, label: txn.device_id.split('-')[1], type: 'device' },
      { id: txn.ip, label: txn.ip, type: 'ip' }
    ];

    const links = [
      { source: txn.sender_upi, target: txn.receiver_upi, type: 'payment' },
      { source: txn.sender_upi, target: txn.device_id, type: 'device' },
      { source: txn.device_id, target: txn.ip, type: 'network' }
    ];

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(60))
      .force('charge', d3.forceManyBody().strength(-100))
      .force('center', d3.forceCenter(width / 2, height / 2));

    // High-precision red string lines
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke', '#e5484d')
      .attr('stroke-width', 1.8)
      .attr('opacity', 0.8);

    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .enter().append('g');

    node.append('circle')
      .attr('r', 7)
      .attr('fill', d => d.type === 'receiver' ? '#e5484d' : '#2a201c')
      .attr('stroke', d => d.type === 'receiver' ? '#e5484d' : '#3a2a24')
      .attr('stroke-width', 1.5);

    node.append('text')
      .text(d => d.label)
      .attr('x', 12)
      .attr('y', 4)
      .attr('fill', '#b5b0a5')
      .attr('font-size', '9px')
      .attr('font-family', 'ui-monospace, monospace');

    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('transform', d => `translate(${d.x},${d.y})`);
    });

    return () => simulation.stop();
  }, [txn]);

  return (
    <div className="mini-graph-canvas" ref={containerRef}>
      <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [visibleTxns, setVisibleTxns] = useState([]);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live simulation update
  useEffect(() => {
    const feed = [...transactions].sort((a, b) => b.risk_score - a.risk_score);
    setVisibleTxns(feed.slice(0, 5));
    setSelectedTxn(feed[0]);

    let idx = 5;
    const interval = setInterval(() => {
      if (idx >= transactions.length) {
        idx = 0;
      }
      const nextTxn = transactions[idx];
      idx++;
      setVisibleTxns(prev => {
        if (prev.find(t => t.id === nextTxn.id)) return prev;
        return [nextTxn, ...prev.slice(0, 8)];
      });
      if (nextTxn.risk_score >= 60) {
        setSelectedTxn(nextTxn);
      }
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="dashboard-console dark-operations-board animate-in">
      
      {/* Top Header Status Bar */}
      <header className="board-top-bar">
        <div className="board-brand">
          <span className="platform-logo">DHOKHA</span>
          <span className="live-badge-stamp">MONITOR ACTIVE</span>
        </div>
        <div className="board-clock mono">
          <Clock size={12} style={{ marginRight: 6, color: 'var(--text-dim)' }} />
          <span>{currentTime.toLocaleTimeString('en-IN', { hour12: false })}</span>
        </div>
      </header>

      {/* Workspace Columns */}
      <div className="board-main-container">
        
        {/* Pinned Stats Metadata Dossier */}
        <section className="metadata-dossier-card">
          <div className="meta-paper-content">
            <div className="meta-stat-item">
              <span className="meta-lbl">EST. MONEY PROTECTED</span>
              <span className="meta-val">₹12.4 Cr</span>
            </div>
            <div className="meta-divider" />
            <div className="meta-stat-item">
              <span className="meta-lbl text-red-lbl">ACTIVE SCAM QUEUE</span>
              <span className="meta-val text-red">{stats.active_rings * 3} Threat Files</span>
            </div>
            <div className="meta-divider" />
            <div className="meta-stat-item">
              <span className="meta-lbl text-green-lbl">API PROCESS SPEED</span>
              <span className="meta-val text-green">{stats.avg_latency_ms}ms</span>
            </div>
          </div>
        </section>

        {/* Cohesive 3-Column Terminal Layout: Bloomberg meets Palantir Gotham */}
        <div className="dossier-workspace-columns">
          
          {/* Column 1: Live Ingress stream (Slate Panel) */}
          <div className="console-panel-box stream-panel">
            <div className="panel-header">
              <h3>LIVE TRANSACTION STREAM</h3>
              <span className="stamp-indicator-critical">LIVE PATH</span>
            </div>
            
            <div className="panel-body-scroll">
              {visibleTxns.map((txn, idx) => {
                const isSelected = selectedTxn && selectedTxn.id === txn.id;
                const isFlagged = txn.risk_score >= 60;
                return (
                  <div 
                    key={txn.id + idx}
                    className={`panel-stream-row ${isSelected ? 'active' : ''} ${isFlagged ? 'flagged' : ''}`}
                    onClick={() => setSelectedTxn(txn)}
                  >
                    <div className="row-top">
                      <span className="time">{formatTime(txn.timestamp)}</span>
                      <span className="amount">{formatAmount(txn.amount)}</span>
                    </div>
                    <div className="row-mid">
                      <span className="flow mono">{txn.sender_upi.split('@')[0]} → {txn.receiver_upi.split('@')[0]}</span>
                      {isFlagged && <span className="flag-stamp-mini">CRITICAL</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Column 2: Live Network Visual Graph (Slate Panel) */}
          <div className="console-panel-box graph-panel">
            <div className="panel-header">
              <h3>CROSS-BANK THREAD MAP</h3>
              {selectedTxn && (
                <span className="stamp-confidence-badge">
                  AI: {Math.round(selectedTxn.confidence * 100)}% SURE
                </span>
              )}
            </div>
            
            <div className="panel-graph-workspace">
              {selectedTxn ? (
                <MiniLiveGraph txn={selectedTxn} />
              ) : (
                <div className="panel-empty-msg">Select a ledger thread to map.</div>
              )}
            </div>
          </div>

          {/* Column 3: Live AI explanation & Action panel (Slate Panel) */}
          <div className="console-panel-box details-panel">
            <div className="panel-header">
              <h3>INCIDENT DOSSIER DETAILS</h3>
            </div>
            
            {selectedTxn ? (
              <div className="panel-details-content">
                <div className="panel-details-row">
                  <span className="lbl">Receiver Target</span>
                  <strong className="val mono">{selectedTxn.receiver_upi}</strong>
                </div>

                <div className="panel-details-row-block">
                  <span className="lbl">Why Flagged (Evidence)</span>
                  <div className="reasons-bullet-list">
                    {selectedTxn.reasons.map((r, i) => (
                      <div className="bullet-row-details" key={i}>
                        <span className="bullet-dash">—</span>
                        <span>{r.detail}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="panel-footer-meta">
                  <div className="meta-col">
                    <span>IP MAPPED</span>
                    <strong className="mono">{selectedTxn.ip}</strong>
                  </div>
                  <div className="meta-col">
                    <span>DEVICE HASH</span>
                    <strong className="mono">{selectedTxn.device_id.split('-')[1]}</strong>
                  </div>
                </div>

                <div className="panel-actions-grid" style={{ display: 'flex', gap: 12, marginTop: 'auto' }}>
                  <button 
                    className="btn-panel-open"
                    style={{ flex: 1 }}
                    onClick={() => navigate('/dashboard/graph', { state: { txn: selectedTxn } })}
                  >
                    [ GRAPH BOARD ]
                  </button>
                  <button 
                    className="btn-panel-open btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => navigate('/dashboard/case', { state: { txn: selectedTxn } })}
                  >
                    [ CASE DOSSIER ]
                  </button>
                </div>
              </div>
            ) : (
              <div className="panel-empty-msg">Select incident ledger details.</div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
