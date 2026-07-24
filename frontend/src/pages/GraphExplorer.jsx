import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as d3 from 'd3';
import { 
  ArrowLeft,
  Clock
} from 'lucide-react';
import './GraphExplorer.css';

// Cohesive case mock data matching the operations console
const CASES = [
  {
    id: 'RING-3021',
    title: 'Cross-bank Mule Ring',
    severity: 'critical',
    exposure: '₹48.2L',
    confidence: 97,
    updated: '14s ago',
    assignee: 'Rahul',
    summary: 'Detected a coordinated layering structure where funds from multiple HDFC accounts are channeled to a single Paytm receiver wallet before being cashed out via hawala.',
    reasons: [
      { type: 'fan_in', detail: '14 unique senders layered funds in under 30 minutes', weight: 0.45 },
      { type: 'velocity', detail: 'Rapid outbound forwarding to known cash-out points', weight: 0.35 },
      { type: 'device', detail: 'Shared emulator device ID seen across 8 profiles', weight: 0.20 }
    ],
    graph: {
      nodes: [
        { id: 'shell_acc_01@paytm', label: 'shell_acc_01', type: 'account', risk: 92, bank: 'Paytm Payments', city: 'Mumbai' },
        { id: 'mule_acc_02@icici', label: 'mule_acc_02', type: 'account', risk: 87, bank: 'ICICI Bank', city: 'Pune' },
        { id: 'shell_acc_03@ybl', label: 'shell_acc_03', type: 'account', risk: 84, bank: 'Yes Bank', city: 'Lucknow' },
        { id: 'mule_acc_04@kotak', label: 'mule_acc_04', type: 'account', risk: 89, bank: 'Kotak Bank', city: 'Delhi' },
        { id: 'DEV-X7F2-ANDROID', label: 'DEV-X7F2', type: 'device', risk: 95 },
        { id: 'IP-103.47.112.54', label: '103.47.112.54', type: 'ip', risk: 90 },
        { id: 'cashout@hawala', label: 'Cashout', type: 'cashout', risk: 99 }
      ],
      edges: [
        { source: 'shell_acc_01@paytm', target: 'mule_acc_02@icici', relation: 'forwarded' },
        { source: 'mule_acc_02@icici', target: 'shell_acc_03@ybl', relation: 'forwarded' },
        { source: 'shell_acc_03@ybl', target: 'mule_acc_04@kotak', relation: 'forwarded' },
        { source: 'mule_acc_04@kotak', target: 'cashout@hawala', relation: 'cashout' },
        { source: 'shell_acc_01@paytm', target: 'DEV-X7F2-ANDROID', relation: 'uses_device' },
        { source: 'mule_acc_02@icici', target: 'DEV-X7F2-ANDROID', relation: 'uses_device' },
        { source: 'DEV-X7F2-ANDROID', target: 'IP-103.47.112.54', relation: 'connects_via' }
      ]
    },
    timeline: [
      { time: '09:26', event: 'Fraud ring confirmed by core scoring model' },
      { time: '09:23', event: 'Shared device hash DEV-X7F2 seen across 8 accounts' },
      { time: '09:20', event: 'Analyst Rahul assigned to investigation queue' },
      { time: '09:18', event: 'First transaction blocked automatically' }
    ]
  },
  {
    id: 'DEVICE-1982',
    title: 'Shared Android Device',
    severity: 'warning',
    exposure: '₹8.9L',
    confidence: 89,
    updated: '2m ago',
    assignee: 'Ananya',
    summary: 'Hardware parameters suggest a rooted device simulating multiple physical nodes. Connected to 12 distinct UPI IDs within HDFC and SBI gateway environments.',
    reasons: [
      { type: 'device_link', detail: 'Device hardware hash matching 12 distinct UPI accounts', weight: 0.60 },
      { type: 'proxy_ip', detail: 'Transactions routed via VPN/proxy cluster', weight: 0.40 }
    ],
    graph: {
      nodes: [
        { id: 'DEV-M3K1-IPHONE', label: 'DEV-M3K1', type: 'device', risk: 85 },
        { id: 'user_01@ybl', label: 'user_01', type: 'account', risk: 32, bank: 'Yes Bank', city: 'Pune' },
        { id: 'user_02@ybl', label: 'user_02', type: 'account', risk: 78, bank: 'Yes Bank', city: 'Delhi' },
        { id: 'user_03@ybl', label: 'user_03', type: 'account', risk: 82, bank: 'Yes Bank', city: 'Mumbai' },
        { id: 'IP-103.47.112.55', label: '103.47.112.55', type: 'ip', risk: 74 }
      ],
      edges: [
        { source: 'user_01@ybl', target: 'DEV-M3K1-IPHONE', relation: 'uses_device' },
        { source: 'user_02@ybl', target: 'DEV-M3K1-IPHONE', relation: 'uses_device' },
        { source: 'user_03@ybl', target: 'DEV-M3K1-IPHONE', relation: 'uses_device' },
        { source: 'DEV-M3K1-IPHONE', target: 'IP-103.47.112.55', relation: 'connects_via' }
      ]
    },
    timeline: [
      { time: '09:20', event: 'Anomaly flagged on shared device DEV-M3K1' },
      { time: '09:15', event: 'User_03 profile created from duplicate IP subnet' }
    ]
  },
  {
    id: 'VELOCITY-882',
    title: 'Transaction Burst',
    severity: 'review',
    exposure: '₹3.1L',
    confidence: 74,
    updated: '8m ago',
    assignee: 'Unassigned',
    summary: 'A burst of high-frequency small transactions attempting to bypass automated transaction limits on a recently created receiver UPI address.',
    reasons: [
      { type: 'velocity', detail: '18 transaction attempts in 4 minutes', weight: 0.70 },
      { type: 'amount_split', detail: 'Pattern matching repetitive micro-amount splits', weight: 0.30 }
    ],
    graph: {
      nodes: [
        { id: 'sender@ybl', label: 'sender', type: 'account', risk: 65, bank: 'Yes Bank', city: 'Kolkata' },
        { id: 'merchant@razorpay', label: 'merchant', type: 'merchant', risk: 10, bank: 'Razorpay', city: 'Bangalore' }
      ],
      edges: [
        { source: 'sender@ybl', target: 'merchant@razorpay', relation: 'burst_payments' }
      ]
    },
    timeline: [
      { time: '09:12', event: 'Velocity limit exceeded (18 attempts/4min)' }
    ]
  }
];

