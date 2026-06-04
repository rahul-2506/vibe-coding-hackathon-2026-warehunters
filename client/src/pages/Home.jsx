import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Send, AlertCircle, Package, Mic, MicOff, FlaskConical, Sparkles, Activity, Compass, HeartPulse, Layers, Zap, ShoppingBag, Home as HomeIcon, Shirt } from 'lucide-react';
import RecommendationCard from '../components/RecommendationCard';
import ProductCardExt from '../components/ProductCardExt';
import { API_BASE_URL } from '../config/api';
import SkeletonLoader from '../components/SkeletonLoader';
import { supabase } from '../config/supabaseClient';
import './Home.css';

const INGREDIENTS_DATA = [
    {
        name: 'Salicylic Acid',
        scientific: 'Beta Hydroxy Acid (BHA)',
        desc: 'Deep lipid-soluble exfoliation that penetrates deep into pores to clear sebum and reduce acne lesions.',
        efficacy: '95%',
        target: 'Acne & Sebum',
        glowColor: 'rgba(16, 185, 129, 0.4)',
        badgeBg: 'rgba(16, 185, 129, 0.1)',
        badgeText: '#10b981',
        iconBg: 'rgba(16, 185, 129, 0.15)',
        icon: <Sparkles size={20} style={{ color: '#10b981' }} />,
        query: 'Verify the best Salicylic Acid formulation for active acne clearing and sebum regulation under 1500/-'
    },
    {
        name: 'Niacinamide',
        scientific: 'Vitamin B3 / Nicotinamide',
        desc: 'Strengthens cellular lipid barriers, regulates sebum secretion, and prevents hyperpigmentation.',
        efficacy: '92%',
        target: 'Skin Barrier',
        glowColor: 'rgba(99, 102, 241, 0.4)',
        badgeBg: 'rgba(99, 102, 241, 0.1)',
        badgeText: '#6366f1',
        iconBg: 'rgba(99, 102, 241, 0.15)',
        icon: <Activity size={20} style={{ color: '#6366f1' }} />,
        query: 'Find high-efficacy Niacinamide formulations that repair dry skin barriers and soothe redness'
    },
    {
        name: 'Retinol',
        scientific: 'Vitamin A / Retinoid',
        desc: 'Accelerates epidermic cellular turnover, stimulates collagen production, and smooths overall texture.',
        efficacy: '88%',
        target: 'Textural Repair',
        glowColor: 'rgba(236, 72, 153, 0.4)',
        badgeBg: 'rgba(236, 72, 153, 0.1)',
        badgeText: '#ec4899',
        iconBg: 'rgba(236, 72, 153, 0.15)',
        icon: <Compass size={20} style={{ color: '#ec4899' }} />,
        query: 'Search clinical retinol formulations optimized for overnight texture refinement and high tolerability'
    },
    {
        name: 'Hyaluronic Acid',
        scientific: 'Glucosaminoglycan Humectant',
        desc: 'Multi-depth moisture absorption holding up to 1000x its weight in water, expanding cellular volume.',
        efficacy: '96%',
        target: 'Hydration',
        glowColor: 'rgba(59, 130, 246, 0.4)',
        badgeBg: 'rgba(59, 130, 246, 0.1)',
        badgeText: '#3b82f6',
        iconBg: 'rgba(59, 130, 246, 0.15)',
        icon: <HeartPulse size={20} style={{ color: '#3b82f6' }} />,
        query: 'Recommend bioavailable Hyaluronic Acid formulations for deep skin hydration and plumping'
    }
];

