import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft,
  Clock
} from 'lucide-react';
import { transactions, caseTimeline } from '../data/mockData';
import './CaseFile.css';

const formatAmount = (n) => '₹' + n.toLocaleString('en-IN');

function getRiskClass(score) {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

export default function CaseFile() {
  const location = useLocation();
  const navigate = useNavigate();
  const [toast, setToast] = useState('');
  
  const txn = location.state?.txn || transactions.find(t => t.risk_score >= 80);

  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  };

  if (!txn) {
    return (
      <div className="case-inspector-page dark-operations-board animate-in">
        <div className="empty-case-view dossier-sheet">
          <h2>NO DOSSIER SELECTED FOR INSPECTION</h2>
          <p>Go back to the Operations Terminal to pick an active threat thread.</p>
          <button className="btn-back" onClick={() => navigate('/dashboard')}>
            [ Go to Operations Board ]
          </button>
        </div>
      </div>
    );
  }

  const riskClass = getRiskClass(txn.risk_score);

  return (
    <div className="case-inspector-page dark-operations-board animate-in">
      
      {/* Top toolbar */}
      <header className="inspector-toolbar">
        <button className="back-btn" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={13} style={{ marginRight: 6 }} /> Back to Terminal
        </button>
        <div className="toolbar-title-box">
          <span className="case-ref-tag">TRANSACTION LEDGER</span>
          <h1>pay_{txn.id.replaceAll('-', '').toLowerCase()}</h1>
        </div>
        <div className="toolbar-badge">
          <span className={`risk-badge-stripe ${riskClass}`}>
            RISK INDEX: {txn.risk_score}
          </span>
        </div>
      </header>

      {toast && <div className="inspector-toast">{toast}</div>}

      <div className="inspector-layout-grid">
        
        {/* Left Sheet: Parameters & Timeline (60% width) */}
        <div className="inspector-main-column dossier-sheet left-paper">
          
          <div className="parameters-panel">
            <h3>TRANSACTION INTERCEPT DOSSIER</h3>
            
            <div className="details-table-stripe">
              <div className="details-row">
                <span className="lbl">SENDER ADDRESS</span>
                <span className="val mono">{txn.sender_upi}</span>
              </div>
              <div className="details-row">
                <span className="lbl">RECEIVER ADDRESS</span>
                <span className="val mono text-red">{txn.receiver_upi}</span>
              </div>
              <div className="details-row">
                <span className="lbl">AMOUNT TRANSFER</span>
                <span className="val mono bold size-large">{formatAmount(txn.amount)}</span>
              </div>
              <div className="details-row">
                <span className="lbl">ROUTING LATENCY</span>
                <span className="val mono">{txn.latency_ms}ms</span>
              </div>
              <div className="details-row">
                <span className="lbl">SENDER INST</span>
                <span className="val">{txn.bank_sender} ({txn.city_sender})</span>
              </div>
              <div className="details-row">
                <span className="lbl">RECEIVER INST</span>
                <span className="val">{txn.bank_receiver} ({txn.city_receiver})</span>
              </div>
              <div className="details-row">
                <span className="lbl">DEVICE FINGERPRINT</span>
                <span className="val mono">{txn.device_id}</span>
              </div>
              <div className="details-row">
                <span className="lbl">NETWORK IP</span>
                <span className="val mono">{txn.ip}</span>
              </div>
            </div>
          </div>

          <div className="parameters-panel">
            <h3>CHRONOLOGICAL SIGNAL LOG</h3>
            
            <div className="audit-timeline-stripe">
              {caseTimeline.map((item, i) => (
                <div key={i} className="timeline-node-stripe">
                  <span className="time">{item.time}</span>
                  <div className="details">
                    <strong>{item.event}</strong>
                    <span>System intercepted signal through routing pipeline.</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Sheet: ML Assessment & Actions (40% width) */}
        <div className="inspector-side-column dossier-sheet right-paper">
          
          <div className="parameters-panel">
            <h3>ML RISK TELEMETRY</h3>
            
            <div className="ml-assessment-box">
              <div className="assessment-stat">
                <span className="number">{txn.risk_score}</span>
                <span className="label">ANOMALY INDEX</span>
              </div>
              <div className="assessment-stat">
                <span className="number">{Math.round(txn.confidence * 100)}%</span>
                <span className="label">CONFIDENCE</span>
              </div>
            </div>

            <div className="reasons-score-stack">
              <span className="lbl">SHAP TRIGGER CONTRIBUTIONS</span>
              
              <div className="reasons-bullet-list">
                {txn.reasons.map((r, i) => (
                  <div key={i} className="shap-item-row">
                    <div className="shap-left">
                      <strong>{r.type.toUpperCase()}</strong>
                      <p>{r.detail}</p>
                    </div>
                    <span className="shap-pct">{Math.round(r.weight * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="parameters-panel resolution-area">
            <h3>NPCI RESOLVER CONSOLE</h3>
            
            <div className="resolution-actions-stack">
              <button 
                className="btn-resolve block-btn"
                onClick={() => triggerToast(`Transaction pay_{txn.id.replaceAll('-', '').toLowerCase()} blocked`)}
              >
                [ BLOCK WALLET ADDRESS ]
              </button>
              
              <button 
                className="btn-resolve review-btn"
                onClick={() => triggerToast(`Flagged for review`)}
              >
                [ FLAG FOR OVERSIGHT ]
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
