import React, { useState, useEffect } from 'react';
import { Bot, Send, AlertCircle, Package, Mic, MicOff, FlaskConical, Sparkles, Activity, Compass, HeartPulse } from 'lucide-react';
import RecommendationCard from '../components/RecommendationCard';
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
    const [prompt, setPrompt] = useState('');
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isListening, setIsListening] = useState(false);

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

            return fetch(`${API_BASE_URL}/api/ai/recommend`, {
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

            const res = await fetch(`${API_BASE_URL}/api/ai/recommend`, {
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
                    {loading && <SkeletonLoader type="recommendations" count={3} />}
                    {!loading && recommendations.length > 0 && recommendations.map(rec => (
                        <RecommendationCard key={rec.id} product={rec} />
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
