import { Link, useLocation } from 'react-router-dom';
import { Routes, Route } from 'react-router-dom';
import Dashboard from '../Dashboard'; // The original transaction feed (now renamed Dashboard)
import Scorer from '../Scorer';
import GraphExplorer from '../GraphExplorer'; // The original graph component
import CaseFile from '../CaseFile';
import { LayoutDashboard, Network, ScanSearch } from 'lucide-react';
import ThemeToggle from '../../components/ThemeToggle';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Graph Explorer', path: '/dashboard/graph', icon: Network },
  { label: 'Transaction Scorer', path: '/dashboard/scorer', icon: ScanSearch },
];

export default function DashboardLayout() {
  const location = useLocation();
  return (
    <div className="db-layout">
      <header className="app-case-nav">
        <Link to="/" className="app-case-logo">DHOKHA<span>.</span></Link>
        <span className="app-case-divider" />
        <span className="app-case-status"><i /> Monitoring active</span>
        <nav className="app-case-links" aria-label="Analyst navigation">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`db-sidebar-link ${location.pathname === item.path || (location.pathname === '/dashboard/' && item.path === '/dashboard') ? 'active' : ''} ${item.soon ? 'soon' : ''}`}
            >
              <span className="db-sidebar-icon"><item.icon size={15} strokeWidth={1.7} /></span>
              <span>{item.label}</span>
              {item.soon && <span className="db-badge-soon">SOON</span>}
            </Link>
          ))}
        </nav>
        <div className="app-case-actions">
          <span className="app-case-id">Case 2026-UPI-0004</span>
          <ThemeToggle />
        </div>
      </header>

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
