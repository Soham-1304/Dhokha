import { useEffect, useRef, useCallback, useState } from 'react';
import {
  forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide,
} from 'd3-force';
import { useDashboardStore } from '../../store/dashboardStore';
import { BANK_COLORS } from '../../api/mock/graphData';
import { Network } from 'lucide-react';

const STATE_COLORS = { safe: null, flagged: '#f59e0b', swarm: '#e5484d' };

const NODE_RADII = { device: 12, mule: 13, identity: 11, account: 8 };

export default function ForceGraph() {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const simRef = useRef(null);
  const animRef = useRef(null);
  const nodesRef = useRef([]);
  const linksRef = useRef([]);

  const { graphNodes, graphLinks, nodeStates, pulsedEdges, activeSwarm, setSelectedNode } = useDashboardStore();

  const [dims, setDims] = useState({ w: 600, h: 400 });
  const [hoveredNode, setHoveredNode] = useState(null);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setDims({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setDims({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Build / rebuild simulation when graph changes
  useEffect(() => {
    if (simRef.current) simRef.current.stop();
    if (animRef.current) cancelAnimationFrame(animRef.current);

    if (!graphNodes.length) {
      nodesRef.current = [];
      linksRef.current = [];
      return;
    }

    const nodes = graphNodes.map(n => ({ ...n, x: dims.w / 2 + (Math.random() - 0.5) * 80, y: dims.h / 2 + (Math.random() - 0.5) * 80 }));
    const nodeById = Object.fromEntries(nodes.map(n => [n.id, n]));
    const links = graphLinks.map(l => ({
      ...l,
      source: nodeById[l.source] || l.source,
      target: nodeById[l.target] || l.target,
    }));

    nodesRef.current = nodes;
    linksRef.current = links;

    simRef.current = forceSimulation(nodes)
      .force('link', forceLink(links).id(d => d.id).distance(90).strength(0.4))
      .force('charge', forceManyBody().strength(-220))
      .force('center', forceCenter(dims.w / 2, dims.h / 2))
      .force('collide', forceCollide(20))
      .on('tick', () => { /* draw is driven by rAF */ });

    return () => {
      simRef.current?.stop();
      cancelAnimationFrame(animRef.current);
    };
  }, [graphNodes, graphLinks, dims.w, dims.h]);

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let running = true;

    const draw = () => {
      if (!running) return;
      animRef.current = requestAnimationFrame(draw);

      const ctx = canvas.getContext('2d');
      const { w, h } = dims;
      ctx.clearRect(0, 0, w, h);

      const nodes = nodesRef.current;
      const links = linksRef.current;
      if (!nodes.length) return;

      // Draw links
      links.forEach(link => {
        const src = link.source;
        const tgt = link.target;
        if (typeof src !== 'object' || typeof tgt !== 'object') return;

        const key = `${typeof link.source === 'object' ? link.source.id : link.source}-${typeof link.target === 'object' ? link.target.id : link.target}`;
        const pulsed = pulsedEdges.has(key);
        const isOwns = link.type === 'owns' || link.type === 'controls';

        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);

        if (isOwns) {
          ctx.setLineDash([5, 5]);
          ctx.strokeStyle = pulsed ? 'rgba(201,162,39,0.9)' : 'rgba(201,162,39,0.35)';
          ctx.lineWidth = 1.5;
        } else {
          ctx.setLineDash([]);
          ctx.strokeStyle = pulsed ? 'rgba(229,72,77,0.9)' : 'rgba(255,255,255,0.12)';
          ctx.lineWidth = pulsed ? 2 : 1;
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Arrow head
        if (!isOwns) {
          const dx = tgt.x - src.x;
          const dy = tgt.y - src.y;
          const len = Math.hypot(dx, dy);
          if (len > 0) {
            const r = NODE_RADII[tgt.type] || 8;
            const ux = dx / len, uy = dy / len;
            const ax = tgt.x - ux * (r + 4);
            const ay = tgt.y - uy * (r + 4);
            ctx.beginPath();
            ctx.moveTo(ax - uy * 4, ay + ux * 4);
            ctx.lineTo(ax + ux * 6, ay + uy * 6);
            ctx.lineTo(ax + uy * 4, ay - ux * 4);
            ctx.closePath();
            ctx.fillStyle = pulsed ? 'rgba(229,72,77,0.85)' : 'rgba(255,255,255,0.18)';
            ctx.fill();
          }
        }
      });

      // Draw nodes
      nodes.forEach(node => {
        const state = nodeStates[node.id] || 'safe';
        const baseColor = BANK_COLORS[node.bank] || '#888';
        const fillColor = state !== 'safe' ? STATE_COLORS[state] : baseColor;
        const r = NODE_RADII[node.type] || 8;
        const isHovered = hoveredNode?.id === node.id;

        // Glow
        if (state !== 'safe' || isHovered) {
          const gColor = state === 'swarm' ? 'rgba(229,72,77,0.4)' : state === 'flagged' ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.15)';
          const grad = ctx.createRadialGradient(node.x, node.y, r * 0.5, node.x, node.y, r + 14);
          grad.addColorStop(0, gColor);
          grad.addColorStop(1, 'transparent');
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 14, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }

        // Dashed ring for swarm state
        if (state === 'swarm') {
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 5, 0, Math.PI * 2);
          ctx.strokeStyle = fillColor;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Main circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = fillColor;
        ctx.fill();

        // Border for device/identity nodes
        if (node.type === 'device' || node.type === 'identity') {
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255,255,255,0.25)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Label
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = state !== 'safe' ? fillColor : 'rgba(240,236,227,0.6)';
        ctx.fillText(node.label, node.x, node.y + r + 4);
      });
    };

    draw();
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [dims, nodeStates, pulsedEdges, hoveredNode]);

  // Mouse interaction
  const getNodeAt = useCallback((mx, my) => {
    return nodesRef.current.find(n => {
      const r = (NODE_RADII[n.type] || 8) + 6;
      return Math.hypot(n.x - mx, n.y - my) <= r;
    });
  }, []);

  const handleMouseMove = useCallback((e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const node = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
    setHoveredNode(node || null);
    canvasRef.current.style.cursor = node ? 'pointer' : 'default';
  }, [getNodeAt]);

  const handleClick = useCallback((e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const node = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
    if (node) setSelectedNode(node);
  }, [getNodeAt, setSelectedNode]);

  if (!activeSwarm || !graphNodes.length) {
    return (
      <div className="graph-empty-state">
        <div className="graph-empty-icon">
          <Network size={24} strokeWidth={1.5} color="var(--text-muted)" />
        </div>
        <div className="graph-empty-title">No active investigation</div>
        <div className="graph-empty-sub">
          Select a swarm type from the left panel to start the demo
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        width={dims.w}
        height={dims.h}
        style={{ display: 'block', width: '100%', height: '100%' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredNode(null)}
        onClick={handleClick}
      />
      {hoveredNode && (
        <NodeTooltip node={hoveredNode} nodeState={nodeStates[hoveredNode.id]} />
      )}
      <PhaseBadge />
    </div>
  );
}

function NodeTooltip({ node, nodeState }) {
  const state = nodeState || 'safe';
  const color = state === 'swarm' ? 'var(--string)' : state === 'flagged' ? 'var(--amber)' : 'var(--text-muted)';
  return (
    <div style={{
      position: 'absolute', top: 12, left: 12, zIndex: 10,
      background: 'var(--surface-raised)', border: '1px solid var(--border-bright)',
      borderRadius: 8, padding: '8px 12px', pointerEvents: 'none',
      fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
    }}>
      <div style={{ color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>{node.label}</div>
      <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{node.bank} · {node.type}</div>
      {node.balance && (
        <div style={{ color: 'var(--text-dim)' }}>Balance: ₹{node.balance.toLocaleString('en-IN')}</div>
      )}
      <div style={{ marginTop: 4, color }}>
        {state === 'swarm' ? 'SWARM MEMBER' : state === 'flagged' ? 'FLAGGED' : `Risk: ${Math.round((node.risk || 0) * 100)}%`}
      </div>
    </div>
  );
}

function PhaseBadge() {
  const phase = useDashboardStore(s => s.demoPhase);
  const phaseConfig = {
    starting: { label: 'FIRING TRANSACTIONS', color: 'var(--brass)' },
    stage1: { label: 'STAGE 1 · SCORING', color: 'var(--amber)' },
    stage2: { label: 'STAGE 2 · SWARM CONFIRMED', color: 'var(--string)' },
    done: { label: 'DEMO COMPLETE', color: 'var(--safe)' },
  };
  const cfg = phaseConfig[phase];
  if (!cfg) return null;
  return (
    <div className="graph-phase-badge" style={{ color: cfg.color, borderColor: `${cfg.color}44`, background: `${cfg.color}18` }}>
      {cfg.label}
    </div>
  );
}
