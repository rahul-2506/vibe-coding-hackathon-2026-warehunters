import React, { useState, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
  useLocation,
} from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import { useAuth } from './context/AuthContext';
import Products from './pages/Products';
import Feedback from './pages/Feedback';
import Profile from './pages/Profile';
import Chatbot from './pages/Chatbot';
import CompareProducts from './pages/CompareProducts';
import { ComparisonProvider } from './context/ComparisonContext';
import { CartProvider } from './context/CartContext';
import ComparisonBar from './components/ComparisonBar';
import ProductDetails from './pages/ProductDetails';
import RouteGuard from './components/RouteGuard.jsx';
import RobotAuthForm from './components/RobotAuthForm';
import PriceTracker from './pages/PriceTracker';
import CartPage from './pages/CartPage';
import { Bot } from 'lucide-react';
import HackathonDemoPanel from './components/HackathonDemoPanel';

/* ─────────────────────────────────────────────
   AppShell — shown only for authenticated routes
   ───────────────────────────────────────────── */
const AppShell = ({ theme, toggleTheme, user, signOut, children }) => (
  <div className="app-container">
    <Sidebar theme={theme} toggleTheme={toggleTheme} user={user} onLogout={signOut} />
    <main className="content-wrapper">
      {children}
    </main>
    <ComparisonBar />
    <Link to="/chatbot" className="floating-bot-icon" title="Open AI Chat">
      <Bot size={24} />
    </Link>
    <HackathonDemoPanel />
  </div>
);

/* ─────────────────────────────────────────────
   App — root component with routing
   ───────────────────────────────────────────── */
function App() {
  const [theme, setTheme] = useState(() =>
    localStorage.getItem('rl-theme') || 'light'
  );
  const { user, signOut } = useAuth();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('rl-theme', theme);
  }, [theme]);

  const toggleTheme = () =>
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));

  return (
    <ComparisonProvider>
      <CartProvider>
        <Router>
          <Routes>
            {/* ── Public: full-screen auth page ── */}
            <Route
              path="/auth"
              element={
                <div className="auth-layout">
                  <RobotAuthForm />
                </div>
              }
            />

            {/* ── Protected: app shell with sidebar ── */}
            <Route
              path="/*"
              element={
                <AppShell
                  theme={theme}
                  toggleTheme={toggleTheme}
                  user={user}
                  signOut={signOut}
                >
                  <Routes>
                    <Route path="/"            element={<RouteGuard><Home /></RouteGuard>} />
                    <Route path="/products"    element={<RouteGuard><Products /></RouteGuard>} />
                    <Route path="/compare"     element={<RouteGuard><CompareProducts /></RouteGuard>} />
                    <Route path="/profile"     element={<RouteGuard><Profile user={user} /></RouteGuard>} />
                    <Route path="/chatbot"     element={<RouteGuard><Chatbot /></RouteGuard>} />
                    <Route path="/product/:id" element={<RouteGuard><ProductDetails /></RouteGuard>} />
                    <Route path="/cheap-buy"   element={<RouteGuard><PriceTracker /></RouteGuard>} />
                    <Route path="/cart"        element={<RouteGuard><CartPage /></RouteGuard>} />
                    <Route path="*"            element={<Navigate to="/" replace />} />
                  </Routes>
                </AppShell>
              }
            />
          </Routes>
        </Router>
      </CartProvider>
    </ComparisonProvider>
  );
}

export default App;
