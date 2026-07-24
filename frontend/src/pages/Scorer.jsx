import { useState, useEffect, useRef } from 'react';
import './Scorer.css';

const PRESETS = [
  {
    label: '🔴 Suspicious — Mule Ring',
    data: {
      sender_upi: 'vikram.rao@icici',
      receiver_upi: 'shell_acc_01@paytm',
      amount: '49900',
      device_id: 'DEV-X7F2-ANDROID',
      ip: '103.47.112.54',
      bank: 'ICICI Bank',
      city: 'Kolkata',
    },
  },
  {
    label: '🟡 Moderate — Threshold Dodge',
    data: {
      sender_upi: 'deepak.raj@ybl',
      receiver_upi: 'mule_acc_02@icici',
      amount: '9999',
      device_id: 'DEV-X7F2-ANDROID',
      ip: '103.47.112.54',
      bank: 'HDFC Bank',
      city: 'Hyderabad',
    },
  },
  {
    label: '🟢 Safe — Normal Payment',
    data: {
      sender_upi: 'sneha.patel@ybl',
      receiver_upi: 'genuine_shop@razorpay',
      amount: '2499',
      device_id: 'DEV-K2L8-IPHONE',
      ip: '106.51.72.33',
      bank: 'Axis Bank',
      city: 'Bangalore',
    },
  },
];

// Simulated scoring logic (mimics backend response)
function simulateScore(formData) {
  const startTime = performance.now();

  let score = 0;
  const reasons = [];

  const amt = parseFloat(formData.amount);
  
  // 1. Structuring / Velocity checks
  if (amt >= 49000 && amt <= 50000) {
    score += 35;
    reasons.push({ type: 'STRUCTURING_ATTEMPT', detail: `Amount ₹${amt.toLocaleString('en-IN')} is designed to evade the ₹50k PAN/reporting threshold.`, weight: 0.35 });
  } else if (amt > 100000) {
    score += 20;
    reasons.push({ type: 'HIGH_VALUE_ANOMALY', detail: `Transfer value (₹${amt.toLocaleString('en-IN')}) is 400% higher than sender's historical average.`, weight: 0.20 });
  }

  // 2. Network / Mule checks
  if (formData.receiver_upi.includes('shell_') || formData.receiver_upi.includes('mule_')) {
    score += 40;
    reasons.push({ type: 'KNOWN_MULE_ACCOUNT', detail: `Receiver (${formData.receiver_upi}) was flagged in 3 other fraud cases this week.`, weight: 0.40 });
  }

  // 3. Device & Identity checks
  if (formData.device_id === 'DEV-X7F2-ANDROID' || formData.device_id.includes('EMULATOR')) {
    score += 25;
    reasons.push({ type: 'DEVICE_FINGERPRINT', detail: `Device ${formData.device_id} is concurrently logged into 14 different bank accounts.`, weight: 0.25 });
  }

  // 4. IP / Geo checks
  if (formData.ip.startsWith('103.47') || formData.ip.startsWith('192.168')) {
    score += 15;
    reasons.push({ type: 'GEO_ANOMALY', detail: `IP Address ${formData.ip} indicates a known VPN/Proxy exit node.`, weight: 0.15 });
  }

  // Normal transaction (if nothing triggered)
  if (score === 0) {
    score = Math.floor(Math.random() * 15) + 3;
    reasons.push({ type: 'VERIFIED_SAFE', detail: 'Historical baseline matches. Device and IP are trusted. No network anomalies.', weight: 1.0 });
  }

  score = Math.min(score, 99);
  const latency = Math.round(performance.now() - startTime) + Math.floor(Math.random() * 80) + 40; // realistic 40-120ms
  const confidence = score > 50 ? 0.88 + Math.random() * 0.10 : 0.95 + Math.random() * 0.04;

  return {
    risk_score: score,
    confidence,
    latency_ms: Math.min(latency, 195),
    reasons,
  };
}

