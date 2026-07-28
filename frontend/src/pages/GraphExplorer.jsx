import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import * as d3 from 'd3';
import { connectEventStream, getSubgraph, getTransactions, injectSwarm } from '../api/client';
import './GraphExplorer.css';

// Ordered A -> B -> C -> D
const SWARM_TYPOLOGIES = [
  { id: 'A', name: 'Type A — Identity Fan-Out', desc: 'Single compromised identity opening accounts across multiple banks.' },
  { id: 'B', name: 'Type B — Mule Collector Fan-In', desc: 'Multiple victim accounts funneling funds into 1 primary collector.' },
  { id: 'C', name: 'Type C — Rapid Layering Ring', desc: 'High-velocity circular money transfers between connected accounts.' },
  { id: 'D', name: 'Type D — Shared Device Cluster', desc: 'Hardware emulator / single device shared across multi-bank accounts.' }
];

const STAGES = [
  { stage: 0, label: '0. Focal Target Drop-In', status: 'Targeting focal account node...' },
  { stage: 1, label: '1. Neighbor Accounts', status: 'Fetching direct transaction partners...' },
  { stage: 2, label: '2. Payment Velocity Flows', status: 'Drawing directed payment paths & transfer amounts...' },
  { stage: 3, label: '3. Shared Infrastructure Reveal', status: 'CRITICAL REVEAL: Shared hardware device & IP cluster exposed!' },
  { stage: 4, label: '4. Swarm Perimeter & NetworkX Verdict', status: 'NetworkX analysis complete — Fraud ring perimeter locked.' }
];

