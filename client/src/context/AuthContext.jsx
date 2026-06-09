import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../config/supabaseClient';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [session, setSession]   = useState(null);
  const [user, setUser]         = useState(null);
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  /* ── Listen to Supabase auth state ── */
  useEffect(() => {
    const isGuest = localStorage.getItem('rl-guest-session');
    if (isGuest === 'true') {
      setUser({ id: 'guest', email: 'guest@reviewlens.local', user_metadata: { username: 'Guest' } });
      setSession({ user: { id: 'guest' } });
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  /* ── Fetch profile whenever user changes ── */
  useEffect(() => {
    if (!user || user.id === 'guest') { setProfile(null); return; }

    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data, error: pgErr }) => {
        if (pgErr && pgErr.code !== 'PGRST116') {
          console.warn('Profile fetch error:', pgErr.message);
        }
        setProfile(data ?? null);
      });
  }, [user]);

  /* ── Auth helpers ── */
  const clearError = () => setError(null);

  const loginAsGuest = () => {
    setError(null);
    localStorage.setItem('rl-guest-session', 'true');
    setUser({ id: 'guest', email: 'guest@reviewlens.local', user_metadata: { username: 'Guest' } });
    setSession({ user: { id: 'guest' } });
  };

  const signUp = async (email, password, username) => {
    setError(null);
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        emailRedirectTo: window.location.origin,
      },
    });
    if (err) { setError(err.message); throw err; }
  };

  const signIn = async (email, password) => {
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) { setError(err.message); throw err; }
  };

  const signInWithGoogle = async () => {
    setError(null);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (err) { setError(err.message); throw err; }
  };

  const navigateRef = useRef(null);

  const setNavigate = (fn) => { navigateRef.current = fn; };

  const signOut = async () => {
    localStorage.removeItem('rl-guest-session');
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
    if (navigateRef.current) {
      navigateRef.current('/auth', { replace: true });
    } else {
      // Fallback for edge cases (e.g. called outside Router context)
      window.location.replace('/auth');
    }
  };

  const updateProfile = async (updates) => {
    if (!user || user.id === 'guest') return;
    const { data, error: err } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single();
    if (err) { setError(err.message); return; }
    setProfile(data);
  };

  return (
    <AuthContext.Provider value={{
      user, session, profile, loading, error,
      signUp, signIn, signInWithGoogle, signOut, updateProfile, clearError, loginAsGuest, setNavigate,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
