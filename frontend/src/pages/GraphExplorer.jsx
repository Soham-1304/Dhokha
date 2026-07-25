import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import * as d3 from 'd3';
import {
  connectEventStream,
  getSubgraph,
  injectSwarm,
  resetDemo,
} from '../api/client';
import './GraphExplorer.css';

const SWARMS = [
  { id: 'A', label: 'Type A — Identity Fan-Out', desc: 'Single identity controlling accounts across 3+ banks' },
  { id: 'B', label: 'Type B — Mule Collector Fan-In', desc: 'Multiple victim accounts funneling into 1 mule wallet' },
  { id: 'C', label: 'Type C — Layering Chain', desc: 'Rapid multi-hop transfers obscuring origin' },
  { id: 'D', label: 'Type D — Shared Device Cluster', desc: '1 hardware emulator executing for 8 accounts' },
];

function getNodeType(node) {
  const id = String(node.id || '').toUpperCase();
  const rawType = String(node.node_type || '').toLowerCase();
  if (rawType === 'device' || id.startsWith('DEV') || id.includes('DEVICE') || /^D-[A-F0-9]+/i.test(id)) return 'device';
  if (rawType === 'ip' || id.startsWith('IP') || id.includes('.') || /^\d+\.\d+/.test(id)) return 'ip';
  if (id.includes('MULE') || id.includes('OUT') || id.includes('CASHOUT') || id === 'ACC-000') return 'mule';
  if (rawType === 'merchant' || id.includes('MERCHANT') || id.includes('RAZORPAY')) return 'merchant';
  return 'account';
}

function formatNodeLabel(id) {
  if (!id) return '';
  const str = String(id);
  if (str.startsWith('ACC-DEMO-')) {
    const parts = str.split('-');
    if (parts.length >= 4) {
      return `${parts[2]}-${parts[3] || parts[parts.length - 1]}`;
    }
  }
  return str.split('@')[0];
}

function normalizeGraph(graph) {
  return {
    nodes: graph.nodes.map(node => ({
      ...node,
      type: getNodeType(node),
      label: formatNodeLabel(node.id),
      bank: node.bank_id,
      risk: Math.round((node.risk || 0) * 100),
    })),
    edges: graph.edges.map(edge => ({ ...edge })),
  };
}

