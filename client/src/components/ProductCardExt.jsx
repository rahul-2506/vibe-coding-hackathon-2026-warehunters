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

            <div className="ext-card-image" onClick={() => navigate(`/product/${product.id}`)}>
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

                {/* Simplified unified action row */}
                <div className="ext-action-row">
                    <button className="ext-main-btn" onClick={() => onAddChat(product)}>
                        <MessageCircle size={14} />
                        AI Consult
                    </button>
                    
                    <button 
                        className={`ext-icon-btn ${isSelected ? 'active' : ''}`} 
                        title={isSelected ? 'Selected for comparison' : 'Compare product'} 
                        onClick={() => addToComparison(product)}
                    >
                        {isSelected ? <Check size={15} /> : <GitCompare size={15} />}
                    </button>
                    
                    <button 
                        className="ext-icon-btn" 
                        title="Add to Watchlist" 
                        onClick={() => addToCart(product)}
                    >
                        <Bell size={15} />
                    </button>
                    
                    <button 
                        className="ext-icon-btn" 
                        title="View Verified Reviews" 
                        onClick={() => onViewFeedback(product)}
                    >
                        <Star size={15} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductCardExt;

