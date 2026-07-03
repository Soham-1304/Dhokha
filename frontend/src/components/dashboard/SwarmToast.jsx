import { useEffect } from 'react';
import { useDashboardStore } from '../../store/dashboardStore';
import { AlertTriangle, Info } from 'lucide-react';

function Toast({ toast, onRemove }) {
  useEffect(() => {
    const id = setTimeout(() => onRemove(toast.id), 6000);
    return () => clearTimeout(id);
  }, [toast.id, onRemove]);

  const isSwarm = toast.type === 'swarm';

  return (
    <div className={`toast ${isSwarm ? 'swarm-toast' : 'info-toast'}`}>
      <div className="toast-header">
        <span
          className="toast-icon"
          style={{ background: isSwarm ? 'var(--string)' : 'var(--brass)' }}
        />
        <span className="toast-title" style={{ color: isSwarm ? 'var(--string)' : 'var(--brass)' }}>
          {isSwarm ? 'SWARM DETECTED' : 'STAGE 1 FLAG'}
        </span>
      </div>
      <div className="toast-body">{toast.message}</div>
      {isSwarm && toast.confidence && (
        <div className="toast-confidence">
          Confidence: {toast.confidence}%
        </div>
      )}
    </div>
  );
}

export default function SwarmToastContainer() {
  const toasts = useDashboardStore(s => s.toasts);
  const removeToast = useDashboardStore(s => s.removeToast);

  if (!toasts.length) return null;

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <Toast key={t.id} toast={t} onRemove={removeToast} />
      ))}
    </div>
  );
}
