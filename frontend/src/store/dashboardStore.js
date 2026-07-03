import { create } from 'zustand';
import { SWARM_GRAPHS } from '../api/mock/graphData';
import { baseMetrics } from '../api/mock/metrics';

const DEFAULT_TYPE = null;

export const useDashboardStore = create((set, get) => ({
  // Graph state
  activeSwarm: DEFAULT_TYPE,
  graphNodes: [],
  graphLinks: [],
  nodeStates: {}, // nodeId → 'safe' | 'flagged' | 'swarm'
  pulsedEdges: new Set(),
  selectedNode: null,
  confirmedSwarm: null,

  // Demo state
  demoPhase: 'idle', // 'idle' | 'starting' | 'stage1' | 'stage2' | 'done'
  toasts: [],

  // Metrics
  metrics: { ...baseMetrics },

  // Actions
  selectSwarm: (type) => {
    const graph = SWARM_GRAPHS[type];
    set({
      activeSwarm: type,
      graphNodes: graph.nodes.map(n => ({ ...n })),
      graphLinks: graph.links.map(l => ({ ...l })),
      nodeStates: Object.fromEntries(graph.nodes.map(n => [n.id, 'safe'])),
      pulsedEdges: new Set(),
      selectedNode: null,
      confirmedSwarm: null,
      demoPhase: 'idle',
      toasts: [],
    });
  },

  resetDemo: () => set({
    activeSwarm: null,
    graphNodes: [],
    graphLinks: [],
    nodeStates: {},
    pulsedEdges: new Set(),
    selectedNode: null,
    confirmedSwarm: null,
    demoPhase: 'idle',
    toasts: [],
  }),

  setNodeState: (nodeId, state) =>
    set(s => ({ nodeStates: { ...s.nodeStates, [nodeId]: state } })),

  pulseEdge: (link) =>
    set(s => {
      const key = `${link.source}-${link.target}`;
      const next = new Set(s.pulsedEdges);
      next.add(key);
      return { pulsedEdges: next };
    }),

  setSelectedNode: (node) => set({ selectedNode: node }),

  setConfirmedSwarm: (swarm) => set({ confirmedSwarm: swarm }),

  setDemoPhase: (phase) => set({ demoPhase: phase }),

  addToast: (toast) =>
    set(s => ({ toasts: [...s.toasts.slice(-2), toast] })),

  removeToast: (id) =>
    set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),

  tickMetrics: (delta) =>
    set(s => ({ metrics: { ...s.metrics, ...delta } })),
}));
