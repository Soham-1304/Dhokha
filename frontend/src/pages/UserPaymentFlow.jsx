import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { scoreTransaction } from '../api/client';
import ThemeToggle from '../components/ThemeToggle';
import {
  ShieldAlert, Lock, LogIn, CheckCircle2, AlertTriangle, XCircle,
  ArrowLeft, Send, User, Building2, Smartphone, Eye, EyeOff, MapPin, CreditCard, Home
} from 'lucide-react';
import './UserPaymentFlow.css';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const BANKS = [
  { id: 'BANK_ALPHA', label: 'HDFC Bank' },
  { id: 'BANK_BETA', label: 'ICICI Bank' },
  { id: 'BANK_GAMMA', label: 'State Bank of India' },
  { id: 'BANK_DELTA', label: 'Axis Bank' },
];

const stableHash = value => Array.from(value || 'demo')
  .reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 7);

const createDemoUser = ({ name, username, city = 'Mumbai', bankLabel }) => {
  const bankIndex = bankLabel
    ? Math.max(0, BANKS.findIndex(bank => bank.label === bankLabel))
    : stableHash(username) % BANKS.length;
  const accountIndex = ((stableHash(username) % 10) * BANKS.length) + bankIndex;
  const bank = BANKS[bankIndex];
  return {
    username,
    name: name || username,
    account_id: `ACC-${String(accountIndex).padStart(3, '0')}`,
    bank_id: bank.label,
    backend_bank_id: bank.id,
    city,
  };
};

const defaultRecipientFor = accountId => accountId === 'ACC-001' ? 'ACC-002' : 'ACC-001';

// Screens
const SCREEN = { LOGIN: 'login', WALLET: 'wallet', PIN: 'pin', RESULT: 'result' };