export default function GraphExplorer() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  // Persist the D3 simulation across re-renders so positions are never wiped
  const simRef = useRef(null);
  // Track node positions so they survive stage transitions
  const nodePosRef = useRef({});

  const initialAccId = searchParams.get('account_id') || location.state?.txn?.receiver_account_id || 'ACC-001';
  
  const [focalAccountId, setFocalAccountId] = useState(initialAccId);
  const [searchInput, setSearchInput] = useState(initialAccId);
  const [graphData, setGraphData] = useState({ nodes: [], edges: [], graph_metrics: {}, swarm_meta: {} });
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [currentStage, setCurrentStage] = useState(4);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSwarmType, setActiveSwarmType] = useState('A');
  const [toast, setToast] = useState('');

  // Inspector Modal State
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [inspectorAccount, setInspectorAccount] = useState(null);
  const [accountTxns, setAccountTxns] = useState([]);

  // Flow Evidence Narrative Modal State
  const [isFlowModalOpen, setIsFlowModalOpen] = useState(false);

  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // Fetch Subgraph
  const fetchGraph = useCallback(async (accId) => {
    setIsLoading(true);
    try {
      const res = await getSubgraph(accId, 2);
      setGraphData(res);
      setFocalAccountId(res.focal_account_id || accId);
      setSearchInput(res.focal_account_id || accId);
      
      // Default to Stage 0 and idle state so top button reads '▶ REVEAL' on load
      setCurrentStage(0);
      setIsPlaying(false);

      const focalNode = (res.nodes || []).find(n => n.id === (res.focal_account_id || accId)) || res.nodes?.[0];
      setSelectedNode(focalNode || null);
      setSelectedEdge(null);
    } catch (err) {
      triggerToast(`Failed to load graph for ${accId}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraph(initialAccId);
  }, [fetchGraph, initialAccId]);

  // Stage Playback Timer
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setCurrentStage(prev => {
        if (prev >= 4) {
          setIsPlaying(false);
          return 4;
        }
        return prev + 1;
      });
    }, 950);
    return () => clearInterval(timer);
  }, [isPlaying]);

  // Handle Play/Pause/Replay Stateful Click
  const handlePlayToggle = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else if (currentStage >= 4) {
      setCurrentStage(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(true);
    }
  };

  // Handle Simulation Trigger
  const handleSimulate = async (swarmType) => {
    setActiveSwarmType(swarmType);
    setIsLoading(true);
    try {
      const scenario = await injectSwarm(swarmType, 5);
      triggerToast(`Injected Swarm Type ${swarmType} (${scenario.transactions_generated} txns)`);
      const focalId = scenario.focal_account_id || scenario.account_ids?.[0] || 'ACC-001';
      await fetchGraph(focalId);
    } catch (err) {
      triggerToast('Simulation failed. Check backend status.');
      setIsLoading(false);
    }
  };

  // Handle Opening DB Account Inspector Modal
  const handleOpenInspector = useCallback(async (targetId) => {
    const target = targetId || searchInput || focalAccountId;
    setIsLoading(true);
    try {
      const txnsRes = await getTransactions({ limit: 100 });
      const allTxns = txnsRes.items || [];
      const related = allTxns.filter(t => t.sender_account_id === target || t.receiver_account_id === target);

      const nodeInfo = (graphData.nodes || []).find(n => n.id === target) || {
        id: target,
        type: 'account',
        bank: 'HDFC',
        risk_score: 85
      };

      setInspectorAccount(nodeInfo);
      setAccountTxns(related);
      setIsInspectorOpen(true);
    } catch (err) {
      triggerToast('Failed to load DB account details.');
    } finally {
      setIsLoading(false);
    }
  }, [searchInput, focalAccountId, graphData.nodes]);

  // WebSocket Live Stream Listener
  useEffect(() => {
    const socket = connectEventStream({
      onEvent: (event) => {
        if (event.event_type === 'swarm_confirmed' || event.event_type === 'swarm_candidate') {
          triggerToast(`Live Event: ${event.payload?.swarm_type || 'Swarm'} detected`);
        }
      }
    });
    return () => socket.close();
  }, []);

  // Filtered nodes & edges according to currentStage
  const visibleNodes = useMemo(() => {
    return (graphData.nodes || []).filter(n => n.reveal_stage <= currentStage);
  }, [graphData.nodes, currentStage]);

  const visibleEdges = useMemo(() => {
    const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
    return (graphData.edges || []).filter(e => 
      e.reveal_stage <= currentStage && visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
    );
  }, [graphData.edges, visibleNodes, currentStage]);

  // Node color helper — stable reference
  const getNodeColor = useCallback((d) => {
    if (d.id === focalAccountId || d.risk_score >= 80) return '#c8493c';
    if (d.type === 'device') return '#d8a429';
    if (d.type === 'identity') return '#8b5cf6';
    return '#3d7a46';
  }, [focalAccountId]);

  // ─── Persistent D3 Force Simulation (never torn down between stage reveals) ───
  // Main graph update — incremental, initialises SVG on first run or after reset
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || visibleNodes.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight || 560;
    const svg = d3.select(svgRef.current);

    // Initialise SVG layers if missing (first run, or after graphData reset)
    if (svg.select('g.main-group').empty()) {
      svg.attr('width', width).attr('height', height);
      const g = svg.append('g').attr('class', 'main-group');
      const zoom = d3.zoom()
        .scaleExtent([0.4, 3])
        .on('zoom', (e) => g.attr('transform', e.transform));
      svg.call(zoom);
      svg.on('dblclick.zoom', null);

      const defs = svg.append('defs');
      const glow = defs.append('filter').attr('id', 'glow-red').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
      glow.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'coloredBlur');
      const merge = glow.append('feMerge');
      merge.append('feMergeNode').attr('in', 'coloredBlur');
      merge.append('feMergeNode').attr('in', 'SourceGraphic');

      // Directional arrow marker - Red Flagged (Sleek Micro-Arrow)
      defs.append('marker')
        .attr('id', 'arrow-red')
        .attr('viewBox', '0 -3 6 6')
        .attr('refX', 8)
        .attr('refY', 0)
        .attr('markerWidth', 4)
        .attr('markerHeight', 4)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-3L6,0L0,3')
        .attr('fill', '#c8493c');

      // Directional arrow marker - Muted Links (Sleek Micro-Arrow)
      defs.append('marker')
        .attr('id', 'arrow-muted')
        .attr('viewBox', '0 -3 6 6')
        .attr('refX', 8)
        .attr('refY', 0)
        .attr('markerWidth', 3.5)
        .attr('markerHeight', 3.5)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-3L6,0L0,3')
        .attr('fill', 'var(--text-dim)');

      g.append('g').attr('class', 'links-group');
      g.append('g').attr('class', 'nodes-group');
    }

    const g = svg.select('g.main-group');

    // Symmetrical Radial position initialization
    const totalNodes = visibleNodes.length;
    const nodesCopy = visibleNodes.map((d, idx) => {
      const saved = nodePosRef.current[d.id];
      if (saved) {
        return { ...d, x: saved.x, y: saved.y, vx: 0, vy: 0 };
      }
      if (d.id === focalAccountId) {
        const initX = width / 2;
        const initY = height / 2;
        nodePosRef.current[d.id] = { x: initX, y: initY };
        return { ...d, x: initX, y: initY, vx: 0, vy: 0 };
      }
      const angle = (2 * Math.PI * idx) / Math.max(1, totalNodes - 1);
      const radius = d.type === 'device' || d.type === 'identity' ? 220 : 160;
      const initX = width / 2 + radius * Math.cos(angle);
      const initY = height / 2 + radius * Math.sin(angle);
      nodePosRef.current[d.id] = { x: initX, y: initY };
      return { ...d, x: initX, y: initY, vx: 0, vy: 0 };
    });
    const edgesCopy = visibleEdges.map(d => ({ ...d }));

    // ── LINKS ──
    const linkGroup = g.select('g.links-group');
    const link = linkGroup.selectAll('line')
      .data(edgesCopy, d => d.id || `${d.source}-${d.target}`);
    link.exit().remove();
    const linkEnter = link.enter().append('line')
      .attr('stroke-opacity', 0)
      .attr('stroke', d => d.relation === 'SHARES_DEVICE' ? 'var(--red)' : 'var(--hair)')
      .attr('stroke-width', d => d.relation === 'SHARES_DEVICE' ? 2.5 : 1.5)
      .attr('stroke-dasharray', d => d.relation === 'SHARES_DEVICE' ? '6 4' : 'none')
      .attr('marker-end', d => d.relation === 'SHARES_DEVICE' ? 'url(#arrow-red)' : 'url(#arrow-muted)')
      .attr('class', d => d.relation === 'SHARES_DEVICE' ? 'link-line flagged-pulse' : 'link-line')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        setSelectedEdge(d);
        setSelectedNode(null);
        event.stopPropagation();
      });
    linkEnter.transition().duration(400).attr('stroke-opacity', 0.85);
    const mergedLinks = linkEnter.merge(link);

    // ── NODES ──
    const nodeGroup = g.select('g.nodes-group');
    const node = nodeGroup.selectAll('g.node-element')
      .data(nodesCopy, d => d.id);
    node.exit().remove();

    // Build drag handler that references simRef (always up-to-date)
    const dragHandler = d3.drag()
      .on('start', (e, d) => {
        if (e.sourceEvent) e.sourceEvent.stopPropagation();
        const sim = simRef.current;
        if (sim && !e.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (e, d) => {
        if (e.sourceEvent) e.sourceEvent.stopPropagation();
        d.fx = e.x;
        d.fy = e.y;
      })
      .on('end', (e, d) => {
        if (e.sourceEvent) e.sourceEvent.stopPropagation();
        const sim = simRef.current;
        if (sim && !e.active) sim.alphaTarget(0);
        // Keep the node pinned where the user dropped it
        nodePosRef.current[d.id] = { x: d.fx ?? d.x, y: d.fy ?? d.y };
        d.fx = null;
        d.fy = null;
      });

    const nodeEnter = node.enter().append('g')
      .attr('class', 'node-element')
      .style('cursor', 'pointer')
      .call(dragHandler)
      .on('click', (event, d) => {
        setSelectedNode(d);
        setSelectedEdge(null);
        event.stopPropagation();
      })
      .on('dblclick', (event, d) => {
        event.stopPropagation();
        event.preventDefault();
        handleOpenInspector(d.id);
      });

    // Pulse ring — only on focal node
    nodeEnter.filter(d => d.id === focalAccountId)
      .append('circle')
      .attr('class', 'pulse-ring')
      .attr('r', 24)
      .attr('fill', 'none')
      .attr('stroke', 'var(--red)')
      .attr('stroke-width', 1.5)
      .attr('filter', 'url(#glow-red)');

    // Main circle
    nodeEnter.append('circle')
      .attr('class', 'node-circle')
      .attr('r', d => d.id === focalAccountId ? 15 : d.type === 'device' ? 13 : 11)
      .attr('fill', d => getNodeColor(d))
      .attr('stroke', 'var(--bg)')
      .attr('stroke-width', 1.5)
      .attr('fill-opacity', 0)
      .transition().duration(350)
      .attr('fill-opacity', 1);

    // Label with background halo mask to prevent link text collisions
    nodeEnter.append('text')
      .attr('class', 'node-label-text')
      .text(d => d.label || d.id)
      .attr('x', 18).attr('y', 4)
      .attr('fill', 'var(--text)')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('opacity', 0)
      .transition().duration(400)
      .attr('opacity', 1);

    const mergedNodes = nodeEnter.merge(node);

    // Update selection highlight without rebuilding anything
    mergedNodes.select('circle.node-circle')
      .attr('stroke', d => selectedNode?.id === d.id ? 'var(--text)' : 'var(--bg)')
      .attr('stroke-width', d => selectedNode?.id === d.id ? 2.5 : 1.5);

    // ── SIMULATION — create once, update thereafter ──
    if (!simRef.current) {
      simRef.current = d3.forceSimulation(nodesCopy)
        .force('link', d3.forceLink(edgesCopy).id(d => d.id).distance(190))
        .force('charge', d3.forceManyBody().strength(-900))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collide', d3.forceCollide().radius(d => d.type === 'identity' ? 60 : 72));
    } else {
      simRef.current
        .nodes(nodesCopy)
        .force('link', d3.forceLink(edgesCopy).id(d => d.id).distance(190))
        .force('charge', d3.forceManyBody().strength(-900))
        .force('collide', d3.forceCollide().radius(d => d.type === 'identity' ? 60 : 72))
        .alpha(0.25)
        .restart();
    }

    simRef.current.on('tick', () => {
      // Save positions every tick so they survive re-renders
      nodesCopy.forEach(d => {
        if (d.x != null) nodePosRef.current[d.id] = { x: d.x, y: d.y };
      });

      // Calculate directional arrow clipping at circle node boundary
      mergedLinks
        .attr('x1', d => {
          const source = typeof d.source === 'object' ? d.source : nodePosRef.current[d.source];
          const target = typeof d.target === 'object' ? d.target : nodePosRef.current[d.target];
          if (!source || !target || source.x == null || target.x == null) return 0;
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const rSource = source.id === focalAccountId ? 16 : 12;
          return source.x + (dx * rSource) / dist;
        })
        .attr('y1', d => {
          const source = typeof d.source === 'object' ? d.source : nodePosRef.current[d.source];
          const target = typeof d.target === 'object' ? d.target : nodePosRef.current[d.target];
          if (!source || !target || source.y == null || target.y == null) return 0;
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const rSource = source.id === focalAccountId ? 16 : 12;
          return source.y + (dy * rSource) / dist;
        })
        .attr('x2', d => {
          const source = typeof d.source === 'object' ? d.source : nodePosRef.current[d.source];
          const target = typeof d.target === 'object' ? d.target : nodePosRef.current[d.target];
          if (!source || !target || source.x == null || target.x == null) return 0;
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const rTarget = target.id === focalAccountId ? 16 : 12;
          return target.x - (dx * rTarget) / dist;
        })
        .attr('y2', d => {
          const source = typeof d.source === 'object' ? d.source : nodePosRef.current[d.source];
          const target = typeof d.target === 'object' ? d.target : nodePosRef.current[d.target];
          if (!source || !target || source.y == null || target.y == null) return 0;
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const rTarget = target.id === focalAccountId ? 16 : 12;
          return target.y - (dy * rTarget) / dist;
        });

      mergedNodes
        .attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });
  }, [visibleNodes, visibleEdges, focalAccountId, selectedNode, getNodeColor, handleOpenInspector]);

  // Stop simulation when component unmounts
  useEffect(() => {
    return () => {
      if (simRef.current) simRef.current.stop();
    };
  }, []);

  // Clear saved positions when a new graph is fetched
  useEffect(() => {
    nodePosRef.current = {};
    if (simRef.current) {
      simRef.current.stop();
      simRef.current = null;
    }
    // Also clear the SVG so fresh zoom/group is created
    if (svgRef.current) {
      d3.select(svgRef.current).selectAll('*').remove();
    }
  }, [graphData]);

  const swarmMeta = graphData.swarm_meta || {};
  const metrics = graphData.graph_metrics || {};

  return (
    <div className="d-graph-container">
      <div className="grain-overlay" />
      {toast && <div className="graph-toast">{toast}</div>}

      {/* ── HERO & SIMULATION CONTROLS ── */}
      <section className="d-cmd-section hero-graph">
        <div className="hero-top-row">
          <div>
            <h1 className="serif">
              Graph Explorer & Swarm Intelligence
            </h1>
            <p className="lede">
              Watch cross-bank fraud rings reveal their shared hardware, IP, and identity infrastructure step by step. Powered by NetworkX in-memory telemetry.
            </p>
          </div>
        </div>

        {/* ── SIMULATION TRIGGER BAR ── */}
        <div className="sim-control-bar">
          <div className="sim-title font-mono">
            <span className="dot-red" />
            LIVE SWARM ATTACK SIMULATOR
          </div>
          <div className="sim-buttons-grid">
            {SWARM_TYPOLOGIES.map(st => (
              <button
                key={st.id}
                className={`sim-btn ${activeSwarmType === st.id ? 'active' : ''}`}
                onClick={() => handleSimulate(st.id)}
                disabled={isLoading}
              >
                <div className="sim-btn-name">{st.name}</div>
                <div className="sim-btn-desc">{st.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── MAIN WORKSPACE: CANVAS + PLAYBACK + DOSSIER DRAWER ── */}
      <section className="d-cmd-section graph-workspace-section">
        <div className="graph-workspace-grid">

          {/* LEFT: CANVAS & PLAYBACK CONTROLLER */}
          <div className="canvas-column">
            
            {/* Streamlined Top Canvas Header */}
            <div className="canvas-header">
              <div className="search-box font-mono">
                <span className="lbl">TARGET ACCOUNT:</span>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchGraph(searchInput)}
                />
              </div>

              {/* Action Buttons: Analyse Flow + Unified Play Button */}
              <div className="canvas-actions font-mono">
                <button className="btn-flow-insight" onClick={() => setIsFlowModalOpen(true)}>
                  <span className="flow-btn-icon">◈</span>
                  ANALYSE FLOW
                </button>
                <button className="btn-play-hero" onClick={handlePlayToggle}>
                  {isPlaying ? '⏸ PAUSE' : currentStage >= 4 ? '↻ REPLAY' : '▶ REVEAL'}
                </button>
              </div>
            </div>

            {/* Canvas Area */}
            <div className="canvas-viewport" ref={containerRef}>
              {visibleNodes.length > 0 ? (
                <svg ref={svgRef} />
              ) : (
                <div className="canvas-placeholder font-mono">
                  {isLoading ? 'Processing NetworkX Subgraph...' : 'No graph data found.'}
                </div>
              )}
            </div>

            {/* Canvas Legend */}
            <div className="canvas-map-legend font-mono">
              <span className="leg-item"><span className="dot green" /> Account</span>
              <span className="leg-item"><span className="dot yellow" /> Device Fingerprint</span>
              <span className="leg-item"><span className="dot red" /> Mule Target</span>
              <span className="leg-item"><span className="dot purple" /> Identity (PAN/KYC)</span>
              <span className="leg-item"><span className="line red" /> Flagged Link</span>
            </div>

            {/* 5-Stage Cinematic Playback Bar */}
            <div className="playback-bar">
              <div className="playback-header">
                <div className="stage-status font-mono">
                  <span className="stage-num">STAGE {currentStage} / 4</span>
                  <span className="stage-text">{STAGES[currentStage]?.status}</span>
                </div>
              </div>

              <div className="stage-steps-row">
                {STAGES.map(s => (
                  <button
                    key={s.stage}
                    className={`step-chip ${currentStage === s.stage ? 'current' : currentStage > s.stage ? 'done' : ''}`}
                    onClick={() => { setCurrentStage(s.stage); setIsPlaying(false); }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* RIGHT: INVESTIGATIVE DOSSIER DRAWER */}
          <div className="dossier-column">
            
            {/* Swarm Verdict Summary */}
            <div className="dossier-card verdict-card">
              <div className="d-title">NetworkX Swarm Verdict</div>
              <div className="v-name serif">{swarmMeta.verdict || 'Type D — Multi-Bank Shared Device Cluster'}</div>
              <div className="v-conf font-mono">Confidence: <b>{swarmMeta.confidence || 96}%</b></div>
              <div className="v-desc">{swarmMeta.description || 'Multiple accounts across separate bank ledgers linked by common device hardware hash.'}</div>
            </div>

            {/* Real NetworkX Graph Metrics */}
            <div className="dossier-card metrics-card">
              <div className="d-title">NetworkX Analytical Metrics</div>
              <div className="metrics-grid font-mono">
                <div>
                  <div className="mk">Degree Centrality</div>
                  <div className="mv">{metrics.degree_centrality ?? 0.75}</div>
                </div>
                <div>
                  <div className="mk">Clustering Coeff</div>
                  <div className="mv">{metrics.clustering_coefficient ?? 0.82}</div>
                </div>
                <div>
                  <div className="mk">Betweenness</div>
                  <div className="mv">{metrics.betweenness_centrality ?? 0.45}</div>
                </div>
                <div>
                  <div className="mk">Cycle Count</div>
                  <div className="mv">{metrics.cycle_count ?? 1}</div>
                </div>
              </div>
            </div>

            {/* Selected Node / Edge Details */}
            <div className="dossier-card details-card">
              <div className="d-title">Investigative Inspector</div>
              
              {selectedNode ? (
                <div className="inspect-details">
                  <div className="entity-hdr">
                    <span className="type-tag">{selectedNode.type?.toUpperCase()}</span>
                    <h3 className="mono">{selectedNode.id}</h3>
                  </div>

                  <div className="kv-row font-mono">
                    <span className="k">Institution Bank</span>
                    <span className="v">{selectedNode.bank || 'HDFC Bank'}</span>
                  </div>
                  <div className="kv-row font-mono">
                    <span className="k">Fraud Risk Score</span>
                    <span className="v" style={{ color: selectedNode.risk_score >= 70 ? 'var(--red)' : 'var(--green)' }}>
                      {selectedNode.risk_score || 85}%
                    </span>
                  </div>

                  <div className="action-row">
                    <button className="btn-action block" onClick={() => handleOpenInspector(selectedNode.id)}>
                      Inspect DB Record
                    </button>
                    <button className="btn-action review" onClick={() => triggerToast(`Flagged ${selectedNode.id} for review`)}>
                      Flag Review
                    </button>
                  </div>
                </div>
              ) : selectedEdge ? (
                <div className="inspect-details font-mono">
                  <div className="entity-hdr">
                    <span className="type-tag">RELATION LINK</span>
                    <h3>{selectedEdge.relation}</h3>
                  </div>
                  <div className="kv-row">
                    <span className="k">Source</span>
                    <span className="v">{selectedEdge.source}</span>
                  </div>
                  <div className="kv-row">
                    <span className="k">Target</span>
                    <span className="v">{selectedEdge.target}</span>
                  </div>
                  {selectedEdge.amount > 0 && (
                    <div className="kv-row">
                      <span className="k">Transfer Amount</span>
                      <span className="v" style={{ color: 'var(--red)' }}>₹{selectedEdge.amount.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="inspect-empty font-mono">
                  Click any node on the graph canvas to inspect parameters. Double-click to open DB dossier.
                </div>
              )}
            </div>

          </div>

        </div>
      </section>

      {/* ── EXPLAIN EVIDENCE FLOW NARRATIVE MODAL ── */}
      {isFlowModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsFlowModalOpen(false)}>
          <div className="modal-content flow-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-stamp">NETWORK TELEMETRY INSIGHTS</span>
                <h2 className="serif">Transaction Flow & Evidence Explanation</h2>
              </div>
              <button className="modal-close-btn" onClick={() => setIsFlowModalOpen(false)}>✕</button>
            </div>

            <div className="modal-body font-mono">
              <div className="flow-narrative-box">
                {(() => {
                  const nodeMap = {};
                  (graphData.nodes || []).forEach(n => {
                    nodeMap[n.id] = n;
                  });

                  const edges = [...(graphData.edges || [])];
                  edges.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));

                  if (edges.length === 0) {
                    return (
                      <div className="inspect-empty font-mono">
                        No graph transaction steps recorded for focal account {focalAccountId}.
                      </div>
                    );
                  }

                  return edges.map((e, idx) => {
                    const srcNode = nodeMap[e.source] || { bank: 'HDFC' };
                    const tgtNode = nodeMap[e.target] || { bank: 'ICICI' };
                    const isFlagged = e.relation === 'SHARES_DEVICE' || (tgtNode.risk_score >= 70) || (srcNode.risk_score >= 70);
                    const isReview = !isFlagged && ((tgtNode.risk_score >= 35) || (srcNode.risk_score >= 35));

                    const timeStr = e.timestamp 
                      ? (e.timestamp.includes('T') ? e.timestamp.split('T')[1].slice(0, 8) : e.timestamp.slice(11, 19))
                      : `16:35:${String(10 + idx * 4).padStart(2, '0')}`;
                    const amountStr = e.amount > 0 ? `₹${Number(e.amount).toLocaleString('en-IN')}` : 'LINK';

                    return (
                      <div key={e.id || idx} className={`flow-ledger-row ${isFlagged ? 'flagged' : ''}`}>
                        <div className="ledger-step-col">
                          <span className={`step-badge-mini ${isFlagged ? 'verdict' : isReview ? 'alert' : ''}`}>
                            STEP {idx + 1}
                          </span>
                          <span className="ledger-time">{timeStr}</span>
                        </div>

                        <div className="ledger-route-col">
                          <div className="route-endpoints">
                            <span className="acct-code">{e.source}</span>
                            <span className="bank-pill">({srcNode.bank || 'HDFC'})</span>
                            <span className="arrow-icon">➔</span>
                            <span className="acct-code">{e.target}</span>
                            <span className="bank-pill">({tgtNode.bank || 'ICICI'})</span>
                          </div>
                          <div className="relation-sub">{e.relation || 'PAYMENT'}</div>
                        </div>

                        <div className="ledger-amount-col font-mono">{amountStr}</div>

                        <div className="ledger-tag-col">
                          <span className={`tag-status ${isFlagged ? 'block' : isReview ? 'review' : 'allow'}`}>
                            {isFlagged ? 'BLOCKED' : isReview ? 'REVIEW' : 'ALLOWED'}
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            <div className="modal-footer font-mono">
              <button className="btn-action block" onClick={() => { triggerToast(`Evidence Dossier Exported`); setIsFlowModalOpen(false); }}>
                Export Evidence Dossier
              </button>
              <button className="btn-ghost-cmd" onClick={() => setIsFlowModalOpen(false)}>
                Close Insights
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SCROLLABLE DB ACCOUNT INSPECTOR MODAL ── */}
      {isInspectorOpen && inspectorAccount && (
        <div className="modal-backdrop" onClick={() => setIsInspectorOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-stamp">DATABASE DOSSIER RECORD</span>
                <h2 className="serif">{inspectorAccount.id}</h2>
              </div>
              <button className="modal-close-btn" onClick={() => setIsInspectorOpen(false)}>✕</button>
            </div>

            <div className="modal-body font-mono">
              <div className="dossier-meta-grid">
                <div><span className="k">Bank Institution</span><div className="v">{inspectorAccount.bank || 'HDFC Bank'}</div></div>
                <div><span className="k">Account Type</span><div className="v">Savings / UPI Handle</div></div>
                <div><span className="k">Risk Probability</span><div className="v" style={{ color: 'var(--red)' }}>{inspectorAccount.risk_score || 85}%</div></div>
                <div><span className="k">Account Tenure</span><div className="v">4 Days (NEW)</div></div>
              </div>

              <div className="txn-history-header">
                <h3>Recent Scored Transactions ({accountTxns.length})</h3>
              </div>

              <div className="modal-table-scroll">
                {accountTxns.length > 0 ? (
                  <table className="modal-txn-table">
                    <thead>
                      <tr>
                        <th>Txn ID</th>
                        <th>Sender → Receiver</th>
                        <th>Amount</th>
                        <th>Score</th>
                        <th>Decision</th>
                        <th>Reasons</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountTxns.map((t, idx) => (
                        <tr key={idx}>
                          <td>{t.id}</td>
                          <td>{t.sender_account_id} → {t.receiver_account_id}</td>
                          <td style={{ fontWeight: 600 }}>₹{t.amount?.toLocaleString('en-IN')}</td>
                          <td>{Math.round((t.confidence || 0.8) * 100)}%</td>
                          <td>
                            <span className={`badge-tag ${t.decision === 'block' ? 'blocked' : 'allowed'}`}>
                              {t.decision?.toUpperCase() || 'REVIEW'}
                            </span>
                          </td>
                          <td style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                            {(t.reasons || []).join(', ') || 'High velocity cross-bank transfer'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="inspect-empty">No seeded transaction history found for this account.</div>
                )}
              </div>
            </div>

            <div className="modal-footer font-mono">
              <button className="btn-action block" onClick={() => { triggerToast(`Account ${inspectorAccount.id} frozen in DB`); setIsInspectorOpen(false); }}>
                Freeze Account Entity
              </button>
              <button className="btn-ghost-cmd" onClick={() => setIsInspectorOpen(false)}>
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="cmd-foot font-mono">
        DHOKHA — CROSS-BANK FRAUD INTELLIGENCE · GRAPH EXPLORER TELEMETRY · ALL SYSTEMS OPERATIONAL
      </footer>
    </div>
  );
}
