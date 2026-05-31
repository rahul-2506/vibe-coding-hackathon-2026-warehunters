import React, { useState, useEffect } from 'react';
import { X, Star, MessageSquare, ShieldCheck, ShieldAlert } from 'lucide-react';

const getFeedbackKey = () => {
    try {
        const u = JSON.parse(localStorage.getItem('currentUser') || 'null');
        return `mySubmittedFeedbacks_${u?.id || u?.username || 'guest'}`;
    } catch {
        return 'mySubmittedFeedbacks_guest';
    }
};

const ProductFeedbackPanel = ({ product, feedbacks, onClose }) => {
    const [mySubmittedFeedbacks, setMySubmittedFeedbacks] = useState([]);

    useEffect(() => {
        const key = getFeedbackKey();
        try {
            const saved = JSON.parse(localStorage.getItem(key) || '[]');
            setMySubmittedFeedbacks(saved);
        } catch {
            setMySubmittedFeedbacks([]);
        }
    }, []);

    const isMyFeedback = (f) => {
        return mySubmittedFeedbacks.some(myF => 
            myF.product_name === f.product_name && 
            myF.review_text === f.review_text && 
            myF.rating === f.rating
        );
    };

    if (!product) return null;

    const productFeedbacks = feedbacks.filter(f => f.product_name.toLowerCase() === product.name.toLowerCase());
    const avgRating = productFeedbacks.length > 0 
        ? (productFeedbacks.reduce((acc, f) => acc + f.rating, 0) / productFeedbacks.length).toFixed(1)
        : 0;

    return (
        <div className="product-chat-overlay open">
            <div className="chat-header">
                <div>
                    <h3 style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                        <MessageSquare size={20} className="text-accent" />
                        {product.name} Feedback
                    </h3>
                </div>
                <button className="close-chat-btn" onClick={onClose}>
                    <X size={20} />
                </button>
            </div>

            <div className="chat-messages" style={{ overflowY: 'auto', padding: '1.5rem' }}>
                <div className="feedback-summary glass-panel p-4 mb-6" style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <span className="text-muted" style={{ fontSize: '0.9rem' }}>Average Rating</span>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {avgRating} <Star size={24} fill="#f59e0b" color="#f59e0b" />
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span className="text-muted" style={{ fontSize: '0.9rem' }}>Total Reviews</span>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{productFeedbacks.length}</div>
                        </div>
                    </div>
                </div>

                <div className="reviews-list" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {productFeedbacks.length > 0 ? (
                        productFeedbacks.map((f) => (
                            <div key={f.id} className="review-card glass-panel p-4" style={{ background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <div style={{ display: 'flex', gap: '2px' }}>
                                        {[...Array(5)].map((_, i) => (
                                            <Star key={i} size={14} fill={i < f.rating ? "#f59e0b" : "none"} color={i < f.rating ? "#f59e0b" : "rgba(255,255,255,0.2)"} />
                                        ))}
                                    </div>
                                    {!isMyFeedback(f) && f.verdict && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: f.verdict === 'Genuine' ? '#10b981' : '#ef4444' }}>
                                            {f.verdict === 'Genuine' ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
                                            {f.verdict.toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <p style={{ fontSize: '0.95rem', marginBottom: '0.5rem', fontStyle: 'italic' }}>"{f.review_text}"</p>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                                    <span className="text-muted" style={{ fontSize: '0.8rem' }}>Source: {f.source}</span>
                                    <span style={{ fontSize: '1.2rem' }}>{f.emoji}</span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                            <MessageSquare size={48} opacity={0.2} style={{ marginBottom: '1rem' }} />
                            <p>No feedback yet for this product.</p>
                            <p style={{ fontSize: '0.8rem' }}>Be the first to share your experience!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProductFeedbackPanel;
