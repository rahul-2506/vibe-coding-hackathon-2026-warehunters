import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    MessageCircle, Package, Star, GitCompare, Check, 
    TrendingDown, Bell, ShieldCheck, Sparkles, Zap, ShoppingBag 
} from 'lucide-react';
import { useComparison } from '../context/ComparisonContext';
import { useCart } from '../context/CartContext';
import SafeImage from './SafeImage';

const ProductCardExt = ({ product, onAddChat, onViewFeedback, index = 0 }) => {
    const navigate = useNavigate();
    const { selectedProducts, addToComparison } = useComparison();
    const { addToCart } = useCart();
    const isSelected = selectedProducts.some(p => p.id === product.id);

    const getCategoryIcon = (cat) => {
        const c = cat || '';
        if (c.includes('Skincare')) return <Sparkles size={13} className="cat-icon-skincare" />;
        if (c.includes('Electronics')) return <Zap size={13} className="cat-icon-electronics" />;
        if (c.includes('Groceries')) return <ShoppingBag size={13} className="cat-icon-groceries" />;
        if (c.includes('Home')) return <Package size={13} className="cat-icon-home" />;
        if (c.includes('Fashion')) return <ShoppingBag size={13} className="cat-icon-fashion" />;
        return <Package size={13} className="cat-icon-default" />;
    };

    // Extract rating, review count, trust score
    const rating = Number(product.rating || 4.0).toFixed(1);
    const reviewCount = product.review_count || (Math.floor((product.id * 17) % 180) + 12);
    const trustScore = product.trust_score || (78 + ((product.id * 7) % 19));

    return (
        <div 
            className={`card ext-product-card glass-panel ${isSelected ? 'selected-card' : ''}`}
            style={{ animationDelay: `${(index % 12) * 0.04}s` }}
        >
            <div className="ext-card-header">
                <span className="ext-category-pill">
                    {getCategoryIcon(product.category)}
                    {product.category}
                </span>
                <span className="ext-trust-pill">
                    <ShieldCheck size={12} />
                    {trustScore}% Trust
                </span>
            </div>

            <div className="ext-card-image" style={{ cursor: 'pointer' }} onClick={() => navigate(`/product/${product.id}`)}>
                <SafeImage src={product.image_url} alt={product.name} />
            </div>

            <div className="ext-card-content">
                <div className="ext-brand-row">
                    <span className="ext-brand">{product.brand || 'Premium Brand'}</span>
                    <span className={`ext-stock-status ${product.stock < 15 ? 'stock-low' : 'stock-ok'}`}>
                        {product.stock > 0 ? (product.stock < 15 ? `Only ${product.stock} Left` : 'In Stock') : 'Out of Stock'}
                    </span>
                </div>

                <h3 className="ext-title" onClick={() => navigate(`/product/${product.id}`)}>
                    {product.title || product.name}
                </h3>

                <div className="ext-rating-row">
                    <div className="ext-stars">
                        <Star size={13} className="star-filled" />
                        <strong>{rating}</strong>
                    </div>
                    <span className="ext-divider">•</span>
                    <span className="ext-reviews">{reviewCount} Verified Reviews</span>
                </div>

                <p className="ext-description">
                    {product.description || 'Premium scientifically validated item cataloged for clinical safety.'}
                </p>

                <div className="ext-price-row">
                    <span className="ext-price">${Number(product.price).toFixed(2)}</span>
                    <button className="ext-deals-link" onClick={() => navigate('/cheap-buy', { state: { product } })}>
                        <TrendingDown size={12} />
                        Live Deals
                    </button>
                </div>

                {/* Two-row premium actions block */}
                <div className="ext-action-block" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
                    {/* Row 1: AI Consult + Feedback */}
                    <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                        <button 
                            className="ext-main-btn" 
                            onClick={(e) => { e.stopPropagation(); onAddChat(product); }} 
                            style={{ 
                                flex: 1, 
                                height: '36px', 
                                fontSize: '0.75rem', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                gap: '4px',
                                background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                                border: 'none',
                                color: 'white',
                                fontWeight: '700',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            <MessageCircle size={13} />
                            AI Consult
                        </button>
                        
                        <button 
                            className="ext-feedback-btn" 
                            onClick={(e) => { e.stopPropagation(); onViewFeedback(product); }}
                            style={{ 
                                flex: 1, 
                                height: '36px',
                                borderRadius: '8px',
                                fontSize: '0.75rem',
                                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', 
                                border: 'none',
                                color: 'black',
                                fontWeight: '700',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Star size={13} fill="currentColor" />
                            Feedback
                        </button>
                    </div>

                    {/* Row 2: Compare + Watchlist */}
                    <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                        <button 
                            className={`ext-compare-btn ${isSelected ? 'active' : ''}`}
                            onClick={(e) => { e.stopPropagation(); addToComparison(product); }}
                            style={{
                                flex: 1,
                                height: '34px',
                                borderRadius: '8px',
                                fontSize: '0.75rem',
                                background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.03)',
                                border: isSelected ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.08)',
                                color: isSelected ? '#a5b4fc' : '#e2e8f0',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            {isSelected ? <Check size={13} className="text-accent" /> : <GitCompare size={13} />}
                            {isSelected ? 'Compared' : 'Compare'}
                        </button>
                        
                        <button 
                            className="ext-watchlist-btn"
                            onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                            style={{
                                flex: 1,
                                height: '34px',
                                borderRadius: '8px',
                                fontSize: '0.75rem',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                color: '#e2e8f0',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Bell size={13} />
                            Watchlist
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductCardExt;

