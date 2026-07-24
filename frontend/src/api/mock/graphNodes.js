// Graph nodes: 1 device hub + 12 account nodes across 3 banks + 3 clean periphery
// Pre-positioned for Type D (Device Cluster) demo

export const graphNodes = [
  // Device Hub — center of Type D swarm
  { id: 'DEV-001', label: 'Device Hub', type: 'device', bank: null, risk: 0, x: 0, y: 0 },

  // Bank A nodes (red hue)
  { id: 'ACC-A01', label: 'Priya Sharma', bank: 'A', type: 'account', city: 'Mumbai', risk: 0, balance: 48200 },
  { id: 'ACC-A02', label: 'Rohan Mehta', bank: 'A', type: 'account', city: 'Mumbai', risk: 0, balance: 12400 },
  { id: 'ACC-A03', label: 'Ananya Gupta', bank: 'A', type: 'account', city: 'Pune', risk: 0, balance: 99100 },

  // Bank B nodes (amber hue)
  { id: 'ACC-B01', label: 'Vikram Singh', bank: 'B', type: 'account', city: 'Delhi', risk: 0, balance: 63500 },
  { id: 'ACC-B02', label: 'Meena Nair', bank: 'B', type: 'account', city: 'Bangalore', risk: 0, balance: 34800 },
  { id: 'ACC-B03', label: 'Arjun Patel', bank: 'B', type: 'account', city: 'Hyderabad', risk: 0, balance: 21700 },

  // Bank C nodes (green hue) — mule/collector
  { id: 'ACC-C01', label: 'Mule Account', bank: 'C', type: 'account', city: 'Chennai', risk: 0, balance: 223700, isMule: true },
  { id: 'ACC-C02', label: 'Suresh Iyer', bank: 'C', type: 'account', city: 'Kolkata', risk: 0, balance: 9200 },
  { id: 'ACC-C03', label: 'Divya Raj', bank: 'C', type: 'account', city: 'Jaipur', risk: 0, balance: 47600 },

  // "Clean" periphery nodes
  { id: 'ACC-A04', label: 'Clean Account 1', bank: 'A', type: 'account', city: 'Surat', risk: 0, balance: 6400 },
  { id: 'ACC-B04', label: 'Clean Account 2', bank: 'B', type: 'account', city: 'Ahmedabad', risk: 0, balance: 18000 },
  { id: 'ACC-C04', label: 'Clean Account 3', bank: 'C', type: 'account', city: 'Lucknow', risk: 0, balance: 5500 },
];

export const SWARM_D_NODES = ['DEV-001', 'ACC-A01', 'ACC-A02', 'ACC-B01', 'ACC-B02', 'ACC-C01', 'ACC-C02'];
export const MULE_NODE = 'ACC-C01';
