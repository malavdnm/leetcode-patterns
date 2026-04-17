import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

function parseAdminEmails() {
  const raw = import.meta.env.VITE_ADMIN_EMAILS || '';
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function resolveIsAdmin(sessionUser) {
  if (!sessionUser) return false;
  const role = sessionUser.app_metadata?.role;
  if (role === 'admin') return true;
  const admins = parseAdminEmails();
  const email = sessionUser.email?.toLowerCase();
  return Boolean(email && admins.includes(email));
}

export function useAuth() {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [signingIn, setSigningIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function init() {
      if (!supabase) {
        if (mounted) setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;
        if (error) {
          setAuthError(error.message);
        } else {
          setSession(data.session ?? null);
          setUser(data.session?.user ?? null);
          setIsAdmin(resolveIsAdmin(data.session?.user ?? null));
        }
      } catch (err) {
        if (mounted) setAuthError(err.message || 'Failed to initialize auth');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();

    if (!supabase) return undefined;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setUser(nextSession?.user ?? null);
      setIsAdmin(resolveIsAdmin(nextSession?.user ?? null));
      setSigningIn(false);
      setSigningOut(false);
      setAuthError(null);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async () => {
    if (!supabase) return;
    setSigningIn(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/auth/v1/callback`,
        },
      });
      if (error) {
        setAuthError(error.message);
        setSigningIn(false);
      }
      // If no error, the browser will redirect to GitHub.
      // signingIn stays true until redirect or onAuthStateChange fires.
    } catch (err) {
      setAuthError(err.message || 'Sign-in failed');
      setSigningIn(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    setSigningOut(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setAuthError(error.message);
        setSigningOut(false);
      }
    } catch (err) {
      setAuthError(err.message || 'Sign-out failed');
      setSigningOut(false);
    }
  }, []);

  const clearError = useCallback(() => setAuthError(null), []);

  return {
    user,
    session,
    isAdmin,
    loading,
    authError,
    signingIn,
    signingOut,
    signIn,
    signOut,
    clearError,
  };
}
