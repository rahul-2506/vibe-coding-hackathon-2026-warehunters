import React, { useState, useEffect } from 'react';
import { User, Settings, Save, AlertCircle, Star, MessageSquare, Package, ChevronRight } from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../config/supabaseClient';
import './Profile.css';

const DEFAULT_PREFS = {
    displayName: '',
    email: '',
    age: '',
    skinType: 'oily',
    maxBudget: '1500',
    preferredCategories: 'Laptops, Smartphones, Monitors',
};

const Profile = ({ user }) => {
    const displayUser = user || { username: 'Guest_Unit_404', id: 'UNREGISTERED' };
    
    const { profile, updateProfile } = useAuth();

    const [prefs, setPrefs] = useState(DEFAULT_PREFS);
    const [myFeedbacks, setMyFeedbacks] = useState([]);
    const [savedMsg, setSavedMsg] = useState(false);

    useEffect(() => {
        const userKey = user?.id || user?.username || 'guest';
        
        // Load user-specific preferences from database or fallback to localStorage
        if (profile) {
            setPrefs({
                displayName: profile.username || '',
                email: profile.email || '',
                age: profile.age || '',
                skinType: profile.skin_type || 'oily',
                maxBudget: profile.max_budget || '1500',
                preferredCategories: Array.isArray(profile.preferred_categories)
                    ? profile.preferred_categories.join(', ')
                    : (profile.preferred_categories || '')
            });
        } else {
            try {
                const savedPrefs = localStorage.getItem(`userPrefs_${userKey}`);
                setPrefs(savedPrefs ? { ...DEFAULT_PREFS, ...JSON.parse(savedPrefs) } : DEFAULT_PREFS);
            } catch { 
                setPrefs(DEFAULT_PREFS); 
            }
        }

        // Load user-specific feedbacks from server
        const fetchMyFeedbacks = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;
                const headers = {};
                if (token) headers['Authorization'] = `Bearer ${token}`;

                const res = await fetch(`${API_BASE_URL}/api/feedback/user/${userKey}`, { headers });
                if (res.ok) {
                    const data = await res.json();
                    setMyFeedbacks(Array.isArray(data) ? data : (data.data || []));
                }
            } catch (err) {
                console.error('Failed to sync feedback history:', err);
            }
        };
        
        fetchMyFeedbacks();
    }, [user, profile]);

    const handleChange = (field, value) => {
        setPrefs(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        const userKey = user?.id || user?.username || 'guest';
        
        // Save to localStorage as a robust fallback
        localStorage.setItem(`userPrefs_${userKey}`, JSON.stringify(prefs));
        
        // Save to Supabase profiles table via updateProfile
        if (user && updateProfile) {
            try {
                const categoriesArray = prefs.preferredCategories
                    ? prefs.preferredCategories.split(',').map(c => c.trim()).filter(Boolean)
                    : [];
                
                await updateProfile({
                    username: prefs.displayName,
                    email: prefs.email,
                    age: prefs.age ? parseInt(prefs.age, 10) : null,
                    skin_type: prefs.skinType,
                    max_budget: prefs.maxBudget ? parseFloat(prefs.maxBudget) : null,
                    preferred_categories: categoriesArray
                });
            } catch (err) {
                console.warn('[Profile] Failed to persist updates to Supabase profiles table, using local fallback:', err);
            }
        }
        
        setSavedMsg(true);
        setTimeout(() => setSavedMsg(false), 2500);
    };

    const totalFeedbacks = myFeedbacks.length;
    const avgRating = myFeedbacks.length > 0
        ? (myFeedbacks.reduce((acc, f) => acc + (f.rating || 0), 0) / myFeedbacks.length).toFixed(1)
        : '—';

    return (
        <div className="profile-container">
            <header className="profile-header">
                <h1>User Profile</h1>
                <p className="text-muted">Manage your settings, preferences and review activity</p>
            </header>

            {!user && (
                <div className="preview-banner">
                    <AlertCircle size={18} />
                    Running in Preview Mode. Log in to persist preferences across sessions.
                </div>
            )}

            <div className="profile-layout">
                {/* LEFT: Avatar + Stats */}
                <div className="profile-left">
                    <div className="profile-card glass-panel">
                        <div className="profile-avatar">
                            <User size={52} className="text-accent" />
                        </div>
                        <h2 className="profile-username">{prefs.displayName || displayUser.username}</h2>
                        <p className="text-muted" style={{ fontSize: '0.8rem' }}>SYSTEM_ID: {displayUser.id}</p>
                        {prefs.skinType && (
                            <span className="skin-badge">
                                Skin: {prefs.skinType.charAt(0).toUpperCase() + prefs.skinType.slice(1)}
                            </span>
                        )}

                        {/* Mini Stats */}
                        <div className="mini-stats">
                            <div className="mini-stat">
                                <span className="mini-stat-value">{totalFeedbacks}</span>
                                <span className="mini-stat-label">Reviews</span>
                            </div>
                            <div className="mini-stat-divider" />
                            <div className="mini-stat">
                                <span className="mini-stat-value">{avgRating}</span>
                                <span className="mini-stat-label">Avg Rating</span>
                            </div>
                            <div className="mini-stat-divider" />
                            <div className="mini-stat">
                                <span className="mini-stat-value">{prefs.maxBudget ? `₹${Number(prefs.maxBudget).toLocaleString()}` : '—'}</span>
                                <span className="mini-stat-label">Budget</span>
                            </div>
                        </div>
                    </div>

                    {/* Feedback Activity Card */}
                    <div className="glass-panel feedback-activity-card">
                        <div className="section-title-row">
                            <MessageSquare size={18} className="text-accent" />
                            <h3>My Review Activity</h3>
                        </div>

                        {myFeedbacks.length === 0 ? (
                            <div className="empty-activity">
                                <Package size={36} opacity={0.2} />
                                <p className="text-muted">No reviews submitted yet.</p>
                                <p className="text-muted" style={{ fontSize: '0.8rem' }}>Your submitted reviews will appear here.</p>
                            </div>
                        ) : (
                            <div className="activity-list">
                                {myFeedbacks.map((f, i) => (
                                    <div key={i} className="activity-item">
                                        <div className="activity-emoji">{f.emoji || '💬'}</div>
                                        <div className="activity-info">
                                            <span className="activity-product">{f.product_name}</span>
                                            <div className="activity-stars">
                                                {[1,2,3,4,5].map(s => (
                                                    <Star key={s} size={10} fill={f.rating >= s ? '#f59e0b' : 'none'} color={f.rating >= s ? '#f59e0b' : 'rgba(255,255,255,0.2)'} />
                                                ))}
                                                <span className="text-muted" style={{ fontSize: '0.75rem', marginLeft: '4px' }}>{f.rating}/5</span>
                                            </div>
                                            <p className="activity-review">"{f.review_text?.substring(0, 60)}{f.review_text?.length > 60 ? '...' : ''}"</p>
                                        </div>
                                        <span className="activity-date">{f.created_at ? new Date(f.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT: Settings Form */}
                <div className="profile-right">
                    <div className="glass-panel preferences-section-new">
                        <div className="section-title-row">
                            <Settings size={18} className="text-accent" />
                            <h3>Personal Information</h3>
                        </div>

                        <div className="form-grid">
                            <div className="input-group-new">
                                <label>Display Name</label>
                                <input
                                    type="text"
                                    className="profile-input"
                                    placeholder="e.g. Kowsh"
                                    value={prefs.displayName}
                                    onChange={e => handleChange('displayName', e.target.value)}
                                />
                            </div>
                            <div className="input-group-new">
                                <label>Email Address</label>
                                <input
                                    type="email"
                                    className="profile-input"
                                    placeholder="e.g. user@example.com"
                                    value={prefs.email}
                                    onChange={e => handleChange('email', e.target.value)}
                                />
                            </div>
                            <div className="input-group-new">
                                <label>Age</label>
                                <input
                                    type="number"
                                    className="profile-input"
                                    placeholder="e.g. 22"
                                    min={10} max={100}
                                    value={prefs.age}
                                    onChange={e => handleChange('age', e.target.value)}
                                />
                            </div>
                            <div className="input-group-new">
                                <label>Skin Type</label>
                                <select
                                    className="profile-input"
                                    value={prefs.skinType}
                                    onChange={e => handleChange('skinType', e.target.value)}
                                >
                                    <option value="oily">Oily</option>
                                    <option value="dry">Dry</option>
                                    <option value="combination">Combination</option>
                                    <option value="sensitive">Sensitive</option>
                                    <option value="normal">Normal</option>
                                </select>
                            </div>
                        </div>

                        <div className="section-divider" />

                        <div className="section-title-row" style={{ marginBottom: '1rem' }}>
                            <ChevronRight size={16} className="text-accent" />
                            <h3>AI Recommendation Preferences</h3>
                        </div>

                        <div className="form-grid">
                            <div className="input-group-new">
                                <label>Max Budget (₹)</label>
                                <input
                                    type="number"
                                    className="profile-input"
                                    placeholder="e.g. 1500"
                                    value={prefs.maxBudget}
                                    onChange={e => handleChange('maxBudget', e.target.value)}
                                />
                            </div>
                            <div className="input-group-new">
                                <label>Preferred Categories</label>
                                <input
                                    type="text"
                                    className="profile-input"
                                    placeholder="e.g. Skincare, Laptops"
                                    value={prefs.preferredCategories}
                                    onChange={e => handleChange('preferredCategories', e.target.value)}
                                />
                            </div>
                        </div>

                        <button className="save-btn bg-accent" onClick={handleSave}>
                            <Save size={16} /> Update Profile
                        </button>

                        {savedMsg && (
                            <div className="saved-success">
                                ✅ Preferences saved successfully!
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
