// Mock graph data for all 4 swarm types

export const BANK_COLORS = {
  'Bank A': '#3b82f6',
  'Bank B': '#22c55e',
  'Bank C': '#f59e0b',
  'Bank D': '#8b5cf6',
  'Device': '#e5484d',
  'Identity': '#c9a227',
};

const baseNodes = [
  // Bank A accounts
  { id: 'acc-a1', label: 'ACC-A1', bank: 'Bank A', type: 'account', risk: 0.12, balance: 48200, city: 'Mumbai' },
  { id: 'acc-a2', label: 'ACC-A2', bank: 'Bank A', type: 'account', risk: 0.08, balance: 22000, city: 'Mumbai' },
  { id: 'acc-a3', label: 'ACC-A3', bank: 'Bank A', type: 'account', risk: 0.09, balance: 31000, city: 'Pune' },

  // Bank B accounts
  { id: 'acc-b1', label: 'ACC-B1', bank: 'Bank B', type: 'account', risk: 0.15, balance: 112000, city: 'Pune' },
  { id: 'acc-b2', label: 'ACC-B2', bank: 'Bank B', type: 'account', risk: 0.11, balance: 58000, city: 'Bangalore' },
  { id: 'acc-b3', label: 'ACC-B3', bank: 'Bank B', type: 'account', risk: 0.07, balance: 19500, city: 'Bangalore' },

  // Bank C accounts
  { id: 'acc-c1', label: 'ACC-C1', bank: 'Bank C', type: 'account', risk: 0.18, balance: 63500, city: 'Delhi' },
  { id: 'acc-c2', label: 'ACC-C2', bank: 'Bank C', type: 'account', risk: 0.10, balance: 41000, city: 'Delhi' },
  { id: 'acc-c3', label: 'ACC-C3', bank: 'Bank C', type: 'account', risk: 0.13, balance: 27000, city: 'Hyderabad' },

  // Bank D accounts
  { id: 'acc-d1', label: 'ACC-D1', bank: 'Bank D', type: 'account', risk: 0.06, balance: 88000, city: 'Chennai' },
  { id: 'acc-d2', label: 'ACC-D2', bank: 'Bank D', type: 'account', risk: 0.09, balance: 34000, city: 'Chennai' },

  // Collector / mule accounts
  { id: 'mule-1', label: 'MULE-01', bank: 'Bank A', type: 'mule', risk: 0.92, balance: 223700, city: 'Mumbai' },
  { id: 'mule-2', label: 'MULE-02', bank: 'Bank C', type: 'mule', risk: 0.88, balance: 156000, city: 'Delhi' },

  // Device nodes
  { id: 'dev-1', label: 'DEV-CTRL-01', bank: 'Device', type: 'device', risk: 0.97, fingerprint: 'fp_8a2f9c' },
  { id: 'dev-2', label: 'DEV-CTRL-02', bank: 'Device', type: 'device', risk: 0.84, fingerprint: 'fp_3c7d1e' },

  // Identity node
  { id: 'id-1', label: 'PAN-XXXX1234', bank: 'Identity', type: 'identity', risk: 0.91, pan: 'XXXXX1234X' },
];

const baseLinks = [
  { source: 'acc-a1', target: 'acc-b1', amount: 48200, channel: 'UPI', ts: '10:22:14' },
  { source: 'acc-b1', target: 'acc-c1', amount: 41000, channel: 'NEFT', ts: '10:24:03' },
  { source: 'acc-b2', target: 'acc-c2', amount: 35000, channel: 'UPI', ts: '10:25:11' },
  { source: 'acc-c1', target: 'mule-1', amount: 38500, channel: 'IMPS', ts: '10:27:58' },
  { source: 'acc-c2', target: 'mule-1', amount: 31000, channel: 'UPI', ts: '10:28:22' },
  { source: 'acc-a2', target: 'mule-2', amount: 19000, channel: 'UPI', ts: '10:29:01' },
  { source: 'acc-d1', target: 'acc-a3', amount: 22000, channel: 'NEFT', ts: '10:31:44' },
];

