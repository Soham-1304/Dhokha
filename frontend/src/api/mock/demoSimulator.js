import { swarms } from './swarms';
import { baseMetrics, demoMetricDeltas } from './metrics';

/**
 * Client-side scripted demo replay engine.
 * Calls into the zustand dashboardStore to drive all visual state.
 *
 * Timeline for Type D (Device Cluster) — the lead demo:
 *   T+0ms     — edge pulses fire one-by-one
 *   T+800ms   — first nodes go amber (Stage 1 flag), latency badge shows
 *   T+2500ms  — more nodes go amber
 *   T+3500ms  — all swarm nodes go red, toast fires, metrics tick up
 */

const PULSE_INTERVAL = 180; // ms between each edge pulse

export function runDemo(swarmId, store) {
  const swarm = swarms.find(s => s.id === swarmId);
  if (!swarm) return;

  store.setActiveSwarm(swarmId);
  store.setDemoPhase('running');

  // Reset all states first
  store.resetNodeStates();
  store.resetLinkStates();

  const linkIds = swarm.linkIds;
  const nodeIds = swarm.nodeIds;

  // T+0ms: Edge pulses fire sequentially
  linkIds.forEach((linkId, i) => {
    setTimeout(() => {
      store.setLinkState(linkId, { pulsing: true });
    }, i * PULSE_INTERVAL);
  });

  // T+800ms: First batch of nodes go amber (Stage 1 flag)
  const firstBatch = nodeIds.slice(0, Math.ceil(nodeIds.length / 2));
  setTimeout(() => {
    firstBatch.forEach(nodeId => {
      store.setNodeState(nodeId, { status: 'flagged', latency: 147 });
    });
  }, 800);

  // T+2500ms: Remaining nodes go amber
  const secondBatch = nodeIds.slice(Math.ceil(nodeIds.length / 2));
  setTimeout(() => {
    secondBatch.forEach(nodeId => {
      store.setNodeState(nodeId, { status: 'flagged', latency: 152 });
    });
  }, 2500);

  // T+3500ms: All swarm nodes go red — SWARM CONFIRMED
  setTimeout(() => {
    nodeIds.forEach(nodeId => {
      store.setNodeState(nodeId, { status: 'swarm', latency: 147 });
    });
    store.setShowToast(true);
    store.setDemoPhase('complete');
    store.tickMetrics(demoMetricDeltas);

    // Auto-dismiss toast after 4s
    setTimeout(() => store.setShowToast(false), 4000);
  }, 3500);
}

export function resetDemo(store) {
  store.setDemoPhase('idle');
  store.setActiveSwarm(null);
  store.setSelectedNode(null);
  store.resetNodeStates();
  store.resetLinkStates();
  store.setShowToast(false);
  store.setMetrics(baseMetrics);
}
