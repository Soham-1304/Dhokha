import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Network, ShieldCheck, Users, ArrowDownToDot, Repeat, MonitorSmartphone } from 'lucide-react';
import CustomCursor from '../components/landing/CustomCursor';
import Reveal from '../components/landing/Reveal';
import Board from '../components/landing/Board';

export default function Landing() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    return saved;
  });

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('theme', nextTheme);
  };

  return (
    <div className="landing-page">
      <CustomCursor />

      <nav>
        <Link to="/" className="logo" style={{ textDecoration: 'none' }}>DHOKHA<span>.</span></Link>
        <div className="nav-links">
          <Link to="/dashboard">Dashboard</Link>
          <button 
            onClick={toggleTheme} 
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--text-dim)', 
              fontSize: '14px', 
              fontWeight: 500, 
              cursor: 'pointer',
              padding: 0
            }}
          >
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
          <Link to="#">Sign Up</Link>
          <Link to="#">Login</Link>
        </div>
        <div className="case-toggle"><span className="dot"></span> CASE: OPEN</div>
      </nav>

      <section className="hero">
        <div className="stamp">Cross-Bank Investigation Unit</div>
        <h1 className="headline">One bank sees a thread.<br/><em>Dhokha</em> sees the whole web.</h1>
        <p className="sub">Fraud rings move across banks on purpose — so no single institution ever sees the full chain. We connect the dots in real time, before the money disappears.</p>
        <div className="cta-row">
          <Link to="/dashboard" className="btn btn-primary" data-hover="true" style={{ textDecoration: 'none' }}>See it in action</Link>
          <Link to="/dashboard" className="btn btn-stamp" data-hover="true" style={{ textDecoration: 'none' }}>Request Case File</Link>
        </div>

        <Board />
      </section>

      <section id="problem">
        <div className="container split">
          <Reveal>
            <div className="eyebrow">The Blind Spot</div>
            <h2>Every bank is investigating the same case — separately, and half-blind.</h2>
            <p className="lead">Each institution only sees its own accounts. A ring that hops through three banks looks, to each of them, like three unrelated stories. Nobody connects the string.</p>
            <p className="lead">Dhokha sits above the banks, correlating device fingerprints, identities, and transaction timing across institutions — turning three separate, quiet case files into one obvious pattern.</p>
          </Reveal>
          <Reveal className="mini-boards">
            <div className="mini-board">
              <div className="label">WITHOUT DHOKHA</div>
              <div className="dots"><div className="n"></div><div className="n"></div><div className="n"></div><div className="n"></div><div className="n"></div></div>
            </div>
            <div className="mini-board">
              <div className="label">WITH DHOKHA</div>
              <div className="dots connected"><div className="n"></div><div className="n"></div><div className="n"></div><div className="n"></div><div className="n"></div></div>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="typologies" style={{ background: 'var(--board)' }}>
        <div className="container">
          <Reveal style={{ textAlign: 'center', marginBottom: '56px' }}>
            <div className="eyebrow">Swarm Typologies</div>
            <h2>Patterns we expose.</h2>
            <p className="lead" style={{ margin: '0 auto', maxWidth: '600px' }}>Our graph engine identifies complex orchestration that traditional rule engines miss.</p>
          </Reveal>
          <div className="files-4">
            <Reveal className="file" style={{ textAlign: 'center' }}>
              <Users size={32} color="var(--string)" style={{ margin: '0 auto 16px' }} />
              <h3>A. Identity Fan-Out</h3>
              <p>One compromised identity opening multiple accounts across different institutions simultaneously.</p>
            </Reveal>
            <Reveal className="file" style={{ textAlign: 'center' }}>
              <ArrowDownToDot size={32} color="var(--string)" style={{ margin: '0 auto 16px' }} />
              <h3>B. Mule Fan-In</h3>
              <p>Multiple victim accounts funneling funds into a single, central collector account rapidly.</p>
            </Reveal>
            <Reveal className="file" style={{ textAlign: 'center' }}>
              <Repeat size={32} color="var(--string)" style={{ margin: '0 auto 16px' }} />
              <h3>C. Layering Chain</h3>
              <p>Funds hopping quickly through a chain of accounts across 3+ banks to obfuscate the origin.</p>
            </Reveal>
            <Reveal className="file" style={{ textAlign: 'center' }}>
              <MonitorSmartphone size={32} color="var(--string)" style={{ margin: '0 auto 16px' }} />
              <h3>D. Device Cluster</h3>
              <p>A single device orchestrating transactions for many seemingly unrelated accounts.</p>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="how-it-works">
        <div className="container">
          <Reveal style={{ textAlign: 'center', marginBottom: '56px' }}>
            <div className="eyebrow">The Pipeline</div>
            <h2>How It Works</h2>
          </Reveal>
          <Reveal className="stats-strip" style={{ justifyContent: 'space-around', borderBottom: 'none', padding: '20px 0' }}>
            <div className="stat" style={{ textAlign: 'center', flex: 1, minWidth: '250px', marginBottom: '24px' }}>
              <div className="num" style={{ fontSize: '24px' }}>Step 1</div>
              <div className="lab" style={{ color: 'var(--text)', fontSize: '16px', margin: '12px 0' }}>Transaction Intercept</div>
              <p style={{ color: 'var(--text-dim)', fontSize: '14px', lineHeight: 1.5, maxWidth: '280px', margin: '0 auto', textTransform: 'none', letterSpacing: 'normal' }}>Payload arrives. We check historical activity and device fingerprints across the network.</p>
            </div>
            <div className="stat" style={{ textAlign: 'center', flex: 1, minWidth: '250px', marginBottom: '24px' }}>
              <div className="num" style={{ fontSize: '24px' }}>Step 2</div>
              <div className="lab" style={{ color: 'var(--text)', fontSize: '16px', margin: '12px 0' }}>Stage 1 Score (&lt;200ms)</div>
              <p style={{ color: 'var(--text-dim)', fontSize: '14px', lineHeight: 1.5, maxWidth: '280px', margin: '0 auto', textTransform: 'none', letterSpacing: 'normal' }}>LightGBM model assigns a baseline risk score based on node-level features.</p>
            </div>
            <div className="stat" style={{ textAlign: 'center', flex: 1, minWidth: '250px', marginBottom: '24px' }}>
              <div className="num" style={{ fontSize: '24px' }}>Step 3</div>
              <div className="lab" style={{ color: 'var(--text)', fontSize: '16px', margin: '12px 0' }}>Stage 2 Swarm Detection</div>
              <p style={{ color: 'var(--text-dim)', fontSize: '14px', lineHeight: 1.5, maxWidth: '280px', margin: '0 auto', textTransform: 'none', letterSpacing: 'normal' }}>High-risk nodes trigger graph propagation, uncovering the full cross-bank ring.</p>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="capabilities" style={{ background: 'var(--board)' }}>
        <div className="container">
          <Reveal style={{ textAlign: 'center', marginBottom: '56px' }}>
            <div className="eyebrow">Case Files</div>
            <h2>Three ways we crack the ring.</h2>
          </Reveal>
          <div className="files">
            <Reveal className="file">
              <Zap size={24} color="var(--brass)" style={{ marginBottom: '16px' }} />
              <span className="tag">FILE 01 — SPEED</span>
              <h3>Scored under 200ms</h3>
              <p>Every transaction gets a behavioral and device-risk score before it settles — fast enough to sit in the live payment path, not just a nightly batch report.</p>
            </Reveal>
            <Reveal className="file">
              <Network size={24} color="var(--brass)" style={{ marginBottom: '16px' }} />
              <span className="tag">FILE 02 — NETWORK</span>
              <h3>Cross-bank identity graph</h3>
              <p>Devices and identities are correlated across institutions, exposing rings that would look like unrelated, isolated accounts to any single bank.</p>
            </Reveal>
            <Reveal className="file">
              <ShieldCheck size={24} color="var(--brass)" style={{ marginBottom: '16px' }} />
              <span className="tag">FILE 03 — PROOF</span>
              <h3>Explainable, not a black box</h3>
              <p>Every flag ships with the exact reasons behind it — fan-in spikes, new devices, timing anomalies — so a fraud analyst can act with confidence, not guesswork.</p>
            </Reveal>
          </div>
        </div>
      </section>

      <section>
        <div className="container">
          <Reveal className="stats-strip">
            <div className="stat"><div className="num">&lt;200ms</div><div className="lab">Scoring Latency</div></div>
            <div className="stat"><div className="num">04</div><div className="lab">Swarm Patterns Tracked</div></div>
            <div className="stat"><div className="num">24/7</div><div className="lab">Live Monitoring</div></div>
          </Reveal>
        </div>
      </section>

      <section className="final" id="cta">
        <Reveal className="stamp">Case Status: Active</Reveal>
        <Reveal><h2>Stop investigating fraud one bank at a time.</h2></Reveal>
        <Reveal className="sub" style={{ marginLeft: 'auto', marginRight: 'auto' }}>See how Dhokha traces a live scam ring across three banks in real time.</Reveal>
        <Reveal className="cta-row" style={{ marginTop: '36px' }}>
          <Link to="/dashboard" className="btn btn-primary" data-hover="true" style={{ textDecoration: 'none' }}>Open the Case</Link>
          <Link to="/dashboard" className="btn btn-stamp" data-hover="true" style={{ textDecoration: 'none' }}>Talk to the Team</Link>
        </Reveal>
      </section>

      <footer>
        <div>DHOKHA — Shared intelligence for modern banking.</div>
        <div>
          <Link to="/dashboard" style={{ color: 'var(--text-dim)', textDecoration: 'none' }} data-hover="true">Open Investigation Dashboard</Link>
        </div>
      </footer>
    </div>
  );
}
