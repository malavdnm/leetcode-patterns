import { useState, useRef, useEffect } from 'react';
import patternMeta from '../data/patternMeta.json';

/* ── helpers ── */

const patMap = Object.fromEntries(patternMeta);

function locLabel(pat, bi, si, role, patterns) {
  if (!pat) return '—';
  const bucket = patterns[pat]?.buckets[bi];
  const sub    = bucket?.subs[si];
  return `${patMap[pat] ?? pat} › ${bucket?.name ?? bi} › ${sub?.idea ?? si}`;
}

function timeAgo(iso) {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (days  > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins  > 0) return `${mins}m ago`;
  return 'just now';
}

/* ── Inline SVG icons ── */

function GitHubIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
        0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
        -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87
        2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95
        0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21
        2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04
        2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82
        2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0
        1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016
        8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function SpinnerIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className="auth-spinner">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22
        9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
    </svg>
  );
}

function WarningIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8.22 1.754a.25.25 0 00-.44 0L1.698 13.132a.25.25 0 00.22.368h12.164a.25.25
        0 00.22-.368L8.22 1.754zm-1.763-.707c.659-1.234 2.427-1.234 3.086
        0l6.082 11.378A1.75 1.75 0 0114.082 15H1.918a1.75 1.75 0
        01-1.543-2.575L6.457 1.047zM9 11a1 1 0 11-2 0 1 1 0 012
        0zm-.25-5.25a.75.75 0 00-1.5 0v2.5a.75.75 0 001.5 0v-2.5z" />
    </svg>
  );
}

function CloudSyncIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M4.5 13a3.5 3.5 0 01-.68-6.93A5.002 5.002 0 019 2a5 5 0 014.9
        4.1A3.5 3.5 0 0113 13H4.5z" />
    </svg>
  );
}

function SignOutIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor"
         strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3" />
      <path d="M10 12l4-4-4-4" />
      <path d="M14 8H6" />
    </svg>
  );
}

function UploadIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M4.5 13a3.5 3.5 0 01-.68-6.93A5.002 5.002 0 019 2a5 5 0 014.9 4.1A3.5 3.5 0 0113 13H4.5z
               M8 6.25a.75.75 0 00-.75.75v3.5a.75.75 0 001.5 0V7a.75.75 0 00-.75-.75z" />
      <path d="M5.72 6.53a.75.75 0 011.06-1.06L8 6.69l1.22-1.22a.75.75 0 111.06 1.06l-1.75 1.75a.75.75 0 01-1.06 0L5.72 6.53z" />
    </svg>
  );
}

/* ── Sync badge ── */

function DotIcon({ size = 8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" fill="currentColor" aria-hidden="true">
      <circle cx="4" cy="4" r="4" />
    </svg>
  );
}

function SyncBadge({ syncStatus, syncMessage }) {
  switch (syncStatus) {
    case 'pending':
      return (
        <div className="auth-sync auth-sync--pending" role="status" aria-live="polite">
          <DotIcon size={8} /><span>{syncMessage || 'Changes pending…'}</span>
        </div>
      );
    case 'saving':
      return (
        <div className="auth-sync auth-sync--saving" role="status" aria-live="polite">
          <SpinnerIcon size={11} /><span>{syncMessage || 'Saving…'}</span>
        </div>
      );
    case 'saved':
      return (
        <div className="auth-sync auth-sync--saved" role="status" aria-live="polite">
          <CheckIcon /><span>{syncMessage || 'Saved'}</span>
        </div>
      );
    case 'error':
      return (
        <div className="auth-sync auth-sync--error" role="status" aria-live="polite">
          <WarningIcon /><span>{syncMessage || 'Sync error'}</span>
        </div>
      );
    default:
      return (
        <div className="auth-sync auth-sync--idle" role="status" aria-live="polite">
          <CloudSyncIcon /><span>{syncMessage || 'Synced'}</span>
        </div>
      );
  }
}

/* ── Requests tab (admin only) ── */

