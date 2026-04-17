import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * CRUD for reorganisation requests.
 *
 * Non-admins: createRequest only.
 * Admins:     loadRequests (all pending) + updateRequest (approve/reject).
 *
 * Note: admin DB operations require app_metadata.role = 'admin' set in
 * the Supabase dashboard (Authentication → Users → Edit → app_metadata).
 */
export function useRequests({ user, isAdmin }) {
  const [requests,  setRequests]  = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [submitMsg, setSubmitMsg] = useState(null); // { ok, text }

  // Admins load all pending requests on mount (and when isAdmin changes)
  const loadRequests = useCallback(async () => {
    if (!supabase || !isAdmin) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    setLoading(false);
    if (!error) setRequests(data ?? []);
  }, [isAdmin]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  /**
   * Submit a new request (non-admin users).
   * `from` and `to` match the shape used in moveProblem:
   *   { patKey, bi, si, role }
   */
  const createRequest = useCallback(async ({ num, action, from, to, note }) => {
    if (!supabase || !user) return;
    setSubmitMsg(null);

    const { error } = await supabase.from('requests').insert({
      user_id:   user.id,
      user_email: user.email,
      action,
      num,
      from_pat:  from.patKey,
      from_bi:   from.bi,
      from_si:   from.si,
      from_role: from.role,
      to_pat:    to?.patKey  ?? null,
      to_bi:     to?.bi      ?? null,
      to_si:     to?.si      ?? null,
      to_role:   to?.role    ?? null,
      note:      note || null,
    });

    if (error) {
      setSubmitMsg({ ok: false, text: 'Failed to submit. Please try again.' });
    } else {
      setSubmitMsg({ ok: true, text: 'Request submitted! The admin will review it.' });
    }
  }, [user]);

  /**
   * Admin: approve or reject a request.
   * On approve the caller is responsible for applying the move via moveProblem.
   */
  const updateRequest = useCallback(async (id, status) => {
    if (!supabase || !isAdmin) return;
    const { error } = await supabase
      .from('requests')
      .update({ status })
      .eq('id', id);
    if (!error) {
      setRequests(prev => prev.filter(r => r.id !== id));
    }
  }, [isAdmin]);

  const clearSubmitMsg = useCallback(() => setSubmitMsg(null), []);

  return {
    requests,
    loading,
    submitMsg,
    createRequest,
    updateRequest,
    loadRequests,
    clearSubmitMsg,
  };
}
