import { Link, useLocation } from 'react-router-dom';
import { Routes, Route } from 'react-router-dom';
import CommandCenter from './CommandCenter';

const NAV_ITEMS = [
  { label: 'Command Center', path: '/dashboard', icon: '⬡' },
  { label: 'Swarm Registry', path: '/dashboard/swarms', icon: '◈', soon: true },
  { label: 'Transaction Feed', path: '/dashboard/transactions', icon: '⟳', soon: true },
];

export default function DashboardLayout() {
  const location = useLocation();

  return (
    <div className="db-layout">
      {/* Sidebar */}
      <aside className="db-sidebar">
        <Link to="/" className="db-sidebar-logo" style={{ textDecoration: 'none' }}>
          DHOKHA<span style={{ color: 'var(--string)' }}>.</span>
        </Link>
        <div className="db-sidebar-label">Investigation Platform</div>

        <nav className="db-sidebar-nav">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`db-sidebar-link ${location.pathname === item.path ? 'active' : ''} ${item.soon ? 'soon' : ''}`}
              onClick={e => item.soon && e.preventDefault()}
            >
              <span className="db-sidebar-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.soon && <span className="db-badge-soon">SOON</span>}
            </Link>
          ))}
        </nav>

        <div className="db-sidebar-footer">
          <div className="db-sidebar-status">
            <span className="db-live-pulse" style={{ width: 6, height: 6 }}></span>
            All systems nominal
          </div>
          <div className="db-sidebar-case">CASE FILE NO. 2026-UPI-0004</div>
        </div>
      </aside>

      {/* Main content */}
      <main className="db-main">
        <Routes>
          <Route index element={<CommandCenter />} />
          <Route path="*" element={<CommandCenter />} />
        </Routes>
      </main>
    </div>
  );
}
