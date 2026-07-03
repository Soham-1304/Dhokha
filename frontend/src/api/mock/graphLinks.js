// Transaction edges linking accounts and the device hub
export const graphLinks = [
  // Device hub → accounts (Type D signature)
  { id: 'L-D-A01', source: 'DEV-001', target: 'ACC-A01', amount: 48200, txnId: 'TXN-9F21-A', ts: '2026-07-03T09:12:00Z', flagged: false },
  { id: 'L-D-A02', source: 'DEV-001', target: 'ACC-A02', amount: 12400, txnId: 'TXN-4B22-A', ts: '2026-07-03T09:14:00Z', flagged: false },
  { id: 'L-D-B01', source: 'DEV-001', target: 'ACC-B01', amount: 63500, txnId: 'TXN-7C08-B', ts: '2026-07-03T09:15:00Z', flagged: false },
  { id: 'L-D-B02', source: 'DEV-001', target: 'ACC-B02', amount: 34800, txnId: 'TXN-2E44-B', ts: '2026-07-03T09:17:00Z', flagged: false },
  { id: 'L-D-C02', source: 'DEV-001', target: 'ACC-C02', amount: 9200, txnId: 'TXN-6A19-C', ts: '2026-07-03T09:18:00Z', flagged: false },

  // Accounts → mule collector (fan-in)
  { id: 'L-A01-C01', source: 'ACC-A01', target: 'ACC-C01', amount: 47000, txnId: 'TXN-1F90-AC', ts: '2026-07-03T09:45:00Z', flagged: false },
  { id: 'L-A02-C01', source: 'ACC-A02', target: 'ACC-C01', amount: 11800, txnId: 'TXN-3C11-AC', ts: '2026-07-03T09:47:00Z', flagged: false },
  { id: 'L-B01-C01', source: 'ACC-B01', target: 'ACC-C01', amount: 62000, txnId: 'TXN-8D55-BC', ts: '2026-07-03T09:48:00Z', flagged: false },
  { id: 'L-B02-C01', source: 'ACC-B02', target: 'ACC-C01', amount: 34200, txnId: 'TXN-5E77-BC', ts: '2026-07-03T09:50:00Z', flagged: false },
  { id: 'L-C02-C01', source: 'ACC-C02', target: 'ACC-C01', amount: 9100, txnId: 'TXN-9K20-CC', ts: '2026-07-03T09:51:00Z', flagged: false },

  // Normal/clean peripheral transactions
  { id: 'L-A03-A04', source: 'ACC-A03', target: 'ACC-A04', amount: 5200, txnId: 'TXN-2A03-AA', ts: '2026-07-03T08:00:00Z', flagged: false },
  { id: 'L-B03-B04', source: 'ACC-B03', target: 'ACC-B04', amount: 3400, txnId: 'TXN-7B12-BB', ts: '2026-07-03T08:20:00Z', flagged: false },
  { id: 'L-C03-C04', source: 'ACC-C03', target: 'ACC-C04', amount: 2100, txnId: 'TXN-1C98-CC', ts: '2026-07-03T08:45:00Z', flagged: false },
  { id: 'L-A03-B03', source: 'ACC-A03', target: 'ACC-B03', amount: 18700, txnId: 'TXN-4F02-AB', ts: '2026-07-03T07:30:00Z', flagged: false },
];

export const SWARM_D_LINKS = ['L-D-A01', 'L-D-A02', 'L-D-B01', 'L-D-B02', 'L-D-C02', 'L-A01-C01', 'L-A02-C01', 'L-B01-C01', 'L-B02-C01', 'L-C02-C01'];
