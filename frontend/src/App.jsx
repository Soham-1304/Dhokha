import CustomCursor from './components/CustomCursor';
import Reveal from './components/Reveal';
import Board from './components/Board';

export default function App() {
  return (
    <>
      <CustomCursor />

      <nav>
        <div className="logo">DHOKHA<span>.</span></div>
        <div className="nav-links">
          <a href="#problem">The Blind Spot</a>
          <a href="#capabilities">Case Files</a>
          <a href="#cta">Access</a>
        </div>
        <div className="case-toggle"><span className="dot"></span> CASE: OPEN</div>
      </nav>

      <section className="hero">
        <div className="stamp">Cross-Bank Investigation Unit</div>
        <h1 className="headline">One bank sees a thread.<br/><em>Dhokha</em> sees the whole web.</h1>
        <p className="sub">Fraud rings move across banks on purpose — so no single institution ever sees the full chain. We connect the dots in real time, before the money disappears.</p>
        <div className="cta-row">
          <button className="btn btn-primary" data-hover="true">See it in action</button>
          <button className="btn btn-stamp" data-hover="true">Request Case File</button>
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

      <section id="capabilities">
        <div className="container">
          <Reveal style={{ textAlign: 'center', marginBottom: '56px' }}>
            <div className="eyebrow">Case Files</div>
            <h2>Three ways we crack the ring.</h2>
          </Reveal>
          <div className="files">
            <Reveal className="file">
              <span className="tag">FILE 01 — SPEED</span>
              <h3>Scored under 200ms</h3>
              <p>Every transaction gets a behavioral and device-risk score before it settles — fast enough to sit in the live payment path, not just a nightly batch report.</p>
            </Reveal>
            <Reveal className="file">
              <span className="tag">FILE 02 — NETWORK</span>
              <h3>Cross-bank identity graph</h3>
              <p>Devices and identities are correlated across institutions, exposing rings that would look like unrelated, isolated accounts to any single bank.</p>
            </Reveal>
            <Reveal className="file">
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
          <button className="btn btn-primary" data-hover="true">Open the Case</button>
          <button className="btn btn-stamp" data-hover="true">Talk to the Team</button>
        </Reveal>
      </section>

      <footer>
        <div>DHOKHA — Shared intelligence for modern banking.</div>
        <div>CASE FILE NO. 2026-UPI-0004</div>
      </footer>
    </>
  );
}
