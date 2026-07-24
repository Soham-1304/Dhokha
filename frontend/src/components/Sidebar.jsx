import { NavLink, useLocation } from 'react-router-dom';
import './Sidebar.css';

const navItems = [
  { path: '/', label: 'Dashboard', icon: '◉', tag: 'LIVE' },
  { path: '/scorer', label: 'Transaction Scorer', icon: '⚡' },
  { path: '/graph', label: 'Graph Explorer', icon: '◈' },
  { path: '/case', label: 'Case File', icon: '📁' },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <a href="/Users/piyushsolanki/Desktop/demoday/dhokha-landing.html" target="_blank" rel="noopener noreferrer" className="logo-link">
          <span className="logo-text">DHOKHA</span>
          <span className="logo-dot">.</span>
        </a>
        <div className="logo-sub">fraud intelligence</div>
      </div>

      <div className="sidebar-section-label">Investigation</div>
      <nav className="sidebar-nav">
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
            {item.tag && (
              <span className="sidebar-tag">{item.tag}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-divider" />

      <div className="sidebar-section-label">Case Intel</div>
      <div className="sidebar-info-block">
        <div className="info-row">
          <span className="info-key">Ring ID</span>
          <span className="info-val red">RING-0092</span>
        </div>
        <div className="info-row">
          <span className="info-key">Status</span>
          <span className="info-val">
            <span className="status-dot active" />
            ACTIVE
          </span>
        </div>
        <div className="info-row">
          <span className="info-key">Nodes</span>
          <span className="info-val">14</span>
        </div>
        <div className="info-row">
          <span className="info-key">Banks</span>
          <span className="info-val">7</span>
        </div>
        <div className="info-row">
          <span className="info-key">Amount</span>
          <span className="info-val red">₹5,23,700</span>
        </div>
      </div>

      <div className="sidebar-bottom">
        <div className="sidebar-stamp">
          <span className="stamp-border">CASE FILE NO. 2026-UPI-0004</span>
        </div>
      </div>
    </aside>
  );
}
