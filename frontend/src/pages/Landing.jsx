import { Link } from 'react-router-dom';
import Board from '../components/landing/Board';
import Reveal from '../components/landing/Reveal';
import { Zap, Network, FileText, Eye, GitBranch, Cpu } from 'lucide-react';

const SWARM_TYPES = [
  {
    id: 'A',
    label: 'Identity Fan-Out',
    tag: 'TYPE A',
    desc: '1 PAN/Aadhaar controls accounts across N banks, firing near-simultaneous transactions to stay under every bank\'s alert threshold.',
    icon: '⬡',
    glyph: 'A',
    color: '#3b82f6',
  },
  {
    id: 'B',
    label: 'Mule Fan-In',
    tag: 'TYPE B',
    desc: 'Many unrelated victims funnel payments into a single collector account in a short burst — the classic scam mule pattern.',
    icon: '⬡',
    glyph: 'B',
    color: '#22c55e',
  },
  {
    id: 'C',
    label: 'Layering Chain',
    tag: 'TYPE C',
    desc: 'Money hops sequentially through several accounts across banks to obscure origin, sometimes looping into a ring.',
    icon: '⬡',
    glyph: 'C',
    color: '#f59e0b',
  },
  {
    id: 'D',
    label: 'Device Cluster',
    tag: 'TYPE D',
    desc: 'Accounts that look unrelated on paper are all operated from the same device fingerprint — invisible to each bank, obvious from above.',
    icon: '⬡',
    glyph: 'D',
    color: '#e5484d',
    lead: true,
  },
];

const STEPS = [
  {
    num: '01',
    label: 'Transaction fires',
    desc: 'A UPI/NEFT/IMPS payment hits the live scoring endpoint. Device fingerprint, velocity, and context captured.',
    icon: Zap,
  },
  {
    num: '02',
    label: 'Stage 1 — <200ms',
    desc: 'LightGBM model scores behavioral + graph features. SHAP values computed. Fraud probability returned with full explanation.',
    icon: Cpu,
  },
  {
    num: '03',
    label: 'Stage 2 — Ring confirmed',
    desc: 'Graph propagation lights up the entire connected swarm within seconds. Cross-bank alert fired. Analysts act.',
    icon: Network,
  },
];