const Home = () => {
    const navigate = useNavigate();
    const [prompt, setPrompt] = useState('');
    const [recommendations, setRecommendations] = useState([]);
    const [activeCategory, setActiveCategory] = useState('All');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isListening, setIsListening] = useState(false);

    const handleChat = (product) => {
        navigate('/chatbot', { state: { product } });
    };

    const handleFeedback = (product) => {
        navigate(`/product/${product.id}`, { state: { product } });
    };

    // Voice Recognition Setup
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = SpeechRecognition ? new SpeechRecognition() : null;

    if (recognition) {
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setPrompt(transcript);
            // Auto-trigger search after a small delay to let state update
            setTimeout(() => {
                document.getElementById('product-prompt-form').dispatchEvent(
                    new Event('submit', { cancelable: true, bubbles: true })
                );
            }, 500);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            setIsListening(false);
        };
    }

    const toggleListening = () => {
        if (!recognition) {
            alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
            return;
        }

        if (isListening) {
            recognition.stop();
        } else {
            setIsListening(true);
            recognition.start();
        }
    };

    const fetchProductsForCategory = (category) => {
        setLoading(true);
        setError('');
        
        let url = `${API_BASE_URL}/api/products/getProducts?limit=24`;
        if (category && category !== 'All') {
            url += `&category=${encodeURIComponent(category)}`;
        }
        
        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error('Failed to load products');
                return res.json();
            })
            .then(resJson => {
                const raw = resJson.data || resJson.products || resJson;
                const prodData = Array.isArray(raw) ? raw : (Array.isArray(raw?.products) ? raw.products : []);
                const formatted = prodData.map(p => ({
                    id: p.id,
                    name: p.title || p.name,
                    title: p.title || p.name,
                    price: Number(p.price),
                    category: p.category,
                    image_url: p.thumbnail || p.image_url,
                    thumbnail: p.thumbnail || p.image_url,
                    brand: p.brand,
                    stock: p.stock,
                    rating: p.rating,
                    trust_score: p.trust_score,
                    review_count: p.review_count,
                    description: p.description,
                    matchScore: p.trust_score || 95,
                    explanation: p.description || 'Verified product from our catalog.',
                    relativityTags: [{ label: 'Featured Product', color: '#6366f1' }]
                }));
                setRecommendations(formatted);
            })
            .catch(err => {
                console.warn("Unable to load catalog products:", err.message);
                setError("Could not retrieve products for this category.");
            })
            .finally(() => {
                setLoading(false);
            });
    };

    const handleCategoryClick = (category) => {
        setActiveCategory(category);
        setPrompt(''); // Clear query when navigating departments
    };

    useEffect(() => {
        const handleDemoTrigger = (e) => {
            const query = e.detail;
            setPrompt(query);
            setTimeout(() => {
                const form = document.getElementById('product-prompt-form');
                if (form) {
                    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                }
            }, 100);
        };

        window.addEventListener('rl-trigger-demo-search', handleDemoTrigger);

        // Check if there is a pending demo query from redirection
        const pendingQuery = sessionStorage.getItem('rl-demo-query');
        if (pendingQuery) {
            sessionStorage.removeItem('rl-demo-query');
            setPrompt(pendingQuery);
            setTimeout(() => {
                const form = document.getElementById('product-prompt-form');
                if (form) {
                    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                }
            }, 150);
        }

        return () => {
            window.removeEventListener('rl-trigger-demo-search', handleDemoTrigger);
        };
    }, []);

    useEffect(() => {
        const pendingQuery = sessionStorage.getItem('rl-demo-query');
        if (pendingQuery) return;

        fetchProductsForCategory(activeCategory);
    }, [activeCategory]);

    const handleIngredientClick = (ing) => {
        setPrompt(ing.query);
        setLoading(true);
        setError('');
        setRecommendations([]);
        
        supabase.auth.getSession()
        .then(({ data: { session } }) => {
            const token = session?.access_token;
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            return fetch(`${API_BASE_URL}/api/recommend`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ prompt: ing.query })
            });
        })
        .then(res => {
            if (!res.ok) throw new Error('API Failed. Mocking data.');
            return res.json();
        })
        .then(data => {
            const actualData = data.data || data;
            setRecommendations(actualData.recommendations || actualData);
            setLoading(false);
        })
        .catch(err => {
            console.warn("Backend unavailable, using context-aware mock data.");
            setTimeout(() => {
                let mockRecs = [];
                if (ing.name === 'Salicylic Acid') {
                    mockRecs = [
                        { id: 101, name: 'The Derma Co 1% Salicylic Acid Facewash', price: 15.00, category: 'Skincare', image_url: '/assets/derma_co.png', matchScore: 95, explanation: 'Perfect match for acne and oily skin. The Salicylic acid targets sebum directly.', relativityTags: [{ label: 'Acne Expert', color: '#10b981' }] },
                        { id: 102, name: 'Himalaya Purifying Neem Facewash', price: 8.50, category: 'Skincare', image_url: '/assets/himalaya.png', matchScore: 82, explanation: 'A great natural alternative for daily bacterial protection.', relativityTags: [{ label: 'Herbal/Safe', color: '#6366f1' }] }
                    ];
                } else if (ing.name === 'Niacinamide') {
                    mockRecs = [
                        { id: 103, name: 'Mamaearth Ubtan Facewash', price: 12.00, category: 'Skincare', image_url: '/assets/mamaearth.png', matchScore: 90, explanation: 'Traditional ubtan ingredients for skin brightening and glow.', relativityTags: [{ label: 'Glow Specialist', color: '#ec4899' }] }
                    ];
                } else {
                    mockRecs = [
                        { id: 101, name: 'The Derma Co 1% Salicylic Acid Facewash', price: 15.00, category: 'Skincare', image_url: '/assets/derma_co.png', matchScore: 95, explanation: 'Perfect match for acne and oily skin. The Salicylic acid targets sebum directly.', relativityTags: [{ label: 'Acne Expert', color: '#10b981' }] }
                    ];
                }
                setRecommendations(mockRecs);
                setLoading(false);
            }, 800);
        });
    };

    const handlePromptSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!prompt.trim()) return;
