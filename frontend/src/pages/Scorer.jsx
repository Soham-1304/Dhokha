import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { scoreTransaction } from '../api/client';
import './Scorer.css';

// Predefined backend database accounts for dropdown selector
const ACCOUNT_OPTIONS = [
  { id: 'ACC-000', label: 'ACC-000 (HDFC · Flagged Mule Hub)', bank: 'HDFC' },
  { id: 'ACC-001', label: 'ACC-001 (ICICI · Active Sender)', bank: 'ICICI' },
  { id: 'ACC-002', label: 'ACC-002 (KOTAK · Active Sender)', bank: 'KOTAK' },
  { id: 'ACC-003', label: 'ACC-003 (SBI · Active Sender)', bank: 'SBI' },
  { id: 'ACC-005', label: 'ACC-005 (HDFC · High Velocity)', bank: 'HDFC' },
  { id: 'ACC-010', label: 'ACC-010 (AXIS · Baseline Account)', bank: 'AXIS' },
  { id: 'ACC-012', label: 'ACC-012 (SBI · Baseline Account)', bank: 'SBI' },
  { id: 'A-scenario-identity-01', label: 'A-scenario-identity-01 (Type A Ring)', bank: 'HDFC' },
  { id: 'B-MULE-collector-01', label: 'B-MULE-collector-01 (Type B Funnel)', bank: 'ICICI' },
  { id: 'C-scenario-layer-01', label: 'C-scenario-layer-01 (Type C Loop)', bank: 'KOTAK' },
  { id: 'D-scenario-device-01', label: 'D-scenario-device-01 (Type D Device)', bank: 'SBI' },
];

const DEVICE_OPTIONS = [
  { id: 'DEV-device-000', label: 'DEV-device-000 (Hardware Hash 000)' },
  { id: 'DEV-device-001', label: 'DEV-device-001 (Hardware Hash 001)' },
  { id: 'DEV-normal-d', label: 'DEV-normal-d (Legitimate Mobile Device)' },
  { id: 'DEV-emulator-ring-x9', label: 'DEV-emulator-ring-x9 (Shared Emulator Cluster)' },
];

const BANK_OPTIONS = ['HDFC', 'ICICI', 'SBI', 'AXIS', 'KOTAK'];
const CHANNEL_OPTIONS = ['UPI', 'IMPS', 'NEFT', 'RTGS'];

// 5 Premium Scenario Cards (1-Click Test Execution)
const SCENARIO_LIBRARY = [
  {
    id: 'safe-p2p',
    label: 'Safe P2P Transfer',
    badge: 'ALLOW',
    badgeClass: 'allow',
    typology: 'Baseline',
    desc: 'Normal small transfer between established accounts with zero anomaly signals.',
    data: {
      sender_upi: 'ACC-010',
      receiver_upi: 'ACC-012',
      amount: '1500',
      device_id: 'DEV-normal-d',
      bank: 'AXIS',
      channel: 'UPI',
    },
  },
  {
    id: 'identity-fanout',
    label: 'Identity Fan-Out Ring',
    badge: 'BLOCK',
    badgeClass: 'block',
    typology: 'Typology A',
    desc: 'Synthetic identity credential operating accounts across multiple bank ledgers.',
    data: {
      sender_upi: 'ACC-005',
      receiver_upi: 'A-scenario-identity-01',
      amount: '49990',
      device_id: 'DEV-device-001',
      bank: 'HDFC',
      channel: 'UPI',
    },
  },
  {
    id: 'mule-collector',
    label: 'Mule Collector Funnel',
    badge: 'BLOCK',
    badgeClass: 'block',
    typology: 'Typology B',
    desc: 'High inbound fan-in stream funneling funds rapidly into a single collector hub.',
    data: {
      sender_upi: 'ACC-001',
      receiver_upi: 'ACC-000',
      amount: '95000',
      device_id: 'DEV-device-000',
      bank: 'ICICI',
      channel: 'UPI',
    },
  },
  {
    id: 'layering-ring',
    label: 'Rapid Layering Loop',
    badge: 'BLOCK',
    badgeClass: 'block',
    typology: 'Typology C',
    desc: 'Circular money transfer routing closing a graph cycle across connected banks.',
    data: {
      sender_upi: 'ACC-002',
      receiver_upi: 'C-scenario-layer-01',
      amount: '185000',
      device_id: 'DEV-device-002',
      bank: 'KOTAK',
      channel: 'IMPS',
    },
  },
  {
    id: 'shared-device',
    label: 'Shared Device Cluster',
    badge: 'BLOCK',
    badgeClass: 'block',
    typology: 'Typology D',
    desc: 'Single physical hardware fingerprint shared across multiple accounts & banks.',
    data: {
      sender_upi: 'ACC-003',
      receiver_upi: 'D-scenario-device-01',
      amount: '42000',
      device_id: 'DEV-emulator-ring-x9',
      bank: 'SBI',
      channel: 'UPI',
    },
  },
];

