import { Outlet, Link, useLocation } from 'react-router-dom';
import { Network, Activity, List, ChevronLeft } from 'lucide-react';

const NAV_ITEMS = [
  { icon: Network, label: 'Command Center', path: '/dashboard', exact: true },
  { icon: Activity, label: 'Swarm Registry', path: '/dashboard/swarms', badge: 'Soon' },
  { icon: List, label: 'Transaction Feed', path: '/dashboard/transactions', badge: 'Soon' },
];

export default function DashboardLayout() {
  const location = useLocation();

  return (
    <div className="db-root">
      {/* Sidebar */}
      <aside className="db-sidebar">
        <div className="db-sidebar-logo">
          <Link to="/">
            DHOKHA<span style={{ color: 'var(--string)' }}>.</span>
          </Link>
          <div className="case-status">Bureau / Command</div>
        </div>

        <nav className="db-sidebar-nav">
          <div className="db-nav-section">Investigations</div>
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.badge ? '#' : item.path}
                className={`db-nav-item ${isActive ? 'active' : ''}`}
                style={item.badge ? { opacity: 0.45, cursor: 'not-allowed', pointerEvents: 'none' } : {}}
              >
                <item.icon size={15} strokeWidth={1.8} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && (
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 8,
                    background: 'var(--surface-raised)', color: 'var(--text-muted)',
                    padding: '2px 6px', borderRadius: 20, letterSpacing: '0.5px',
                  }}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="db-sidebar-bottom">
          <Link
            to="/"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)',
              textDecoration: 'none', fontSize: 10, letterSpacing: '0.5px',
              fontFamily: 'JetBrains Mono, monospace', transition: 'color .15s',
            }}
          >
            <ChevronLeft size={11} />
            Back to Landing
          </Link>
          <div style={{ marginTop: 10, fontSize: 9, color: 'var(--text-muted)', opacity: 0.6 }}>
            CASE FILE NO. 2026-UPI-0004
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="db-main">
        {/* Top bar */}
        <div className="db-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="db-topbar-title">Investigation Dashboard</div>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: 1,
              color: 'var(--text-muted)', background: 'var(--surface)', padding: '3px 8px',
              borderRadius: 20, border: '1px solid var(--border)',
            }}>
              MOCK MODE
            </span>
          </div>
          <div className="db-topbar-meta">
            <span>Bureau v2.0</span>
            <div className="db-topbar-live">
              <span className="dot"></span>
              LIVE
            </div>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>
              {new Date().toLocaleTimeString('en-IN', { hour12: false })}
            </span>
          </div>
        </div>

        {/* Page content */}
        <div className="db-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
