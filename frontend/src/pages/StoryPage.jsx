import { useRef, useEffect, useState, useMemo } from 'react';
import { useScroll, useTransform, useMotionValueEvent } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Fingerprint, BrainCircuit, Network, Zap,
  Store, Link2, ShieldCheck
} from 'lucide-react';
import './StoryPage.css';

/* ════════════════════════════════════════════════════════════
   DATA
   ════════════════════════════════════════════════════════════ */

const ANALYSIS_CHECKS = [
  { Icon: Fingerprint,  label: 'Device Fingerprint' },
  { Icon: BrainCircuit, label: 'Behaviour Analysis' },
  { Icon: Network,      label: 'Graph Intelligence' },
  { Icon: Zap,          label: 'Velocity Detection' },
  { Icon: Store,        label: 'Merchant Reputation' },
  { Icon: Link2,        label: 'Historical Fraud Links' },
  { Icon: ShieldCheck,  label: 'AI Risk Model' },
];

/* Positions for the 7 analysis chips (scattered around center) */
const CHIP_POSITIONS = [
  { top: '2%',   left: '50%' },       // 0 — top center
  { top: '20%',  left: '2%' },        // 1 — upper-left
  { top: '18%',  right: '2%' },       // 2 — upper-right
  { top: '50%',  left: '0%' },        // 3 — mid-left
  { top: '48%',  right: '0%' },       // 4 — mid-right
  { bottom: '18%', left: '4%' },      // 5 — lower-left
  { bottom: '16%', right: '4%' },     // 6 — lower-right
];

/* Payment flow path (smooth S-curve through 5 infrastructure nodes) */
const FLOW_PATH = 'M 100 200 C 180 200 260 100 340 100 C 420 100 520 200 600 200 C 680 200 780 100 860 100 C 940 100 1020 200 1100 200';

const FLOW_NODES = [
  { x: 100,  y: 200, label: 'Consumer',      sub: 'UPI App' },
  { x: 340,  y: 100, label: 'Sender Bank',   sub: 'HDFC' },
  { x: 600,  y: 200, label: 'NPCI',          sub: 'Switch' },
  { x: 860,  y: 100, label: 'Receiver Bank', sub: 'SBI' },
  { x: 1100, y: 200, label: 'Merchant',      sub: 'QuickMart' },
];

/* Network graph — clean cluster + fraud ring */
const GRAPH_NODES = [
  // Clean network
  { id: 'a1',   label: 'Rajesh K.',    type: 'account',  x: 120, y: 200 },
  { id: 'a2',   label: 'Priya S.',     type: 'account',  x: 170, y: 340 },
  { id: 'a3',   label: 'Amit V.',      type: 'account',  x: 90,  y: 420 },
  { id: 'b1',   label: 'HDFC',         type: 'bank',     x: 290, y: 250 },
  { id: 'b2',   label: 'SBI',          type: 'bank',     x: 310, y: 400 },
  { id: 'd1',   label: 'iPhone 14',    type: 'device',   x: 100, y: 280 },
  { id: 'ip1',  label: '103.21.x.x',  type: 'ip',       x: 200, y: 140 },
  { id: 'm1',   label: 'QuickMart',    type: 'merchant', x: 440, y: 170 },
  { id: 'm2',   label: 'FreshGrocer',  type: 'merchant', x: 470, y: 440 },
  // Central hub
  { id: 'npci', label: 'NPCI',         type: 'npci',     x: 500, y: 300 },
  // Bridge bank
  { id: 'b3',   label: 'ICICI',        type: 'bank',     x: 640, y: 280 },
  // Fraud ring
  { id: 'f1',   label: 'Mule A',       type: 'account',  x: 740, y: 190, fraud: true },
  { id: 'f2',   label: 'Mule B',       type: 'account',  x: 810, y: 300, fraud: true },
  { id: 'f3',   label: 'Mule C',       type: 'account',  x: 730, y: 390, fraud: true },
  { id: 'f4',   label: 'Collector',    type: 'account',  x: 900, y: 260, fraud: true },
  { id: 'fd1',  label: 'Shared Phone', type: 'device',   x: 860, y: 160, fraud: true },
  { id: 'fip1', label: 'Shared IP',    type: 'ip',       x: 870, y: 420, fraud: true },
];