function ScoreGauge({ score, size = 180 }) {
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  let color = '#3fb67f';
  if (score >= 80) color = '#e5484d';
  else if (score >= 60) color = '#e5844d';
  else if (score >= 35) color = '#f5a623';

  return (
    <div className="score-gauge">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.05)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${progress} ${circumference - progress}`}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dasharray 1s ease, stroke 0.5s ease' }}
          opacity={0.9}
        />
      </svg>
      <div className="score-gauge-inner">
        <div className="score-gauge-number" style={{ color }}>{score}</div>
        <div className="score-gauge-label">RISK SCORE</div>
      </div>
    </div>
  );
}

export default function Scorer() {
  const [formData, setFormData] = useState(PRESETS[0].data);
  const [result, setResult] = useState(null);
  const [isScoring, setIsScoring] = useState(false);
  const formRef = useRef(null);

  // Auto-load the first preset and score it on mount
  useEffect(() => {
    setIsScoring(true);
    setTimeout(() => {
      setResult(simulateScore(PRESETS[0].data));
      setIsScoring(false);
    }, 600);
  }, []);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePreset = (preset) => {
    setFormData(preset.data);
    setResult(null);
  };

  const handleScore = () => {
    setIsScoring(true);
    setResult(null);

    // Simulate API call delay
    setTimeout(() => {
      const res = simulateScore(formData);
      setResult(res);
      setIsScoring(false);
    }, 300 + Math.random() * 400);
  };

  const riskClass = result ? (result.risk_score >= 80 ? 'critical' : result.risk_score >= 60 ? 'high' : result.risk_score >= 35 ? 'medium' : 'low') : '';

  return (
    <div className="page animate-in">
      <div className="topbar">
        <div className="topbar-left">
          <h1>Transaction Scorer</h1>
          <span className="tag gold">INTERACTIVE DEMO</span>
        </div>
      </div>

      <div className="page-content">
        <div className="scorer-layout">
          {/* Left: Form */}
          <div className="scorer-form-panel">
            <div className="card">
              <div className="card-header">
                <span className="card-title">📝 Transaction Details</span>
              </div>

              {/* Presets */}
              <div className="preset-row">
                {PRESETS.map((p, i) => (
                  <button
                    key={i}
                    className={`preset-btn ${JSON.stringify(formData) === JSON.stringify(p.data) ? 'active' : ''}`}
                    onClick={() => handlePreset(p)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="form-grid" ref={formRef}>
                <div className="form-group">
                  <label>Sender UPI ID</label>
                  <input value={formData.sender_upi} onChange={e => handleChange('sender_upi', e.target.value)} placeholder="user@bank" />
                </div>
                <div className="form-group">
                  <label>Receiver UPI ID</label>
                  <input value={formData.receiver_upi} onChange={e => handleChange('receiver_upi', e.target.value)} placeholder="receiver@bank" />
                </div>
                <div className="form-group">
                  <label>Amount (₹)</label>
                  <input type="number" value={formData.amount} onChange={e => handleChange('amount', e.target.value)} placeholder="10000" />
                </div>
                <div className="form-group">
                  <label>Bank</label>
                  <input value={formData.bank} onChange={e => handleChange('bank', e.target.value)} placeholder="Bank name" />
                </div>
                <div className="form-group">
                  <label>Device ID</label>
                  <input value={formData.device_id} onChange={e => handleChange('device_id', e.target.value)} placeholder="DEV-XXXX" />
                </div>
                <div className="form-group">
                  <label>IP Address</label>
                  <input value={formData.ip} onChange={e => handleChange('ip', e.target.value)} placeholder="0.0.0.0" />
                </div>
              </div>

              <button className={`btn btn-primary score-btn ${isScoring ? 'scoring' : ''}`} onClick={handleScore} disabled={isScoring}>
                {isScoring ? (
                  <>
                    <span className="spinner" /> Scoring...
                  </>
                ) : (
                  <>⚡ Score Transaction</>
                )}
              </button>
            </div>
          </div>

          {/* Right: Result */}
          <div className="scorer-result-panel">
            {!result && !isScoring && (
              <div className="empty-result card">
                <div className="empty-icon">🔍</div>
                <div className="empty-text">Submit a transaction to see<br />real-time fraud scoring</div>
                <div className="empty-sub">Try different presets to see how<br />the engine responds</div>
              </div>
            )}

            {isScoring && (
              <div className="scoring-anim card">
                <div className="scanning-lines">
                  <div className="scan-line" />
                  <div className="scan-line d2" />
                  <div className="scan-line d3" />
                </div>
                <div className="scoring-text">Analyzing transaction...</div>
              </div>
            )}

            {result && !isScoring && (
              <div className={`result-card card result-${riskClass}`}>
                <div className="result-header">
                  <ScoreGauge score={result.risk_score} />
                  <div className="result-meta">
                    <div className={`risk-badge ${riskClass}`} style={{ fontSize: 12, padding: '5px 14px' }}>
                      <span className="dot" />
                      {riskClass.toUpperCase()}
                    </div>
                    <div className="result-confidence">
                      <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>CONFIDENCE</span>
                      <span className="mono" style={{ fontSize: 22, fontWeight: 700 }}>{Math.round(result.confidence * 100)}%</span>
                    </div>
                    <div className="latency-badge">
                      <span className="lightning">⚡</span>
                      Scored in {result.latency_ms}ms
                    </div>
                  </div>
                </div>

                <div className="result-divider" />

                <div className="result-reasons">
                  <div className="card-title" style={{ marginBottom: 12 }}>🔎 EXPLAINABILITY — WHY WAS THIS FLAGGED?</div>
                  {result.reasons.map((r, i) => (
                    <div className="reason-item" key={i}>
                      <div className="reason-icon">
                        {r.type === 'VERIFIED_SAFE' ? '✅' : '⚠️'}
                      </div>
                      <div className="reason-text">
                        <div className="reason-type">{r.type.replace(/_/g, ' ')}</div>
                        <div className="reason-detail">{r.detail}</div>
                      </div>
                      <div className="reason-weight">{Math.round(r.weight * 100)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
