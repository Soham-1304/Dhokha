import { useEffect, useRef } from 'react';
import useDashboardStore from '../../store/dashboardStore';

export default function SwarmToast() {
  const showToast = useDashboardStore(s => s.showToast);
  const toastRef = useRef(null);

  useEffect(() => {
    const el = toastRef.current;
    if (!el) return;
    if (showToast) {
      el.classList.add('visible');
    } else {
      el.classList.remove('visible');
    }
  }, [showToast]);

  return (
    <div className="db-toast" ref={toastRef}>
      <div className="db-toast-dot"></div>
      <div className="db-toast-content">
        <div className="db-toast-title">SWARM DETECTED</div>
        <div className="db-toast-body">MULE-RING-0092 confirmed across 3 banks · ₹2,23,700 at risk</div>
      </div>
      <div className="db-toast-ring"></div>
    </div>
  );
}