export default function Landing() {
  return (
    <>
      {/* NAV */}
      <nav>
        <Link to="/" className="logo" style={{ textDecoration: 'none' }}>
          DHOKHA<span>.</span>
        </Link>
        <div className="nav-links">
          <a href="#problem">The Blind Spot</a>
          <a href="#typologies">Swarm Types</a>
          <a href="#capabilities">Case Files</a>
          <Link to="/dashboard" style={{ color: 'var(--string)', fontWeight: 600 }}>
            Live Dashboard
          </Link>
        </div>
        <div className="case-toggle">
          <span className="dot"></span> CASE: OPEN
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="stamp">Cross-Bank Investigation Unit</div>
        <h1 className="headline">
          One bank sees a thread.<br />
          <em>Dhokha</em> sees the whole web.
        </h1>
        <p className="sub">
          Fraud rings move across banks on purpose — so no single institution ever sees the full chain.
          We connect the dots in real time, before the money disappears.
        </p>
        <div className="cta-row">
          <Link to="/dashboard">
            <button className="btn btn-primary" data-hover="true">See it in action</button>
          </Link>
          <button className="btn btn-stamp" data-hover="true">Request Case File</button>
        </div>
        <Board />
      </section>

      {/* BLIND SPOT */}
      <section id="problem">
        <div className="container split">
          <Reveal>
            <div className="eyebrow">The Blind Spot</div>
            <h2>Every bank is investigating the same case — separately, and half-blind.</h2>
            <p className="lead">
              Each institution only sees its own accounts. A ring that hops through three banks looks,
              to each of them, like three unrelated stories. Nobody connects the string.
            </p>
            <p className="lead">
              Dhokha sits above the banks, correlating device fingerprints, identities, and transaction
              timing across institutions — turning three separate quiet case files into one obvious pattern.
            </p>
          </Reveal>
          <Reveal className="mini-boards">
            <div className="mini-board">
              <div className="label">WITHOUT DHOKHA</div>
              <div className="dots">
                <div className="n"></div><div className="n"></div><div className="n"></div>
                <div className="n"></div><div className="n"></div>
              </div>
            </div>
            <div className="mini-board">
              <div className="label">WITH DHOKHA</div>
              <div className="dots connected">
                <div className="n"></div><div className="n"></div><div className="n"></div>
                <div className="n"></div><div className="n"></div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* SWARM TYPOLOGIES */}
      <section id="typologies" style={{ paddingTop: '80px' }}>
        <div className="container">
          <Reveal style={{ textAlign: 'center', marginBottom: '56px' }}>
            <div className="eyebrow">Swarm Patterns</div>
            <h2>Four ways fraud rings hide in plain sight.</h2>
            <p className="lead" style={{ maxWidth: 540, margin: '0 auto' }}>
              We track four distinct swarm typologies — each with its own graph signature, features, and detection path.
            </p>
          </Reveal>
          <div className="typology-grid">
            {SWARM_TYPES.map((s) => (
              <Reveal key={s.id} className={`typology-card${s.lead ? ' typology-lead' : ''}`}>
                <div className="typology-header">
                  <span className="typology-tag" style={{ color: s.color, borderColor: `${s.color}44` }}>
                    {s.tag}
                  </span>
                  {s.lead && <span className="lead-badge">LEAD DEMO</span>}
                </div>
                <div className="typology-glyph" style={{ color: s.color }}>{s.glyph}</div>
                <h3>{s.label}</h3>
                <p>{s.desc}</p>
                <Link to="/dashboard" className="typology-link" data-hover="true">
                  See in dashboard →
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" style={{ paddingTop: '80px' }}>
        <div className="container">
          <Reveal style={{ textAlign: 'center', marginBottom: '56px' }}>
            <div className="eyebrow">How It Works</div>
            <h2>Two-stage detection. One decisive answer.</h2>
          </Reveal>
          <div className="steps-row">
            {STEPS.map((step, i) => (
              <Reveal key={step.num} className="step-card">
                <div className="step-num">{step.num}</div>
                <div className="step-icon-wrap">
                  <step.icon size={22} strokeWidth={1.5} color="var(--string)" />
                </div>
                <h3>{step.label}</h3>
                <p>{step.desc}</p>
                {i < STEPS.length - 1 && <div className="step-arrow">→</div>}
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CASE FILES */}
      <section id="capabilities" style={{ paddingTop: '80px' }}>
        <div className="container">
          <Reveal style={{ textAlign: 'center', marginBottom: '56px' }}>
            <div className="eyebrow">Case Files</div>
            <h2>Three ways we crack the ring.</h2>
          </Reveal>
          <div className="files">
            <Reveal className="file">
              <div className="file-icon-row">
                <Zap size={18} strokeWidth={1.5} color="var(--brass)" />
              </div>
              <span className="tag">FILE 01 — SPEED</span>
              <h3>Scored under 200ms</h3>
              <p>Every transaction gets a behavioral and device-risk score before it settles — fast enough to sit in the live payment path, not just a nightly batch report.</p>
            </Reveal>
            <Reveal className="file">
              <div className="file-icon-row">
                <Network size={18} strokeWidth={1.5} color="var(--brass)" />
              </div>
              <span className="tag">FILE 02 — NETWORK</span>
              <h3>Cross-bank identity graph</h3>
              <p>Devices and identities are correlated across institutions, exposing rings that would look like unrelated, isolated accounts to any single bank.</p>
            </Reveal>
            <Reveal className="file">
              <div className="file-icon-row">
                <FileText size={18} strokeWidth={1.5} color="var(--brass)" />
              </div>
              <span className="tag">FILE 03 — PROOF</span>
              <h3>Explainable, not a black box</h3>
              <p>Every flag ships with the exact reasons behind it — fan-in spikes, new devices, timing anomalies — so a fraud analyst can act with confidence, not guesswork.</p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section>
        <div className="container">
          <Reveal className="stats-strip">
            <div className="stat">
              <div className="num">&lt;200ms</div>
              <div className="lab">Scoring Latency</div>
            </div>
            <div className="stat">
              <div className="num">04</div>
              <div className="lab">Swarm Patterns Tracked</div>
            </div>
            <div className="stat">
              <div className="num">24/7</div>
              <div className="lab">Live Monitoring</div>
            </div>
            <div className="stat">
              <div className="num">3+</div>
              <div className="lab">Banks Correlated</div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="final" id="cta">
        <Reveal className="stamp">Case Status: Active</Reveal>
        <Reveal><h2>Stop investigating fraud one bank at a time.</h2></Reveal>
        <Reveal className="sub" style={{ marginLeft: 'auto', marginRight: 'auto' }}>
          See how Dhokha traces a live scam ring across three banks in real time.
        </Reveal>
        <Reveal className="cta-row" style={{ marginTop: '36px' }}>
          <Link to="/dashboard">
            <button className="btn btn-primary" data-hover="true">Open the Case</button>
          </Link>
          <button className="btn btn-stamp" data-hover="true">Talk to the Team</button>
        </Reveal>
      </section>

      {/* FOOTER */}
      <footer>
        <div>DHOKHA — Shared intelligence for modern banking.</div>
        <Link to="/dashboard" style={{ color: 'var(--string)', textDecoration: 'none', fontFamily: 'inherit', fontSize: 'inherit' }}>
          Open Investigation Dashboard →
        </Link>
        <div>CASE FILE NO. 2026-UPI-0004</div>
      </footer>
    </>
  );
}
