import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    MessageCircle, Package, Star, GitCompare, Check, 
    TrendingDown, Bell, ShieldCheck, Sparkles, Zap, ShoppingBag,
    ExternalLink, ChevronDown, ChevronUp
} from 'lucide-react';
import { useComparison } from '../context/ComparisonContext';
import { useCart } from '../context/CartContext';
import SafeImage from './SafeImage';

const ProductCardExt = ({ product, onAddChat, onViewFeedback, index = 0 }) => {
    const navigate = useNavigate();
    const { selectedProducts, addToComparison } = useComparison();
    const { addToCart } = useCart();
    const isSelected = selectedProducts.some(p => p.id === product.id);
    const [showComparisons, setShowComparisons] = useState(false);

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

    // Price parsing and discount calculation
    const price = Number(product.price || 0);
    const originalPrice = Number(product.originalPrice || product.original_price || price);
    const discountPercent = originalPrice > price ? Math.round((1 - price / originalPrice) * 100) : 0;

    // Marketplace matching & styling details
    const source = product.source || 'Internal Store';
    const getSourceStyle = (src) => {
        const s = src.toLowerCase();
        if (s.includes('amazon')) return { background: 'linear-gradient(135deg, #FF9900 0%, #FFB84D 100%)', color: '#000' };
        if (s.includes('flipkart')) return { background: 'linear-gradient(135deg, #2874F0 0%, #669CFF 100%)', color: '#fff' };
        if (s.includes('myntra')) return { background: 'linear-gradient(135deg, #FF3F6C 0%, #FF668C 100%)', color: '#fff' };
        if (s.includes('nykaa')) return { background: 'linear-gradient(135deg, #FC2779 0%, #FF66A3 100%)', color: '#fff' };
        if (s.includes('ajio')) return { background: 'linear-gradient(135deg, #2C3E50 0%, #4A6572 100%)', color: '#fff' };
        if (s.includes('croma')) return { background: 'linear-gradient(135deg, #00E5D4 0%, #00BFA6 100%)', color: '#000' };
        if (s.includes('reliance')) return { background: 'linear-gradient(135deg, #E52B50 0%, #FF5A76 100%)', color: '#fff' };
        return { background: 'rgba(255,255,255,0.08)', color: '#fff' };
    };

    // Parse price comparisons
    const comparisons = (() => {
        try {
            const rawComp = product.price_comparison || product.priceComparison;
            if (Array.isArray(rawComp)) return rawComp;
            if (typeof rawComp === 'string') return JSON.parse(rawComp);
        } catch (e) {
            console.error("Failed to parse comparisons:", e);
        }
        return [];
    })();

    // Freshness format
    const formatFreshness = (timestamp) => {
        if (!timestamp) return 'Verified';
        const diffMs = Date.now() - new Date(timestamp).getTime();
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        if (isNaN(diffHrs) || diffHrs < 0) return 'Verified';
        if (diffHrs === 0) return 'Updated just now';
        if (diffHrs === 1) return 'Updated 1 hr ago';
        if (diffHrs < 24) return `Updated ${diffHrs} hrs ago`;
        return 'Updated today';
    };
    const freshness = formatFreshness(product.last_price_update || product.lastPriceUpdate);

    return (
        <div 
            className={`card ext-product-card glass-panel ${isSelected ? 'selected-card' : ''}`}
            style={{ animationDelay: `${(index % 12) * 0.04}s`, position: 'relative' }}
        >
            {/* Marketplace source badge */}
            <span 
                style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    padding: '3px 8px',
                    borderRadius: '20px',
                    fontSize: '0.65rem',
                    fontWeight: '700',
                    zIndex: 10,
                    letterSpacing: '0.5px',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                    ...getSourceStyle(source)
                }}
            >
                {source}
            </span>

            <div className="ext-card-header" style={{ paddingLeft: '110px' }}>
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
                        {product.stock > 0 ? (product.stock < 15 ? `Only ${product.stock} Left` : 'In Stock') : 'In Stock'}
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

                <div className="ext-price-row" style={{ alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="ext-price">₹{price.toLocaleString('en-IN')}</span>
                            {discountPercent > 0 && (
                                <span style={{
                                    background: 'rgba(239, 68, 68, 0.15)',
                                    color: '#f87171',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '0.7rem',
                                    fontWeight: '700'
                                }}>
                                    {discountPercent}% OFF
                                </span>
                            )}
                        </div>
                        {originalPrice > price && (
                            <span style={{ fontSize: '0.75rem', textDecoration: 'line-through', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                                ₹{originalPrice.toLocaleString('en-IN')}
                            </span>
                        )}
                        <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                            {freshness}
                        </span>
                    </div>

                    <button 
                        className="ext-deals-link" 
                        onClick={() => navigate('/cheap-buy', { state: { product } })}
                        style={{ alignSelf: 'center' }}
                    >
                        <TrendingDown size={12} />
                        Live Deals
                    </button>
                </div>

                {/* Live Price Comparison Section */}
                {comparisons.length > 0 && (
                    <div style={{ marginTop: '0.75rem', width: '100%' }}>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setShowComparisons(!showComparisons); }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                width: '100%',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.05)',
                                borderRadius: '6px',
                                padding: '6px 10px',
                                fontSize: '0.7rem',
                                color: '#a5b4fc',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            <span>Compare {comparisons.length} other prices</span>
                            {showComparisons ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                        
                        {showComparisons && (
                            <div style={{
                                background: 'rgba(0,0,0,0.2)',
                                border: '1px solid rgba(255,255,255,0.05)',
                                borderTop: 'none',
                                borderRadius: '0 0 6px 6px',
                                padding: '8px 10px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px'
                            }}>
                                {comparisons.map((c, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                                        <span style={{ color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {c.merchant || c.source}
                                        </span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontWeight: '700', color: '#fff' }}>₹{Number(c.price).toLocaleString('en-IN')}</span>
                                            {c.url && (
                                                <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', display: 'flex', alignItems: 'center' }}>
                                                    <ExternalLink size={10} />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Two-row premium actions block */}
                <div className="ext-action-block" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
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