export default function GraphExplorer() {
  const location = useLocation();
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  const [selectedSwarmType, setSelectedSwarmType] = useState('B');
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [accountId, setAccountId] = useState(location.state?.txn?.receiver_account_id || location.state?.txn?.receiver_upi || 'ACC-000');
  const [operation, setOperation] = useState('');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [toast, setToast] = useState('');

  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const loadGraph = useCallback(async (targetAccountId) => {
    const requestedAccount = targetAccountId.trim();
    if (!requestedAccount) return;
    setOperation('Loading graph');
    setError('');
    try {
      const response = await getSubgraph(requestedAccount, 2);
      setGraph(normalizeGraph(response));
      setAccountId(requestedAccount);
      setSelectedNode(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setOperation('');
    }
  }, []);

  // Initial load
  useEffect(() => {
    let active = true;
    const initialAcc = location.state?.txn?.receiver_account_id || location.state?.txn?.receiver_upi || 'ACC-000';
    getSubgraph(initialAcc, 2)
      .then(graphResponse => {
        if (!active) return;
        setGraph(normalizeGraph(graphResponse));
      })
      .catch(requestError => {
        if (active) setError(requestError.message);
      });
    return () => {
      active = false;
    };
  }, [location.state]);

  // WebSocket Event Stream
  useEffect(() => {
    const socket = connectEventStream({
      onEvent: event => {
        if (event.event_type === 'swarm_confirmed') {
          triggerToast(`⚡ Swarm Event Received: ${event.payload?.swarm_type || 'Attack'}`);
        }
      },
    });
    return () => socket.close();
  }, []);

  // D3 Visualization
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || graph.nodes.length === 0) return;

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

    // Defs for glowing dropshadows & halos
    const defs = svg.append('defs');
    const filterGlow = defs.append('filter')
      .attr('id', 'shadow-glow')
      .attr('width', '160%')
      .attr('height', '160%');
    filterGlow.append('feDropShadow')
      .attr('dx', 0)
      .attr('dy', 2)
      .attr('stdDeviation', 3)
      .attr('flood-opacity', 0.5)
      .attr('flood-color', '#000000');

    // Distinct Node Color Palette:
    // mule: Red (#e5484d), device: Amber (#f5a623), ip: Violet (#818cf8), account: Blue (#38bdf8), merchant: Green (#3fb67f)
    const colorMap = {
      mule: '#e5484d',
      device: '#f5a623',
      ip: '#818cf8',
      account: '#38bdf8',
      merchant: '#3fb67f',
    };

    let graphNodes = graph.nodes.map(d => ({ ...d }));
    let graphEdges = graph.edges.map(d => ({ ...d }));

    if (filter !== 'all') {
      graphNodes = graphNodes.filter(n => n.type === filter);
      const nodeIds = new Set(graphNodes.map(n => n.id));
      graphEdges = graphEdges.filter(e => nodeIds.has(e.source) || nodeIds.has(e.target));
    }

    const simulation = d3.forceSimulation(graphNodes)
      .force('link', d3.forceLink(graphEdges).id(d => d.id).distance(195))
      .force('charge', d3.forceManyBody().strength(-520))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(48));

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

    // Outer Halo Ring for Mule / Collector Targets
    node.filter(d => d.type === 'mule')
      .append('circle')
      .attr('r', 18)
      .attr('fill', 'none')
      .attr('stroke', '#e5484d')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4 3')
      .attr('opacity', 0.8);

    // Node Body
    node.append('circle')
      .attr('r', d => (selectedNode && selectedNode.id === d.id ? 14 : d.type === 'device' ? 12 : 10))
      .attr('fill', d => colorMap[d.type] || '#38bdf8')
      .attr('stroke', 'var(--bg)')
      .attr('stroke-width', d => (selectedNode && selectedNode.id === d.id ? 2.5 : 1.5))
      .attr('filter', 'url(#shadow-glow)')
      .style('cursor', 'pointer');

    // Inner Pin Center Dot
    node.append('circle')
      .attr('r', 2)
      .attr('fill', '#ffffff');

    // Node Type Badge Indicator Text
    node.append('text')
      .text(d => d.label || d.id)
      .attr('x', 18)
      .attr('y', 4)
      .attr('fill', 'var(--text)')
      .attr('font-size', '10px')
      .attr('font-weight', '600')
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

    if (!selectedNode && graphNodes.length > 0) {
      setSelectedNode(graphNodes[0]);
    }

    return () => simulation.stop();
  }, [graph, filter, selectedNode]);

  const handleSimulateSwarm = async () => {
    setOperation(`Simulating Swarm ${selectedSwarmType}`);
    setError('');
    try {
      const scenario = await injectSwarm(selectedSwarmType, 5);
      triggerToast(`⚡ Simulated Swarm Type ${selectedSwarmType} (${scenario.transactions_generated} txns)`);
      
      const targetAcc = scenario.account_ids?.[scenario.account_ids.length - 1] || scenario.account_ids?.[0] || 'ACC-000';
      await loadGraph(targetAcc);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setOperation('');
    }
  };

  const handleReset = async () => {
    setOperation('Resetting graph dataset');
    setError('');
    try {
      await resetDemo();
      triggerToast('Backend graph dataset reset to baseline');
      const graphResponse = await getSubgraph('ACC-000', 2);
      setGraph(normalizeGraph(graphResponse));
      setAccountId('ACC-000');
      setSelectedNode(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setOperation('');
    }
  };

  return (
    <div className="explorer-layout dark-operations-board animate-in">

      {toast && <div className="workspace-toast">{toast}</div>}

      {/* Pinned dossiers layout */}
      <div className="workspace-columns-container">
        
        {/* Left Side: Clean Swarm Simulator Controls */}
        <aside className="workspace-queue-column dossier-sheet">
          <span className="paper-pin" />
          <div className="column-title-bar">
            <span>Swarm Attack Simulator</span>
          </div>

          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Select a fraud typology below to generate live cross-bank attack transactions through the backend engine:
            </div>

            {/* 4 Swarm Typology Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SWARMS.map(swarm => (
                <div
                  key={swarm.id}
                  onClick={() => setSelectedSwarmType(swarm.id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: `1px solid ${selectedSwarmType === swarm.id ? 'var(--string)' : 'var(--border)'}`,
                    background: selectedSwarmType === swarm.id ? 'var(--string-bg)' : 'var(--bg-surface)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <strong style={{ fontSize: 11, color: selectedSwarmType === swarm.id ? 'var(--string)' : 'var(--text)' }}>
                      {swarm.label}
                    </strong>
                    <input
                      type="radio"
                      name="swarm_type"
                      checked={selectedSwarmType === swarm.id}
                      onChange={() => setSelectedSwarmType(swarm.id)}
                      style={{ cursor: 'pointer', accentColor: 'var(--string)' }}
                    />
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.3 }}>
                    {swarm.desc}
                  </div>
                </div>
              ))}
            </div>

            {/* Simulate Trigger Button */}
            <button
              className="btn btn-primary"
              style={{ padding: '12px', width: '100%', fontSize: 12, fontWeight: 700, marginTop: 4 }}
              disabled={Boolean(operation)}
              onClick={handleSimulateSwarm}
            >
              {operation ? operation : `⚡ SIMULATE TYPE ${selectedSwarmType} ATTACK`}
            </button>

            {/* Reset Button */}
            <button
              className="canvas-filter-btn"
              style={{ padding: '8px', width: '100%', textAlign: 'center', justifyContent: 'center', borderColor: 'var(--border)' }}
              disabled={Boolean(operation)}
              onClick={handleReset}
            >
              ↺ Reset DB Baseline
            </button>
          </div>

          {/* Color Legend */}
          <div className="column-title-bar" style={{ marginTop: 'auto' }}>
            <span>Graph Node Legend</span>
          </div>
          <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 10, background: 'var(--surface-quiet)' }}>
            <span><span style={{ color: '#e5484d' }}>●</span> Mule Target</span>
            <span><span style={{ color: '#f5a623' }}>●</span> Hardware Device</span>
            <span><span style={{ color: '#818cf8' }}>●</span> IP Endpoint</span>
            <span><span style={{ color: '#38bdf8' }}>●</span> User Account</span>
          </div>
        </aside>

        {/* Center: Thread Canvas Board */}
        <main className="explorer-graph-canvas-column dossier-sheet graph-canvas-panel">
          <span className="paper-pin" />
          <div className="column-title-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>Graph Neighborhood</span>
              <form
                onSubmit={e => {
                  e.preventDefault();
                  loadGraph(accountId);
                }}
                style={{ display: 'flex', gap: 4 }}
              >
                <input
                  aria-label="Account ID"
                  value={accountId}
                  onChange={e => setAccountId(e.target.value)}
                  placeholder="ACC-000"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    color: 'var(--text)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    padding: '2px 6px',
                    width: 100,
                  }}
                />
                <button
                  type="submit"
                  disabled={Boolean(operation)}
                  className="canvas-filter-btn active"
                >
                  Load
                </button>
              </form>
            </div>

            <div className="canvas-filters">
              {['all', 'account', 'device', 'mule', 'ip'].map(f => (
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
            {graph.nodes.length > 0 ? (
              <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />
            ) : (
              <div className="node-empty-state">
                {operation || 'No graph nodes found for this account. Try searching ACC-000 or ACC-005.'}
              </div>
            )}
          </div>
        </main>

        {/* Right: Dossier Node Parameters Inspector */}
        <aside className="workspace-panel-column dossier-sheet">
          <span className="paper-pin" />
          <div className="column-title-bar">
            <span>Node Parameters</span>
          </div>

          {error && (
            <div style={{ padding: 12, color: 'var(--string)', fontSize: 11, background: 'var(--string-bg)' }}>
              {error}
            </div>
          )}

          {selectedNode ? (
            <div className="investigation-details animate-in">
              <header className="node-details-header">
                <span className="node-type-label">{(selectedNode.type || 'ACCOUNT').toUpperCase()}</span>
                <h2>{selectedNode.id}</h2>
              </header>

              <section className="node-section-block">
                <h4>System Telemetry</h4>
                <div className="telemetry-info-row">
                  <span className="lbl">Risk Score</span>
                  <span className={`risk-badge-stripe ${selectedNode.risk >= 80 ? 'critical' : selectedNode.risk >= 50 ? 'high' : 'low'}`}>
                    {selectedNode.risk || 50} / 100
                  </span>
                </div>
                {selectedNode.bank && (
                  <div className="telemetry-info-row">
                    <span className="lbl">Bank</span>
                    <span className="val bold">{selectedNode.bank}</span>
                  </div>
                )}
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
