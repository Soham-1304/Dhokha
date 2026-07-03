import { SWARM_GRAPHS } from './graphData';

// Simulator drives timed demo events for each swarm type.
// Returns a cleanup function to cancel pending timeouts.

export function runSwarmDemo(swarmType, callbacks) {
  const { onEdgePulse, onNodeFlag, onSwarmConfirmed, onMetricTick, onToast, onPhaseChange } = callbacks;
  const graph = SWARM_GRAPHS[swarmType];
  const timeouts = [];

  const t = (ms, fn) => {
    const id = setTimeout(fn, ms);
    timeouts.push(id);
  };

  onPhaseChange('starting');

  // Pulse edges one by one
  const txnLinks = graph.links.filter(l => l.amount);
  txnLinks.forEach((link, i) => {
    t(i * 280, () => onEdgePulse(link));
  });

  // First node flagged by Stage 1 (amber) after ~800ms
  t(820, () => {
    onPhaseChange('stage1');
    const firstFlagged = swarmType === 'B' || swarmType === 'D' ? graph.swarmNodes[graph.swarmNodes.length - 1] : graph.swarmNodes[0];
    onNodeFlag(firstFlagged, 'flagged');
    onMetricTick({ avg_latency_ms: Math.floor(Math.random() * 30) + 138 });
    onToast({ type: 'info', message: `Stage 1: Transaction flagged — ${Math.floor(Math.random() * 30) + 138}ms`, id: Date.now() });
  });

  // More nodes flagged
  t(1400, () => {
    const second = graph.swarmNodes[1];
    if (second) onNodeFlag(second, 'flagged');
  });

  t(1900, () => {
    const third = graph.swarmNodes[2];
    if (third) onNodeFlag(third, 'flagged');
  });

  // Stage 2 swarm confirmation — entire ring turns red
  t(3600, () => {
    onPhaseChange('stage2');
    graph.swarmNodes.forEach(nodeId => onNodeFlag(nodeId, 'swarm'));
    onSwarmConfirmed({ swarmType, nodeCount: graph.swarmNodes.length, description: graph.description });

    const typeLabels = { A: 'Identity Fan-Out', B: 'Mule Fan-In', C: 'Layering Ring', D: 'Device Cluster' };
    const bankCounts = { A: 4, B: 4, C: 4, D: 4 };
    onToast({
      type: 'swarm',
      message: `Swarm confirmed: ${typeLabels[swarmType]} · ${graph.swarmNodes.length} nodes · ${bankCounts[swarmType]} banks`,
      confidence: Math.floor(Math.random() * 6) + 91,
      id: Date.now(),
    });
    onMetricTick({ active_swarms: 1, value_protected_inr: 94200000 + Math.floor(Math.random() * 5000000) });
  });

  t(4200, () => onPhaseChange('done'));

  return () => timeouts.forEach(clearTimeout);
}