function RequestsTab({ requests, reqLoading, onApprove, onReject, patterns, problems }) {
  if (reqLoading) {
    return <div className="req-tab-empty">Loading requests…</div>;
  }
  if (!requests.length) {
    return (
      <div className="req-tab-empty">
        <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" opacity="0.35" aria-hidden="true">
          <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22
            9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
        </svg>
        <span>No pending requests</span>
      </div>
    );
  }

  return (
    <div className="req-tab-list">
      {requests.map(r => {
        const p = problems[String(r.num)];
        return (
          <div key={r.id} className="req-card">
            <div className="req-card__head">
              <span className={`req-action req-action--${r.action}`}>{r.action}</span>
              <span className="req-card__prob">
                <strong>{r.num}</strong>{p ? `. ${p.name}` : ''}
              </span>
              <span className="req-card__time">{timeAgo(r.created_at)}</span>
            </div>

            <div className="req-card__user">{r.user_email}</div>

            <div className="req-card__loc">
              <span className="req-loc-tag req-loc-tag--from">From</span>
              <span>{locLabel(r.from_pat, r.from_bi, r.from_si, r.from_role, patterns)}</span>
            </div>
            {r.to_pat && (
              <div className="req-card__loc">
                <span className="req-loc-tag req-loc-tag--to">To</span>
                <span>{locLabel(r.to_pat, r.to_bi, r.to_si, r.to_role, patterns)}</span>
              </div>
            )}
            {r.note && <div className="req-card__note">"{r.note}"</div>}

            <div className="req-card__actions">
              <button className="req-btn req-btn--approve" onClick={() => onApprove(r)}>
                Approve
              </button>
              <button className="req-btn req-btn--reject" onClick={() => onReject(r.id)}>
                Reject
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Signed-out ── */

function SignedOut({ signIn, signingIn, authError, clearError }) {
  return (
    <div className="auth-inline">
      {authError && (
        <div className="auth-error" role="alert">
          <WarningIcon />
          <span>{authError}</span>
          <button className="auth-error__dismiss" onClick={clearError} aria-label="Dismiss" type="button">&times;</button>
        </div>
      )}
      <button
        className="auth-btn auth-btn--signin"
        onClick={signIn}
        disabled={signingIn}
        aria-busy={signingIn}
        type="button"
      >
        {signingIn
          ? <><SpinnerIcon size={13} /><span>Redirecting…</span></>
          : <><GitHubIcon size={14} /><span>Sign in</span></>}
      </button>
    </div>
  );
}

/* ── Signed-in ── */

function SignedIn({
  user, syncStatus, syncMessage, flushNow, hasPendingChanges,
  signOut, signingOut, authError, clearError,
  isAdmin, requests, reqLoading, onApprove, onReject, patterns, problems,
}) {
  const [open, setOpen] = useState(false);
  const [tab,  setTab]  = useState('profile');
  const menuRef    = useRef(null);
  const triggerRef = useRef(null);

  const name =
    user.user_metadata?.user_name ||
    user.user_metadata?.preferred_username ||
    user.user_metadata?.full_name ||
    user.email?.split('@')[0] ||
    'User';

  const avatar       = user.user_metadata?.avatar_url;
  const pendingCount = isAdmin ? (requests?.length ?? 0) : 0;

  // Switch to requests tab when opening and there are pending items
  const handleOpen = () => {
    setOpen(v => {
      if (!v && isAdmin && pendingCount > 0) setTab('requests');
      else if (!v) setTab('profile');
      return !v;
    });
  };

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onClickOut = (e) => {
      if (
        menuRef.current    && !menuRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) setOpen(false);
    };
    const onEsc = (e) => {
      if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener('mousedown', onClickOut);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickOut);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div className="auth-inline">
      {authError && (
        <div className="auth-error" role="alert">
          <WarningIcon />
          <span>{authError}</span>
          <button className="auth-error__dismiss" onClick={clearError} aria-label="Dismiss" type="button">&times;</button>
        </div>
      )}

      <SyncBadge syncStatus={syncStatus} syncMessage={syncMessage} />

      <button
        className="auth-sync-btn"
        onClick={flushNow}
        disabled={!hasPendingChanges || syncStatus === 'saving' || syncStatus === 'paused'}
        title={syncStatus === 'paused' ? syncMessage : hasPendingChanges ? 'Sync now' : 'No changes'}
        type="button"
        aria-label="Sync now"
      >
        {syncStatus === 'saving' ? <SpinnerIcon size={13} /> : <UploadIcon size={13} />}
      </button>

      <div className="auth-user-menu">
        <button
          ref={triggerRef}
          className="auth-user-trigger"
          onClick={handleOpen}
          aria-expanded={open}
          aria-haspopup="true"
          aria-label={`User menu for ${name}`}
          type="button"
        >
          {avatar ? (
            <img src={avatar} alt="" width="22" height="22" className="auth-avatar" loading="lazy" />
          ) : (
            <span className="auth-avatar auth-avatar--fallback" aria-hidden="true">
              {name.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="auth-user-name">{name}</span>
          {isAdmin && pendingCount > 0 && (
            <span className="auth-req-badge" aria-label={`${pendingCount} pending requests`}>
              {pendingCount}
            </span>
          )}
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor"
               strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
               className={`auth-chevron ${open ? 'auth-chevron--open' : ''}`}>
            <path d="M2.5 3.5L5 6.5L7.5 3.5" />
          </svg>
        </button>

        {open && (
          <div
            ref={menuRef}
            className={`auth-dropdown ${isAdmin ? 'auth-dropdown--admin' : ''}`}
            role="dialog"
            aria-label="User menu"
          >
            {/* Tabs (admin only) */}
            {isAdmin && (
              <div className="auth-dropdown__tabs" role="tablist">
                <button
                  role="tab"
                  aria-selected={tab === 'profile'}
                  className={`auth-tab ${tab === 'profile' ? 'auth-tab--active' : ''}`}
                  onClick={() => setTab('profile')}
                  type="button"
                >
                  Profile
                </button>
                <button
                  role="tab"
                  aria-selected={tab === 'requests'}
                  className={`auth-tab ${tab === 'requests' ? 'auth-tab--active' : ''}`}
                  onClick={() => setTab('requests')}
                  type="button"
                >
                  Requests
                  {pendingCount > 0 && (
                    <span className="auth-tab-badge">{pendingCount}</span>
                  )}
                </button>
              </div>
            )}

            {/* Profile tab */}
            {tab === 'profile' && (
              <>
                <div className="auth-dropdown__header">
                  <span className="auth-dropdown__email">{user.email}</span>
                </div>
                <div className="auth-dropdown__divider" />
                <button
                  className="auth-dropdown__item auth-dropdown__item--signout"
                  onClick={() => { setOpen(false); signOut(); }}
                  disabled={signingOut}
                  aria-busy={signingOut}
                  role="menuitem"
                  type="button"
                >
                  {signingOut
                    ? <><SpinnerIcon size={13} /><span>Signing out…</span></>
                    : <><SignOutIcon size={13} /><span>Sign out</span></>}
                </button>
              </>
            )}

            {/* Requests tab (admin only) */}
            {tab === 'requests' && (
              <RequestsTab
                requests={requests}
                reqLoading={reqLoading}
                onApprove={onApprove}
                onReject={onReject}
                patterns={patterns}
                problems={problems}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Loading skeleton ── */

function AuthSkeleton() {
  return (
    <div className="auth-inline" aria-busy="true">
      <div className="auth-skeleton auth-skeleton--medium" />
      <div className="auth-skeleton auth-skeleton--circle" />
    </div>
  );
}

/* ── Export ── */

export default function AuthBar({
  user, syncStatus, syncMessage, flushNow, hasPendingChanges,
  signIn, signOut,
  loading, authError, signingIn, signingOut, clearError,
  isAdmin, requests, reqLoading, onApprove, onReject, patterns, problems,
}) {
  if (loading) return <AuthSkeleton />;

  if (!user) {
    return <SignedOut signIn={signIn} signingIn={signingIn} authError={authError} clearError={clearError} />;
  }

  return (
    <SignedIn
      user={user}
      syncStatus={syncStatus}
      syncMessage={syncMessage}
      flushNow={flushNow}
      hasPendingChanges={hasPendingChanges}
      signOut={signOut}
      signingOut={signingOut}
      authError={authError}
      clearError={clearError}
      isAdmin={isAdmin}
      requests={requests}
      reqLoading={reqLoading}
      onApprove={onApprove}
      onReject={onReject}
      patterns={patterns}
      problems={problems}
    />
  );
}
