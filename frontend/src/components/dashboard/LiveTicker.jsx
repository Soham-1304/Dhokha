import { useEffect, useRef } from 'react';
import { transactions } from '../../api/mock/transactions';

const STATUS_COLORS = { SWARM: '#e5484d', FLAGGED: '#c9a227', CLEAN: '#3fb67f' };

export default function LiveTicker() {
  const scrollRef = useRef(null);
  // Duplicate array to allow seamless loop
  const items = [...transactions, ...transactions];

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let animId;
    let pos = 0;

    const scroll = () => {
      pos += 0.5;
      if (pos >= el.scrollWidth / 2) pos = 0;
      el.scrollLeft = pos;
      animId = requestAnimationFrame(scroll);
    };
    animId = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="db-ticker-wrap">
      <div className="db-ticker-label">LIVE FEED</div>
      <div className="db-ticker-scroll" ref={scrollRef}>
        <div className="db-ticker-inner">
          {items.map((txn, i) => (
            <div key={`${txn.id}-${i}`} className="db-ticker-item">
              <span className="db-ticker-status" style={{ color: STATUS_COLORS[txn.status] }}>
                ● {txn.status}
              </span>
              <span className="db-ticker-id">{txn.id}</span>
              <span className="db-ticker-route">{txn.bank}</span>
              <span className="db-ticker-amount">₹{txn.amount.toLocaleString('en-IN')}</span>
              <span className="db-ticker-latency">{txn.latency}ms</span>
              <span className="db-ticker-time">{txn.ts}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
