import { useRef, useEffect, useCallback, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { graphNodes } from '../../api/mock/graphNodes';
import { graphLinks } from '../../api/mock/graphLinks';
import useDashboardStore from '../../store/dashboardStore';

const BANK_COLORS = { A: '#e5484d', B: '#c9a227', C: '#3fb67f', D: '#7c6af0' };
const STATUS_GLOW = { flagged: '#c9a227', swarm: '#e5484d' };

function getNodeColor(node, nodeStates) {
  const state = nodeStates[node.id];
  if (!state || state.status === 'safe') {
    if (node.type === 'device') return '#7c6af0';
    return BANK_COLORS[node.bank] || '#9b968c';
  }
  return STATUS_GLOW[state.status] || '#9b968c';
}

function getLinkColor(link, linkStates) {
  const state = linkStates[link.id];
  return state?.pulsing ? '#e5484d' : 'rgba(155,150,140,0.25)';
}

export default function ForceGraph() {
  const fgRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 480 });
  const containerRef = useRef(null);

  const nodeStates = useDashboardStore(s => s.nodeStates);
  const linkStates = useDashboardStore(s => s.linkStates);
  const setSelectedNode = useDashboardStore(s => s.setSelectedNode);
  const selectedNode = useDashboardStore(s => s.selectedNode);

  // Measure container and freeze graph after settle
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Freeze graph layout after 3s so it stays stable for the demo
  useEffect(() => {
    const t = setTimeout(() => {
      if (fgRef.current) fgRef.current.d3Force('charge', null);
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  const drawNode = useCallback((node, ctx, globalScale) => {
    const state = nodeStates[node.id];
    const status = state?.status;
    const color = getNodeColor(node, nodeStates);
    const isDevice = node.type === 'device';
    const isSelected = selectedNode === node.id;
    const r = isDevice ? 9 : (node.isMule ? 11 : 8);

    // Glow ring for flagged/swarm
    if (status === 'flagged' || status === 'swarm') {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 6, 0, 2 * Math.PI);
      ctx.fillStyle = `${color}22`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 3, 0, 2 * Math.PI);
      ctx.fillStyle = `${color}44`;
      ctx.fill();
    }

    // Selection ring
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 5, 0, 2 * Math.PI);
      ctx.strokeStyle = '#ffffff88';
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();
    }

    // Node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    if (isDevice) {
      // Device: dashed border style
      ctx.fillStyle = '#17141a';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5 / globalScale;
      ctx.setLineDash([3 / globalScale, 3 / globalScale]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = color;
      ctx.fill();
    }

    // Latency badge
    if (state?.latency) {
      const label = `${state.latency}ms`;
      ctx.font = `${8 / globalScale}px "JetBrains Mono"`;
      ctx.fillStyle = '#ffffffcc';
      ctx.textAlign = 'center';
      ctx.fillText(label, node.x, node.y + r + 10 / globalScale);
    }

    // Node label
    const fontSize = 6 / globalScale;
    ctx.font = `${fontSize}px "Inter"`;
    ctx.fillStyle = status ? '#ffffff' : '#9b968c';
    ctx.textAlign = 'center';
    const shortLabel = isDevice ? 'DEV' : (node.label || node.id).split(' ')[0];
    ctx.fillText(shortLabel, node.x, node.y - r - 3 / globalScale);
  }, [nodeStates, selectedNode]);

  const drawLink = useCallback((link, ctx) => {
    const color = getLinkColor(link, linkStates);
    ctx.strokeStyle = color;
    ctx.lineWidth = linkStates[link.id]?.pulsing ? 1.5 : 0.8;
    ctx.beginPath();
    ctx.moveTo(link.source.x, link.source.y);
    ctx.lineTo(link.target.x, link.target.y);
    ctx.stroke();
  }, [linkStates]);

  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node.id === selectedNode ? null : node.id);
  }, [setSelectedNode, selectedNode]);

  return (
    <div ref={containerRef} className="db-graph-container">
      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={{
          nodes: graphNodes.map(n => ({ ...n })),
          links: graphLinks.map(l => ({ ...l })),
        }}
        nodeCanvasObject={drawNode}
        linkCanvasObject={drawLink}
        onNodeClick={handleNodeClick}
        nodeLabel={node => `${node.label || node.id} · ${node.bank ? `Bank ${node.bank}` : 'Device'}`}
        cooldownTicks={120}
        d3AlphaDecay={0.03}
        d3VelocityDecay={0.4}
        backgroundColor="transparent"
        enableNodeDrag={true}
        enableZoomInteraction={true}
      />
    </div>
  );
}
