import { useEffect, useRef, useCallback, useState } from 'react';
import ForceGraphLib from 'react-force-graph-2d';
import { useDashboardStore } from '../../store/dashboardStore';
import { BANK_COLORS } from '../../api/mock/graphData';
import { Network } from 'lucide-react';

const STATE_COLORS = {
  safe: null,       // uses bank color
  flagged: '#f59e0b',
  swarm: '#e5484d',
};

const GLOW_COLORS = {
  flagged: 'rgba(245,158,11,0.5)',
  swarm: 'rgba(229,72,77,0.6)',
};

export default function ForceGraph() {
  const graphRef = useRef(null);
  const containerRef = useRef(null);
  const { graphNodes, graphLinks, nodeStates, pulsedEdges, activeSwarm, setSelectedNode } = useDashboardStore();

  // Custom node paint
  const paintNode = useCallback((node, ctx, globalScale) => {
    const state = nodeStates[node.id] || 'safe';
    const baseColor = BANK_COLORS[node.bank] || '#666';
    const fillColor = STATE_COLORS[state] || baseColor;
    const isDevice = node.type === 'device';
    const isMule = node.type === 'mule';
    const isIdentity = node.type === 'identity';

    const r = isDevice ? 10 : isMule ? 12 : isIdentity ? 11 : 8;

    // Glow for flagged/swarm
    if (state !== 'safe') {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 6, 0, Math.PI * 2);
      const gradient = ctx.createRadialGradient(node.x, node.y, r, node.x, node.y, r + 10);
      gradient.addColorStop(0, GLOW_COLORS[state] || 'transparent');
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // Swarm ring pulse
    if (state === 'swarm') {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 3, 0, Math.PI * 2);
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

    // Device/identity border
    if (isDevice || isIdentity) {
      ctx.strokeStyle = state !== 'safe' ? fillColor : baseColor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 2]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Label
    if (globalScale >= 0.6) {
      const label = node.label;
      ctx.font = `${Math.max(8 / globalScale, 6)}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = state !== 'safe' ? fillColor : 'rgba(240,236,227,0.7)';
      ctx.fillText(label, node.x, node.y + r + 8);
    }
  }, [nodeStates]);

  // Custom link paint
  const paintLink = useCallback((link, ctx) => {
    const key = `${link.source.id || link.source}-${link.target.id || link.target}`;
    const isPulsed = pulsedEdges.has(key);
    const isOwns = link.type === 'owns' || link.type === 'controls';

    ctx.beginPath();
    ctx.moveTo(link.source.x, link.source.y);
    ctx.lineTo(link.target.x, link.target.y);

    if (isOwns) {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = isPulsed ? 'rgba(201,162,39,0.8)' : 'rgba(201,162,39,0.3)';
      ctx.lineWidth = 1;
    } else {
      ctx.setLineDash([]);
      ctx.strokeStyle = isPulsed ? 'rgba(229,72,77,0.9)' : 'rgba(42,37,53,0.9)';
      ctx.lineWidth = isPulsed ? 2 : 1;
    }

    ctx.stroke();
    ctx.setLineDash([]);

    // Arrow for transaction direction
    if (!isOwns && link.source.x !== undefined) {
      const dx = link.target.x - link.source.x;
      const dy = link.target.y - link.source.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        const ux = dx / len, uy = dy / len;
        const arrowX = link.target.x - ux * 12;
        const arrowY = link.target.y - uy * 12;
        ctx.beginPath();
        ctx.moveTo(arrowX - uy * 3, arrowY + ux * 3);
        ctx.lineTo(link.target.x - ux * 8, link.target.y - uy * 8);
        ctx.lineTo(arrowX + uy * 3, arrowY - ux * 3);
        ctx.strokeStyle = isPulsed ? 'rgba(229,72,77,0.9)' : 'rgba(42,37,53,0.7)';
        ctx.lineWidth = isPulsed ? 1.5 : 1;
        ctx.stroke();
      }
    }
  }, [pulsedEdges]);

  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node);
  }, [setSelectedNode]);

  // Zoom to fit on new graph
  useEffect(() => {
    if (graphRef.current && graphNodes.length > 0) {
      setTimeout(() => graphRef.current?.zoomToFit(400, 60), 300);
    }
  }, [activeSwarm]);

  if (!activeSwarm || graphNodes.length === 0) {
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

  const phaseConfig = {
    idle: null,
    starting: { label: 'FIRING TRANSACTIONS', color: 'var(--brass)', bg: 'var(--brass-dim)' },
    stage1: { label: 'STAGE 1: SCORING', color: 'var(--amber)', bg: 'var(--amber-dim)' },
    stage2: { label: 'STAGE 2: SWARM CONFIRMED', color: 'var(--string)', bg: 'var(--string-dim)' },
    done: { label: 'DEMO COMPLETE', color: 'var(--safe)', bg: 'var(--safe-dim)' },
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <GraphLibWrapper
        graphRef={graphRef}
        containerRef={containerRef}
        graphNodes={graphNodes}
        graphLinks={graphLinks}
        paintNode={paintNode}
        paintLink={paintLink}
        onNodeClick={handleNodeClick}
      />
      <PhaseBadge />
    </div>
  );
}

function GraphLibWrapper({ graphRef, containerRef, graphNodes, graphLinks, paintNode, paintLink, onNodeClick }) {
  const dims = useContainerDims(containerRef);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <ForceGraphLib
        ref={graphRef}
        graphData={{ nodes: graphNodes, links: graphLinks }}
        width={dims.width}
        height={dims.height}
        backgroundColor="transparent"
        nodeCanvasObject={paintNode}
        nodeCanvasObjectMode={() => 'replace'}
        linkCanvasObject={paintLink}
        linkCanvasObjectMode={() => 'replace'}
        onNodeClick={onNodeClick}
        nodeLabel={(n) => `${n.label} · ${n.bank}${n.balance ? ` · ₹${n.balance?.toLocaleString('en-IN')}` : ''}`}
        cooldownTicks={120}
        d3AlphaDecay={0.04}
        d3VelocityDecay={0.3}
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={1.5}
        linkDirectionalParticleColor={() => 'rgba(229,72,77,0.6)'}
        linkDirectionalParticleSpeed={0.004}
        enableNodeDrag={true}
        enableZoomInteraction={true}
      />
    </div>
  );
}

function useContainerDims(containerRef) {
  const [dims, setDims] = useState({ width: 600, height: 400 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setDims({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return dims;
}

function PhaseBadge() {
  const phase = useDashboardStore(s => s.demoPhase);
  const phaseConfig = {
    idle: null,
    starting: { label: 'FIRING TRANSACTIONS', color: 'var(--brass)' },
    stage1: { label: 'STAGE 1 · SCORING', color: 'var(--amber)' },
    stage2: { label: 'STAGE 2 · SWARM CONFIRMED', color: 'var(--string)' },
    done: { label: 'DEMO COMPLETE', color: 'var(--safe)' },
  };
  const cfg = phaseConfig[phase];
  if (!cfg) return null;

  return (
    <div
      className="graph-phase-badge"
      style={{ color: cfg.color, borderColor: `${cfg.color}44`, background: `${cfg.color}15` }}
    >
      {cfg.label}
    </div>
  );
}
