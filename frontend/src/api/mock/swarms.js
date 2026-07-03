import { SWARM_D_NODES } from './graphNodes';
import { SWARM_D_LINKS } from './graphLinks';

export const swarms = [
  {
    id: 'A',
    label: 'Identity Fan-Out',
    description: 'One compromised identity opens N accounts across multiple banks simultaneously.',
    graphSignature: '1 identity → N accounts',
    nodeIds: ['ACC-A01', 'ACC-A03', 'ACC-B01', 'ACC-C03'],
    linkIds: ['L-A03-B03'],
    leadNode: 'ACC-A01',
  },
  {
    id: 'B',
    label: 'Mule Fan-In',
    description: 'Multiple victim accounts funnel funds into a single collector.',
    graphSignature: 'N victims → 1 collector',
    nodeIds: ['ACC-A01', 'ACC-A02', 'ACC-B01', 'ACC-C01'],
    linkIds: ['L-A01-C01', 'L-A02-C01', 'L-B01-C01'],
    leadNode: 'ACC-C01',
  },
  {
    id: 'C',
    label: 'Layering Chain',
    description: 'Funds hop through a chain of accounts across 3+ banks to obscure origin.',
    graphSignature: 'multi-hop path across banks',
    nodeIds: ['ACC-A01', 'ACC-A02', 'ACC-B01', 'ACC-B02', 'ACC-C01'],
    linkIds: ['L-A01-C01', 'L-A02-C01', 'L-B01-C01', 'L-B02-C01'],
    leadNode: 'ACC-A01',
  },
  {
    id: 'D',
    label: 'Device Cluster',
    description: 'One device orchestrates transactions for multiple unrelated accounts across banks.',
    graphSignature: '1 device → unrelated accounts',
    nodeIds: SWARM_D_NODES,
    linkIds: SWARM_D_LINKS,
    leadNode: 'DEV-001',
    isLeadDemo: true,
  },
];
