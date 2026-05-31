import React, { createContext, useContext, useEffect, useState } from 'react';
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
    if (!user) { setProfile(null); return; }

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

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
    window.location.assign('/auth');
  };

  const updateProfile = async (updates) => {
    if (!user) return;
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
      signUp, signIn, signInWithGoogle, signOut, updateProfile, clearError,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
