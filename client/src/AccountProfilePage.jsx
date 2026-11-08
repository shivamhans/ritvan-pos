import React, { useEffect, useRef, useState } from 'react';
import {
  UserRound, Mail, Phone, ShieldCheck, LockKeyhole, Save, CheckCircle2,
  AlertCircle, KeyRound, Eye, EyeOff, RefreshCw, Fingerprint, Clock3,
} from 'lucide-react';
import { apiRequest } from './lib/api.js';

const initialForm = user => ({
  name: user?.name || '',
  email: user?.email || '',
  phone: user?.phone || '',
});

function initialsFor(name) {
  return String(name || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2)
    .map(part => part.charAt(0).toUpperCase()).join('') || '?';
}

function ProfileField({ label, icon: Icon, hint, children }) {
  return <label className="profile-field">
    <span className="profile-field-label">{Icon && <Icon size={14}/>} {label}</span>
    {children}
    {hint && <small>{hint}</small>}
  </label>;
}

function Feedback({ type = 'error', children }) {
  if (!children) return null;
  return <div className={'profile-feedback profile-feedback-' + type}>
    {type === 'success' ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>}
    <span>{children}</span>
  </div>;
}

export default function AccountProfilePage({ auth, notify, onUnauthorized, onProfileUpdated }) {
  const token = auth?.token;
  const unauthorizedRef = useRef(onUnauthorized);
  const notifyRef = useRef(notify);
  unauthorizedRef.current = onUnauthorized;
  notifyRef.current = notify;

  const [form, setForm] = useState(() => initialForm(auth?.user));
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileWarning, setProfileWarning] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPasswords, setShowPasswords] = useState(false);
  const [serverUpdatedAt, setServerUpdatedAt] = useState(null);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    apiRequest('/auth/me', { token })
      .then(data => {
        if (cancelled || !data.user) return;
        setForm(initialForm(data.user));
        setServerUpdatedAt(data.user.updatedAt || null);
      })
      .catch(error => {
        if (cancelled) return;
        setProfileError(error.message || 'Could not load your profile.');
        if (error.status === 401 && unauthorizedRef.current) unauthorizedRef.current();
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const role = auth?.user?.role || 'Staff';
  const accountId = auth?.user?.id;
  const setProfileValue = (key, value) => {
    setForm(current => ({ ...current, [key]: value }));
    setProfileSaved(false);
    setProfileError('');
    setProfileWarning('');
  };
  const setPasswordValue = (key, value) => {
    setPasswordForm(current => ({ ...current, [key]: value }));
    setPasswordSaved(false);
    setPasswordError('');
  };

  const saveProfile = async event => {
    event.preventDefault();
    if (!form.name.trim()) { setProfileError('Enter your full name.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setProfileError('Enter a valid email address.'); return; }
    if (form.phone.trim() && (!/^[+0-9().\s-]{7,24}$/.test(form.phone.trim()) || form.phone.replace(/\D/g, '').length < 7)) {
      setProfileError('Enter a valid phone number or leave it blank.');
      return;
    }
    setSavingProfile(true); setProfileError(''); setProfileWarning(''); setProfileSaved(false);
    try {
      const result = await apiRequest('/auth/me', {
        method: 'PATCH', token,
        body: { name: form.name.trim(), email: form.email.trim().toLowerCase(), phone: form.phone.trim() || null },
      });
      setForm(initialForm(result.user));
      if (result.user?.updatedAt) setServerUpdatedAt(result.user.updatedAt);
      if (onProfileUpdated) onProfileUpdated(result);
      setProfileSaved(!result.warning);
      if (result.warning) {
        setProfileWarning(result.warning);
        notifyRef.current?.(result.warning, 'warning');
      } else {
        notifyRef.current?.('Your profile has been updated.', 'success');
      }
    } catch (error) {
      setProfileError(error.message || 'Could not save your profile.');
      if (error.status === 401 && unauthorizedRef.current) unauthorizedRef.current();
    } finally { setSavingProfile(false); }
  };

  const savePassword = async event => {
    event.preventDefault();
    if (!passwordForm.currentPassword) { setPasswordError('Enter your current password.'); return; }
    if (passwordForm.newPassword.length < 12) { setPasswordError('Your new password must be at least 12 characters.'); return; }
    if (passwordForm.newPassword.length > 200) { setPasswordError('Your new password cannot exceed 200 characters.'); return; }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { setPasswordError('The new password and confirmation do not match.'); return; }
    if (passwordForm.newPassword === passwordForm.currentPassword) { setPasswordError('Choose a password different from your current one.'); return; }
    setSavingPassword(true); setPasswordError(''); setPasswordSaved(false);
    try {
      const result = await apiRequest('/auth/me', {
        method: 'PATCH', token,
        body: { currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword },
      });
      if (onProfileUpdated) onProfileUpdated(result);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordSaved(true);
      notifyRef.current?.('Your password has been changed.', 'success');
    } catch (error) {
      setPasswordError(error.message || 'Could not change your password.');
      if (error.status === 401 && unauthorizedRef.current) unauthorizedRef.current();
    } finally { setSavingPassword(false); }
  };

  return <div className="account-profile-page">
    <header className="account-profile-heading">
      <div>
        <div className="profile-eyebrow"><span/> ACCOUNT / PERSONAL SETTINGS</div>
        <h1>My profile</h1>
        <p>Manage your personal details and keep your account secure.</p>
      </div>
      <div className="profile-account-state"><span className="profile-online-dot"/><span>Signed in</span><i/> <b>{role}</b></div>
    </header>

    <section className="profile-hero panel">
      <div className="profile-hero-glow"/>
      <div className="profile-hero-avatar">{initialsFor(auth?.user?.name)}</div>
      <div className="profile-hero-copy">
        <span className="profile-overline">YOUR RITVAN ACCOUNT</span>
        <h2>{auth?.user?.name || 'Your profile'}</h2>
        <p>{auth?.user?.email || 'Add an email address to your account'}</p>
        <div className="profile-role-line"><span><ShieldCheck size={13}/>{role}</span><span><Fingerprint size={13}/>Account #{accountId ?? '—'}</span></div>
      </div>
      <div className="profile-hero-badge"><ShieldCheck size={16}/><span>Personal account<br/><small>Role managed by your administrator</small></span></div>
    </section>

    <div className="profile-content-grid">
      <section className="panel profile-settings-card">
        <div className="profile-panel-heading">
          <span className="profile-panel-icon"><UserRound size={18}/></span>
          <div><h2>Personal details</h2><p>Update the name and contact information shown around Ritvan POS.</p></div>
        </div>
        {loading ? <div className="profile-loading"><RefreshCw size={17}/>Loading your details…</div> : <form className="profile-form" onSubmit={saveProfile}>
          <div className="profile-form-grid">
            <ProfileField label="Full name" icon={UserRound} hint="This name appears in your account menu and staff activity.">
              <input autoComplete="name" className="form-input" maxLength={140} required value={form.name} onChange={event=>setProfileValue('name',event.target.value)} placeholder="Your full name"/>
            </ProfileField>
            <ProfileField label="Email address" icon={Mail} hint="Used for signing in to Ritvan POS.">
              <input autoComplete="email" className="form-input" type="email" maxLength={190} required value={form.email} onChange={event=>setProfileValue('email',event.target.value)} placeholder="you@example.com"/>
            </ProfileField>
            <ProfileField label="Phone number" icon={Phone} hint="Optional. Use your country code where applicable.">
              <input autoComplete="tel" className="form-input" type="tel" maxLength={24} value={form.phone} onChange={event=>setProfileValue('phone',event.target.value)} placeholder="+91 98765 43210"/>
            </ProfileField>
          </div>
          <Feedback>{profileError}</Feedback>
          <Feedback type="warning">{profileWarning}</Feedback>
          {profileSaved && <Feedback type="success">Your personal details are saved.</Feedback>}
          <div className="profile-form-footer"><span><LockKeyhole size={14}/> Only your personal details can be changed here. Role and permissions stay protected.</span><button className="btn btn-primary" type="submit" disabled={savingProfile || loading}>{savingProfile ? <RefreshCw size={15} className="profile-spin"/> : <Save size={15}/>}<span>{savingProfile ? 'Saving…' : 'Save changes'}</span></button></div>
        </form>}
      </section>

      <section className="panel profile-security-card">
        <div className="profile-panel-heading">
          <span className="profile-panel-icon profile-panel-icon-security"><LockKeyhole size={18}/></span>
          <div><h2>Security</h2><p>Change your password without asking an administrator to reset it.</p></div>
        </div>
        <form className="profile-form" onSubmit={savePassword}>
          <div className="profile-form-grid profile-password-grid">
            <ProfileField label="Current password" icon={KeyRound}>
              <input autoComplete="current-password" className="form-input" type={showPasswords?'text':'password'} value={passwordForm.currentPassword} onChange={event=>setPasswordValue('currentPassword',event.target.value)} placeholder="Enter current password"/>
            </ProfileField>
            <ProfileField label="New password" icon={LockKeyhole} hint="At least 12 characters.">
              <input autoComplete="new-password" className="form-input" type={showPasswords?'text':'password'} value={passwordForm.newPassword} onChange={event=>setPasswordValue('newPassword',event.target.value)} placeholder="Create a strong password"/>
            </ProfileField>
            <ProfileField label="Confirm new password" icon={LockKeyhole}>
              <input autoComplete="new-password" className="form-input" type={showPasswords?'text':'password'} value={passwordForm.confirmPassword} onChange={event=>setPasswordValue('confirmPassword',event.target.value)} placeholder="Re-enter new password"/>
            </ProfileField>
          </div>
          <label className="profile-show-password"><input type="checkbox" checked={showPasswords} onChange={event=>setShowPasswords(event.target.checked)}/> Show passwords</label>
          <Feedback>{passwordError}</Feedback>
          {passwordSaved && <Feedback type="success">Password updated successfully.</Feedback>}
          <div className="profile-form-footer profile-security-footer"><span><ShieldCheck size={14}/> Your current password is required to change it.</span><button className="btn btn-primary" type="submit" disabled={savingPassword}>{savingPassword ? <RefreshCw size={15} className="profile-spin"/> : <LockKeyhole size={15}/>}<span>{savingPassword ? 'Updating…' : 'Update password'}</span></button></div>
        </form>
        <div className="profile-security-note"><Clock3 size={15}/><span>For account safety, role, access permissions and account status can only be changed by an authorized Admin.</span></div>
      </section>
    </div>
  </div>;
}
