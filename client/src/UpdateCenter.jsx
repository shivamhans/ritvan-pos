import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, RefreshCw, X } from 'lucide-react';

const bridge = typeof window !== 'undefined' ? window.ritvanUpdater : null;

export default function UpdateCenter({ activePage, hasModal, isAdmin }) {
  const [state, setState] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!bridge || !isAdmin) return undefined;
    let mounted = true;
    const unsubscribe = bridge.onState(next => { if (mounted) setState(next); });
    bridge.getState().then(next => {
      if (!mounted) return;
      setState(next);
    }).catch(() => {});
    const report = () => bridge.reportActivity({
      safeToUpdate: activePage === 'Dashboard' && !hasModal,
    }).catch(() => {});
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    events.forEach(name => window.addEventListener(name, report, { passive: true }));
    report();
    return () => {
      mounted = false;
      unsubscribe?.();
      events.forEach(name => window.removeEventListener(name, report));
    };
  }, [activePage, hasModal, isAdmin]);

  if (!isAdmin || !state?.supported) return null;
  const checking = state.status === 'checking';
  const downloading = state.status === 'downloading';
  const downloaded = state.status === 'downloaded';
  const hasError = state.status === 'error';

  async function checkNow() {
    setBusy(true);
    try { const next = await bridge.checkForUpdates(); if (next) setState(current => ({ ...current, ...next })); }
    finally { setBusy(false); }
  }
  async function toggleAutomatic() {
    setBusy(true);
    try {
      const result = await bridge.setAutoInstallWhenIdle(!state.autoInstallWhenIdle);
      setState(current => ({ ...current, ...result }));
    } finally { setBusy(false); }
  }
  async function installNow() {
    setBusy(true);
    try { await bridge.installUpdate(); }
    finally { setBusy(false); }
  }

  return (
    <div className="update-center">
      <button className={'icon-button update-center-trigger' + (downloaded ? ' update-ready' : '')}
        onClick={() => setOpen(value => !value)} title="Ritvan POS updates" aria-label="Ritvan POS updates">
        {downloaded ? <Download size={18}/> : hasError ? <AlertTriangle size={18}/> : <RefreshCw size={18} className={checking ? 'update-spin' : ''}/>}
        {(downloaded || downloading || hasError) && <i/>}
      </button>
      {open && <section className="update-popover" role="dialog" aria-label="Software updates">
        <div className="update-popover-head">
          <div><span className="eyebrow">SYSTEM / UPDATES</span><h3>Ritvan POS updates</h3></div>
          <button className="icon-button small" onClick={() => setOpen(false)} aria-label="Close updates"><X size={16}/></button>
        </div>
        <div className="update-version-row">
          <div className="update-status-icon">{downloaded ? <CheckCircle2 size={19}/> : hasError ? <AlertTriangle size={19}/> : <RefreshCw size={19}/>}</div>
          <div className="update-status-copy">
            <b>{downloaded ? 'Update ready to install' : downloading ? 'Downloading update' : checking ? 'Checking for updates' : hasError ? 'Update check failed' : state.status === 'up-to-date' ? 'You are up to date' : state.status === 'available' ? 'Update available' : 'Installed version'}</b>
            <small>Installed version {state.currentVersion || 'unknown'}{state.availableVersion ? ' · Latest ' + state.availableVersion : ''}</small>
          </div>
        </div>
        <p className="update-message">{state.message || 'Updates are delivered through GitHub Releases.'}</p>
        {downloading && <div className="update-progress"><div style={{ width: `${Math.max(0, Math.min(100, state.percent || 0))}%` }}/></div>}
        {hasError && state.error && <p className="update-error">{state.error}</p>}
        <label className="update-auto-option">
          <span><b>Automatic updates</b><small>Install after 10 minutes of inactivity on Dashboard, or when you quit the app. The database is backed up before schema migrations.</small></span>
          <input type="checkbox" checked={Boolean(state.autoInstallWhenIdle)} onChange={toggleAutomatic} disabled={busy}/>
        </label>
        <div className="update-actions">
          <button className="btn btn-secondary" onClick={checkNow} disabled={busy || checking || downloading}><RefreshCw size={15}/> Check now</button>
          <button className="btn btn-primary" onClick={installNow} disabled={!downloaded || busy}><Download size={15}/> Install now</button>
        </div>
        <small className="update-footnote">Updates are available only in the installed desktop app. Keep the computer powered on while installing.</small>
      </section>}
    </div>
  );
}