export default function GraphExplorer() {
  const navigate = useNavigate();
  const location = useLocation();
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  // Initial case loading logic
  const initialCase = location.state?.txn
    ? CASES.find(c => c.graph.nodes.some(n => n.id === location.state.txn.receiver_upi || n.id === location.state.txn.sender_upi)) || CASES[0]
    : CASES[0];

  const [activeCase, setActiveCase] = useState(initialCase);
  const [selectedNode, setSelectedNode] = useState(null);
  const [filter, setFilter] = useState('all');
  const [toast, setToast] = useState('');

  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  };

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !activeCase) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight || 550;

    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g');

    // Zoom setup
    const zoom = d3.zoom()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);

    // Defs for glowing dropshadows on pins
    const defs = svg.append('defs');
    const filterGlow = defs.append('filter')
      .attr('id', 'shadow-glow')
      .attr('width', '140%')
      .attr('height', '140%');
    filterGlow.append('feDropShadow')
      .attr('dx', 1)
      .attr('dy', 2)
      .attr('stdDeviation', 2)
      .attr('flood-opacity', 0.4)
      .attr('flood-color', '#000000');

    const colorMap = {
      account: 'var(--risk-critical)',
      device: 'var(--risk-medium)',
      ip: 'var(--accent-purple)',
      merchant: 'var(--safe)',
      cashout: 'var(--risk-critical)'
    };

    let graphNodes = activeCase.graph.nodes.map(d => ({ ...d }));
    let graphEdges = activeCase.graph.edges.map(d => ({ ...d }));

    if (filter !== 'all') {
      graphNodes = graphNodes.filter(n => n.type === filter);
      const nodeIds = new Set(graphNodes.map(n => n.id));
      graphEdges = graphEdges.filter(e => nodeIds.has(e.source) || nodeIds.has(e.target));
    }

    const simulation = d3.forceSimulation(graphNodes)
      .force('link', d3.forceLink(graphEdges).id(d => d.id).distance(120))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(22));

    // Links: Red wool thread strings
    const link = g.append('g')
      .selectAll('line')
      .data(graphEdges)
      .enter().append('line')
      .attr('stroke', 'var(--string)')
      .attr('stroke-width', 2)
      .attr('opacity', 0.85);

    const node = g.append('g')
      .selectAll('g')
      .data(graphNodes)
      .enter().append('g')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended))
      .on('click', (event, d) => {
        setSelectedNode(d);
        event.stopPropagation();
      });

    // Pinned nodes: Brass circular map pins
    node.append('circle')
      .attr('r', d => (selectedNode && selectedNode.id === d.id ? 13 : 10))
      .attr('fill', d => colorMap[d.type] || 'var(--brass)')
      .attr('stroke', 'var(--bg)')
      .attr('stroke-width', d => (selectedNode && selectedNode.id === d.id ? 2 : 1.2))
      .attr('filter', 'url(#shadow-glow)')
      .style('cursor', 'pointer');

    node.append('circle')
      .attr('r', 1.8)
      .attr('fill', 'var(--text)');

    node.append('text')
      .text(d => d.label || d.id.split('@')[0])
      .attr('x', 16)
      .attr('y', 4)
      .attr('fill', 'var(--text-secondary)')
      .attr('font-size', '10px')
      .attr('font-weight', '500')
      .attr('font-family', 'var(--font-mono)')
      .style('pointer-events', 'none');

    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('transform', d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    if (!selectedNode) {
      setSelectedNode(graphNodes[0]);
    }

    return () => simulation.stop();
  }, [activeCase, filter, selectedNode]);

  return (
    <div className="explorer-layout dark-operations-board animate-in">
      
      {/* Wooden-style subheader bar */}
      <div className="explorer-sub-header">
        <button className="back-btn" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={13} style={{ marginRight: 6 }} /> Back to Terminal
        </button>
        <div className="title-area">
          <span className="queue-tag">CASE DOSSIER</span>
          <h1>{activeCase.title}</h1>
        </div>
        <div className="header-meta">
          <span>AI Threat: <strong className="text-red">{activeCase.confidence}%</strong></span>
          <span className="pipe" />
          <span>Exposure: <strong>{activeCase.exposure}</strong></span>
        </div>
      </div>

      {toast && <div className="workspace-toast">{toast}</div>}

      {/* Pinned dossiers layout */}
      <div className="workspace-columns-container">
        
        {/* Left Side: Folder Dossier Queue */}
        <aside className="workspace-queue-column dossier-sheet">
          <span className="paper-pin" />
          <div className="column-title-bar">
            <span>Case Switcher</span>
          </div>
          <div className="queue-list">
            {CASES.map(c => (
              <div 
                key={c.id} 
                className={`queue-item-card ${activeCase.id === c.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveCase(c);
                  setSelectedNode(null);
                }}
              >
                <div className="queue-top">
                  <span className={`dot-status ${c.severity}`} />
                  <strong className="mono">#{c.id}</strong>
                </div>
                <span className="queue-title">{c.title}</span>
                <span className="queue-exp text-red">{c.exposure}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* Center: Thread Canvas Board */}
        <main className="explorer-graph-canvas-column dossier-sheet graph-canvas-panel">
          <span className="paper-pin" />
          <div className="column-title-bar">
            <span>Graph Interaction Space</span>
            <div className="canvas-filters">
              {['all', 'account', 'device', 'ip'].map(f => (
                <button
                  key={f}
                  className={`canvas-filter-btn ${filter === f ? 'active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? 'All' : f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          
          <div className="canvas-wrapper-stripe" ref={containerRef}>
            <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />
          </div>
        </main>

        {/* Right: Dossier Node Parameters Inspector */}
        <aside className="workspace-panel-column dossier-sheet">
          <span className="paper-pin" />
          <div className="column-title-bar">
            <span>Node Parameters</span>
          </div>

          {selectedNode ? (
            <div className="investigation-details animate-in">
              <header className="node-details-header">
                <span className="node-type-label">{selectedNode.type.toUpperCase()}</span>
                <h2>{selectedNode.id}</h2>
              </header>

              <section className="node-section-block">
                <h4>System Telemetry</h4>
                <div className="telemetry-info-row">
                  <span className="lbl">Risk Score</span>
                  <span className={`risk-badge-stripe ${selectedNode.risk >= 80 ? 'critical' : 'high'}`}>
                    {selectedNode.risk} / 100
                  </span>
                </div>
                {selectedNode.bank && (
                  <div className="telemetry-info-row">
                    <span className="lbl">Bank</span>
                    <span className="val bold">{selectedNode.bank}</span>
                  </div>
                )}
                {selectedNode.city && (
                  <div className="telemetry-info-row">
                    <span className="lbl">City</span>
                    <span className="val">{selectedNode.city}</span>
                  </div>
                )}
              </section>

              <section className="node-section-block">
                <h4>Feature Weight (SHAP Explanation)</h4>
                <div className="reasons-stack">
                  {activeCase.reasons.map((r, i) => (
                    <div className="reason-item-stripe" key={i}>
                      <div>
                        <strong>{r.type.toUpperCase()}</strong>
                        <p>{r.detail}</p>
                      </div>
                      <span className="weight-percent">{Math.round(r.weight * 100)}%</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="node-section-block">
                <h4>Audit History Log</h4>
                <div className="compact-timeline">
                  {activeCase.timeline.map((t, i) => (
                    <div className="timeline-item-row" key={i}>
                      <span className="time">{t.time}</span>
                      <span className="event">{t.event}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="node-section-actions">
                <button 
                  className="btn-action block" 
                  onClick={() => triggerToast(`Node ${selectedNode.id} blocked successfully`)}
                >
                  Block Wallet Entity
                </button>
                <button 
                  className="btn-action review" 
                  onClick={() => triggerToast(`Entity flag raised under review queue`)}
                >
                  Escalate Case Review
                </button>
              </section>
            </div>
          ) : (
            <div className="node-empty-state">
              <span>Select any node on the graph canvas to inspect parameters.</span>
            </div>
          )}
        </aside>

      </div>

    </div>
  );
}
