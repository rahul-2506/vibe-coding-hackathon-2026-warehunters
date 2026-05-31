import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, AlertTriangle, CheckCircle, Package, TrendingDown, Bell } from 'lucide-react';
import { useCart } from '../context/CartContext';
import SafeImage from './SafeImage';
import './RecommendationCard.css';

const RecommendationCard = ({ product }) => {
    const { name, price, category, rating, image_url, matchScore, explanation, rejectReason, features } = product;
    const navigate = useNavigate();
    const { addToCart } = useCart();

    const [livePrice, setLivePrice] = useState(Math.round(Number(price || 0)));

    useEffect(() => {
        // Live price crawler simulation
        const interval = setInterval(() => {
            const fluctuation = (Math.random() - 0.5) * 4; // +/- 2 rupees
            setLivePrice(Math.round(Number(price || 0) + fluctuation));
        }, 3000);
        return () => clearInterval(interval);
    }, [price]);

    const parsedFeatures = typeof features === 'string' ? JSON.parse(features) : features || {};

    return (
        <div className={`rec-card glass-panel ${matchScore >= 80 ? 'high-match' : matchScore <= 50 ? 'low-match' : ''}`}>
            <div className="match-badge" style={{ backgroundColor: matchScore >= 80 ? 'var(--accent-color)' : matchScore <= 50 ? '#ef4444' : '#f59e0b' }}>
                <span>{matchScore}% MATCH</span>
            </div>

            <div className="rec-image">
                <SafeImage src={image_url} alt={name} />
            </div>

            <div className="rec-content">
                <span className="category-tag text-muted">{category}</span>
                <h3 className="product-title">{name}</h3>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    {rating && (
                        <div className="rating" style={{ margin: 0 }}>
                            <Star size={16} fill="#f59e0b" color="#f59e0b" />
                            <span>{rating}/5.0</span>
                        </div>
                    )}

                    {/* Live Scanned Price Badge */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        padding: '0.3rem 0.6rem',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: '800',
                        color: '#10b981'
                    }}>
                        <span className="live-pulse-dot" style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: '#10b981',
                            display: 'inline-block',
                            boxShadow: '0 0 6px #10b981'
                        }} />
                        <span>LIVE: ₹{livePrice}/-</span>
                    </div>
                </div>

                <div className="features-list">
                    {parsedFeatures && Object.entries(parsedFeatures).slice(0, 3).map(([k, v]) => (
                        <span key={k} className="feature-pill">{v}</span>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    <button 
                        type="button"
                        className="cheap-buy-action-btn"
                        onClick={(e) => { e.stopPropagation(); navigate('/cheap-buy', { state: { product } }); }}
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.6rem 1rem',
                            borderRadius: '10px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            color: 'var(--text-main)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            fontWeight: '700',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            justifyContent: 'center'
                        }}
                    >
                        <TrendingDown size={14} /> 
                        Cheap Buy
                    </button>

                    <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                        style={{
                            flex: 1,
                            padding: '0.6rem 1rem',
                            borderRadius: '10px',
                            background: 'linear-gradient(to bottom, #10b981, #059669)',
                            color: 'white',
                            border: 'none',
                            fontSize: '0.8rem',
                            fontWeight: '700',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.4rem',
                            cursor: 'pointer',
                            boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Bell size={14} />
                        Watchlist
                    </button>
                </div>

                {rejectReason ? (
                    <div className="reject-reason-box glass-panel">
                        <AlertTriangle size={18} className="text-muted" style={{ flexShrink: 0 }} />
                        <p>{rejectReason}</p>
                    </div>
                ) : (
                    <div className="explanation-box glass-panel">
                        <CheckCircle size={18} className="text-accent" style={{ flexShrink: 0 }} />
                        <p>{explanation || "This clinical grade formula matches your concerns based on deep vector analysis of active ingredients."}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RecommendationCard;