const GRAPH_LINKS = [
  // Clean edges
  { s: 'a1',  t: 'b1' },   { s: 'a2',  t: 'b1' },   { s: 'a3',  t: 'b2' },
  { s: 'd1',  t: 'a1' },   { s: 'd1',  t: 'a2' },   { s: 'ip1', t: 'a1' },
  { s: 'b1',  t: 'npci' }, { s: 'b2',  t: 'npci' },
  { s: 'npci', t: 'm1' },  { s: 'npci', t: 'm2' },
  // Bridge
  { s: 'npci', t: 'b3' },  { s: 'b3',  t: 'f1' },   { s: 'b3', t: 'f2' },
  // Fraud ring internals
  { s: 'f1',  t: 'f2',  fraud: true },  { s: 'f2',  t: 'f4',  fraud: true },
  { s: 'f1',  t: 'f4',  fraud: true },  { s: 'f2',  t: 'f4',  fraud: true },
  { s: 'f3',  t: 'f4',  fraud: true },
  { s: 'fd1', t: 'f1',  fraud: true },  { s: 'fd1', t: 'f2',  fraud: true },
  { s: 'fd1', t: 'f4',  fraud: true },
  { s: 'fip1', t: 'f3', fraud: true },  { s: 'fip1', t: 'f4', fraud: true },
  // Fraud → merchant
  { s: 'f4',  t: 'm1' },
];

/* ─── Helpers ─── */

function nodeColor(n) {
  if (n.fraud) return 'var(--string)';
  switch (n.type) {
    case 'account':  return 'var(--safe)';
    case 'bank':
    case 'npci':     return 'var(--brass)';
    case 'device':   return 'var(--accent-purple)';
    case 'merchant': return 'var(--safe)';
    default:         return 'var(--text-secondary)';
  }
}

function nodeRadius(n) {
  if (n.type === 'npci')     return 14;
  if (n.type === 'bank')     return 11;
  if (n.type === 'merchant') return 9;
  if (n.id   === 'f4')       return 10;  // Collector
  if (n.type === 'device')   return 7;
  if (n.type === 'ip')       return 6;
  return 8;
}

/* ════════════════════════════════════════════════════════════
   SCENE 1 — THE PAYMENT
   ════════════════════════════════════════════════════════════ */