// Swarm-specific graph configs
export const SWARM_GRAPHS = {
  A: {
    // Identity Fan-Out: 1 identity → many accounts across banks
    nodes: [
      ...baseNodes.filter(n => ['id-1', 'acc-a1', 'acc-a2', 'acc-b1', 'acc-b2', 'acc-c1', 'acc-c2', 'acc-d1'].includes(n.id)),
    ],
    links: [
      { source: 'id-1', target: 'acc-a1', type: 'owns' },
      { source: 'id-1', target: 'acc-a2', type: 'owns' },
      { source: 'id-1', target: 'acc-b1', type: 'owns' },
      { source: 'id-1', target: 'acc-b2', type: 'owns' },
      { source: 'id-1', target: 'acc-c1', type: 'owns' },
      { source: 'id-1', target: 'acc-c2', type: 'owns' },
      { source: 'id-1', target: 'acc-d1', type: 'owns' },
      { source: 'acc-a1', target: 'acc-b1', amount: 48200, channel: 'UPI', ts: '10:22:14' },
      { source: 'acc-a2', target: 'acc-c1', amount: 22000, channel: 'NEFT', ts: '10:22:58' },
      { source: 'acc-b2', target: 'acc-d1', amount: 58000, channel: 'IMPS', ts: '10:23:11' },
    ],
    swarmNodes: ['id-1', 'acc-a1', 'acc-a2', 'acc-b1', 'acc-b2', 'acc-c1', 'acc-c2', 'acc-d1'],
    description: 'One identity controls accounts across 4 banks, firing simultaneous transactions to evade per-bank thresholds.',
  },
  B: {
    // Mule Fan-In: many victims → 1 collector
    nodes: [
      ...baseNodes.filter(n => ['acc-a1', 'acc-a2', 'acc-b1', 'acc-b2', 'acc-c1', 'acc-c2', 'acc-d1', 'acc-d2', 'mule-1'].includes(n.id)),
    ],
    links: [
      { source: 'acc-a1', target: 'mule-1', amount: 48200, channel: 'UPI', ts: '10:22:14' },
      { source: 'acc-a2', target: 'mule-1', amount: 22000, channel: 'UPI', ts: '10:22:31' },
      { source: 'acc-b1', target: 'mule-1', amount: 41000, channel: 'NEFT', ts: '10:22:48' },
      { source: 'acc-b2', target: 'mule-1', amount: 35000, channel: 'UPI', ts: '10:23:02' },
      { source: 'acc-c1', target: 'mule-1', amount: 63500, channel: 'IMPS', ts: '10:23:19' },
      { source: 'acc-c2', target: 'mule-1', amount: 41000, channel: 'UPI', ts: '10:23:33' },
      { source: 'acc-d1', target: 'mule-1', amount: 88000, channel: 'NEFT', ts: '10:23:51' },
      { source: 'acc-d2', target: 'mule-1', amount: 34000, channel: 'UPI', ts: '10:24:08' },
    ],
    swarmNodes: ['mule-1', 'acc-a1', 'acc-a2', 'acc-b1', 'acc-b2', 'acc-c1', 'acc-c2', 'acc-d1', 'acc-d2'],
    description: 'Multiple victims across 4 banks funneling money into a single mule collector account.',
  },
  C: {
    // Layering Chain: victim → mule chain across banks
    nodes: [
      ...baseNodes.filter(n => ['acc-a1', 'acc-b1', 'acc-c1', 'acc-d1', 'mule-1', 'acc-a3'].includes(n.id)),
    ],
    links: [
      { source: 'acc-a1', target: 'acc-b1', amount: 48200, channel: 'UPI', ts: '10:22:14' },
      { source: 'acc-b1', target: 'acc-c1', amount: 41000, channel: 'NEFT', ts: '10:24:03' },
      { source: 'acc-c1', target: 'acc-d1', amount: 35000, channel: 'IMPS', ts: '10:26:18' },
      { source: 'acc-d1', target: 'mule-1', amount: 29500, channel: 'UPI', ts: '10:28:44' },
      { source: 'mule-1', target: 'acc-a3', amount: 25000, channel: 'NEFT', ts: '10:31:02' },
      { source: 'acc-a3', target: 'acc-a1', amount: 21000, channel: 'UPI', ts: '10:34:29' },
    ],
    swarmNodes: ['acc-a1', 'acc-b1', 'acc-c1', 'acc-d1', 'mule-1', 'acc-a3'],
    description: 'Money laundered through a 6-hop chain across 4 banks before looping back — a closed layering ring.',
  },
  D: {
    // Device Cluster: 1 device fingerprint → many accounts across banks
    nodes: [
      ...baseNodes.filter(n => ['dev-1', 'acc-a1', 'acc-a3', 'acc-b2', 'acc-c3', 'acc-d2', 'mule-1'].includes(n.id)),
    ],
    links: [
      { source: 'dev-1', target: 'acc-a1', type: 'controls' },
      { source: 'dev-1', target: 'acc-a3', type: 'controls' },
      { source: 'dev-1', target: 'acc-b2', type: 'controls' },
      { source: 'dev-1', target: 'acc-c3', type: 'controls' },
      { source: 'dev-1', target: 'acc-d2', type: 'controls' },
      { source: 'acc-a1', target: 'mule-1', amount: 48200, channel: 'UPI', ts: '10:22:14' },
      { source: 'acc-a3', target: 'mule-1', amount: 31000, channel: 'UPI', ts: '10:22:19' },
      { source: 'acc-b2', target: 'mule-1', amount: 58000, channel: 'UPI', ts: '10:22:24' },
      { source: 'acc-c3', target: 'mule-1', amount: 27000, channel: 'UPI', ts: '10:22:28' },
      { source: 'acc-d2', target: 'mule-1', amount: 34000, channel: 'UPI', ts: '10:22:33' },
    ],
    swarmNodes: ['dev-1', 'acc-a1', 'acc-a3', 'acc-b2', 'acc-c3', 'acc-d2', 'mule-1'],
    description: 'One device fingerprint controls 5 accounts across 4 banks — invisible to each individual bank, obvious from above.',
  },
};

export default baseNodes;
