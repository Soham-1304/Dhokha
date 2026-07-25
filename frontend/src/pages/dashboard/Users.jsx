import { useState, useEffect } from 'react';
import { Users as UsersIcon, Building2, MapPin, Calendar, TrendingUp, RefreshCw, Phone } from 'lucide-react';
import './Users.css';

const BANK_LABELS = {
  BANK_ALPHA: 'Alpha Bank India',
  BANK_BETA:  'Beta National Bank',
  BANK_GAMMA: 'Gamma Commerce Bank',
  BANK_DELTA: 'Delta Rural Bank',
};
const BANK_COLORS = {
  BANK_ALPHA: '#3B82F6',
  BANK_BETA:  '#10B981',
  BANK_GAMMA: '#8B5CF6',
  BANK_DELTA: '#F59E0B',
};
const AVATAR_COLORS = ['#5855FF','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#EC4899','#84CC16'];

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const DEMO_USERS = [
  { id: 'USR-001', name: 'Rahul Sharma', phone: '+91 98765 43210', email: 'rahul@demo.in', account_id: 'ACC-000', bank_id: 'BANK_ALPHA', balance: 50000, city: 'Mumbai', created_at: '2026-07-20T10:00:00Z', txn_count: 3 },
  { id: 'USR-002', name: 'Priya Patel', phone: '+91 91234 56789', email: 'priya@demo.in', account_id: 'ACC-001', bank_id: 'BANK_BETA', balance: 55000, city: 'Pune', created_at: '2026-07-20T10:00:00Z', txn_count: 0 },
  { id: 'USR-003', name: 'Vikram Singh', phone: '+91 99887 76655', email: 'vikram@demo.in', account_id: 'ACC-002', bank_id: 'BANK_GAMMA', balance: 60000, city: 'Delhi', created_at: '2026-07-20T10:00:00Z', txn_count: 1 },
  { id: 'USR-004', name: 'Anita Roy', phone: '+91 88001 12233', email: 'anita@demo.in', account_id: 'ACC-003', bank_id: 'BANK_DELTA', balance: 65000, city: 'Bangalore', created_at: '2026-07-20T10:00:00Z', txn_count: 0 },
  { id: 'USR-005', name: 'Deepak Nair', phone: '+91 77889 90011', email: 'deepak@demo.in', account_id: 'ACC-004', bank_id: 'BANK_ALPHA', balance: 70000, city: 'Hyderabad', created_at: '2026-07-20T10:00:00Z', txn_count: 0 },
];

export default function Users() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [expanded, setExpanded] = useState(null);

  const load = () => {
    setLoading(true);
    setUsers(DEMO_USERS);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.phone || '').includes(search) ||
    (u.account_id || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalBalance = filtered.reduce((s, u) => s + (u.balance || 0), 0);

  return (
    <div className="usr-page">
      {/* Page header */}
      <div className="usr-page-header">
        <div>
          <h1 className="usr-page-title">
            <UsersIcon size={20} />
            Registered Users
          </h1>
          <p className="usr-page-sub">Seeded demo account directory (authentication is outside this MVP)</p>
        </div>
        <button className="usr-refresh-btn" onClick={load} title="Refresh">
          <RefreshCw size={15} className={loading ? 'usr-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI strip */}
      <div className="usr-kpi-row">
        <div className="usr-kpi">
          <div className="usr-kpi-label">Total Users</div>
          <div className="usr-kpi-value">{users.length}</div>
        </div>
        <div className="usr-kpi">
          <div className="usr-kpi-label">Total Balance Tracked</div>
          <div className="usr-kpi-value">{fmt(totalBalance)}</div>
        </div>
        <div className="usr-kpi">
          <div className="usr-kpi-label">Banks Represented</div>
          <div className="usr-kpi-value">{new Set(users.map(u => u.bank_id)).size}</div>
        </div>
        <div className="usr-kpi">
          <div className="usr-kpi-label">With Transactions</div>
          <div className="usr-kpi-value">{users.filter(u => (u.txn_count || 0) > 0).length}</div>
        </div>
      </div>

      {/* Search */}
      <div className="usr-search-wrap">
        <input
          className="usr-search"
          type="text"
          placeholder="Search by name, email, phone or account ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>


      {/* Table */}
      <div className="usr-table-wrap">
        {loading ? (
          <div className="usr-loading">
            <div className="usr-loading-spinner" />
            <span>Loading users…</span>
          </div>
        ) : (
          <table className="usr-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Contact</th>
                <th>Bank</th>
                <th>Account</th>
                <th>Balance</th>
                <th>Txns</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => {
                const color  = AVATAR_COLORS[i % AVATAR_COLORS.length];
                const bColor = BANK_COLORS[u.bank_id] || '#6B7280';
                const isOpen = expanded === u.id;
                return (
                  <>
                    <tr
                      key={u.id}
                      className={`usr-row ${isOpen ? 'usr-row-open' : ''}`}
                      onClick={() => setExpanded(isOpen ? null : u.id)}
                    >
                      <td>
                        <div className="usr-user-cell">
                          <div className="usr-avatar" style={{ background: color + '18', color }}>
                            {u.name[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="usr-name">{u.name}</div>
                            <div className="usr-city">
                              <MapPin size={10} /> {u.city || '—'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="usr-contact-cell">
                          <div className="usr-contact-phone"><Phone size={11} /> {u.phone || '—'}</div>
                          <div className="usr-contact-email">{u.email || '—'}</div>
                        </div>
                      </td>
                      <td>
                        <div className="usr-bank-chip" style={{ background: bColor + '14', color: bColor, borderColor: bColor + '30' }}>
                          <Building2 size={11} />
                          {BANK_LABELS[u.bank_id]?.split(' ').slice(0,2).join(' ') || u.bank_id}
                        </div>
                      </td>
                      <td>
                        <code className="usr-mono">{u.account_id}</code>
                      </td>
                      <td>
                        <span className="usr-balance">{fmt(u.balance)}</span>
                      </td>
                      <td>
                        <div className="usr-txn-count">
                          <TrendingUp size={12} />
                          {u.txn_count ?? 0}
                        </div>
                      </td>
                      <td>
                        <div className="usr-date">
                          <Calendar size={11} />
                          {new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={u.id + '-detail'} className="usr-detail-row">
                        <td colSpan={7}>
                          <div className="usr-detail">
                            <div className="usr-detail-item">
                              <span className="usr-detail-label">User ID</span>
                              <code className="usr-mono">{u.id}</code>
                            </div>
                            <div className="usr-detail-item">
                              <span className="usr-detail-label">Full Bank</span>
                              <span>{BANK_LABELS[u.bank_id] || u.bank_id}</span>
                            </div>
                            <div className="usr-detail-item">
                              <span className="usr-detail-label">Email</span>
                              <span>{u.email || '—'}</span>
                            </div>
                            <div className="usr-detail-item">
                              <span className="usr-detail-label">Phone</span>
                              <span>{u.phone || '—'}</span>
                            </div>
                            <div className="usr-detail-item">
                              <span className="usr-detail-label">Balance</span>
                              <span style={{ fontWeight: 700, color: 'var(--safe, #3fb67f)' }}>{fmt(u.balance)}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}

        {!loading && filtered.length === 0 && (
          <div className="usr-empty">
            <UsersIcon size={36} style={{ opacity: 0.3 }} />
            <span>No users found</span>
          </div>
        )}
      </div>
    </div>
  );
}
