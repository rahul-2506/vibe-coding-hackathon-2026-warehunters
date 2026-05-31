import React, { useState, useEffect } from 'react';
import { Search, Star, MessageSquare, ShieldCheck, CheckCircle2, User, Send } from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { supabase } from '../config/supabaseClient';
import './Feedback.css';

// Helper: get the localStorage key scoped to the current user
const getFeedbackKey = () => {
    try {
        const u = JSON.parse(localStorage.getItem('currentUser') || 'null');
        return `mySubmittedFeedbacks_${u?.id || u?.username || 'guest'}`;
    } catch {
        return 'mySubmittedFeedbacks_guest';
    }
};

const FALLBACK_PRODUCTS = [
    "The Derma Co facewash",
    "Himalaya facewash",
    "Mamaearth facewash",
    "QuantumBook Pro 15",
    "CyberRig X10",
    "AeroPhone 14 Max"
];

const Feedback = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [publicFeedbacks, setPublicFeedbacks] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [products, setProducts] = useState(FALLBACK_PRODUCTS);
    const [selectedFeedbackId, setSelectedFeedbackId] = useState(null);

    const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    const currentUserId = currentUser?.id || currentUser?.username || 'guest';

    const [formData, setFormData] = useState({
        product_name: '',
        rating: 5,
        review_text: '',
        emoji: '😊',
        source: 'self',
        mentioned_ingredients: ''
    });

    const filteredProducts = products.filter(p =>
        p.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const fetchPublicFeedbacks = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/feedbacks`);
            const resJson = await res.json();
            const data = Array.isArray(resJson) ? resJson : (resJson.data || []);
            setPublicFeedbacks(data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchProducts = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/products/getProducts`);
            if (!res.ok) throw new Error('Failed');
            const resJson = await res.json();
            const data = Array.isArray(resJson) ? resJson : (resJson.data || []);
            if (data && data.length > 0) {
                setProducts(data.map(p => p.name));
            }
        } catch (err) {
            console.warn('Using fallback product list:', err.message);
        }
    };

    useEffect(() => {
        fetchPublicFeedbacks();
        fetchProducts();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const headers = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const res = await fetch(`${API_BASE_URL}/api/feedback/submit`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ ...formData, user_id: currentUserId })
            });
            if (res.ok) {
                setSubmitSuccess(true);
                setFormData({
                    product_name: '',
                    rating: 5,
                    review_text: '',
                    emoji: '😊',
                    source: 'self',
                    mentioned_ingredients: ''
                });
                setSearchQuery('');
                setTimeout(() => setSubmitSuccess(false), 3000);
                fetchPublicFeedbacks(); // Refresh the list
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="feedback-container">
            <header className="feedback-header">
                <h1>Community Insights</h1>
                <p className="text-muted">Real reviews from verified users. Submit your own experience below.</p>
            </header>

            <div className="feedback-layout">
                {/* Community Feed */}
                <div className="feedback-feed">
                    <div className="feed-header">
                        <MessageSquare size={20} className="text-accent" />
                        <h2>Community Reviews</h2>
                    </div>

                    <div className="feed-list">
                        {publicFeedbacks.length > 0 ? publicFeedbacks.map(f => {
                            const isOwnFeedback = f.user_id === currentUserId; // Assuming user_id exists in the feedback data
                            const isSelected = selectedFeedbackId === f.id;

                            return (
                                <div 
                                    key={f.id} 
                                    className={`feedback-card glass-panel ${isSelected ? 'selected' : ''}`}
                                    onClick={() => setSelectedFeedbackId(selectedFeedbackId === f.id ? null : f.id)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="card-top">
                                        <div className="user-info">
                                            <div className="user-avatar"><User size={16} /></div>
                                            <div>
                                                <span className="user-name">{isOwnFeedback ? 'You' : 'Anonymous User'}</span>
                                                <span className="product-tag">{f.product_name}</span>
                                            </div>
                                        </div>
                                        {/* Show label only if selected AND not own feedback */}
                                        {isSelected && !isOwnFeedback && (
                                            <div className={`verified-badge verdict-${f.verdict?.toLowerCase()} fade-in`}>
                                                <ShieldCheck size={14} /> {f.verdict || 'Verified'}
                                            </div>
                                        )}
                                    </div>
                                    <div className="card-rating">
                                        {[1, 2, 3, 4, 5].map(nu => (
                                            <Star key={nu} size={14} fill={f.rating >= nu ? "var(--accent-color)" : "none"} stroke="var(--accent-color)" />
                                        ))}
                                        <span className="msg-emoji">{f.emoji}</span>
                                    </div>
                                    <p className="review-text">"{f.review_text}"</p>
                                    <div className="card-meta">
                                        <span>Source: {f.source}</span>
                                        <span>•</span>
                                        <span>{new Date(f.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="empty-feed">
                                <p className="text-muted">No verified reviews found yet. Be the first to submit!</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Submission Form */}
                <div className="submission-sec">
                    <div className="glass-panel submission-card">
                        <h3>Share Your Experience</h3>
                        <form onSubmit={handleSubmit}>
                            <div className="search-group">
                                <label>Search Product</label>
                                <div className="search-input-wrapper">
                                    <Search size={18} className="search-icon" />
                                    <input
                                        type="text"
                                        placeholder="Type to search..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                {searchQuery && !formData.product_name && (
                                    <div className="search-dropdown">
                                        {filteredProducts.map(p => (
                                            <div
                                                key={p}
                                                className="dropdown-item"
                                                onClick={() => {
                                                    setFormData({ ...formData, product_name: p });
                                                    setSearchQuery(p);
                                                }}
                                            >
                                                {p}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="form-row">
                                <div className="form-group flex-1">
                                    <label>Rating</label>
                                    <div className="rating-select">
                                        {[1, 2, 3, 4, 5].map(nu => (
                                            <Star
                                                key={nu}
                                                size={20}
                                                fill={formData.rating >= nu ? "var(--accent-color)" : "none"}
                                                stroke="var(--accent-color)"
                                                onClick={() => setFormData({ ...formData, rating: nu })}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div className="form-group flex-1">
                                    <label>Reactive Emoji</label>
                                    <div className="emoji-row">
                                        {['😊', '😍', '😐', '😡', '👍', '👎'].map(em => (
                                            <span
                                                key={em}
                                                className={`emoji-opt ${formData.emoji === em ? 'active' : ''}`}
                                                onClick={() => setFormData({ ...formData, emoji: em })}
                                            >
                                                {em}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Where did you hear about it?</label>
                                <select
                                    value={formData.source}
                                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                                >
                                    <option value="dermatologist">Dermatologist</option>
                                    <option value="self">Self Discovery</option>
                                    <option value="friend">Friend / Relative</option>
                                    <option value="ads">Ads / Social Media</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Key ingredients you recall?</label>
                                <input
                                    type="text"
                                    placeholder="e.g. neem, turmeric, vitamin c..."
                                    value={formData.mentioned_ingredients}
                                    onChange={(e) => setFormData({ ...formData, mentioned_ingredients: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>Your Honest Review</label>
                                <textarea
                                    rows={4}
                                    placeholder="Tell us what you liked or hated..."
                                    value={formData.review_text}
                                    onChange={(e) => setFormData({ ...formData, review_text: e.target.value })}
                                ></textarea>
                            </div>

                            <button type="submit" className="submit-btn bg-accent" disabled={isSubmitting || !formData.product_name}>
                                {isSubmitting ? 'Verifying Neural Tags...' : 'Post Review'}
                                {!isSubmitting && <Send size={18} />}
                            </button>

                            {submitSuccess && (
                                <div className="success-msg">
                                    <CheckCircle2 size={16} /> Submitted for verification.
                                </div>
                            )}
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Feedback;
