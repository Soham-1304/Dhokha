import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Routes, Route } from 'react-router-dom';
import Dashboard from '../Dashboard'; // The original transaction feed (now renamed Dashboard)
import Scorer from '../Scorer';
import GraphExplorer from '../GraphExplorer'; // The original graph component
import CaseFile from '../CaseFile';
import { Menu, X } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', icon: '⬡' },
  { label: 'Graph Explorer (D3)', path: '/dashboard/graph', icon: '◈' },
  { label: 'Transaction Scorer', path: '/dashboard/scorer', icon: '⚡' },
];

export default function DashboardLayout() {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    return saved;
  });

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('theme', nextTheme);
  };

  return (
    <div className="db-layout">
      {/* Floating Hamburger Button */}
      <button 
        className="db-hamburger" 
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        title="Toggle Menu"
      >
        {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Floating Sidebar Menu */}
      <aside className={`db-sidebar floating-menu ${isMenuOpen ? 'open' : ''}`}>
        <Link to="/" className="db-sidebar-logo" style={{ textDecoration: 'none' }} onClick={() => setIsMenuOpen(false)}>
          DHOKHA<span style={{ color: 'var(--string)' }}>.</span>
        </Link>
        <div className="db-sidebar-label">Investigation Platform</div>

        <nav className="db-sidebar-nav">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`db-sidebar-link ${location.pathname === item.path || (location.pathname === '/dashboard/' && item.path === '/dashboard') ? 'active' : ''} ${item.soon ? 'soon' : ''}`}
              onClick={e => {
                if (item.soon) e.preventDefault();
                else setIsMenuOpen(false);
              }}
            >
              <span className="db-sidebar-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.soon && <span className="db-badge-soon">SOON</span>}
            </Link>
          ))}
        </nav>

        {/* Theme Toggle Button */}
        <div className="db-sidebar-theme-toggle">
          <button onClick={toggleTheme} className="theme-toggle-btn">
            {theme === 'dark' ? '☀️ LIGHT MODE' : '🌙 DARK MODE'}
          </button>
        </div>

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
          <Route index element={<Dashboard />} />
          <Route path="scorer" element={<Scorer />} />
          <Route path="graph" element={<GraphExplorer />} />
          <Route path="case" element={<CaseFile />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </main>
    </div>
  );
}
