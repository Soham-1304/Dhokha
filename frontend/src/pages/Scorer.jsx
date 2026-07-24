import { useEffect, useRef, useState } from 'react';
import {
  API_BASE_URL,
  connectEventStream,
  evaluateTransaction,
  getHealth,
  scoreTransaction,
} from '../api/client';
import './Scorer.css';

const PRESETS = [
  {
    id: 'high',
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
    modelProfile: 'high',
  },
  {
    id: 'medium',
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
    modelProfile: 'medium',
  },
  {
    id: 'low',
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
    modelProfile: 'low',
  },
];

function buildModelPayload(formData, profile) {
  const amount = Number(formData.amount);

  if (profile === 'high') {
    return {
      amount,
      oldbalanceOrg: amount,
      newbalanceOrig: 0,
      oldbalanceDest: 0,
      newbalanceDest: 0,
      dest_in_degree: 45,
      dest_out_degree: 12,
      dest_pagerank: 0.0024,
      is_merchant: 0,
    };
  }

  if (profile === 'medium') {
    return {
      amount,
      oldbalanceOrg: 0,
      newbalanceOrig: 0,
      oldbalanceDest: 1000,
      newbalanceDest: 1000,
      dest_in_degree: 1,
      dest_out_degree: 50,
      dest_pagerank: 0.0001,
      is_merchant: 1,
    };
  }

  const oldbalanceOrg = Math.max(50_000, amount * 10);
  const oldbalanceDest = 100_000;
  return {
    amount,
    oldbalanceOrg,
    newbalanceOrig: oldbalanceOrg - amount,
    oldbalanceDest,
    newbalanceDest: oldbalanceDest + amount,
    dest_in_degree: 3,
    dest_out_degree: 8,
    dest_pagerank: 0.0001,
    is_merchant: 1,
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
  const [activePreset, setActivePreset] = useState(PRESETS[0]);
  const [result, setResult] = useState(null);
  const [isScoring, setIsScoring] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [streamStatus, setStreamStatus] = useState('connecting');
  const [error, setError] = useState('');
  const [pipelineForm, setPipelineForm] = useState({
    sender_account_id: 'ACC-000',
    receiver_account_id: 'ACC-001',
    amount: '800',
    device_fingerprint: 'normal-device-000',
  });
  const [pipelineResult, setPipelineResult] = useState(null);
  const [pipelineError, setPipelineError] = useState('');
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const formRef = useRef(null);

  useEffect(() => {
    let active = true;
    getHealth()
      .then(health => {
        if (active) setBackendStatus(health.model_ready ? 'online' : 'degraded');
      })
      .catch(() => {
        if (active) setBackendStatus('offline');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const socket = connectEventStream({
      onOpen: () => setStreamStatus('online'),
      onError: () => setStreamStatus('offline'),
      onClose: () => setStreamStatus('offline'),
    });
    return () => socket.close();
  }, []);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePreset = (preset) => {
    setActivePreset(preset);
    setFormData(preset.data);
    setResult(null);
    setError('');
  };

  const handleScore = async () => {
    setIsScoring(true);
    setResult(null);
    setError('');

    try {
      const response = await evaluateTransaction(
        buildModelPayload(formData, activePreset.modelProfile),
      );
      setResult({
        risk_score: response.fraud_risk_score,
        confidence: response.confidence,
        latency_ms: response.performance.latency_ms,
        reasons: response.reasons,
        decision: response.decision,
        risk_tier: response.risk_tier,
        model_backend: response.model_backend,
      });
      setBackendStatus('online');
    } catch (requestError) {
      setError(requestError.message);
      setBackendStatus('offline');
    } finally {
      setIsScoring(false);
    }
  };

  const handlePipelineScore = async () => {
    setPipelineLoading(true);
    setPipelineResult(null);
    setPipelineError('');
    try {
      const response = await scoreTransaction({
        transaction_id: crypto.randomUUID(),
        sender_account_id: pipelineForm.sender_account_id,
        receiver_account_id: pipelineForm.receiver_account_id,
        amount: Number(pipelineForm.amount),
        timestamp: new Date().toISOString(),
        device_fingerprint: pipelineForm.device_fingerprint,
        channel: 'UPI',
      });
      setPipelineResult(response);
    } catch (requestError) {
      setPipelineError(requestError.message);
    } finally {
      setPipelineLoading(false);
    }
  };

  const riskClass = result ? (result.risk_score >= 80 ? 'critical' : result.risk_score >= 60 ? 'high' : result.risk_score >= 35 ? 'medium' : 'low') : '';

  return (
    <div className="page animate-in">
      <div className="scorer-intro">
        <div>
          <p className="workspace-kicker">Live risk assessment</p>
          <h1>Transaction scorer</h1>
          <p>Run a payment through the fraud engine and inspect the evidence behind its score.</p>
        </div>
        <span className={`scorer-status api-state-${backendStatus}`}>
          <span />
          {backendStatus === 'online' && 'ONNX model live'}
          {backendStatus === 'checking' && 'Connecting to model'}
          {backendStatus === 'degraded' && 'Model degraded'}
          {backendStatus === 'offline' && 'Model offline'}
          {' · '}
          {streamStatus === 'online' && 'Stream live'}
          {streamStatus === 'connecting' && 'Stream connecting'}
          {streamStatus === 'offline' && 'Stream offline'}
        </span>
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
                {PRESETS.map(p => (
                  <button
                    key={p.id}
                    className={`preset-btn ${activePreset.id === p.id ? 'active' : ''}`}
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
              <div className="api-endpoint-note">
                Live endpoint: <span>{API_BASE_URL}/v1/evaluate</span>
              </div>
            </div>
          </div>

          {/* Right: Result */}
          <div className="scorer-result-panel">
            {!result && !isScoring && (
              <div className="empty-result card">
                {error ? (
                  <>
                    <div className="empty-icon">⚠️</div>
                    <div className="empty-text">Backend model unavailable</div>
                    <div className="empty-sub error-copy">{error}</div>
                    <div className="empty-sub">Start the FastAPI service on port 8000 and retry.</div>
                  </>
                ) : (
                  <>
                    <div className="empty-icon">🔍</div>
                    <div className="empty-text">Submit a transaction to see<br />real-time fraud scoring</div>
                    <div className="empty-sub">The selected preset is evaluated by<br />the repository’s ONNX model</div>
                  </>
                )}
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
                      {result.decision}
                    </div>
                    <div className="result-confidence">
                      <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>CONFIDENCE</span>
                      <span className="mono" style={{ fontSize: 22, fontWeight: 700 }}>{Math.round(result.confidence * 100)}%</span>
                    </div>
                    <div className="latency-badge">
                      <span className="lightning">⚡</span>
                      Scored in {result.latency_ms}ms
                    </div>
                    <div className="model-backend-label">{result.model_backend}</div>
                  </div>
                </div>

                <div className="result-divider" />

                <div className="result-reasons">
                  <div className="card-title" style={{ marginBottom: 12 }}>🔎 EXPLAINABILITY — WHY WAS THIS FLAGGED?</div>
                  {result.reasons.map((r, i) => (
                    <div className="reason-item" key={i}>
                      <div className="reason-icon">
                        {r.type === 'BASELINE_CONSISTENT' ? '✅' : '⚠️'}
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

        <section className="card pipeline-scorer-card">
          <div className="card-header pipeline-header">
            <div>
              <span className="card-title">🕸 Full UPI Fraud Pipeline</span>
              <p>Behavioral features, deterministic swarm rules, persistence, graph analysis, and live events.</p>
            </div>
            <span className="pipeline-endpoint">{API_BASE_URL}/score</span>
          </div>

          <div className="pipeline-content">
            <div className="pipeline-form-grid">
              <div className="form-group">
                <label>Sender account</label>
                <input
                  aria-label="Pipeline sender account"
                  value={pipelineForm.sender_account_id}
                  onChange={event => setPipelineForm(previous => ({
                    ...previous,
                    sender_account_id: event.target.value,
                  }))}
                />
              </div>
              <div className="form-group">
                <label>Receiver account</label>
                <input
                  aria-label="Pipeline receiver account"
                  value={pipelineForm.receiver_account_id}
                  onChange={event => setPipelineForm(previous => ({
                    ...previous,
                    receiver_account_id: event.target.value,
                  }))}
                />
              </div>
              <div className="form-group">
                <label>Amount (₹)</label>
                <input
                  aria-label="Pipeline amount"
                  type="number"
                  value={pipelineForm.amount}
                  onChange={event => setPipelineForm(previous => ({
                    ...previous,
                    amount: event.target.value,
                  }))}
                />
              </div>
              <div className="form-group">
                <label>Device fingerprint</label>
                <input
                  aria-label="Pipeline device fingerprint"
                  value={pipelineForm.device_fingerprint}
                  onChange={event => setPipelineForm(previous => ({
                    ...previous,
                    device_fingerprint: event.target.value,
                  }))}
                />
              </div>
              <button
                className="btn btn-primary pipeline-score-button"
                disabled={pipelineLoading}
                onClick={handlePipelineScore}
              >
                {pipelineLoading ? 'Running full pipeline…' : 'Score with rules + graph'}
              </button>
            </div>

            <div className="pipeline-result" aria-live="polite">
              {pipelineError && <p className="live-error-copy">{pipelineError}</p>}
              {!pipelineResult && !pipelineError && (
                <p>Use seeded accounts ACC-000 through ACC-039, or inject a swarm in Graph Explorer.</p>
              )}
              {pipelineResult && (
                <>
                  <div className="pipeline-verdict-row">
                    <span className={`risk-badge ${pipelineResult.decision === 'block' ? 'critical' : pipelineResult.decision === 'review' ? 'medium' : 'low'}`}>
                      {pipelineResult.decision.toUpperCase()}
                    </span>
                    <strong>{Math.round(pipelineResult.final_confidence * 100)}% confidence</strong>
                    <span>{pipelineResult.latency_ms}ms</span>
                  </div>
                  <p className="mono">{pipelineResult.transaction_id}</p>
                  <div className="pipeline-reasons">
                    {pipelineResult.top_reasons.length > 0
                      ? pipelineResult.top_reasons.map(reason => <span key={reason}>— {reason}</span>)
                      : <span>— No suspicious swarm rules triggered</span>}
                  </div>
                  <p>
                    Swarms: {pipelineResult.suspected_swarm_types.join(', ') || 'none'} ·
                    Rule score: {Math.round(pipelineResult.rule_score * 100)}%
                  </p>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
