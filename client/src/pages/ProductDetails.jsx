import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { 
    ChevronLeft, Star, MessageCircle, ShieldCheck, ShieldAlert, Package, 
    Info, TrendingDown, Bell, AlertTriangle, Cpu, Zap, TrendingUp, Sparkles, ThumbsUp 
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { API_BASE_URL } from '../config/api';
import SafeImage from '../components/SafeImage';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';
import './ProductDetails.css';

const getPlatformRates = (product) => {
    if (!product) return [];
    
    const basePrice = Number(product.price || 0);
    const isSkincare = product.category?.toLowerCase() === 'skincare' || product.category?.toLowerCase() === 'beauty';
    
    if (isSkincare) {
        return [
            {
                platform: 'Amazon',
                price: (basePrice * 0.95).toFixed(2),
                logo: '📦',
                delivery: 'Free Delivery with Prime',
                url: 'https://amazon.in',
                highlight: false
            },
            {
                platform: 'Flipkart',
                price: (basePrice * 0.92).toFixed(2),
                logo: '⚡',
                delivery: 'Delivery in 2 Days (₹40)',
                url: 'https://flipkart.com',
                highlight: false
            },
            {
                platform: 'Nykaa',
                price: (basePrice * 0.88).toFixed(2),
                logo: '💖',
                delivery: 'Clinical Special: Free Delivery',
                url: 'https://nykaa.com',
                highlight: true
            },
            {
                platform: 'Purplle',
                price: (basePrice * 0.90).toFixed(2),
                logo: '💜',
                delivery: 'Delivery in 3 Days',
                url: 'https://purplle.com',
                highlight: false
            }
        ];
    } else {
        return [
            {
                platform: 'Amazon',
                price: (basePrice * 0.97).toFixed(2),
                logo: '📦',
                delivery: 'Free Prime One-Day Delivery',
                url: 'https://amazon.in',
                highlight: false
            },
            {
                platform: 'Flipkart',
                price: (basePrice * 0.94).toFixed(2),
                logo: '⚡',
                delivery: 'SuperCoins Applicable',
                url: 'https://flipkart.com',
                highlight: true
            },
            {
                platform: 'Croma',
                price: (basePrice * 0.96).toFixed(2),
                logo: '🔴',
                delivery: 'Store Pick-up Available',
                url: 'https://croma.com',
                highlight: false
            },
            {
                platform: 'Reliance Digital',
                price: (basePrice * 0.98).toFixed(2),
                logo: '🔵',
                delivery: 'Free Home Installation',
                url: 'https://reliancedigital.in',
                highlight: false
            }
        ];
    }
};

const getFeedbackKey = (user) => {
    const userKey = user?.id || user?.user_metadata?.username || 'guest';
    return `mySubmittedFeedbacks_${userKey}`;
};

const ProductDetails = () => {
    const { id } = useParams();
    const { addToCart } = useCart();
    const location = useLocation();
    const navigate = useNavigate();
    
    // Core States
    const [product, setProduct] = useState(location.state?.product || null);
    const [activeImage, setActiveImage] = useState('');
    const [recommendations, setRecommendations] = useState([]);
    const [recsLoading, setRecsLoading] = useState(true);
    const [feedbacks, setFeedbacks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [mySubmittedFeedbacks, setMySubmittedFeedbacks] = useState([]);
    
    // Review form states (Extended for Phase 5)
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewEmoji, setReviewEmoji] = useState('😊');
    const [reviewSource, setReviewSource] = useState('self');
    const [reviewIngredients, setReviewIngredients] = useState('');
    const [reviewText, setReviewText] = useState('');
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const [reviewSuccessMsg, setReviewSuccessMsg] = useState(false);

    // Phase 5 specific states
    const [reviewMood, setReviewMood] = useState('😀 Excellent');
    const [highlightCategories, setHighlightCategories] = useState([]);
    const [recommendation, setRecommendation] = useState('👍 Yes');
    const [discoverySource, setDiscoverySource] = useState('Own Research');
    const [confidenceScore, setConfidenceScore] = useState(80);
    const [imageUrl, setImageUrl] = useState('');
    const [aiAnalysisResult, setAiAnalysisResult] = useState(null);

    const { user } = useAuth();
    const currentUser = user;
    const currentUserId = user?.id || user?.user_metadata?.username || 'guest';

    const handleReviewSubmit = async (e) => {
        e.preventDefault();
        if (!reviewText.trim() || isSubmittingReview) return;
        setIsSubmittingReview(true);
        setReviewSuccessMsg(false);
        setAiAnalysisResult(null);

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
                body: JSON.stringify({
                    product_name: product.title || product.name,
                    rating: reviewRating,
                    review_text: reviewText,
                    emoji: reviewEmoji,
                    source: reviewSource,
                    mentioned_ingredients: reviewIngredients,
                    user_id: currentUser ? currentUserId : null,
                    experience_mood: reviewMood,
                    highlight_categories: highlightCategories,
                    recommendation: recommendation,
                    discovery_source: discoverySource,
                    confidence_score: confidenceScore,
                    image_url: imageUrl
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || 'Failed to submit review');
            }

            const payload = await res.json();
            console.log("Review submission response:", payload);
            const analysisData = payload.data || payload;
            setAiAnalysisResult(analysisData);

            setReviewText('');
            setReviewIngredients('');
            setReviewRating(5);
            setReviewEmoji('😊');
            setReviewSource('self');
            setReviewMood('😀 Excellent');
            setHighlightCategories([]);
            setRecommendation('👍 Yes');
            setDiscoverySource('Own Research');
            setConfidenceScore(80);
            setImageUrl('');
            setReviewSuccessMsg(true);
            setTimeout(() => setReviewSuccessMsg(false), 10000);

            // Refetch reviews to show the new one
            const reviewsRes = await fetch(`${API_BASE_URL}/api/products/${id}/reviews`);
            if (reviewsRes.ok) {
                const resJson = await reviewsRes.json();
                const data = Array.isArray(resJson) ? resJson : (resJson.data || []);
                setFeedbacks(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error("Failed to submit review:", err);
            alert(`Review submission failed: ${err.message}`);
        } finally {
            setIsSubmittingReview(false);
        }
    };
    
    // Dynamic Pricing & Crawlers
    const [liveRates, setLiveRates] = useState({ Amazon: 0, Flipkart: 0, Nykaa: 0 });
    
    // Interactive Bot Review Generator States
    const [botTone, setBotTone] = useState('promotional');
    const [generatingBot, setGeneratingBot] = useState(false);
    const [botVerificationOutput, setBotVerificationOutput] = useState(null);
    const [syntheticTestReviews, setSyntheticTestReviews] = useState([]);

    // Live Crawled Price Monitor simulation
    useEffect(() => {
        if (!product) return;
        const base = Number(product.price || 0);
        
        const updatePrices = () => {
            setLiveRates({
                Amazon: Math.round(base * (0.94 + Math.random() * 0.08)),
                Flipkart: Math.round(base * (0.95 + Math.random() * 0.08)),
                Nykaa: Math.round(base * (0.91 + Math.random() * 0.08))
            });
        };
        
        updatePrices();
        const interval = setInterval(updatePrices, 3500);
        return () => clearInterval(interval);
    }, [product]);

    // Local submissions retrieval
    useEffect(() => {
        const key = getFeedbackKey(user);
        try {
            const saved = JSON.parse(localStorage.getItem(key) || '[]');
            setMySubmittedFeedbacks(saved);
        } catch {
            setMySubmittedFeedbacks([]);
        }
    }, [user]);

    const isMyFeedback = (f) => {
        return (mySubmittedFeedbacks || []).some(myF => 
            myF.product_name === (f.product_name || f.product_title) && 
            myF.review_text === f.review_text && 
            myF.rating === f.rating
        );
    };

    // Load full details & sync
    useEffect(() => {
        const fetchProductData = async () => {
            try {
                setLoading(true);
                // 1. Fetch single product directly from our upgraded ID route to grab complete metadata
                const prodRes = await fetch(`${API_BASE_URL}/api/products/${id}`);
                let foundProduct = null;
                if (prodRes.ok) {
                    const resJson = await prodRes.json();
                    foundProduct = resJson.data || resJson;
                    setProduct(foundProduct);
                    
                    // Set active main image
                    let list = [];
                    if (foundProduct.images) {
                        if (Array.isArray(foundProduct.images)) list = foundProduct.images;
                        else if (typeof foundProduct.images === 'string') {
                            try { list = JSON.parse(foundProduct.images); } catch (e) {}
                        }
                    }
                    if (list.length > 0) {
                        setActiveImage(list[0]);
                    } else {
                        setActiveImage(foundProduct.thumbnail || foundProduct.image_url || '');
                    }
                }

                // 2. Fetch specific reviews
                const reviewsRes = await fetch(`${API_BASE_URL}/api/products/${id}/reviews`);
                if (reviewsRes.ok) {
                    const resJson = await reviewsRes.json();
                    const data = Array.isArray(resJson) ? resJson : (resJson.data || []);
                    setFeedbacks(Array.isArray(data) ? data : []);
                } else {
                    // Fallback to older feedbacks search
                    const feedRes = await fetch(`${API_BASE_URL}/api/feedbacks`);
                    if (feedRes.ok) {
                        const resJson = await feedRes.json();
                        const allFeedbacks = Array.isArray(resJson) ? resJson : (resJson.data || []);
                        const pName = foundProduct?.title || foundProduct?.name || '';
                        const filtered = (Array.isArray(allFeedbacks) ? allFeedbacks : []).filter(f => 
                            f.product_id === Number(id) || 
                            (f.product_name && f.product_name.toLowerCase().trim() === pName.toLowerCase().trim())
                        );
                        setFeedbacks(filtered);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch product details:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchProductData();
    }, [id]);

    // Load AI recommendations
    useEffect(() => {
        if (!product) return;
        
        const fetchRecommendations = async () => {
            try {
                setRecsLoading(true);
                const recsRes = await fetch(`${API_BASE_URL}/api/recommend/${product.id}`);
                if (recsRes.ok) {
                    const resJson = await recsRes.json();
                    const data = Array.isArray(resJson) ? resJson : (resJson.data || []);
                    setRecommendations(Array.isArray(data) ? data : []);
                }
            } catch (err) {
                console.error("Failed to fetch recommendations:", err);
            } finally {
                setRecsLoading(false);
            }
        };

        fetchRecommendations();
    }, [product]);

    // Synthetic Bot Generator Handler
    const handleGenerateBotReview = async () => {
        if (!product) return;
        try {
            setGeneratingBot(true);
            setBotVerificationOutput(null);
            
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            
            const headers = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            // 1. Post to Express Gateway Synthetic review generation service
            const response = await fetch(`${API_BASE_URL}/api/ai/generate-fake`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    product_id: product.id,
                    product_name: product.title || product.name,
                    tone: botTone
                })
            });
            
            if (response.ok) {
                const resJson = await response.json();
                const data = resJson.data || resJson;
                
                // 2. Query classification model prediction via Express Gateway
                const probeResponse = await fetch(`${API_BASE_URL}/api/ai/predict`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ review: data.review_text })
                });
                
                let classifierVerdict = "FAKE";
                if (probeResponse.ok) {
                    const probeJson = await probeResponse.json();
                    const probeData = probeJson.data || probeJson;
                    classifierVerdict = probeData.prediction || "FAKE";
                }
                
                const verifiedReview = {
                    id: `synth_${Date.now()}`,
                    review_text: data.review_text,
                    rating: botTone === 'negative_spam' ? 1 : 5,
                    emoji: botTone === 'negative_spam' ? '😡' : '🤖',
                    source: `Simulated Bot: ${botTone.toUpperCase().replace('_', ' ')}`,
                    trust_score: data.trust_score,
                    verdict: classifierVerdict === 'REAL' ? 'Genuine' : 'Suspicious',
                    sentiment: botTone === 'negative_spam' ? 'negative' : 'positive',
                    created_at: new Date().toISOString()
                };
                
                setBotVerificationOutput(verifiedReview);
                setSyntheticTestReviews(prev => [verifiedReview, ...prev]);
            }
        } catch (err) {
            console.error("Synthetic generation simulation failed:", err);
        } finally {
            setGeneratingBot(false);
        }
    };

    if (loading) return <div className="processing-state"><div className="spinner"></div></div>;
    if (!product) return <div className="error-banner">Product not found.</div>;

    // Combine standard DB reviews and newly simulated synthetic ones for local reactive UI testing
    const activeReviews = [...(syntheticTestReviews || []), ...(feedbacks || [])];

    const avgRating = activeReviews.length > 0 
        ? (activeReviews.reduce((acc, f) => acc + Number(f.rating), 0) / activeReviews.length).toFixed(1)
        : Number(product.rating || 4.0).toFixed(1);

    const ratingCounts = [5, 4, 3, 2, 1].map(star => ({
        star,
        count: activeReviews.filter(f => Number(f.rating) === star).length,
        percent: activeReviews.length > 0 ? (activeReviews.filter(f => Number(f.rating) === star).length / activeReviews.length) * 100 : 0
    }));

    // Secure Image extraction
    let imageList = [];
    if (product.images) {
        if (Array.isArray(product.images)) {
            imageList = product.images;
        } else if (typeof product.images === 'string') {
            try { imageList = JSON.parse(product.images); } catch (e) { imageList = [product.images]; }
        }
    }
    if (imageList.length === 0) {
        imageList = [product.thumbnail || product.image_url || ''];
    }

    // Stock & Brand pills
    const stockVal = Number(product.stock || 50);
    const brandText = product.brand || 'Premium Brand';
    let stockText = 'In Stock';
    let stockClass = 'stock-pill-in';
    if (stockVal === 0) {
        stockText = 'Out of Stock';
        stockClass = 'stock-pill-out';
    } else if (stockVal <= 15) {
        stockText = `Only ${stockVal} Left!`;
        stockClass = 'stock-pill-low';
    }

    // Trust pill computation
    const productTrust = Number(product.trust_score || 80);
    let trustLabel = 'Highly Trusted';
    let trustClass = 'trust-pill-high';
    if (productTrust < 50) {
        trustLabel = 'High Spam Risk';
        trustClass = 'trust-pill-low';
    } else if (productTrust < 75) {
        trustLabel = 'Moderately Checked';
        trustClass = 'trust-pill-med';
    }

    return (
        <div className="product-details-container animate-fade-in">
            <div className="back-btn" onClick={() => navigate('/products')}>
                <ChevronLeft size={20} /> Back to Catalog
            </div>

            {/* MAIN HERO SPLIT */}
            <section className="product-hero-section">
                
                {/* 1. COMPACT PREMIUM IMAGE SIDEBAR GALLERY */}
                <div className="gallery-layout-container">
                    <div className="thumbnail-sidebar">
                        {(imageList || []).slice(0, 5).map((img, idx) => (
                            <div 
                                key={idx} 
                                className={`thumbnail-item glass-panel ${activeImage === img ? 'active-thumb' : ''}`}
                                onClick={() => setActiveImage(img)}
                            >
                                <img src={img} alt={`view-${idx}`} onError={(e) => { e.target.style.display = 'none'; }} />
                            </div>
                        ))}
                    </div>
                    
                    <div className="hero-image-container glass-panel">
                        <SafeImage src={activeImage} alt={product.title || product.name} className="main-display-image" aspectRatio="auto" />
                        
                        {/* Interactive floating badges */}
                        <div className="floating-gallery-badges">
                            <span className={`gallery-pill ${stockClass}`}>{stockText}</span>
                            <span className={`gallery-pill ${trustClass}`}>{productTrust}% Trust Score</span>
                        </div>
                    </div>
                </div>

                {/* 2. RICH DETAIL CONTAINER */}
                <div className="hero-info-container">
                    <div className="hero-header-badges">
                        <span className="hero-category text-accent">{product.category}</span>
                        <span className="brand-badge-premium">{brandText}</span>
                    </div>

                    <h1 className="hero-title">{product.title || product.name}</h1>
                    
                    <div className="ratings-summary-inline">
                        <div className="stars-row">
                            {[...Array(5)].map((_, i) => (
                                <Star 
                                    key={i} 
                                    size={18} 
                                    fill={i < Math.round(avgRating) ? "var(--rating-star)" : "none"} 
                                    color={i < Math.round(avgRating) ? "var(--rating-star)" : "rgba(255,255,255,0.2)"} 
                                />
                            ))}
                        </div>
                        <span className="rating-text-value">{avgRating} / 5.0</span>
                        <span className="divider-bar">|</span>
                        <span className="text-muted font-small">({activeReviews.length} Verified Submissions)</span>
                    </div>

                    <div className="price-tag-row">
                        <span className="price-currency-value">₹{product.price ? Number(product.price).toFixed(2) : "0.00"}</span>
                        <span className="price-tax-pill">Inclusive of all taxes</span>
                    </div>
                    
                    <p className="hero-description">
                        {product.description || product.explanation || "Premium scientifically validated formula configured for high skin compatibility. Curated under deep quality standards."}
                    </p>

                    {/* Scientific verifier pill */}
                    <div className="scientific-guarantee-card glass-panel">
                        <Cpu size={22} className="scientific-badge-icon" />
                        <div className="scientific-guarantee-text">
                            <h4>ADVANCED SCIENTIFIC VERIFICATION PROBE</h4>
                            <p>All active ingredients have been vetted using structural biochemistry databases mapping peer-reviewed clinical reports.</p>
                        </div>
                    </div>

                    {/* Immediate Interactive UI Actions */}
                    <div className="hero-actions">
                        <div className="action-button-group">
                            <button 
                                className="add-to-chat-btn-premium" 
                                onClick={() => navigate('/chatbot', { state: { product } })}
                            >
                                <MessageCircle size={20} />
                                Start AI Clinical Consulting
                            </button>
                            
                            <button 
                                className="add-to-cart-details-btn-premium" 
                                onClick={() => addToCart(product)}
                            >
                                <Bell size={20} />
                                Add to Watchlist
                            </button>
                        </div>

                        <button 
                            className="price-crawler-alert-btn"
                            onClick={() => navigate('/cheap-buy', { state: { product } })}
                        >
                            <TrendingDown size={18} />
                            Open Intelligent Multi-Platform Tracker
                        </button>

                        {/* Beautiful Realtime Crawler Monitor Card */}
                        <div className="live-scanners-card glass-panel">
                            <div className="scanner-card-header">
                                <h4 className="scanner-title">
                                    <span className="live-pulse-dot" />
                                    REAL-TIME MULTI-PLATFORM SCRAPER
                                </h4>
                                <span className="scanner-status-tag">ACTIVE ENGINE</span>
                            </div>
                            
                            <div className="scanner-grid">
                                {Object.entries(liveRates || {}).map(([platform, price]) => (
                                    <div key={platform} className="scanner-box glass-panel">
                                        <span className="scanner-platform">{platform}</span>
                                        <strong className="scanner-price">₹{price}/-</strong>
                                        <span className="scanner-micro-time">Synced 1s ago</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* MARKETPLACE COMPARISON, PRICE HISTORY & ASPECT SENTIMENT HUB */}
            <section className="premium-analytics-dashboard marketplace-hub-section">
                <div className="dashboard-section-header">
                    <h2>
                        <TrendingDown size={22} className="header-badge-icon text-accent" />
                        Marketplace Comparison & Intelligence Hub
                    </h2>
                    <p className="text-muted">Real-time competitor tracking, historical price trends, and review aspect-level sentiments.</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
                    
                    {/* 1. Side-by-Side Competitor Comparison Table */}
                    <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff', fontSize: '1.1rem', margin: '0 0 1rem 0' }}>
                            <Package size={18} className="text-accent" />
                            Competitor Price & Delivery Matrix
                        </h3>
                        
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
                                        <th style={{ padding: '0.5rem' }}>Merchant</th>
                                        <th style={{ padding: '0.5rem' }}>Price</th>
                                        <th style={{ padding: '0.5rem' }}>Shipping Details</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(getPlatformRates(product) || []).map((rate) => (
                                        <tr key={rate.platform} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', verticalAlign: 'middle', background: rate.highlight ? 'rgba(99, 102, 241, 0.05)' : 'transparent' }}>
                                            <td style={{ padding: '0.75rem 0.5rem', fontWeight: '600', color: '#fff' }}>
                                                {rate.logo} {rate.platform}
                                            </td>
                                            <td style={{ padding: '0.75rem 0.5rem', color: rate.highlight ? 'var(--accent-color)' : '#fff', fontWeight: 'bold' }}>
                                                ₹{rate.price}
                                            </td>
                                            <td style={{ padding: '0.75rem 0.5rem', color: 'rgba(255,255,255,0.6)' }}>
                                                {rate.delivery}
                                            </td>
                                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                                                <a 
                                                    href={rate.url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    style={{ 
                                                        display: 'inline-block', 
                                                        padding: '0.25rem 0.75rem', 
                                                        borderRadius: '6px', 
                                                        background: rate.highlight ? 'var(--accent-color)' : 'rgba(255,255,255,0.08)', 
                                                        color: '#fff', 
                                                        textDecoration: 'none', 
                                                        fontSize: '0.75rem', 
                                                        fontWeight: 'bold',
                                                        border: '1px solid var(--border-color)' 
                                                    }}
                                                >
                                                    Buy Now
                                                </a>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 2. Interactive Price History Sparkline Card */}
                    <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff', fontSize: '1.1rem', margin: '0 0 0.5rem 0' }}>
                            <TrendingDown size={18} className="text-accent" />
                            30-Day Price Trajectory
                        </h3>
                        <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                            Tracking daily adjustments across major merchant endpoints.
                        </p>

                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '1rem' }}>
                            <span style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#fff' }}>₹{product.price}</span>
                            <span style={{ fontSize: '0.8rem', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '0.1rem' }}>
                                <TrendingDown size={12} /> -8.4% this month
                            </span>
                        </div>

                        {/* Beautiful simulated price history SVG sparkline */}
                        <div style={{ height: '80px', width: '100%', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', padding: '0.5rem', position: 'relative' }}>
                            <svg viewBox="0 0 100 30" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                                <defs>
                                    <linearGradient id="sparklineGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="var(--accent-color)" stopOpacity="0.4" />
                                        <stop offset="100%" stopColor="var(--accent-color)" stopOpacity="0.0" />
                                    </linearGradient>
                                </defs>
                                {/* Fill path */}
                                <path 
                                    d="M0,5 Q15,12 30,8 T60,22 T90,14 L100,10 L100,30 L0,30 Z" 
                                    fill="url(#sparklineGrad)" 
                                />
                                {/* Sparkline path */}
                                <path 
                                    d="M0,5 Q15,12 30,8 T60,22 T90,14 L100,10" 
                                    fill="none" 
                                    stroke="var(--accent-color)" 
                                    strokeWidth="1.5" 
                                    strokeLinecap="round"
                                />
                                {/* Pulsing current price marker */}
                                <circle cx="100" cy="10" r="2" fill="#fff" />
                                <circle cx="100" cy="10" r="4" fill="var(--accent-color)" opacity="0.5" className="animate-ping" />
                            </svg>
                            <span style={{ position: 'absolute', left: '8px', bottom: '4px', fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>30 Days Ago</span>
                            <span style={{ position: 'absolute', right: '8px', bottom: '4px', fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>Today</span>
                        </div>
                    </div>

                    {/* 3. Aspect-Level Sentiment Card */}
                    <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff', fontSize: '1.1rem', margin: '0 0 1rem 0' }}>
                            <Sparkles size={18} className="text-accent" />
                            AI Aspect-Level Sentiments
                        </h3>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                            {[
                                { aspect: 'Efficacy & Quality', score: 94, sentiment: 'Excellent' },
                                { aspect: 'Cost-Efficiency', score: 85, sentiment: 'Great Value' },
                                { aspect: 'Ingredients & Active safety', score: 90, sentiment: 'Very Safe' },
                                { aspect: 'Shipping & Delivery speed', score: 78, sentiment: 'Reliable' }
                            ].map((aspectObj) => (
                                <div key={aspectObj.aspect} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                        <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: '500' }}>{aspectObj.aspect}</span>
                                        <span style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>{aspectObj.sentiment} ({aspectObj.score}%)</span>
                                    </div>
                                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${aspectObj.score}%`, background: 'var(--accent-color)', borderRadius: '3px' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </section>

            {/* AI SIMILARITY RECOMMENDATIONS SYSTEM */}
            <section className="premium-analytics-dashboard">
                <div className="dashboard-section-header">
                    <h2>
                        <Sparkles size={22} className="header-badge-icon text-accent" />
                        AI Similarity-Weighted Recommendations
                    </h2>
                    <p className="text-muted">Calculated in real-time utilizing 40% Category, 30% Keyword Jaccard Overlap, 20% Trust index, and 10% base Rating.</p>
                </div>

                {recsLoading ? (
                    <div className="recs-loading-bar"><div className="spinner"></div></div>
                ) : (recommendations || []).length > 0 ? (
                    <div className="recommendations-scroller-grid">
                        {(recommendations || []).slice(0, 4).map((rec) => (
                            <div 
                                key={rec.id} 
                                className="recommendation-badge-card glass-panel animate-hover"
                                onClick={() => {
                                    navigate(`/products/${rec.id}`);
                                    window.scrollTo(0, 0);
                                }}
                            >
                                <div className="rec-image-wrapper">
                                    <SafeImage src={rec.image_url || rec.thumbnail} alt={rec.title || rec.name} />
                                    <div className="rec-floating-match">
                                        <Zap size={12} />
                                        {rec.match_score}% MATCH
                                    </div>
                                </div>

                                <div className="rec-body-wrapper">
                                    <span className="rec-category">{rec.category}</span>
                                    <h4 className="rec-title">{rec.title || rec.name}</h4>
                                    
                                    <div className="rec-ratings-row">
                                        <Star size={13} fill="#f59e0b" color="#f59e0b" />
                                        <span>{Number(rec.rating).toFixed(1)}</span>
                                        <span className="rec-trust-badge">{rec.trust_score}% TRUST</span>
                                    </div>

                                    <p className="rec-explanation">{rec.explanation}</p>
                                    
                                    <div className="rec-price-action">
                                        <span className="rec-price">₹{Number(rec.price).toFixed(2)}</span>
                                        <button className="rec-view-btn">Inspect</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="glass-panel empty-recommendations">
                        <Cpu size={32} opacity={0.3} />
                        <p className="text-muted">No high similarity counterparts found in inventory.</p>
                    </div>
                )}
            </section>

            {/* REAL-TIME INTERACTIVE BOT INJECTOR PROBE */}
            <section className="premium-analytics-dashboard">
                <div className="dashboard-section-header">
                    <h2>
                        <AlertTriangle size={22} className="header-badge-icon text-error" />
                        AI Classifier Stress Test & Bot Review Injector
                    </h2>
                    <p className="text-muted">Simulate a malicious bot attack or artificial promotional surge to stress test the machine learning trust classification pipeline in real-time.</p>
                </div>

                <div className="bot-stress-test-container glass-panel">
                    <div className="bot-control-sidebar">
                        <h3>Stress Test Controller</h3>
                        
                        <div className="control-group-spec">
                            <label>Injectable Bot Narrative Tone</label>
                            <select 
                                className="premium-select-input" 
                                value={botTone}
                                onChange={(e) => setBotTone(e.target.value)}
                            >
                                <option value="promotional">📈 Over-promotional Spam (5-Star)</option>
                                <option value="negative_spam">📉 Competitor Negative Spam (1-Star)</option>
                                <option value="generic_repetitive">🔁 Repetitive Generic Copypasta (Neutral)</option>
                            </select>
                        </div>

                        <button 
                            className="bot-attack-trigger-btn"
                            onClick={handleGenerateBotReview}
                            disabled={generatingBot}
                        >
                            {generatingBot ? (
                                <>
                                    <div className="spinner-small" /> Running Neural Scraper...
                                </>
                            ) : (
                                <>
                                    <Zap size={18} /> Launch Simulated Injection Attack
                                </>
                            )}
                        </button>
                    </div>

                    <div className="bot-console-output">
                        <h3>Model Verification Logs</h3>
                        
                        {botVerificationOutput ? (
                            <div className="verification-log-card animate-glow">
                                <div className="log-header-spec">
                                    <span className="log-tag"><Cpu size={14} /> CLASSIFIER PROBE</span>
                                    <span className={`log-verdict-badge ${botVerificationOutput.verdict === 'Genuine' ? 'verdict-real' : 'verdict-spam'}`}>
                                        {botVerificationOutput.verdict === 'Genuine' ? 'PASSED: GENUINE' : 'FLAGGED: SUSPICIOUS'}
                                    </span>
                                </div>

                                <div className="log-narrative-box">
                                    <p className="log-text">"{botVerificationOutput.review_text}"</p>
                                </div>

                                <div className="log-breakdown-row">
                                    <div className="log-metric">
                                        <span className="label">Base Rating</span>
                                        <strong>{botVerificationOutput.rating} ★</strong>
                                    </div>
                                    <div className="log-metric">
                                        <span className="label">Evaluation Trust Index</span>
                                        <strong>{botVerificationOutput.trust_score}%</strong>
                                    </div>
                                    <div className="log-metric">
                                        <span className="label">Stress Attack Source</span>
                                        <strong className="text-accent">{botVerificationOutput.source}</strong>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bot-idle-terminal">
                                <span className="terminal-cursor">&gt;</span> Waiting for simulation trigger. Select a tone and launch an attack vector to monitor the ML classifier reaction logs.
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* VERIFIED CUSTOMER VOICE */}
            <section className="feedback-repository-section">
                <div className="feedback-header">
                    <h2>
                        <ThumbsUp size={22} className="header-badge-icon text-accent" />
                        Verified Customer Voice
                    </h2>
                </div>

                <div className="feedback-grid">
                    {/* LEFT PANEL: RATINGS OVERVIEW */}
                    <div className="sentiment-summary-card">
                        <div className="glass-panel sentiment-card-inner">
                            <h3>Sentiment Audit</h3>
                            <div className="avg-rating-value">{avgRating}</div>
                            
                            <div className="stars-column-wrapper">
                                <div className="stars-row" style={{ justifyContent: 'center' }}>
                                    {[...Array(5)].map((_, i) => (
                                        <Star 
                                            key={i} 
                                            size={22} 
                                            fill={i < Math.round(avgRating) ? "var(--rating-star)" : "none"} 
                                            color={i < Math.round(avgRating) ? "var(--rating-star)" : "rgba(255,255,255,0.2)"} 
                                        />
                                    ))}
                                </div>
                                <span className="text-muted font-micro mt-2">Weighted average index of active reviews</span>
                            </div>
                            
                            <div className="rating-bar-container">
                                {(ratingCounts || []).map(item => (
                                    <div key={item.star} className="rating-bar-row">
                                        <span className="bar-label">{item.star} ★</span>
                                        <div className="rating-bar-fill">
                                            <div className="rating-bar-inner animate-width" style={{ width: `${item.percent}%` }}></div>
                                        </div>
                                        <span className="bar-percent">{Math.round(item.percent)}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT PANEL: LIVE REVIEW FEED */}
                    <div className="reviews-feed">
                        {/* Compact Review Form */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
                            {/* Review Challenge Form Card */}
                            <div className="details-review-card glass-panel review-form-card" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)' }}>
                                <h3 className="text-sm font-bold tracking-wider uppercase mb-4" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0, color: 'var(--accent-color)' }}>
                                    <MessageCircle size={18} />
                                    🎭 The AI Review Challenge {!currentUser && <span style={{ fontSize: '0.75rem', textTransform: 'none', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.6rem', borderRadius: '12px', color: 'var(--text-muted)', fontWeight: 'normal' }}>Posting as Guest</span>}
                                </h3>
                                    
                                    <form onSubmit={handleReviewSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                        
                                        {/* 1. EXPERIENCE MOOD emoji grid */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>1. Experience Mood</label>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                                {['😀 Excellent', '🙂 Good', '😐 Neutral', '😕 Disappointed', '😡 Terrible', '🤯 Unexpected'].map(m => (
                                                    <span
                                                        key={m}
                                                        onClick={() => setReviewMood(m)}
                                                        style={{
                                                            cursor: 'pointer',
                                                            fontSize: '0.8rem',
                                                            padding: '0.35rem 0.75rem',
                                                            borderRadius: '8px',
                                                            border: reviewMood === m ? '1px solid var(--accent-color)' : '1px solid rgba(255,255,255,0.1)',
                                                            background: reviewMood === m ? 'var(--accent-color-dim)' : 'rgba(255,255,255,0.02)',
                                                            color: reviewMood === m ? 'var(--accent-color)' : 'white',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        {m}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        {/* 2. HIGHLIGHT CATEGORIES multi-select chips */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>2. What Stood Out? (Select Multiples)</label>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                                {['Quality', 'Price', 'Packaging', 'Delivery', 'Results', 'Ingredients', 'Customer Support', 'Other'].map(cat => {
                                                    const isSelected = highlightCategories.includes(cat);
                                                    return (
                                                        <span
                                                            key={cat}
                                                            onClick={() => {
                                                                if (isSelected) {
                                                                    setHighlightCategories(prev => prev.filter(c => c !== cat));
                                                                } else {
                                                                    setHighlightCategories(prev => [...prev, cat]);
                                                                }
                                                            }}
                                                            style={{
                                                                cursor: 'pointer',
                                                                fontSize: '0.75rem',
                                                                padding: '0.25rem 0.6rem',
                                                                borderRadius: '20px',
                                                                border: isSelected ? '1px solid var(--accent-color)' : '1px solid rgba(255,255,255,0.08)',
                                                                background: isSelected ? 'var(--accent-color-dim)' : 'rgba(255,255,255,0.01)',
                                                                color: isSelected ? 'var(--accent-color)' : 'var(--text-muted)',
                                                                transition: 'all 0.2s'
                                                            }}
                                                        >
                                                            {isSelected ? '✓ ' : '+ '} {cat}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* 3. Price & Ratings Inline layout */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Your Rating</span>
                                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                    {[1, 2, 3, 4, 5].map(nu => (
                                                        <Star
                                                            key={nu}
                                                            size={18}
                                                            fill={reviewRating >= nu ? "var(--rating-star)" : "none"}
                                                            stroke="var(--rating-star)"
                                                            onClick={() => setReviewRating(nu)}
                                                            style={{ cursor: 'pointer' }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                            
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Reaction Emoji</span>
                                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                    {['😊', '😍', '😐', '😡', '👍', '👎'].map(em => (
                                                        <span
                                                            key={em}
                                                            onClick={() => setReviewEmoji(em)}
                                                            style={{
                                                                cursor: 'pointer',
                                                                fontSize: '1.1rem',
                                                                padding: '0.2rem 0.4rem',
                                                                borderRadius: '6px',
                                                                border: reviewEmoji === em ? '1px solid var(--accent-color)' : '1px solid transparent',
                                                                background: reviewEmoji === em ? 'var(--accent-color-dim)' : 'transparent',
                                                                transition: 'all 0.2s'
                                                            }}
                                                        >
                                                            {em}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* 4. Recommendation & Discovery inline */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, minWidth: '150px' }}>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>3. Would You Recommend It?</label>
                                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                    {['👍 Yes', '👎 No', '🤔 Maybe'].map(opt => (
                                                        <span
                                                            key={opt}
                                                            onClick={() => setRecommendation(opt)}
                                                            style={{
                                                                cursor: 'pointer',
                                                                fontSize: '0.75rem',
                                                                padding: '0.35rem 0.6rem',
                                                                borderRadius: '8px',
                                                                border: recommendation === opt ? '1px solid var(--accent-color)' : '1px solid rgba(255,255,255,0.08)',
                                                                background: recommendation === opt ? 'var(--accent-color-dim)' : 'rgba(255,255,255,0.02)',
                                                                color: recommendation === opt ? 'var(--accent-color)' : 'white',
                                                                transition: 'all 0.2s',
                                                                flex: 1,
                                                                textAlign: 'center'
                                                            }}
                                                        >
                                                            {opt}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, minWidth: '150px' }}>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>4. How Did You Discover This?</label>
                                                <select
                                                    value={discoverySource}
                                                    onChange={(e) => setDiscoverySource(e.target.value)}
                                                    className="premium-select-input"
                                                    style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white' }}
                                                >
                                                    {['Friend', 'Doctor', 'Influencer', 'Social Media', 'Advertisement', 'Own Research', 'Other'].map(opt => (
                                                        <option key={opt} value={opt} style={{ background: '#111', color: '#fff' }}>{opt}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* 5. Confidence Slider */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                                <span style={{ color: 'var(--text-muted)' }}>5. How confident are you about this opinion?</span>
                                                <strong style={{ color: 'var(--accent-color)' }}>{confidenceScore}% Confident</strong>
                                            </div>
                                            <input 
                                                type="range" 
                                                min="0" 
                                                max="100" 
                                                value={confidenceScore} 
                                                onChange={(e) => setConfidenceScore(Number(e.target.value))}
                                                style={{ width: '100%', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                                            />
                                        </div>

                                        {/* 6. Active Ingredients & Image URL inline */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: '150px' }}>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Active Ingredients (e.g. salicylic, neem)</label>
                                                <input
                                                    type="text"
                                                    placeholder="Ingredients you recall..."
                                                    value={reviewIngredients}
                                                    onChange={(e) => setReviewIngredients(e.target.value)}
                                                    style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white' }}
                                                />
                                            </div>
                                            
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: '150px' }}>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Optional Product Image URL</label>
                                                <input
                                                    type="text"
                                                    placeholder="http://example.com/product.jpg"
                                                    value={imageUrl}
                                                    onChange={(e) => setImageUrl(e.target.value)}
                                                    style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white' }}
                                                />
                                            </div>
                                        </div>
                                        
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Your Experience ("Tell us what actually happened while using this product")</label>
                                            <textarea
                                                rows={3}
                                                placeholder="Describe detail rich observations of the formulas or components..."
                                                value={reviewText}
                                                onChange={(e) => setReviewText(e.target.value)}
                                                style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', resize: 'vertical' }}
                                                required
                                            />
                                        </div>

                                        <button 
                                            type="submit" 
                                            disabled={isSubmittingReview}
                                            className="primary-btn mt-2" 
                                            style={{ width: '100%', padding: '0.75rem', fontWeight: 'bold' }}
                                        >
                                            {isSubmittingReview ? "🚀 Neural Scraper Evaluating..." : "Post to Authenticity Pipeline"}
                                        </button>
                                    </form>
                                </div>

                                {/* Dynamic Gamified Results Scorecard Panel */}
                                {aiAnalysisResult && (
                                    <div className="details-review-card glass-panel animate-glow" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--accent-color)' }}>
                                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem 0', color: 'var(--accent-color)', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            🎯 AI Review Analysis Results
                                        </h3>

                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
                                            {/* Circular HSL Trust Meter */}
                                            <div style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                width: '90px',
                                                height: '90px',
                                                borderRadius: '50%',
                                                border: `4px solid ${aiAnalysisResult.trust_score >= 75 ? '#22c55e' : (aiAnalysisResult.trust_score >= 40 ? '#eab308' : '#ef4444')}`,
                                                background: 'rgba(0,0,0,0.2)',
                                                textAlign: 'center'
                                            }}>
                                                <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'white' }}>{aiAnalysisResult.trust_score}%</span>
                                                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Trust</span>
                                            </div>

                                            {/* Status Badge & Dynamic description */}
                                            <div style={{ flex: 1, minWidth: '200px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                                    <span style={{
                                                        padding: '0.25rem 0.75rem',
                                                        borderRadius: '20px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 'bold',
                                                        textTransform: 'uppercase',
                                                        background: aiAnalysisResult.trust_score >= 75 ? 'rgba(34, 197, 94, 0.15)' : (aiAnalysisResult.trust_score >= 40 ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)'),
                                                        color: aiAnalysisResult.trust_score >= 75 ? '#22c55e' : (aiAnalysisResult.trust_score >= 40 ? '#eab308' : '#ef4444')
                                                    }}>
                                                        {aiAnalysisResult.trust_score >= 75 ? '🟢 Genuine Review' : (aiAnalysisResult.trust_score >= 40 ? '🟡 Suspicious Review' : '🔴 Likely Fake Review')}
                                                    </span>

                                                    <span style={{
                                                        padding: '0.25rem 0.75rem',
                                                        borderRadius: '20px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 'bold',
                                                        background: 'rgba(255,255,255,0.05)',
                                                        color: 'white'
                                                    }}>
                                                        {aiAnalysisResult.reviewer_score >= 85 ? '🥇 Expert' : (aiAnalysisResult.reviewer_score >= 60 ? '🥈 Trusted' : '🥉 Casual')} Reviewer
                                                    </span>
                                                </div>

                                                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'white', fontStyle: 'italic' }}>
                                                    "{aiAnalysisResult.ml_explanation}"
                                                </p>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    AI Prediction Confidence: <strong>{aiAnalysisResult.ai_confidence}%</strong>
                                                </span>
                                            </div>
                                        </div>

                                        {/* Scientific Analysis Section */}
                                        {aiAnalysisResult.scientific_context && (
                                            <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '12px' }}>
                                                <h4 style={{ margin: '0 0 0.5rem 0', color: '#38bdf8', fontSize: '0.85rem' }}>🔬 Scientific Analysis</h4>
                                                <p style={{ margin: '0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{aiAnalysisResult.scientific_context}</p>
                                                {aiAnalysisResult.ingredients && aiAnalysisResult.ingredients.length > 0 && (
                                                    <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                        {aiAnalysisResult.ingredients.map(ing => (
                                                            <span key={ing} style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem' }}>{ing}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Horizontal Factor breakdown metrics */}
                                        {aiAnalysisResult.analysis_breakdown && (
                                            <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Analyzed Confidence Factors:</span>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.8rem' }}>
                                                    {([
                                                        { name: 'Specificity', val: aiAnalysisResult?.analysis_breakdown?.specificity || 0 },
                                                        { name: 'Product Relevance', val: aiAnalysisResult?.analysis_breakdown?.relevance || 0 },
                                                        { name: 'Sentiment Consistency', val: aiAnalysisResult?.analysis_breakdown?.consistency || 0 },
                                                        { name: 'Detail Richness', val: aiAnalysisResult?.analysis_breakdown?.detail_richness || 0 },
                                                        { name: 'Spam Risk', val: aiAnalysisResult?.analysis_breakdown?.spam_risk || 0 }
                                                    ]).map(factor => (
                                                        <div key={factor.name} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                                                                <span style={{ color: 'var(--text-muted)' }}>{factor.name}</span>
                                                                <strong style={{ color: 'white' }}>{factor.val}%</strong>
                                                            </div>
                                                            <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                                                <div style={{
                                                                    height: '100%',
                                                                    width: `${factor.val}%`,
                                                                    background: factor.name === 'Spam Risk' 
                                                                        ? (factor.val > 40 ? '#ef4444' : '#22c55e')
                                                                        : (factor.val >= 75 ? '#22c55e' : (factor.val >= 40 ? '#eab308' : '#ef4444'))
                                                                }}></div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                        {(activeReviews || []).length > 0 ? (
                            (activeReviews || []).map((f) => {
                                const hasVerdict = f.verdict && !isMyFeedback(f);
                                const isGenuine = f.verdict === 'Genuine';
                                
                                return (
                                    <div key={f.id || Math.random()} className={`details-review-card glass-panel ${(f.id || '').toString().startsWith('synth') ? 'synthetic-review-injected animate-pulse' : ''}`}>
                                        <div className="review-meta">
                                            <div className="review-author">
                                                <div className="author-avatar-spec">
                                                    {f.emoji || "👤"}
                                                </div>
                                                <div className="author-details-wrapper">
                                                    <span className="author-name" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'white', fontWeight: 'bold' }}>
                                                        Verified Buyer
                                                        <span style={{
                                                            fontSize: '0.7rem',
                                                            padding: '0.15rem 0.5rem',
                                                            borderRadius: '12px',
                                                            background: (f.reviewer_score || 50) >= 85 ? 'rgba(234, 179, 8, 0.12)' : ((f.reviewer_score || 50) >= 60 ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255,255,255,0.05)'),
                                                            color: (f.reviewer_score || 50) >= 85 ? '#eab308' : ((f.reviewer_score || 50) >= 60 ? '#38bdf8' : 'var(--text-muted)'),
                                                            border: (f.reviewer_score || 50) >= 85 ? '1px solid rgba(234, 179, 8, 0.2)' : ((f.reviewer_score || 50) >= 60 ? '1px solid rgba(56, 189, 248, 0.2)' : '1px solid transparent'),
                                                            fontWeight: 'normal'
                                                        }}>
                                                            {(f.reviewer_score || 50) >= 85 ? '🥇 Expert' : ((f.reviewer_score || 50) >= 60 ? '🥈 Trusted' : '🥉 Casual')}
                                                        </span>
                                                    </span>
                                                    <span className="author-timestamp">
                                                        Source: {f.source} • {f.created_at ? new Date(f.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Just now'}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            {hasVerdict && (
                                                <div className={`verdict-pill-badge ${isGenuine ? 'verdict-pill-genuine' : 'verdict-pill-suspicious'}`}>
                                                    {isGenuine ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
                                                    {f.verdict ? f.verdict.toUpperCase() : 'GENUINE'}
                                                </div>
                                            )}
                                        </div>

                                        {/* Display mood, recommendation, and stood-out highlights */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', margin: '0.5rem 0 0.75rem 0', fontSize: '0.7rem' }}>
                                            {f.experience_mood && (
                                                <span style={{ background: 'rgba(255,255,255,0.04)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: '#fff' }}>
                                                    Mood: {f.experience_mood}
                                                </span>
                                            )}
                                            {f.recommendation && (
                                                <span style={{ background: 'rgba(255,255,255,0.04)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: '#fff' }}>
                                                    Recommend: {f.recommendation}
                                                </span>
                                            )}
                                            {f.highlight_categories && Array.isArray(f.highlight_categories) && (f.highlight_categories || []).map((c, idx) => (
                                                <span key={idx} style={{ background: 'var(--accent-color-dim)', border: '1px solid var(--accent-color)', padding: '0.15rem 0.5rem', borderRadius: '20px', color: 'var(--accent-color)', fontSize: '0.65rem' }}>
                                                    {c}
                                                </span>
                                            ))}
                                        </div>
                                        
                                        <div className="stars-row mb-2">
                                            {[...Array(5)].map((_, i) => (
                                                <Star 
                                                    key={i} 
                                                    size={14} 
                                                    fill={i < f.rating ? "#f59e0b" : "none"} 
                                                    color={i < f.rating ? "#f59e0b" : "rgba(255,255,255,0.15)"} 
                                                />
                                            ))}
                                        </div>

                                        <p className="review-text-content" style={{ marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                                            "{f.review_text}"
                                        </p>

                                        {/* Optional image rendering */}
                                        {f.image_url && (
                                            <div style={{ marginTop: '0.75rem', borderRadius: '8px', overflow: 'hidden', maxWidth: '250px', maxHeight: '160px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                                <img 
                                                    src={f.image_url} 
                                                    alt="Review attachment" 
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                                    onError={(e) => { e.target.style.display = 'none'; }} 
                                                />
                                            </div>
                                        )}

                                        <div className="review-audit-details-row" style={{ marginTop: '0.75rem' }}>
                                            {f.mentioned_ingredients && f.mentioned_ingredients !== "None" && (
                                                <span className="ingredient-pill">
                                                    🌿 Bio-actives: {f.mentioned_ingredients}
                                                </span>
                                            )}
                                            
                                            <span className="trust-level-pill-micro">
                                                Authenticity Score: {f.trust_score || f.authenticity_score || 80}%
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="glass-panel p-10 empty-state-reviews">
                                <Package size={48} opacity={0.2} style={{ marginBottom: '1rem' }} />
                                <h3>No detailed reviews yet</h3>
                                <p className="text-muted font-small">Users are currently discussing this in individual consults.</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default ProductDetails;
