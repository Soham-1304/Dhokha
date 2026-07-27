import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const formatAmount = (n) => n == null ? '—' : '₹' + Number(n).toLocaleString('en-IN');

export default function LiveFeed({ transactions = [] }) {
  const [expandedId, setExpandedId] = useState(null);
  const navigate = useNavigate();

  const toggleExpand = (id) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <section className="d-section">
      <div className="d-section-header">
        <h2 className="d-section-title font-display">Live Transaction Intelligence Feed</h2>
        <span className="d-section-count font-mono">{transactions.length} Received</span>
      </div>

      <div className="d-feed-stack">
        {transactions.slice(0, 10).map((t, idx) => {
          const score = t.risk_score ?? (t.confidence ? Math.round(t.confidence * 100) : 10);
          const isBlock = score >= 70 || t.decision === 'block';
          const isReview = score >= 35 && score < 70 || t.decision === 'review';
          const badgeClass = isBlock ? 'blocked' : isReview ? 'review' : 'safe';
          const isExpanded = expandedId === (t.id || idx);

          return (
            <div
              key={t.id || idx}
              className={`d-feed-card ${badgeClass} ${isExpanded ? 'expanded' : ''}`}
              onClick={() => toggleExpand(t.id || idx)}
            >
              <div className="d-feed-card-main">
                <div className="d-feed-left">
                  <div className={`d-risk-pill ${badgeClass} font-mono`}>
                    {isBlock ? 'BLOCKED' : isReview ? 'REVIEW' : 'ALLOWED'} ({score}%)
                  </div>
                  <div className="d-feed-users font-mono">
                    <span className="user-id">{t.sender_account_id || t.sender_upi || 'ACC-SENDER'}</span>
                    <span className="user-arrow">→</span>
                    <span className="user-id">{t.receiver_account_id || t.receiver_upi || 'ACC-RECEIVER'}</span>
                  </div>
                </div>

                <div className="d-feed-right">
                  <div className="d-feed-amount font-mono">{formatAmount(t.amount)}</div>
                  <span className="d-expand-hint font-mono">{isExpanded ? '▲ LESS' : '▼ MORE'}</span>
                </div>
              </div>

              {isExpanded && (
                <div className="d-feed-card-details" onClick={(e) => e.stopPropagation()}>
                  <div className="d-details-grid font-mono">
                    <div><span>Fraud Prob:</span> {t.fraud_probability ? (t.fraud_probability * 100).toFixed(1) + '%' : `${score}%`}</div>
                    <div><span>Rule Score:</span> {t.rule_score ?? 'N/A'}</div>
                    <div><span>Latency:</span> {t.latency_ms ?? 14}ms</div>
                    <div><span>Swarms:</span> {t.suspected_swarm_types?.join(', ') || 'None'}</div>
                  </div>
                  {t.top_reasons?.length > 0 && (
                    <div className="d-reasons-list font-mono">
                      <strong>Risk Cues:</strong> {t.top_reasons.join(' • ')}
                    </div>
                  )}
                  <div className="d-details-actions">
                    <button
                      className="d-btn font-mono"
                      onClick={() => navigate('/dashboard/scorer', { state: { accountId: t.receiver_account_id } })}
                    >
                      Investigate Account →
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