function ScenePayment() {
  return (
    <section className="story-scene scene-payment">
      <div className="story-sticky">
        <div className="story-label">The Thread</div>

        {/* Phone + QR illustration */}
        <div className="phone-frame">
          <svg viewBox="0 0 200 400" fill="none">
            <rect x="10" y="10" width="180" height="380" rx="30"
                  fill="var(--bg-card)" stroke="var(--border)" strokeWidth="2" />
            <rect x="22" y="45" width="156" height="310" rx="6" fill="var(--bg)" />
            <rect x="70" y="18" width="60" height="8" rx="4" fill="var(--bg)" />
          </svg>
          <div className="phone-screen">
            <div className="qr-display">
              <svg viewBox="0 0 80 80" className="qr-code">
                <rect x="2" y="2" width="76" height="76" fill="none"
                      stroke="var(--text-secondary)" strokeWidth="1.5" rx="3" />
                <rect x="8"  y="8"  width="20" height="20" fill="var(--text-secondary)" rx="2" />
                <rect x="52" y="8"  width="20" height="20" fill="var(--text-secondary)" rx="2" />
                <rect x="8"  y="52" width="20" height="20" fill="var(--text-secondary)" rx="2" />
                <rect x="34" y="34" width="12" height="12" fill="var(--text-secondary)" rx="1" />
                <rect x="12" y="12" width="12" height="12" fill="var(--bg-card)" rx="1" />
                <rect x="56" y="12" width="12" height="12" fill="var(--bg-card)" rx="1" />
                <rect x="12" y="56" width="12" height="12" fill="var(--bg-card)" rx="1" />
                <rect x="34" y="8"  width="6"  height="6"  fill="var(--text-secondary)" rx="1" opacity="0.5" />
                <rect x="52" y="34" width="8"  height="8"  fill="var(--text-secondary)" rx="1" opacity="0.5" />
                <rect x="8"  y="34" width="6"  height="10" fill="var(--text-secondary)" rx="1" opacity="0.4" />
                <rect x="34" y="52" width="10" height="6"  fill="var(--text-secondary)" rx="1" opacity="0.4" />
              </svg>
              <div className="qr-amount">₹48,200</div>
              <div className="qr-scan-label">Scan to Pay</div>
            </div>
          </div>
          <div className="phone-scan-line" />
        </div>

        <h1 className="story-headline">Every UPI payment tells a story.</h1>
        <p className="story-subtext">
          Most banks only see a transaction.{' '}
          <em>DHOKHA</em> sees the entire network.
        </p>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   SCENE 2 — THE JOURNEY
   ════════════════════════════════════════════════════════════ */

function SceneJourney() {
  const ref        = useRef(null);
  const pathRef    = useRef(null);
  const particleRef = useRef(null);
  const glowRef    = useRef(null);
  const [pathLength, setPathLength] = useState(1400);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const particleProg = useTransform(scrollYProgress, [0.1, 0.9], [0, 1]);

  /* Measure actual path length for particle positioning */
  useEffect(() => {
    if (pathRef.current) setPathLength(pathRef.current.getTotalLength());
  }, []);

  /* Move particle along the path based on scroll */
  useMotionValueEvent(particleProg, 'change', (v) => {
    if (!pathRef.current || pathLength <= 0) return;
    const pt = pathRef.current.getPointAtLength(Math.min(1, Math.max(0, v)) * pathLength);
    particleRef.current?.setAttribute('cx', pt.x);
    particleRef.current?.setAttribute('cy', pt.y);
    glowRef.current?.setAttribute('cx', pt.x);
    glowRef.current?.setAttribute('cy', pt.y);
  });

  return (
    <section ref={ref} className="story-scene scene-journey">
      <div className="story-sticky">
        <div className="story-label">The Journey</div>

        <svg className="flow-svg" viewBox="0 0 1200 380">
          <defs>
            <filter id="particleGlow">
              <feGaussianBlur stdDeviation="6" />
              <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="softGlow">
              <feGaussianBlur stdDeviation="3" />
              <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Guide path */}
          <path d={FLOW_PATH} stroke="var(--border)" strokeWidth="1.5"
                strokeDasharray="6 6" fill="none" opacity="0.6" />

          {/* Main path */}
          <path
            ref={pathRef}
            d={FLOW_PATH} stroke="var(--string)" strokeWidth="2.5"
            strokeLinecap="round" fill="none" opacity="0.8"
          />

          {/* Particle (glow + core) */}
          <circle ref={glowRef}     r="16" fill="rgba(229,72,77,0.3)" filter="url(#particleGlow)" cx="100" cy="200" />
          <circle ref={particleRef} r="6"  fill="var(--string)" cx="100" cy="200" />

          {/* Infrastructure nodes */}
          {FLOW_NODES.map((nd, i) => (
            <g key={i}>
              <circle cx={nd.x} cy={nd.y} r="22" fill="var(--bg-card)"
                      stroke="var(--border)" strokeWidth="2" />
              <circle cx={nd.x} cy={nd.y} r="5" fill="var(--string)" />
              <text x={nd.x} y={nd.y + 38} textAnchor="middle" className="flow-label">
                {nd.label}
              </text>
              <text x={nd.x} y={nd.y + 54} textAnchor="middle" className="flow-sublabel">
                {nd.sub}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   SCENE 3 — THE ANALYSIS
   ════════════════════════════════════════════════════════════ */

function SceneAnalysis() {
  return (
    <section className="story-scene scene-analysis">
      <div className="story-sticky">
        <div style={{ textAlign: 'center' }}>
          <div className="story-label">Real-Time Analysis</div>
          <h2 className="story-headline" style={{ fontSize: 'clamp(26px, 3.8vw, 46px)', marginBottom: '12px' }}>
            Seven layers. One verdict.
          </h2>
          <p className="story-subtext" style={{ marginTop: 0, marginBottom: '40px' }}>
            As the payment travels, DHOKHA silently performs real-time analysis.
          </p>
        </div>

        <div className="analysis-container">
          {/* Central pulsing indicator */}
          <div className="analysis-center">
            <div className="analysis-center-ring" />
            <div className="analysis-center-ring ring-2" />
          </div>

          {/* Floating chips */}
          {ANALYSIS_CHECKS.map((check, i) => (
            <div
              key={i}
              className="analysis-chip"
              style={{
                ...CHIP_POSITIONS[i],
                ...(i === 0 ? { transform: 'translateX(-50%)' } : {}),
              }}
            >
              <div className="chip-icon"><check.Icon size={18} /></div>
              <span>{check.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   SCENE 4 — THE GRAPH
   ════════════════════════════════════════════════════════════ */

function SceneGraph() {
  const nodeMap = useMemo(() => {
    const m = {};
    GRAPH_NODES.forEach(n => { m[n.id] = n; });
    return m;
  }, []);

  return (
    <section className="story-scene scene-graph">
      <div className="story-sticky">
        <div style={{ textAlign: 'center' }}>
          <div className="story-label">The Web</div>
          <h2 className="story-headline" style={{ fontSize: 'clamp(26px, 3.8vw, 46px)', marginBottom: '36px' }}>
            One transaction. An entire network revealed.
          </h2>
        </div>

        <svg className="graph-svg" viewBox="0 0 1000 520">
          <defs>
            <filter id="fraudGlow">
              <feGaussianBlur stdDeviation="4" />
              <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Clean edges */}
          <g>
            {GRAPH_LINKS.filter(l => !l.fraud).map((l, i) => (
              <line key={`ce${i}`}
                x1={nodeMap[l.s].x} y1={nodeMap[l.s].y}
                x2={nodeMap[l.t].x} y2={nodeMap[l.t].y}
                stroke="var(--border)" strokeWidth="1.5" />
            ))}
          </g>

          {/* Fraud edges */}
          <g>
            {GRAPH_LINKS.filter(l => l.fraud).map((l, i) => (
              <line key={`fe${i}`}
                x1={nodeMap[l.s].x} y1={nodeMap[l.s].y}
                x2={nodeMap[l.t].x} y2={nodeMap[l.t].y}
                stroke="var(--string)" strokeWidth="2.5" opacity="0.8" />
            ))}
          </g>

          {/* Fraud-ring detection ellipse */}
          <ellipse
            cx="810" cy="290" rx="175" ry="165"
            fill="none" stroke="var(--string)" strokeWidth="2"
            strokeDasharray="8 5"
          />
          <text
            x="810" y="480" textAnchor="middle"
            className="graph-detection-label"
          >
            FRAUD RING DETECTED
          </text>

          {/* Clean nodes */}
          <g>
            {GRAPH_NODES.filter(n => !n.fraud).map(n => {
              const r = nodeRadius(n);
              return (
                <g key={n.id}>
                  <circle cx={n.x} cy={n.y} r={r} fill={nodeColor(n)} stroke="var(--border)" strokeWidth="1" />
                  <text x={n.x} y={n.y + r + 14} textAnchor="middle" className="graph-node-label">
                    {n.label}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Fraud nodes */}
          <g>
            {GRAPH_NODES.filter(n => n.fraud).map(n => {
              const r = nodeRadius(n);
              return (
                <g key={n.id}>
                  <circle cx={n.x} cy={n.y} r={r + 8}
                          fill="rgba(229,72,77,0.18)" className="fraud-pulse-ring" />
                  <circle cx={n.x} cy={n.y} r={r}
                          fill={nodeColor(n)} filter="url(#fraudGlow)" />
                  <text x={n.x} y={n.y + r + 14} textAnchor="middle"
                        className="graph-node-label fraud-label">
                    {n.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   SCENE 5 — THE BLOCK
   ════════════════════════════════════════════════════════════ */

function SceneBlock() {
  return (
    <section className="story-scene scene-block">
      <div className="story-sticky">
        <div className="block-container">
          {/* Phone — blocked state */}
          <div className="phone-frame phone-blocked">
            <svg viewBox="0 0 200 400" fill="none">
              <rect x="10" y="10" width="180" height="380" rx="30"
                    fill="var(--bg-card)" stroke="var(--string)" strokeWidth="2" strokeOpacity="0.8" />
              <rect x="22" y="45" width="156" height="310" rx="6" fill="var(--bg)" />
              <rect x="70" y="18" width="60" height="8" rx="4" fill="var(--bg)" />
            </svg>
            <div className="phone-screen">
              <div className="blocked-display">
                <div className="blocked-shield">⊘</div>
                <div className="blocked-title">Transaction Blocked</div>
                <div className="blocked-amount-phone">₹48,200</div>
                <div className="blocked-status">Protected</div>
              </div>
            </div>
          </div>

          {/* Stats card */}
          <div className="block-card">
            <div className="block-stats">
              <div className="block-stat">
                <div className="block-stat-value">₹48,200</div>
                <div className="block-stat-label">Protected</div>
              </div>
              <div className="block-stat">
                <div className="block-stat-value">97%</div>
                <div className="block-stat-label">Confidence</div>
              </div>
              <div className="block-stat">
                <div className="block-stat-value">128ms</div>
                <div className="block-stat-label">Detected In</div>
              </div>
              <div className="block-stat">
                <div className="block-stat-value">Ring #47</div>
                <div className="block-stat-label">Linked Case</div>
              </div>
            </div>
            <div className="block-reason">
              <div className="block-reason-label">Reason</div>
              <div className="block-reason-text">
                Receiver belongs to a known mule network. Shared device fingerprint
                detected across 3 flagged accounts.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   SCENE 6 — THE FINALE
   ════════════════════════════════════════════════════════════ */

function SceneFinale() {
  return (
    <section className="story-scene scene-finale">
      <div className="story-sticky">
        <div className="finale-content">
          <p className="finale-headline">
            One bank saw a payment.
          </p>
          <p className="finale-headline" style={{ color: 'var(--text)' }}>
            <em>DHOKHA saw the whole web.</em>
          </p>
          <div>
            <Link to="/dashboard" className="finale-cta">
              Enter Operations Center →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════════════════════ */

export default function StoryPage() {
  return (
    <div className="story-page">
      <ScenePayment />
      <SceneJourney />
      <SceneAnalysis />
      <SceneGraph />
      <SceneBlock />
      <SceneFinale />
    </div>
  );
}
