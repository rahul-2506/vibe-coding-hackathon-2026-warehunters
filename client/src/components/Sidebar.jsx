import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Home, Package, MessageSquare, LogIn, LogOut, Sun, Moon, User, Bot, Bell, Terminal } from 'lucide-react';
import { useCart } from '../context/CartContext';

const Sidebar = ({ theme, toggleTheme, user, onLogout }) => {
    const { cartCount } = useCart();

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <Package className="text-accent" />
                <span className="text-accent">ReviewLens</span>
            </div>

            <nav className="nav-links">
                <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Home size={20} />
                    <span>Home</span>
                </NavLink>
                <NavLink to="/products" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Package size={20} />
                    <span>Products</span>
                </NavLink>
                <NavLink to="/cart" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', width: '100%', position: 'relative' }}>
                    <Bell size={20} />
                    <span>Watchlist</span>
                    {cartCount > 0 && (
                        <span className="cart-badge" style={{
                            background: 'var(--accent-color)',
                            color: 'white',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            padding: '0.1rem 0.45rem',
                            borderRadius: '10px',
                            marginLeft: 'auto',
                            boxShadow: '0 0 8px var(--accent-color)'
                        }}>
                            {cartCount}
                        </span>
                    )}
                </NavLink>
                <NavLink to="/chatbot" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Bot size={20} />
                    <span>v chat</span>
                </NavLink>
                {user && (
                    <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <User size={20} />
                        <span>Profile</span>
                    </NavLink>
                )}
                {/* Hackathon Playbook button */}
                <button 
                    onClick={() => window.dispatchEvent(new CustomEvent('toggle-hackathon-playbook'))}
                    className="nav-item border-none text-left w-full cursor-pointer bg-transparent"
                    style={{ border: 'none', background: 'transparent', textAlign: 'left', width: '100%', cursor: 'pointer' }}
                >
                    <Terminal size={20} className="text-accent animate-pulse" />
                    <span>Playbook</span>
                </button>
            </nav>

            <div className="sidebar-footer">
                <button onClick={toggleTheme} className="theme-toggle">
                    <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>

                {user ? (
                    <button onClick={onLogout} className="nav-item" style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', width: '100%', cursor: 'pointer' }}>
                        <LogOut size={20} />
                        <span>Logout ({user.username})</span>
                    </button>
                ) : (
                    <Link to="/auth" className="nav-item bg-accent" style={{ color: 'white', justifyContent: 'center' }}>
                        <LogIn size={20} />
                        <span>Login / Register</span>
                    </Link>
                )}
            </div>
        </aside>
    );
};

export default Sidebar;
