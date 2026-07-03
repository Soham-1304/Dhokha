export const baseMetrics = {
  txns_per_sec: 847,
  active_swarms: 3,
  value_protected_inr: 94200000,
  avg_latency_ms: 148,
  flagged_today: 127,
  false_positive_rate: 0.4,
};

export const FLAGGED_TRANSACTIONS = [
  { id: 'TXN-9F21-A', from: 'ACC-A1 · Bank A', to: 'MULE-01', amount: 48200, risk: 0.92, type: 'Fan-In', ts: '10:22:14', status: 'flagged' },
  { id: 'TXN-7C08-B', from: 'ACC-B1 · Bank B', to: 'ACC-C1 · Bank C', amount: 41000, risk: 0.87, type: 'Layering', ts: '10:24:03', status: 'flagged' },
  { id: 'TXN-4E77-C', from: 'ACC-C1 · Bank C', to: 'MULE-01', amount: 63500, risk: 0.95, type: 'Fan-In', ts: '10:27:58', status: 'swarm' },
  { id: 'TXN-2D19-D', from: 'DEV-CTRL-01', to: 'ACC-A1 · Bank A', amount: 0, risk: 0.97, type: 'Device', ts: '10:22:10', status: 'swarm' },
  { id: 'TXN-8B44-E', from: 'ACC-D1 · Bank D', to: 'ACC-A3 · Bank A', amount: 22000, risk: 0.41, type: 'Chain', ts: '10:31:44', status: 'review' },
  { id: 'TXN-1A03-F', from: 'ACC-A2 · Bank A', to: 'MULE-02', amount: 19000, risk: 0.78, type: 'Fan-In', ts: '10:29:01', status: 'flagged' },
  { id: 'TXN-5C92-G', from: 'ACC-B2 · Bank B', to: 'MULE-01', amount: 58000, risk: 0.93, type: 'Device', ts: '10:22:24', status: 'swarm' },
  { id: 'TXN-3F67-H', from: 'ACC-C3 · Bank C', to: 'MULE-01', amount: 27000, risk: 0.91, type: 'Device', ts: '10:22:28', status: 'swarm' },
];

export const SHAP_DATA = {
  default: [
    { feature: 'Fan-in spike', value: 0.31, positive: true },
    { feature: 'New device flag', value: 0.24, positive: true },
    { feature: 'Off-hours activity', value: 0.18, positive: true },
    { feature: 'Amount z-score', value: 0.15, positive: true },
    { feature: 'Receiver acct age', value: 0.12, positive: true },
    { feature: 'Normal txn history', value: -0.09, positive: false },
  ],
  'mule-1': [
    { feature: 'Fan-in spike (8 senders)', value: 0.42, positive: true },
    { feature: 'Cross-bank in-degree', value: 0.38, positive: true },
    { feature: 'Account age < 30d', value: 0.21, positive: true },
    { feature: 'Velocity: 8 txns/10min', value: 0.19, positive: true },
    { feature: 'New receivers', value: 0.11, positive: true },
    { feature: 'Known city', value: -0.04, positive: false },
  ],
  'dev-1': [
    { feature: 'Device → 5 accounts', value: 0.47, positive: true },
    { feature: 'Cross-bank device use', value: 0.39, positive: true },
    { feature: 'Simultaneous sessions', value: 0.28, positive: true },
    { feature: 'Fingerprint first-seen', value: 0.16, positive: true },
    { feature: 'IP block cluster', value: 0.14, positive: true },
    { feature: 'Device model known', value: -0.03, positive: false },
  ],
  'id-1': [
    { feature: 'PAN controls 7 accts', value: 0.44, positive: true },
    { feature: 'Fan-out across banks', value: 0.36, positive: true },
    { feature: 'Simultaneous txns', value: 0.25, positive: true },
    { feature: 'KYC risk flags', value: 0.18, positive: true },
    { feature: 'Off-hours txns', value: 0.12, positive: true },
    { feature: 'Normal ID format', value: -0.05, positive: false },
  ],
};
