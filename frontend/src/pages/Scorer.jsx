import { useState, useRef } from 'react';
import { scoreTransaction } from '../api/client';
import './Scorer.css';

// Presets using valid seeded database accounts (ACC-000 to ACC-039)
const PRESETS = [
  {
    label: '🔴 Suspicious — Mule Ring (High Risk)',
    data: {
      sender_upi: 'ACC-005',
      receiver_upi: 'ACC-000',
      amount: '49900',
      device_id: 'normal-device-005',
      bank: 'HDFC Bank',
      city: 'Kolkata',
    },
  },
  {
    label: '🟡 Moderate — Threshold Dodge (Medium Risk)',
    data: {
      sender_upi: 'ACC-002',
      receiver_upi: 'ACC-000',
      amount: '9999',
      device_id: 'normal-device-002',
      bank: 'State Bank of India',
      city: 'Hyderabad',
    },
  },
  {
    label: '🟢 Safe — Normal Payment (Low Risk)',
    data: {
      sender_upi: 'ACC-001',
      receiver_upi: 'ACC-002',
      amount: '500',
      device_id: 'normal-device-001',
      bank: 'ICICI Bank',
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
    transaction_id: `TXN-SCORER-${crypto.randomUUID()}`,
    sender_account_id: data.sender_upi.trim().toUpperCase(),
    receiver_account_id: data.receiver_upi.trim().toUpperCase(),
    amount: parseFloat(data.amount),
    device_fingerprint: data.device_id.trim(),
    channel: 'UPI',
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePreset = (preset) => {
    setFormData(preset.data);
    setResult(null);
    setApiError('');
  };

  const handleScore = async () => {
    setIsScoring(true);
    setResult(null);
    setApiError('');

    try {
      const res = await scoreTransaction(buildPayload(formData));
      // Prioritize final_confidence (which combines ML probability + swarm rules)
      const confidenceVal = typeof res.final_confidence === 'number' ? res.final_confidence : (res.fraud_probability || 0);
      const riskScore = Math.round(confidenceVal * 100);

      setResult({
        risk_score: riskScore,
        confidence: confidenceVal,
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
          {/* Left: Form & Model Parameters */}
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
                  <label>Sender Account / UPI ID</label>
                  <input value={formData.sender_upi} onChange={e => handleChange('sender_upi', e.target.value)} placeholder="ACC-001" />
                </div>
                <div className="form-group">
                  <label>Receiver Account / UPI ID</label>
                  <input value={formData.receiver_upi} onChange={e => handleChange('receiver_upi', e.target.value)} placeholder="ACC-000" />
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
                  <input value={formData.device_id} onChange={e => handleChange('device_id', e.target.value)} placeholder="DEV-001" />
                </div>
                <div className="form-group">
                  <label>City</label>
                  <input value={formData.city} onChange={e => handleChange('city', e.target.value)} placeholder="City" />
                </div>
              </div>

              <button className={`btn btn-primary score-btn ${isScoring ? 'scoring' : ''}`} onClick={handleScore} disabled={isScoring}>
                {isScoring ? (
                  <>
                    <span className="spinner" /> Scoring via Backend API...
                  </>
                ) : (
                  <>⚡ Score Transaction</>
                )}
              </button>
            </div>

            {/* Model Architecture & Features Card */}
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-header">
                <span className="card-title">ONNX ML & Risk Engine Parameters</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <p style={{ marginBottom: 8 }}>
                  <strong style={{ color: 'var(--text)' }}>Stage-1 Classifier:</strong> PaySim-trained LightGBM exported to ONNX format. Evaluates transaction velocity, balance changes, and graph topology.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                  <div style={{ background: 'var(--surface-quiet)', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--brass)', marginBottom: 4 }}>ML FEATURES</div>
                    <div>• amount_zscore</div>
                    <div>• oldbalanceOrg/Dest</div>
                    <div>• dest_in_degree</div>
                    <div>• dest_pagerank</div>
                  </div>
                  <div style={{ background: 'var(--surface-quiet)', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--string)', marginBottom: 4 }}>SWARM RULES</div>
                    <div>• device_account_count</div>
                    <div>• device_bank_count</div>
                    <div>• fan_in (&ge;4 in 5m)</div>
                    <div>• closes_cycle</div>
                  </div>
                </div>
              </div>
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
                    Ensure sender and receiver exist in backend seeded DB (ACC-000 to ACC-039+)
                  </div>
                </div>
              </div>
            )}

            {!result && !isScoring && !apiError && (
              <div className="empty-result card">
                <div className="empty-icon">🔍</div>
                <div className="empty-text">Submit a transaction to hit the backend API</div>
                <div className="empty-sub">Select a preset or edit form values, then click Score Transaction to get real-time risk scoring</div>
              </div>
            )}

            {isScoring && (
              <div className="scoring-anim card">
                <div className="scanning-lines">
                  <div className="scan-line" />
                  <div className="scan-line d2" />
                  <div className="scan-line d3" />
                </div>
                <div className="scoring-text">Calling POST /score...</div>
              </div>
            )}

            {result && !isScoring && (
              <div className={`result-card card result-${riskClass}`}>
                <div className="result-header">
                  <ScoreGauge score={result.risk_score} />
                  <div className="result-meta">
                    <div className={`risk-badge ${riskClass}`} style={{ fontSize: 12, padding: '5px 14px' }}>
                      <span className="dot" />
                      {result.decision?.toUpperCase() || riskClass.toUpperCase()}
                    </div>
                    <div className="result-confidence">
                      <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>CONFIDENCE</span>
                      <span className="mono" style={{ fontSize: 22, fontWeight: 700 }}>{Math.round((result.confidence || (result.risk_score / 100)) * 100)}%</span>
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
                  {result.reasons.length > 0 ? (
                    result.reasons.map((r, i) => (
                      <div className="reason-item" key={i}>
                        <div className="reason-icon">
                          {riskClass === 'low' ? '✅' : '⚠️'}
                        </div>
                        <div className="reason-text">
                          <div className="reason-detail">{r.detail}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="reason-item">
                      <div className="reason-icon">✅</div>
                      <div className="reason-text">
                        <div className="reason-detail">Normal baseline payment. No graph anomalies detected.</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