const PIPELINE_STAGES = [
  'Ingest', 'Validate', 'SQLite DB', 'Redis Cache',
  'Feature Eng.', 'NetworkX Graph', 'ONNX Model', 'Rule Engine', 'Verdict'
];

function ScoreGauge({ score, size = 150 }) {
  const strokeWidth = 9;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  let color = '#3d7a46';
  if (score >= 70) color = '#c8493c';
  else if (score >= 35) color = '#d8a429';

  return (
    <div className="score-gauge font-mono">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--hair)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${progress} ${circumference - progress}`}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dasharray 0.8s ease, stroke 0.4s ease' }}
        />
      </svg>
      <div className="score-gauge-inner">
        <div className="score-gauge-number" style={{ color }}>{score}%</div>
        <div className="score-gauge-label">CONFIDENCE</div>
      </div>
    </div>
  );
}

export default function Scorer() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(SCENARIO_LIBRARY[0].data);
  const [result, setResult] = useState(null);
  const [isScoring, setIsScoring] = useState(false);
  const [pipelineStageIndex, setPipelineStageIndex] = useState(-1);
  const [apiError, setApiError] = useState('');

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleQuickAmount = (amt) => {
    setFormData(prev => ({ ...prev, amount: amt.toString() }));
  };

  const executeScore = useCallback(async (dataToScore) => {
    setIsScoring(true);
    setResult(null);
    setApiError('');
    setPipelineStageIndex(0);

    const stageInterval = setInterval(() => {
      setPipelineStageIndex(prev => (prev < PIPELINE_STAGES.length - 1 ? prev + 1 : prev));
    }, 40);

    try {
      const payload = {
        transaction_id: `TXN-SCORER-${crypto.randomUUID().slice(0, 8)}`,
        sender_account_id: (dataToScore.sender_upi || 'ACC-001').trim().toUpperCase(),
        receiver_account_id: (dataToScore.receiver_upi || 'ACC-000').trim().toUpperCase(),
        amount: parseFloat(dataToScore.amount || 1000),
        device_fingerprint: (dataToScore.device_id || 'DEV-device-000').trim(),
        channel: dataToScore.channel || 'UPI',
      };

      const res = await scoreTransaction(payload);
      clearInterval(stageInterval);
      setPipelineStageIndex(PIPELINE_STAGES.length - 1);

      const confidenceVal = typeof res.final_confidence === 'number' ? res.final_confidence : (res.fraud_probability || 0);
      const riskScore = Math.round(confidenceVal * 100);

      setResult({
        risk_score: riskScore,
        confidence: confidenceVal,
        fraud_probability: res.fraud_probability || 0,
        rule_score: res.rule_score || 0,
        latency_ms: Math.round(res.latency_ms || 12),
        decision: res.decision || (riskScore >= 70 ? 'block' : riskScore >= 35 ? 'review' : 'allow'),
        suspected_swarm_types: res.suspected_swarm_types || [],
        reasons: res.top_reasons || [],
      });
    } catch (err) {
      clearInterval(stageInterval);
      setApiError(err.message || 'Failed to connect to backend scoring engine');
    } finally {
      setIsScoring(false);
    }
  }, []);

  const handlePresetSelect = (preset) => {
    setFormData(preset.data);
    executeScore(preset.data);
  };

  const decisionClass = result
    ? (result.decision === 'block' || result.risk_score >= 70 ? 'block' : result.decision === 'review' || result.risk_score >= 35 ? 'review' : 'allow')
    : '';

  return (
    <div className="s-scorer-container animate-in">
      <div className="grain-overlay" />

      {/* ── TOPBAR HEADER ── */}
      <header className="s-header">
        <div>
          <h1 className="serif">Transaction Scorer</h1>
        </div>
        <div className="header-meta font-mono">
          <span className="status-dot green" />
          LIVE SCORING ENGINE ONLINE
        </div>
      </header>

      {/* ── TOP SCENARIO LIBRARY TOOLBAR ── */}
      <div className="s-panel scenario-toolbar-panel">
        <div className="panel-header-inline">
          <span className="eyebrow-tag">SCENARIO LIBRARY</span>
          <span className="sub-tag font-mono">1-Click Fraud Typology Presets</span>
        </div>
        <div className="scenarios-toolbar-grid">
          {SCENARIO_LIBRARY.map((sc) => {
            const isSelected = JSON.stringify(formData) === JSON.stringify(sc.data);
            return (
              <div
                key={sc.id}
                className={`scenario-card-top ${sc.badgeClass} ${isSelected ? 'selected' : ''}`}
                onClick={() => handlePresetSelect(sc)}
              >
                <div className="sc-top-row">
                  <span className={`sc-badge ${sc.badgeClass}`}>{sc.badge}</span>
                  <span className="sc-type font-mono">{sc.typology}</span>
                </div>
                <h4>{sc.label}</h4>
                <p>{sc.desc}</p>
                <div className="sc-foot-row font-mono">
                  <span>{sc.data.sender_upi} ➔ {sc.data.receiver_upi}</span>
                  <span className="sc-amt">₹{Number(sc.data.amount).toLocaleString('en-IN')}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── MAIN TWO-COLUMN WORKSTATION ── */}
      <div className="s-grid">
        
        {/* ── LEFT COLUMN: GUIDED TRANSACTION BUILDER ── */}
        <div className="s-left-col">
          <div className="s-panel builder-panel">
            <div className="panel-header">
              <span className="eyebrow-tag">GUIDED BUILDER</span>
              <h3>Construct Payment Payload</h3>
            </div>

            <div className="form-grid font-mono">
              
              {/* Sender Account */}
              <div className="form-group">
                <label>SENDER ACCOUNT ID</label>
                <select
                  value={formData.sender_upi}
                  onChange={(e) => handleChange('sender_upi', e.target.value)}
                >
                  {ACCOUNT_OPTIONS.map((ac) => (
                    <option key={ac.id} value={ac.id}>{ac.label}</option>
                  ))}
                </select>
              </div>

              {/* Receiver Account */}
              <div className="form-group">
                <label>RECEIVER ACCOUNT ID</label>
                <select
                  value={formData.receiver_upi}
                  onChange={(e) => handleChange('receiver_upi', e.target.value)}
                >
                  {ACCOUNT_OPTIONS.map((ac) => (
                    <option key={ac.id} value={ac.id}>{ac.label}</option>
                  ))}
                </select>
              </div>

              {/* Amount & Quick Chips */}
              <div className="form-group full-width">
                <div className="label-row">
                  <label>TRANSACTION AMOUNT (₹)</label>
                  <div className="quick-chips">
                    {[1500, 5000, 9990, 49990, 95000, 185000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        className={`chip-btn ${formData.amount === amt.toString() ? 'active' : ''}`}
                        onClick={() => handleQuickAmount(amt)}
                      >
                        ₹{amt.toLocaleString('en-IN')}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => handleChange('amount', e.target.value)}
                  placeholder="Enter amount in ₹"
                />
              </div>

              {/* Device Fingerprint */}
              <div className="form-group">
                <label>DEVICE HARDWARE HASH</label>
                <select
                  value={formData.device_id}
                  onChange={(e) => handleChange('device_id', e.target.value)}
                >
                  {DEVICE_OPTIONS.map((dv) => (
                    <option key={dv.id} value={dv.id}>{dv.label}</option>
                  ))}
                </select>
              </div>

              {/* Bank Selector */}
              <div className="form-group">
                <label>ORIGINATING INSTITUTION</label>
                <select
                  value={formData.bank}
                  onChange={(e) => handleChange('bank', e.target.value)}
                >
                  {BANK_OPTIONS.map((bk) => (
                    <option key={bk} value={bk}>{bk} Bank</option>
                  ))}
                </select>
              </div>

              {/* Channel Selector */}
              <div className="form-group">
                <label>PAYMENT CHANNEL</label>
                <select
                  value={formData.channel}
                  onChange={(e) => handleChange('channel', e.target.value)}
                >
                  {CHANNEL_OPTIONS.map((ch) => (
                    <option key={ch} value={ch}>{ch}</option>
                  ))}
                </select>
              </div>

            </div>

            <button
              className={`btn-score-submit ${isScoring ? 'scoring' : ''}`}
              onClick={() => executeScore(formData)}
              disabled={isScoring}
            >
              {isScoring ? 'EVALUATING IN BACKEND ENGINE...' : 'EVALUATE TRANSACTION'}
            </button>

          </div>
        </div>

        {/* ── RIGHT COLUMN: DECISION ENGINE & TELEMETRY CONSOLE ── */}
        <div className="s-right-col">

          {apiError && (
            <div className="s-panel error-panel font-mono">
              <div className="err-hdr">SCORING ENGINE EXCEPTION</div>
              <p>{apiError}</p>
            </div>
          )}

          {/* IDLE TELEMETRY PREVIEW */}
          {!result && !isScoring && !apiError && (
            <div className="s-panel idle-telemetry-panel font-mono">
              <div className="panel-header">
                <span className="eyebrow-tag">TELEMETRY CONSOLE</span>
                <h3 className="serif" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Decision Engine Idle</h3>
              </div>

              <div className="idle-grid">
                <div className="idle-box">
                  <span className="ik">ML MODEL</span>
                  <span className="iv">ONNX LightGBM-v2</span>
                </div>
                <div className="idle-box">
                  <span className="ik">RULE ENGINE</span>
                  <span className="iv">4 Swarm Detectors Active</span>
                </div>
                <div className="idle-box">
                  <span className="ik">TARGET SLA</span>
                  <span className="iv">&lt; 15ms Latency</span>
                </div>
                <div className="idle-box">
                  <span className="ik">FEATURE EXTRACTION</span>
                  <span className="iv">Velocity, Z-Score & Cycles</span>
                </div>
              </div>

              <div className="idle-prompt font-mono">
                Select a scenario preset above or edit parameters on the left, then click <strong>EVALUATE TRANSACTION</strong> to trigger real-time backend inference.
              </div>
            </div>
          )}

          {/* SCORED RESULT PANEL */}
          {result && (
            <div className={`s-panel decision-panel ${decisionClass}`}>
              
              {/* Verdict Header */}
              <div className="decision-header">
                <div className="verdict-col font-mono">
                  <span className="eyebrow-tag">BACKEND VERDICT</span>
                  <div className={`verdict-badge ${decisionClass}`}>
                    {result.decision.toUpperCase()}
                  </div>
                  <div className="latency-tag">
                    Processing Latency: <strong>{result.latency_ms}ms</strong>
                  </div>
                </div>

                <div className="gauge-col">
                  <ScoreGauge score={result.risk_score} />
                </div>
              </div>

              <div className="panel-divider" />

              {/* Telemetry Breakdown Grid */}
              <div className="telemetry-grid font-mono">
                <div className="tel-box">
                  <div className="tk">FINAL CONFIDENCE</div>
                  <div className="tv">{Math.round(result.confidence * 100)}%</div>
                </div>
                <div className="tel-box">
                  <div className="tk">ONNX ML PROB.</div>
                  <div className="tv">{Math.round(result.fraud_probability * 100)}%</div>
                </div>
                <div className="tel-box">
                  <div className="tk">RULE ENGINE SCORE</div>
                  <div className="tv">{Math.round(result.rule_score * 100)}%</div>
                </div>
                <div className="tel-box">
                  <div className="tk">SWARM TYPOLOGIES</div>
                  <div className="tv swarm-val">
                    {result.suspected_swarm_types.length > 0 ? result.suspected_swarm_types.join(', ') : 'None'}
                  </div>
                </div>
              </div>

              <div className="panel-divider" />

              {/* Evidence Cards */}
              <div className="evidence-section">
                <div className="eyebrow-tag font-mono" style={{ marginBottom: 8 }}>EVIDENCE & EXPLAINABILITY REASONS</div>
                <div className="reasons-list font-mono">
                  {result.reasons.length > 0 ? (
                    result.reasons.map((reason, idx) => (
                      <div key={idx} className="reason-card">
                        <span className={`reason-dot ${decisionClass === 'allow' ? 'pass' : 'warn'}`} />
                        <div className="reason-text">{reason}</div>
                      </div>
                    ))
                  ) : (
                    <div className="reason-card safe">
                      <span className="reason-dot pass" />
                      <div className="reason-text">Normal baseline transaction. No graph or behavioral anomalies detected.</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="panel-divider" />

              {/* Handoff to Graph Explorer */}
              <div className="handoff-box">
                <button
                  className="btn-handoff font-mono"
                  onClick={() => navigate(`/dashboard/graph?sender=${encodeURIComponent(formData.sender_upi)}&receiver=${encodeURIComponent(formData.receiver_upi)}&device=${encodeURIComponent(formData.device_id)}&amount=${encodeURIComponent(formData.amount)}`)}
                >
                  ➔ CONTINUE INVESTIGATION IN GRAPH EXPLORER
                </button>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
