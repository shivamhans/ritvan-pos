import React, { useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, ShieldCheck, Sparkles, CircleCheck, Wifi, WifiOff } from 'lucide-react';
import { API_BASE_URL } from './lib/api.js';

export default function LoginScreen({ onLogin, onDemo }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [apiOnline, setApiOnline] = useState(null);
  const [dbOnline, setDbOnline] = useState(null);

  useEffect(() => {
    let alive = true;
    const apiIsNgrok = (() => {
      try {
        const hostname = new URL(API_BASE_URL).hostname;
        return hostname.endsWith('.ngrok-free.app') || hostname.endsWith('.ngrok.app');
      } catch { return false; }
    })();
    fetch(`${API_BASE_URL}/health`, {
      cache: 'no-store',
      headers: apiIsNgrok ? { 'ngrok-skip-browser-warning': 'true' } : {},
    }).then(async response => {
      if (!response.ok) throw new Error('Health check returned HTTP ' + response.status);
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('API returned a non-JSON response. Check that VITE_API_URL points to the ngrok tunnel for port 4001.');
      }
      return response.json();
    }).then(data => {
      if (alive) {
        setApiOnline(data.status === 'ok');
        setDbOnline(data.database === 'connected');
      }
    }).catch(error => {
      if (alive) {
        setApiOnline(false);
        console.warn('Ritvan API health check failed:', error);
      }
    });
    return () => { alive = false; };
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await onLogin({ email: email.trim(), password });
    } catch (err) {
      setError(err.message || 'Unable to sign in. Check your details and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-ambient login-ambient-one" />
      <div className="login-ambient login-ambient-two" />
      <div className="login-grid-texture" />
      <main className="login-layout">
        <section className="login-story">
          <div className="login-brand">
            <span className="login-brand-mark"><i /><i /><i /><i /></span>
            <span><b>RITVAN</b><small>POINT OF SALE</small></span>
          </div>
          <div className="login-story-content">
            <div className="login-kicker"><Sparkles size={14} /> RETAIL, IN SYNC</div>
            <h1>Your store.<br /><span>In perfect flow.</span></h1>
            <p>One clear view of sales, stock, and the little details that keep your business moving.</p>
            <div className="login-value-list">
              <div><span><CircleCheck size={16} /></span><div><b>Everything in one place</b><small>Sales, inventory, purchases and insights</small></div></div>
              <div><span><CircleCheck size={16} /></span><div><b>Built around your workflow</b><small>Fast checkout, clear controls, fewer surprises</small></div></div>
              <div><span><ShieldCheck size={16} /></span><div><b>Permission-aware by design</b><small>Protected actions belong on the server</small></div></div>
            </div>
          </div>
          <div className="login-story-footer"><span>© 2026 Ritvan POS</span><span>Phase 2 · API integration</span></div>
        </section>

        <section className="login-form-panel">
          <div className="login-mobile-brand">
            <span className="login-brand-mark"><i /><i /><i /><i /></span>
            <span><b>RITVAN</b><small>POINT OF SALE</small></span>
          </div>
          <div className="login-form-heading">
            <div className="login-form-icon"><ShieldCheck size={22} /></div>
            <h2>Welcome back</h2>
            <p>Sign in with your store account to continue.</p>
          </div>
          <div className={`api-status ${apiOnline && dbOnline ? 'api-status-online' : apiOnline === false || dbOnline === false ? 'api-status-offline' : ''}`}>
            {apiOnline && dbOnline ? <Wifi size={15} /> : apiOnline === false || dbOnline === false ? <WifiOff size={15} /> : <span className="login-status-pulse" />}
            <span>{apiOnline && dbOnline ? 'API + database connected' : apiOnline === false ? 'Local API not reachable' : dbOnline === false ? 'API reachable · database offline' : 'Checking local API…'}</span>
            <small>{API_BASE_URL.replace('/api', '')}</small>
          </div>
          <form className="login-form" onSubmit={submit}>
            <label htmlFor="ritvan-email">Email address</label>
            <input id="ritvan-email" type="email" autoComplete="username" placeholder="admin@yourstore.com" value={email} onChange={e => setEmail(e.target.value)} required />
            <div className="login-password-label"><label htmlFor="ritvan-password">Password</label></div>
            <div className="login-password-field">
              <input id="ritvan-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} required />
              <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            </div>
            {error && <div className="login-error" role="alert">{error}</div>}
            <button className="login-submit" type="submit" disabled={busy || apiOnline === false}>
              <span>{busy ? 'Signing in…' : 'Sign in to Ritvan'}</span>{!busy && <ArrowRight size={17} />}
            </button>
          </form>
          {(apiOnline === false || dbOnline === false) && <p className="login-help">{apiOnline === false ? 'Start the Express server and confirm the API URL is correct.' : 'The API is running, but MySQL is not connected. Start MySQL and check server/.env.'}</p>}
          <div className="login-divider"><span /> <small>OR</small> <span /></div>
          <button className="login-demo-button" type="button" onClick={onDemo}>Explore demo workspace <ArrowRight size={16} /></button>
          <p className="login-form-foot">Demo data is illustrative and resets on refresh. It is not connected to your database.</p>
        </section>
      </main>
    </div>
  );
}