export default function UserPaymentFlow() {
  const [searchParams] = useSearchParams();
  const [screen, setScreen] = useState(SCREEN.LOGIN);
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);

  // Auth Mode ('login' | 'signup')
  const [authMode, setAuthMode] = useState('signup');

  // Parse URL tab parameter (?tab=login or ?tab=signup)
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'login') {
      setAuthMode('login');
    } else if (tab === 'signup') {
      setAuthMode('signup');
    }
  }, [searchParams]);

  // Sign Up form state
  const [signUpName, setSignUpName]         = useState('');
  const [signUpPhone, setSignUpPhone]       = useState('');
  const [signUpBank, setSignUpBank]         = useState('HDFC Bank');
  const [signUpBalance, setSignUpBalance]   = useState(50000);
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpCity, setSignUpCity]         = useState('Mumbai');
  const [signUpError, setSignUpError]       = useState('');

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass]  = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Pay form state
  const [recipientInput, setRecipientInput] = useState('ACC-001');
  const [amount, setAmount]                 = useState('');
  const [payError, setPayError]             = useState('');

  // PIN state
  const [pin, setPin]             = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError]   = useState('');

  // Result state
  const [result, setResult] = useState(null);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    const demoUser = createDemoUser({
      name: username.trim(),
      username: username.trim(),
    });
    setUser(demoUser);
    setBalance(50000);
    setRecipientInput(defaultRecipientFor(demoUser.account_id));
    setScreen(SCREEN.WALLET);
    setLoginLoading(false);
  };

  const handleSignUp = (e) => {
    e.preventDefault();
    setSignUpError('');
    if (!signUpName.trim() || !signUpPhone.trim() || !signUpPassword) {
      setSignUpError('Please fill in all required fields');
      return;
    }
    const initialBal = parseFloat(signUpBalance) || 50000;
    const newUser = createDemoUser({
      name: signUpName.trim(),
      username: signUpPhone.trim(),
      bankLabel: signUpBank,
      city: signUpCity || 'Mumbai',
    });
    setUser(newUser);
    setBalance(initialBal);
    setRecipientInput(defaultRecipientFor(newUser.account_id));
    setScreen(SCREEN.WALLET);
  };

  const handleProceedToPay = () => {
    setPayError('');
    const recipient = recipientInput.trim().toUpperCase();
    if (!/^ACC-0(?:[0-2]\d|3\d)$/.test(recipient)) {
      setPayError('Use a seeded demo recipient from ACC-000 to ACC-039');
      return;
    }
    if (recipient === user.account_id) {
      setPayError('Sender and recipient accounts must be different');
      return;
    }
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) { setPayError('Enter a valid payment amount'); return; }
    if (amt > balance)                      { setPayError('Insufficient wallet balance'); return; }
    setPin('');
    setPinError('');
    setScreen(SCREEN.PIN);
  };

  const handleKeypad = (key) => {
    if (key === 'C') { setPin(''); return; }
    if (key === '←') { setPin(p => p.slice(0, -1)); return; }
    if (pin.length < 4) setPin(p => p + key);
  };

  const handlePay = async () => {
    if (pin.length < 4) { setPinError('Enter 4-digit PIN'); return; }
    setPinLoading(true);
    setPinError('');
    const target = recipientInput.trim().toUpperCase();
    const amt    = parseFloat(amount);
    const payload = {
      transaction_id:      `TXN-WEB-${crypto.randomUUID()}`,
      sender_account_id:   user.account_id,
      receiver_account_id: target,
      amount:              amt,
      timestamp:           new Date().toISOString(),
      device_fingerprint:  `normal-device-${user.account_id.slice(-3)}`,
      channel:             'UPI',
      geo_lat:             19.076,
      geo_lon:             72.8777,
    };
    try {
      const res = await scoreTransaction(payload);
      setResult({ ...res, _amount: amt, _target: target });
      if (res.decision === 'allow') setBalance(b => b - amt);
      setScreen(SCREEN.RESULT);
    } catch (error) {
      setPinError(error.message || 'The live risk engine could not score this payment');
    } finally {
      setPinLoading(false);
    }
  };

  const handleNewPayment = () => {
    setResult(null);
    setAmount('');
    setRecipientInput(defaultRecipientFor(user.account_id));
    setPin('');
    setPayError('');
    setScreen(SCREEN.WALLET);
  };

  const handleLogout = () => {
    setUser(null);
    setUsername('');
    setPassword('');
    setScreen(SCREEN.LOGIN);
  };

  return (
    <div className="upf-root">
      {/* Header Bar with Theme Toggle & Back to Home */}
      <header className="upf-header">
        <div className="upf-header-inner">
          <div className="upf-brand">
            <Link to="/" className="upf-home-link" title="Return to Landing Page">
              <Home size={15} />
              <span>Home</span>
            </Link>
            <span className="upf-brand-divider">/</span>
            <ShieldAlert size={18} className="upf-brand-icon" />
            <span className="upf-brand-name">DHOKHA<span className="upf-brand-dot">.</span>PAY</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ThemeToggle />
            {user && (
              <button className="upf-logout-btn" onClick={handleLogout}>
                <ArrowLeft size={14} />
                <span>Logout</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="upf-main">

        {/* ── 1. AUTHENTICATION (SIGN UP & SIGN IN) ── */}
        {screen === SCREEN.LOGIN && (
          <div className="upf-card upf-card-narrow animate-in">
            {/* Tab Selector */}
            <div className="upf-tab-container">
              <button
                type="button"
                className={`upf-tab-btn ${authMode === 'signup' ? 'active' : ''}`}
                onClick={() => setAuthMode('signup')}
              >
                CREATE ACCOUNT
              </button>
              <button
                type="button"
                className={`upf-tab-btn ${authMode === 'login' ? 'active' : ''}`}
                onClick={() => setAuthMode('login')}
              >
                SIGN IN
              </button>
            </div>

            {authMode === 'signup' ? (
              <>
                <div className="upf-card-eyebrow">
                  <User size={14} />
                  <span>USER PROFILE REGISTRATION</span>
                </div>
                <h2 className="upf-card-title">Create Account</h2>
                <p className="upf-card-sub">Demo profile mapped to a seeded account; payments use the live risk engine</p>

                <form onSubmit={handleSignUp} className="upf-form">
                  <div className="upf-field">
                    <label className="upf-label">Full Name</label>
                    <div className="upf-input-wrap">
                      <User size={15} className="upf-input-icon" />
                      <input
                        className="upf-input"
                        type="text"
                        placeholder="e.g. Rahul Sharma"
                        value={signUpName}
                        onChange={e => setSignUpName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="upf-field">
                    <label className="upf-label">Phone / Username</label>
                    <div className="upf-input-wrap">
                      <Smartphone size={15} className="upf-input-icon" />
                      <input
                        className="upf-input"
                        type="text"
                        placeholder="e.g. +91 98765 43210"
                        value={signUpPhone}
                        onChange={e => setSignUpPhone(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="upf-field">
                    <label className="upf-label">Bank Name</label>
                    <div className="upf-input-wrap">
                      <Building2 size={15} className="upf-input-icon" />
                      <select
                        className="upf-input"
                        value={signUpBank}
                        onChange={e => setSignUpBank(e.target.value)}
                        style={{ cursor: 'pointer' }}
                      >
                        <option value="HDFC Bank">HDFC Bank</option>
                        <option value="ICICI Bank">ICICI Bank</option>
                        <option value="State Bank of India">State Bank of India</option>
                        <option value="Axis Bank">Axis Bank</option>
                      </select>
                    </div>
                  </div>

                  <div className="upf-field">
                    <label className="upf-label">City / Location</label>
                    <div className="upf-input-wrap">
                      <MapPin size={15} className="upf-input-icon" />
                      <input
                        className="upf-input"
                        type="text"
                        placeholder="e.g. Mumbai"
                        value={signUpCity}
                        onChange={e => setSignUpCity(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="upf-field">
                    <label className="upf-label">Starting Balance (₹)</label>
                    <div className="upf-input-wrap">
                      <CreditCard size={15} className="upf-input-icon" />
                      <input
                        className="upf-input"
                        type="number"
                        placeholder="50000"
                        value={signUpBalance}
                        onChange={e => setSignUpBalance(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="upf-field">
                    <label className="upf-label">Password</label>
                    <div className="upf-input-wrap">
                      <Lock size={15} className="upf-input-icon" />
                      <input
                        className="upf-input"
                        type="password"
                        placeholder="••••••••"
                        value={signUpPassword}
                        onChange={e => setSignUpPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {signUpError && <div className="upf-error-bar">{signUpError}</div>}

                  <button type="submit" className="upf-btn-primary">
                    <LogIn size={16} />
                    <span>CREATE PROFILE & OPEN WALLET</span>
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="upf-card-eyebrow">
                  <Lock size={14} />
                  <span>SECURE LOGIN</span>
                </div>
                <h2 className="upf-card-title">Welcome back</h2>
                <p className="upf-card-sub">Demo sign-in maps you to a seeded account; credentials stay in this browser</p>

                <form onSubmit={handleLogin} className="upf-form">
                  <div className="upf-field">
                    <label className="upf-label">Username / Phone</label>
                    <div className="upf-input-wrap">
                      <User size={15} className="upf-input-icon" />
                      <input
                        className="upf-input"
                        type="text"
                        placeholder="e.g. rahul"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        autoComplete="username"
                        required
                      />
                    </div>
                  </div>

                  <div className="upf-field">
                    <label className="upf-label">Password</label>
                    <div className="upf-input-wrap">
                      <Lock size={15} className="upf-input-icon" />
                      <input
                        className="upf-input"
                        type={showPass ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        autoComplete="current-password"
                        required
                      />
                      <button type="button" className="upf-eye-btn" onClick={() => setShowPass(v => !v)}>
                        {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  {loginError && <div className="upf-error-bar">{loginError}</div>}

                  <button type="submit" className="upf-btn-primary" disabled={loginLoading}>
                    {loginLoading ? (
                      <span className="upf-spinner" />
                    ) : (
                      <>
                        <LogIn size={16} />
                        <span>SIGN IN</span>
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        {/* ── 2. WALLET PROFILE & PAYMENT SCREEN ── */}
        {screen === SCREEN.WALLET && user && (
          <div className="upf-card animate-in">
            {/* User Profile Banner */}
            <div className="upf-profile-card">
              <div className="upf-avatar">{user.name?.[0]?.toUpperCase() || 'U'}</div>
              <div className="upf-profile-info">
                <div className="upf-profile-name">{user.name}</div>
                <div className="upf-profile-sub">
                  <span>{user.account_id}</span> • <span>{user.bank_id || 'HDFC Bank'}</span>
                </div>
              </div>
              <div className="upf-balance-badge">
                <div className="upf-balance-lbl">AVAILABLE BALANCE</div>
                <div className="upf-balance-val">{fmt(balance)}</div>
              </div>
            </div>

            {/* Make Payment Form */}
            <div className="upf-pay-section">
              <div className="upf-section-title">
                <Send size={15} />
                <span>MAKE A PAYMENT</span>
              </div>

              <div className="upf-form">
                <div className="upf-field">
                  <label className="upf-label">Recipient UPI / Account ID</label>
                  <div className="upf-input-wrap">
                    <User size={15} className="upf-input-icon" />
                    <input
                      className="upf-input"
                      type="text"
                      placeholder="e.g. ACC-005"
                      value={recipientInput}
                      onChange={e => setRecipientInput(e.target.value)}
                    />
                  </div>
                </div>

                <div className="upf-field">
                  <label className="upf-label">Amount (₹)</label>
                  <div className="upf-input-wrap">
                    <input
                      className="upf-input upf-amount-input"
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                    />
                  </div>
                </div>

                {/* Quick amount chips */}
                <div className="upf-quick-chips">
                  {['500', '1000', '5000', '10000', '25000'].map(val => (
                    <button
                      key={val}
                      type="button"
                      className="upf-chip-btn"
                      onClick={() => setAmount(val)}
                    >
                      ₹{parseInt(val).toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>

                {payError && <div className="upf-error-bar">{payError}</div>}

                <button type="button" className="upf-btn-primary" onClick={handleProceedToPay}>
                  <span>PROCEED TO PAY</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 3. PIN ENTRY MODAL ── */}
        {screen === SCREEN.PIN && (
          <div className="upf-card upf-card-narrow animate-in">
            <div className="upf-card-eyebrow">
              <Lock size={14} />
              <span>UPI SECURITY PIN</span>
            </div>
            <h2 className="upf-card-title">Enter PIN</h2>
            <p className="upf-card-sub">
              Paying <strong style={{ color: 'var(--text)' }}>{fmt(amount)}</strong> to <strong style={{ color: 'var(--text)' }}>{recipientInput}</strong>
              <br />Demo PIN: enter any 4 digits
            </p>

            <div className="upf-pin-dots">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={`upf-dot ${pin.length > i ? 'filled' : ''}`} />
              ))}
            </div>

            {pinError && <div className="upf-error-bar">{pinError}</div>}

            <div className="upf-keypad">
              {['1','2','3','4','5','6','7','8','9','C','0','←'].map(k => (
                <button key={k} className="upf-key" onClick={() => handleKeypad(k)}>
                  {k}
                </button>
              ))}
            </div>

            <div className="upf-pin-actions">
              <button className="upf-btn-secondary" onClick={() => setScreen(SCREEN.WALLET)}>
                Cancel
              </button>
              <button
                className="upf-btn-primary"
                onClick={handlePay}
                disabled={pin.length < 4 || pinLoading}
              >
                {pinLoading ? <span className="upf-spinner" /> : <span>CONFIRM PAYMENT</span>}
              </button>
            </div>
          </div>
        )}

        {/* ── 4. TRANSACTION RESULT ── */}
        {screen === SCREEN.RESULT && result && (
          <div className="upf-card upf-card-narrow animate-in">
            <div className="upf-result-header">
              {result.decision === 'allow' && <CheckCircle2 size={48} style={{ color: 'var(--safe)' }} />}
              {result.decision === 'review' && <AlertTriangle size={48} style={{ color: 'var(--risk-medium)' }} />}
              {result.decision === 'block' && <XCircle size={48} style={{ color: 'var(--risk-critical)' }} />}

              <h2 className="upf-result-title">
                {result.decision === 'allow' && 'Payment Successful'}
                {result.decision === 'review' && 'Payment Under Review'}
                {result.decision === 'block' && 'Payment Blocked'}
              </h2>
              <div className="upf-result-sub">
                Txn ID: <code>{result.transaction_id}</code>
              </div>
            </div>

            <div className="upf-result-details">
              <div className="upf-detail-row">
                <span>Amount Paid</span>
                <span className="upf-detail-val">{fmt(result._amount)}</span>
              </div>
              <div className="upf-detail-row">
                <span>Recipient</span>
                <span className="upf-detail-val">{result._target}</span>
              </div>
              <div className="upf-detail-row">
                <span>Risk Decision</span>
                <span className={`upf-tag tag-${result.decision}`}>
                  {result.decision.toUpperCase()}
                </span>
              </div>
              <div className="upf-detail-row">
                <span>Fraud Probability</span>
                <span className="upf-detail-val">
                  {Math.round((result.fraud_probability || result.final_confidence || 0) * 100)}/100
                </span>
              </div>
              <div className="upf-detail-row">
                <span>Engine Latency</span>
                <span className="upf-detail-val">{result.latency_ms || 120}ms</span>
              </div>
            </div>

            {result.top_reasons?.length > 0 && (
              <div className="upf-reasons-box">
                <div className="upf-reasons-title">Risk Engine Findings:</div>
                <ul>
                  {result.top_reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            <button className="upf-btn-primary" onClick={handleNewPayment} style={{ marginTop: 20 }}>
              <span>MAKE ANOTHER PAYMENT</span>
            </button>
          </div>
        )}

      </main>
    </div>
  );
}