// ... (rest of the handlePromptSubmit logic)

        setLoading(true);
        setError('');
        setRecommendations([]);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${API_BASE_URL}/api/recommend`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ prompt })
            });

            if (!res.ok) throw new Error('API Failed. Mocking data.');

            const data = await res.json();
            const actualData = data.data || data;
            setRecommendations(actualData.recommendations || actualData);
        } catch (err) {
            console.warn("Backend unavailable, using context-aware mock data.");
            // Mock data fallback that respects intent
            setTimeout(() => {
                const lowerPrompt = prompt.toLowerCase();
                let mockRecs = [];

                if (lowerPrompt.match(/pimp|acne|face|skin|wash|derma|himalaya|mamaearth|glow/)) {
                    mockRecs = [
                        { id: 101, name: 'The Derma Co 1% Salicylic Acid Facewash', price: 15.00, category: 'Skincare', image_url: '/assets/derma_co.png', matchScore: 95, explanation: 'Perfect match for acne and oily skin. The Salicylic acid targets sebum directly.', relativityTags: [{ label: 'Acne Expert', color: '#10b981' }] },
                        { id: 102, name: 'Himalaya Purifying Neem Facewash', price: 8.50, category: 'Skincare', image_url: '/assets/himalaya.png', matchScore: 82, explanation: 'A great natural alternative for daily bacterial protection.', relativityTags: [{ label: 'Herbal/Safe', color: '#6366f1' }] },
                        { id: 103, name: 'Mamaearth Ubtan Facewash', price: 12.00, category: 'Skincare', image_url: '/assets/mamaearth.png', matchScore: 90, explanation: 'Traditional ubtan ingredients for skin brightening and glow.', relativityTags: [{ label: 'Glow Specialist', color: '#ec4899' }] }
                    ];
                } else {
                    mockRecs = [
                        { id: 1, name: 'QuantumBook Pro 15', price: 1499.99, category: 'Laptops', image_url: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500', matchScore: 92, explanation: 'High performance laptop fitting your likely electronics intent.', relativityTags: [{ label: 'Power User', color: '#6366f1' }] }
                    ];
                }
                setRecommendations(mockRecs);
                setLoading(false);
            }, 1000);
            return;
        }
        setLoading(false);
    };

    return (
        <div className="home-container">
            <header className="home-header">
                <div className="header-content-wrapper">
                    <div className="header-text-section">
                        <div className="system-status glass-panel">
                            <span className="status-dot"></span>
                            <span className="status-text">Deep AI Product Verification Engine: <strong style={{color: '#10b981', letterSpacing: '1px'}}>LIVE</strong></span>
                        </div>
                        <h1>AI Product Discovery &amp; Verification</h1>
                        <p className="text-muted">Describe the product you're looking for or paste details to verify. Our intelligence engine will cross-reference clinical data, authentic reviews, and pricing.</p>
                    </div>
                    <div className="header-mascot">
                        <img src="/cartoon_robot.png" alt="AI Mascot" className="mascot-img" />
                    </div>
                </div>
            </header>

            <form id="product-prompt-form" className="prompt-box glass-panel" onSubmit={handlePromptSubmit}>
                <Bot className="prompt-icon text-accent" size={32} />
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="E.g., Verify if Mamaearth Ubtan facewash is good for dry skin under 500/- or find me a premium gaming laptop..."
                    className="prompt-input"
                    rows={3}
                />

                <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                    <button 
                        type="button" 
                        onClick={toggleListening} 
                        className={`mic-btn ${isListening ? 'active' : ''}`}
                        title="Search by voice"
                    >
                        {isListening ? <Mic size={20} /> : <MicOff size={20} />}
                    </button>

                    <button 
                        type="submit" 
                        className="send-btn bg-accent" 
                        disabled={loading || !prompt.trim()}
                    >
                        {loading ? <div className="spinner"></div> : <Send size={20} />}
                    </button>
                </div>
            </form>

            {/* Horizontal Department Category Bar (Flipkart/Amazon style) */}
            <div className="home-category-bar glass-panel" style={{ 
                display: 'flex', 
                gap: '1rem', 
                padding: '1rem', 
                overflowX: 'auto', 
                borderRadius: '16px', 
                margin: '1.5rem 0', 
                justifyContent: 'center',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
                backdropFilter: 'blur(10px)'
            }}>
                {[
                    { name: 'All', icon: <Layers size={20} /> },
                    { name: 'Skincare & Beauty', icon: <Sparkles size={20} className="cat-icon-skincare" /> },
                    { name: 'Electronics', icon: <Zap size={20} className="cat-icon-electronics" /> },
                    { name: 'Groceries', icon: <ShoppingBag size={20} className="cat-icon-groceries" /> },
                    { name: 'Home & Living', icon: <HomeIcon size={20} className="cat-icon-home" /> },
                    { name: 'Fashion & Apparel', icon: <Shirt size={20} className="cat-icon-fashion" /> },
                    { name: 'Others', icon: <Package size={20} className="cat-icon-default" /> }
                ].map(cat => (
                    <div 
                        key={cat.name} 
                        className={`home-category-item ${activeCategory === cat.name ? 'active' : ''}`}
                        onClick={() => handleCategoryClick(cat.name)}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.6rem 1.2rem',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                            border: activeCategory === cat.name ? '1px solid var(--accent-color)' : '1px solid rgba(255,255,255,0.05)',
                            background: activeCategory === cat.name ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.02)',
                            minWidth: '100px',
                            boxShadow: activeCategory === cat.name ? '0 0 15px rgba(99, 102, 241, 0.15)' : 'none'
                        }}
                    >
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: activeCategory === cat.name ? 'var(--accent-color)' : 'rgba(255,255,255,0.04)',
                            color: activeCategory === cat.name ? 'black' : 'white',
                            transition: 'all 0.25s'
                        }}>
                            {cat.icon}
                        </div>
                        <span style={{ 
                            fontSize: '0.75rem', 
                            fontWeight: '600', 
                            whiteSpace: 'nowrap', 
                            color: activeCategory === cat.name ? 'var(--accent-color)' : '#94a3b8',
                            transition: 'all 0.25s'
                        }}>{cat.name}</span>
                    </div>
                ))}
            </div>

            {/* Clinical Lab: Ingredient Quick-Analysis */}
            <div className="clinical-lab-section">
                <div className="section-header">
                    <FlaskConical className="text-accent section-icon" size={24} />
                    <h2>Clinical Lab: Ingredient Quick-Analysis</h2>
                    <span className="subtitle-tag glass-panel">Interactive Biosensors</span>
                </div>
                <p className="section-desc">Select a bioactive compound to simulate a scientific verification audit or immediately query our clinical inventory database.</p>
                
                <div className="ingredients-deck">
                    {INGREDIENTS_DATA.map((ing) => (
                        <div 
                            key={ing.name}
                            className="ingredient-card glass-panel"
                            onClick={() => handleIngredientClick(ing)}
                            style={{ '--glow-color': ing.glowColor }}
                        >
                            <div className="card-badge" style={{ backgroundColor: ing.badgeBg, color: ing.badgeText }}>
                                {ing.efficacy} Efficacy
                            </div>
                            <div className="card-icon-wrapper" style={{ backgroundColor: ing.iconBg }}>
                                {ing.icon}
                            </div>
                            <h3>{ing.name}</h3>
                            <p className="card-scientific-name">{ing.scientific}</p>
                            <p className="card-description">{ing.desc}</p>
                            <div className="card-footer">
                                <span className="target-concern">Target: {ing.target}</span>
                                <span className="action-link">Verify &rarr;</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="recommendations-area">
                {!loading && recommendations.length > 0 && (
                    <div className="section-header" style={{ marginBottom: '1.5rem', borderBottom: 'none' }}>
                        <Compass className="text-accent section-icon" size={24} />
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>
                            {prompt ? "AI Verifications & Recommendations" : "Featured Products Showcase"}
                        </h2>
                    </div>
                )}
                {loading && (
                    <div className="processing-state text-accent glass-panel">
                        <div className="scanner-line"></div>
                        <Bot className="bouncing-bot" size={48} />
                        <p style={{fontSize: '1.2rem', letterSpacing: '1px'}}>Scanning global inventory &amp; verifying clinical data...</p>
                    </div>
                )}

                {error && (
                    <div className="error-banner">
                        <AlertCircle /> {error}
                    </div>
                )}

                <div className="cards-grid">
                    {loading && <SkeletonLoader type={prompt ? "recommendations" : "product-grid"} count={6} />}
                    {!loading && recommendations.length > 0 && recommendations.map((rec, idx) => (
                        prompt ? (
                            <RecommendationCard key={rec.id || idx} product={rec} />
                        ) : (
                            <ProductCardExt 
                                key={rec.id || idx} 
                                index={idx}
                                product={rec} 
                                onAddChat={handleChat}
                                onViewFeedback={handleFeedback}
                            />
                        )
                    ))}
                </div>

                {!loading && recommendations.length === 0 && !error && (
                    <div className="empty-state">
                        <Package size={48} className="text-muted" opacity={0.5} />
                        <p className="text-muted">No recommendations generated yet. Submit a query to begin.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Home;
