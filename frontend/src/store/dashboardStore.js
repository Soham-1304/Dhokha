import { create } from 'zustand';
import { baseMetrics } from '../api/mock/metrics';

const useDashboardStore = create((set, _get) => ({
  // --- Demo phase ---
  demoPhase: 'idle', // 'idle' | 'running' | 'complete'
  activeSwarm: null,
  setDemoPhase: (phase) => set({ demoPhase: phase }),
  setActiveSwarm: (swarmId) => set({ activeSwarm: swarmId }),

  // --- Selected node for ExplainPanel ---
  selectedNode: null,
  setSelectedNode: (nodeId) => set({ selectedNode: nodeId }),

  // --- Node states: map of nodeId → { status, latency } ---
  nodeStates: {},
  setNodeState: (nodeId, state) =>
    set(s => ({ nodeStates: { ...s.nodeStates, [nodeId]: state } })),
  resetNodeStates: () => set({ nodeStates: {} }),

  // --- Link states: map of linkId → { pulsing } ---
  linkStates: {},
  setLinkState: (linkId, state) =>
    set(s => ({ linkStates: { ...s.linkStates, [linkId]: state } })),
  resetLinkStates: () => set({ linkStates: {} }),

  // --- Metrics ---
  metrics: { ...baseMetrics },
  setMetrics: (metrics) => set({ metrics }),
  tickMetrics: (deltas) =>
    set(s => ({
      metrics: {
        txns_per_sec: s.metrics.txns_per_sec + deltas.txns_per_sec,
        active_swarms: s.metrics.active_swarms + deltas.active_swarms,
        value_protected_inr: s.metrics.value_protected_inr + deltas.value_protected_inr,
        avg_latency_ms: s.metrics.avg_latency_ms + deltas.avg_latency_ms,
      },
    })),

  // --- Toast ---
  showToast: false,
  setShowToast: (val) => set({ showToast: val }),
}));

export default useDashboardStore;
