import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const FADE = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, y: -10, transition: { duration: 0.25 } },
};

const STAGGER = {
  visible: { transition: { staggerChildren: 0.07 } },
};

const ITEM = {
  hidden:  { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const RobotAuthForm = () => {
  const { signIn, signUp, signInWithGoogle, user, loading: authLoading, error: authError } = useAuth();
  const navigate = useNavigate();

  const [isLogin, setIsLogin]     = useState(true);
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [username, setUsername]   = useState('');
  const [localError, setLocalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  /* Redirect once user signs in */
  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  /* Clear error when switching modes */
  useEffect(() => {
    setLocalError('');
  }, [isLogin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setSubmitting(true);
    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        if (!username.trim()) { setLocalError('Username is required'); setSubmitting(false); return; }
        await signUp(email, password, username);
        // After sign-up inform user to check email if confirmation required
        if (!authError) {
          setLocalError('');
          // user effect will redirect if auto-confirmed
        }
      }
    } catch (err) {
      setLocalError(err.message || 'Something went wrong.');
    }
    setSubmitting(false);
  };

  const handleGoogle = () => signInWithGoogle();

  const errorMsg = localError || authError;
  const busy = authLoading || submitting;

  return (
    <motion.div
      className="robot-auth-container"
      variants={FADE}
      initial="hidden"
      animate="visible"
    >
      {/* ── Robot avatar ── */}
      <motion.div
        className={`robot-avatar ${busy ? 'processing' : ''}`}
        whileHover={{ y: -6, scale: 1.04 }}
        transition={{ type: 'spring', stiffness: 280, damping: 18 }}
      >
        <div className="antenna">
          <div className="antenna-bulb" />
        </div>
        <div className="robot-face">
          <div className="eyes-container">
            <motion.div
              className="eye"
              animate={busy ? { scaleY: [1, 0.1, 1] } : { scaleY: 1 }}
              transition={busy ? { repeat: Infinity, duration: 0.55 } : {}}
            />
            <motion.div
              className="eye"
              animate={busy ? { scaleY: [1, 0.1, 1] } : { scaleY: 1 }}
              transition={busy ? { repeat: Infinity, duration: 0.55, delay: 0.1 } : {}}
            />
          </div>
          <motion.div
            className="mouth"
            animate={busy
              ? { scaleX: [1, 0.7, 1], scaleY: [1, 1.8, 1] }
              : { scaleX: 1, scaleY: 1 }}
            transition={busy ? { repeat: Infinity, duration: 0.4 } : {}}
          />
        </div>
      </motion.div>

      {/* ── Auth card ── */}
      <motion.div className="auth-card" variants={STAGGER} initial="hidden" animate="visible">
        {/* Animated tab switcher */}
        <motion.div variants={ITEM} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {['Sign in', 'Register'].map((label, idx) => {
            const active = isLogin === (idx === 0);
            return (
              <button
                key={label}
                onClick={() => setIsLogin(idx === 0)}
                style={{
                  flex: 1,
                  padding: '0.55rem',
                  borderRadius: 'var(--r-sm)',
                  border: active ? 'none' : '1px solid var(--border-color)',
                  background: active ? 'var(--accent-color)' : 'transparent',
                  color: active ? '#fff' : 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {label}
              </button>
            );
          })}
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={isLogin ? 'login' : 'signup'}
            variants={FADE}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <p className="auth-subtitle">
              {isLogin
                ? 'Welcome back — sign in to your account'
                : 'Create your account to get started'}
            </p>

            {/* Error */}
            <AnimatePresence>
              {errorMsg && (
                <motion.div
                  className="error-message"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  ⚠️ {errorMsg}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="auth-form">
              {!isLogin && (
                <motion.div className="input-group" variants={ITEM}>
                  <label htmlFor="auth-username">Username</label>
                  <input
                    id="auth-username"
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="e.g. johndoe"
                    autoComplete="username"
                  />
                </motion.div>
              )}

              <motion.div className="input-group" variants={ITEM}>
                <label htmlFor="auth-email">Email address</label>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </motion.div>

              <motion.div className="input-group" variants={ITEM}>
                <label htmlFor="auth-password">Password</label>
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  minLength={6}
                />
              </motion.div>

              <motion.button
                type="submit"
                className="auth-btn"
                disabled={busy}
                variants={ITEM}
                whileHover={!busy ? { y: -2, scale: 1.015 } : {}}
                whileTap={!busy ? { y: 0, scale: 0.98 } : {}}
                style={{ cursor: busy ? 'not-allowed' : 'pointer' }}
              >
                {busy ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                    <span className="spinner-sm" /> {isLogin ? 'Signing in…' : 'Creating account…'}
                  </span>
                ) : (
                  isLogin ? 'Sign in' : 'Create account'
                )}
              </motion.button>
            </form>
 
            <div className="divider">or continue with</div>
 
            <motion.button
              className="google-btn"
              onClick={handleGoogle}
              disabled={busy}
              whileHover={!busy ? { y: -2, scale: 1.015 } : {}}
              whileTap={!busy ? { y: 0, scale: 0.98 } : {}}
              variants={ITEM}
              style={{ cursor: busy ? 'not-allowed' : 'pointer' }}
            >
              {/* Google G icon */}
              <svg width="18" height="18" viewBox="0 0 48 48" style={{ marginRight: '0.5rem' }}>
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                <path fill="none" d="M0 0h48v48H0z"/>
              </svg>
              {busy ? 'Connecting…' : 'Continue with Google'}
            </motion.button>

            <p className="toggle-auth">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}
              <span className="toggle-link" onClick={() => setIsLogin(l => !l)}>
                {isLogin ? ' Register' : ' Sign in'}
              </span>
            </p>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <style>{`
        .spinner-sm {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </motion.div>
  );
};

export default RobotAuthForm;
