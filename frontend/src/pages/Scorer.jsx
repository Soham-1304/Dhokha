import { useState, useEffect, useRef } from 'react';
import { scoreTransaction } from '../api/client';
import './Scorer.css';

const PRESETS = [
  {
    label: '🔴 Suspicious — Mule Ring',
    data: {
      sender_upi: 'vikram.rao@icici',
      receiver_upi: 'shell_acc_01@paytm',
      amount: '49900',
      device_id: 'DEV-X7F2-ANDROID',
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
      bank: 'Axis Bank',
      city: 'Bangalore',
    },
  },
];

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
  const [apiError, setApiError] = useState('');
  const formRef = useRef(null);

  // Build the backend payload from form data
  const buildPayload = (data) => ({
    sender_account_id: data.sender_upi,
    receiver_account_id: data.receiver_upi,
    amount: parseFloat(data.amount),
    device_fingerprint: data.device_id,
    channel: 'UPI',
  });

  // Score on mount with first preset
  useEffect(() => {
    handleScore(PRESETS[0].data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePreset = (preset) => {
    setFormData(preset.data);
    setResult(null);
    setApiError('');
  };

  const handleScore = async (overrideData) => {
    const data = overrideData || formData;
    setIsScoring(true);
    setResult(null);
    setApiError('');

    try {
      const res = await scoreTransaction(buildPayload(data));
      // Map backend response to display format
      const riskScore = Math.round(res.fraud_probability * 100);
      setResult({
        risk_score: riskScore,
        confidence: res.final_confidence,
        latency_ms: Math.round(res.latency_ms),
        decision: res.decision,
        suspected_swarm_types: res.suspected_swarm_types || [],
        reasons: (res.top_reasons || []).map((reason, i) => ({
          type: reason.split(':')[0]?.trim() || `SIGNAL_${i + 1}`,
          detail: reason,
          weight: 1 / (res.top_reasons?.length || 1),
        })),
      });
    } catch (err) {
      setApiError(err.message || 'Failed to reach scoring API');
    } finally {
      setIsScoring(false);
    }
  };

  const riskClass = result ? (result.risk_score >= 80 ? 'critical' : result.risk_score >= 60 ? 'high' : result.risk_score >= 35 ? 'medium' : 'low') : '';

  return (
    <div className="page animate-in">
      <div className="topbar">
        <div className="topbar-left">
          <h1>Transaction Scorer</h1>
          <span className="tag gold">LIVE API</span>
        </div>
      </div>

      <div className="page-content">
        <div className="scorer-layout">
          {/* Left: Form */}
          <div className="scorer-form-panel">
            <div className="card">
              <div className="card-header">
                <span className="card-title">Transaction Details</span>
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
                  <label>City</label>
                  <input value={formData.city} onChange={e => handleChange('city', e.target.value)} placeholder="City" />
                </div>
              </div>

              <button className={`btn btn-primary score-btn ${isScoring ? 'scoring' : ''}`} onClick={() => handleScore()} disabled={isScoring}>
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
            {apiError && (
              <div className="card" style={{ borderColor: 'rgba(229, 72, 77, 0.4)' }}>
                <div style={{ padding: '24px', textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
                  <div style={{ color: 'var(--string)', fontWeight: 600, marginBottom: '8px' }}>Scoring API Error</div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '13px' }}>{apiError}</div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '11px', marginTop: '12px' }}>
                    Make sure the backend is running at the configured API URL
                  </div>
                </div>
              </div>
            )}

            {!result && !isScoring && !apiError && (
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
                <div className="scoring-text">Scoring via backend API...</div>
              </div>
            )}

            {result && !isScoring && (
              <div className={`result-card card result-${riskClass}`}>
                <div className="result-header">
                  <ScoreGauge score={result.risk_score} />
                  <div className="result-meta">
                    <div className={`risk-badge ${riskClass}`} style={{ fontSize: 12, padding: '5px 14px' }}>
                      <span className="dot" />
                      {result.decision || riskClass.toUpperCase()}
                    </div>
                    <div className="result-confidence">
                      <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>CONFIDENCE</span>
                      <span className="mono" style={{ fontSize: 22, fontWeight: 700 }}>{Math.round(result.confidence * 100)}%</span>
                    </div>
                    <div className="latency-badge">
                      <span className="lightning">⚡</span>
                      Scored in {result.latency_ms}ms
                    </div>
                    {result.suspected_swarm_types.length > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                        SWARM: {result.suspected_swarm_types.join(', ')}
                      </div>
                    )}
                  </div>
                </div>

                <div className="result-divider" />

                <div className="result-reasons">
                  <div className="card-title" style={{ marginBottom: 12 }}>EXPLAINABILITY — WHY WAS THIS FLAGGED?</div>
                  {result.reasons.map((r, i) => (
                    <div className="reason-item" key={i}>
                      <div className="reason-icon">
                        {riskClass === 'low' ? '✅' : '⚠️'}
                      </div>
                      <div className="reason-text">
                        <div className="reason-detail">{r.detail}</div>
                      </div>
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
