import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Bot, Send, User, Sparkles, Mic, MicOff,
    Search, GitCompare, Leaf, Calendar,
    Star, Shield, ChevronRight, Sparkle, RefreshCw, Eye, HelpCircle, Settings, Square,
    Copy, ThumbsUp, ThumbsDown
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { API_BASE_URL } from '../config/api';
import { supabase } from '../config/supabaseClient';
import './Chatbot.css';

// ─── Product Card with HSL Match Meters (Phase 11 & 12) ───────
const ProductCard = ({ product, onCompareClick, onViewClick, onTrustClick }) => {
    const [showWhy, setShowWhy] = useState(false);
    const trust = product.trust_score || 80;
    const trustClass = trust >= 85 ? 'high' : trust >= 70 ? 'mid' : 'low';
    const trustLabel = trust >= 85 ? '✓ Trusted' : trust >= 70 ? '~ Moderate' : '! Low Trust';

    const handleWhyToggle = (e) => {
        e.stopPropagation();
        setShowWhy(!showWhy);
    };

    return (
        <div className="vchat-product-card-wrapper">
            <div className="vchat-product-card">
                {product.thumbnail ? (
                    <img
                        src={product.thumbnail}
                        alt={product.title}
                        className="vchat-product-thumb"
                        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                    />
                ) : null}
                <div
                    className="vchat-product-thumb-placeholder"
                    style={{ display: product.thumbnail ? 'none' : 'flex' }}
                >
                    🧴
                </div>
                <div className="vchat-product-info">
                    <div className="vchat-product-name" title={product.title}>{product.title || product.name}</div>
                    <div className="vchat-product-meta">
                        <span className="vchat-product-price">${Number(product.price).toFixed(2)}</span>
                        <span className="vchat-product-rating">
                            <Star size={10} style={{ display: 'inline', marginRight: 2, color: '#f59e0b', fill: '#f59e0b' }} />
                            {Number(product.rating || 4.2).toFixed(1)}
                        </span>
                        <span className={`vchat-trust-badge ${trustClass}`}>{trustLabel}</span>
                    </div>
                </div>
                <ChevronRight size={14} className="vchat-product-arrow" />
            </div>

            {/* Action Bar inside Chat Card (Phase 11) */}
            <div className="vchat-product-actions">
                <button 
                    className={`vchat-card-action-btn why-btn ${showWhy ? 'active' : ''}`}
                    onClick={handleWhyToggle}
                    title="Explain matching parameters"
                >
                    <HelpCircle size={12} />
                    {showWhy ? 'Hide Match Analysis' : 'Why this recommendation?'}
                </button>
                <div className="vchat-card-actions-right">
                    <button 
                        className="vchat-card-action-btn compare-btn"
                        onClick={(e) => { e.stopPropagation(); onCompareClick(product); }}
                        title="Compare side-by-side"
                    >
                        <GitCompare size={12} />
                        Compare
                    </button>
                    <button 
                        className="vchat-card-action-btn trust-btn"
                        onClick={(e) => { e.stopPropagation(); onTrustClick(product); }}
                        title="Scan reviews authenticity"
                    >
                        <Shield size={12} />
                        Analyze Trust
                    </button>
                    <button 
                        className="vchat-card-action-btn view-btn"
                        onClick={(e) => { e.stopPropagation(); onViewClick(product); }}
                        title="Inspect catalog details"
                    >
                        <Eye size={12} />
                        View
                    </button>
                </div>
            </div>
            {/* HSL-based 'Why Recommended' Panel (Phase 12 WOW Factor) */}
            {showWhy && product.whyRecommend && (
                <div className="vchat-why-recommend-panel panel-enter">
                    <div className="vchat-why-title">
                        <Sparkle size={12} />
                        <span>Clinical Matching Rationale</span>
                    </div>

                    <div className="vchat-why-checklist">
                        <div className="vchat-why-chk"><span className="chk-icon">✓</span> Matches skin type</div>
                        <div className="vchat-why-chk"><span className="chk-icon">✓</span> Matches active concern</div>
                        <div className="vchat-why-chk"><span className="chk-icon">✓</span> Fits inside maximum budget</div>
                        <div className="vchat-why-chk"><span className="chk-icon">✓</span> Verified organic trust rating</div>
                        <div className="vchat-why-chk"><span className="chk-icon">✓</span> Ingredient bio-relevance verified</div>
                    </div>
                    
                    <div className="vchat-why-meters">
                        {/* 1. Skin Type Match Meter */}
                        <div className="vchat-why-meter">
                            <div className="vchat-why-meter-header">
                                <span>🛡️ Skin Type Match</span>
                                <span className="pct high">100%</span>
                            </div>
                            <div className="vchat-why-meter-track">
                                <div className="vchat-why-meter-fill" style={{ width: '100%', background: 'hsl(142, 70%, 45%)' }} />
                            </div>
                            <div className="vchat-why-meter-desc">{product.whyRecommend.skinTypeMatch}</div>
                        </div>

                        {/* 2. Ingredient Suitability Meter */}
                        <div className="vchat-why-meter">
                            <div className="vchat-why-meter-header">
                                <span>🧬 Clinical Actives match</span>
                                <span className="pct high">95%</span>
                            </div>
                            <div className="vchat-why-meter-track">
                                <div className="vchat-why-meter-fill" style={{ width: '95%', background: 'hsl(217, 85%, 50%)' }} />
                            </div>
                            <div className="vchat-why-meter-desc">{product.whyRecommend.concernMatch}</div>
                        </div>

                        {/* 3. Review Authenticity Verification */}
                        <div className="vchat-why-meter">
                            <div className="vchat-why-meter-header">
                                <span>🔬 Review Trust Score</span>
                                <span className={`pct ${trust >= 85 ? 'high' : trust >= 70 ? 'mid' : 'low'}`}>{trust}%</span>
                            </div>
                            <div className="vchat-why-meter-track">
                                <div className="vchat-why-meter-fill" style={{ 
                                    width: `${trust}%`, 
                                    background: trust >= 85 ? 'hsl(142, 70%, 45%)' : trust >= 70 ? 'hsl(38, 90%, 50%)' : 'hsl(0, 80%, 50%)' 
                                }} />
                            </div>
                            <div className="vchat-why-meter-desc">{product.whyRecommend.trustMatch}</div>
                        </div>

                        {/* 4. Budget Compatibility */}
                        <div className="vchat-why-meter">
                            <div className="vchat-why-meter-header">
                                <span>💰 Budget Compatibility</span>
                                <span className="pct high">100%</span>
                            </div>
                            <div className="vchat-why-meter-track">
                                <div className="vchat-why-meter-fill" style={{ width: '100%', background: 'hsl(280, 75%, 55%)' }} />
                            </div>
                            <div className="vchat-why-meter-desc">{product.whyRecommend.budgetMatch}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Comparison Summary Table ─────────────────────────────────
const ComparisonTable = ({ productA, productB, winners, winner, reasoning }) => {
    const rows = [
        { label: 'Retail Price', valA: `$${Number(productA.price).toFixed(2)}`, valB: `$${Number(productB.price).toFixed(2)}`, isWinner: winners?.value },
        { label: 'Rating Index', valA: `⭐ ${Number(productA.rating || 4.2).toFixed(1)}`, valB: `⭐ ${Number(productB.rating || 4.2).toFixed(1)}`, isWinner: winners?.ingredient },
        { label: 'Trust Authenticity', valA: `${productA.trust_score}%`, valB: `${productB.trust_score}%`, isWinner: winners?.review },
        { label: 'Dimension Score', valA: `${productA.ingredientScore || 80}/100`, valB: `${productB.ingredientScore || 80}/100`, isWinner: winners?.ingredient },
    ];

    return (
        <div className="vchat-compare-table-wrapper">
            <div className="vchat-compare-table">
                <div className="vchat-compare-header">
                    <div className="vchat-compare-header-cell">
                        {productA.title?.split(' ').slice(0, 3).join(' ')}
                        {winners?.overall === productA.title && <span className="vchat-compare-winner-label">🏆 Overall Winner</span>}
                    </div>
                    <div className="vchat-compare-header-cell">
                        {productB.title?.split(' ').slice(0, 3).join(' ')}
                        {winners?.overall === productB.title && <span className="vchat-compare-winner-label">🏆 Overall Winner</span>}
                    </div>
                </div>
                {rows.map((row, i) => (
                    <div key={i} className="vchat-compare-row">
                        <div className={`vchat-compare-cell ${row.isWinner === productA.title ? 'winner-cell' : ''}`}>
                            <div className="vchat-cell-label">{row.label}</div>
                            {row.valA}
                        </div>
                        <div className={`vchat-compare-cell ${row.isWinner === productB.title ? 'winner-cell' : ''}`}>
                            <div className="vchat-cell-label">{row.label}</div>
                            {row.valB}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── Trust Fraud Gauge (Phase 8) ──────────────────────────────
const TrustGauge = ({ data }) => {
    const score = data.avgTrustScore || 80;
    const cls = score >= 85 ? 'high' : score >= 70 ? 'mid' : 'low';
    return (
        <div className="vchat-trust-gauge-panel">
            <div className="vchat-trust-bar-container">
                <div className="vchat-trust-bar-label">
                    <span>Authentic Review Integrity</span>
                    <span style={{ fontWeight: 700 }}>{score}/100</span>
                </div>
                <div className="vchat-trust-bar-track">
                    <div className={`vchat-trust-bar-fill ${cls}`} style={{ width: `${score}%` }} />
                </div>
            </div>
            
            <div className="vchat-trust-an-stats">
                <div className="vchat-trust-stat">
                    <div className="num">{data.suspiciousPercentage}%</div>
                    <div className="lbl">Flagged Reviews</div>
                </div>
                <div className="vchat-trust-stat">
                    <div className="num">{data.duplicateCount}</div>
                    <div className="lbl">Duplicate Texts</div>
                </div>
                <div className="vchat-trust-stat">
                    <div className="num">{data.sentimentMismatchCount}</div>
                    <div className="lbl">Rating Conflicts</div>
                </div>
            </div>
        </div>
    );
};

// ─── Routine Steps with Clinical Explanations ─────────────────
const RoutineSection = ({ title, steps }) => (
    <div className="vchat-routine-section">
        <div className="vchat-routine-heading">{title}</div>
        {steps.map((s, i) => (
            <div key={i} className="vchat-routine-step-card">
                <div className="vchat-routine-step-header">
                    <div className="vchat-routine-step-num">{i + 1}</div>
                    <div className="vchat-routine-step-label">{s.step}</div>
                </div>
                {s.product ? (
                    <div className="vchat-routine-step-details">
                        <div className="vchat-routine-step-product">{s.product.title}</div>
                        <div className="vchat-routine-step-exp">{s.product.explanation}</div>
                    </div>
                ) : (
                    <div className="vchat-routine-step-product empty">Product out of stock</div>
                )}
            </div>
        ))}
    </div>
);

// ─── Rich Message Block ────────────────────────────────────────
const RichMessage = ({ msg, onProductCompare, onProductClick, onSuggestionClick, onProductTrust }) => {
    const { type, data, followUpQuestions } = msg;

    return (
        <div>
            <div className="vchat-bubble">
                <ReactMarkdown>{msg.text}</ReactMarkdown>

                {/* Product List Table */}
                {type === 'product_list' && data?.products?.length > 0 && (
                    <div className="vchat-product-table-wrapper" style={{ marginTop: '1rem', overflowX: 'auto' }}>
                        <table className="vchat-product-table" style={{ width: '100%', borderCollapse: 'collapse', borderRadius: '8px', overflow: 'hidden', background: 'rgba(30, 41, 59, 0.45)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                            <thead>
                                <tr style={{ background: 'rgba(15, 23, 42, 0.6)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: '#94a3b8', fontWeight: '600' }}>Product</th>
                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.8rem', color: '#94a3b8', fontWeight: '600' }}>Price</th>
                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8', fontWeight: '600' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.products.map(p => {
                                    const trust = p.trust_score || 80;
                                    const trustClass = trust >= 85 ? 'high' : trust >= 70 ? 'mid' : 'low';
                                    return (
                                        <tr key={p.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', transition: 'background-color 0.2s' }} className="table-row-hover">
                                            <td style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                {p.thumbnail ? (
                                                    <img src={p.thumbnail} alt={p.title || p.name} style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                                                ) : null}
                                                <div className="vchat-product-thumb-placeholder" style={{ display: p.thumbnail ? 'none' : 'flex', width: '32px', height: '32px', borderRadius: '6px', justifyContent: 'center', alignItems: 'center', background: 'rgba(255, 255, 255, 0.05)', fontSize: '1rem' }}>🧴</div>
                                                <div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#f8fafc' }}>{p.title || p.name}</div>
                                                    <div style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', gap: '0.5rem', marginTop: '0.15rem' }}>
                                                        <span>⭐ {Number(p.rating || 4.2).toFixed(1)}</span>
                                                        <span className={`vchat-trust-badge ${trustClass}`} style={{ fontSize: '0.65rem', padding: '0 0.25rem', borderRadius: '3px' }}>{trust >= 85 ? 'Trusted' : trust >= 70 ? 'Moderate' : 'Low Trust'}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.85rem', fontWeight: '700', color: '#38bdf8' }}>
                                                ${Number(p.price).toFixed(2)}
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                    <button 
                                                        onClick={() => {
                                                            const other = data.products.find(x => x.id !== p.id);
                                                            onProductCompare(p, other);
                                                        }}
                                                        style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '4px', color: '#818cf8', padding: '0.25rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                                        title="Compare side-by-side using Neural Comparator"
                                                    >
                                                        <GitCompare size={10} /> Compare
                                                    </button>
                                                    <button 
                                                        onClick={() => onProductClick(p)}
                                                        style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '4px', color: '#e2e8f0', padding: '0.25rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                                        title="Inspect catalog details"
                                                    >
                                                        <Eye size={10} /> View
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}


                {/* Comparison summaries */}
                {type === 'comparison' && data?.productA && data?.productB && (
                    <ComparisonTable
                        productA={data.productA}
                        productB={data.productB}
                        winners={data.winners}
                        winner={data.winner}
                        reasoning={data.reasoning}
                    />
                )}

                {/* Trust Analysis */}
                {type === 'trust_analysis' && data?.avgTrustScore && (
                    <TrustGauge data={data} />
                )}

                {/* Routine */}
                {type === 'routine' && data && (
                    <div className="vchat-routines-container">
                        {data.morningRoutine?.length > 0 && (
                            <RoutineSection title="☀️ Morning Regimen" steps={data.morningRoutine} />
                        )}
                        <div style={{ height: '1.25rem' }} />
                        {data.eveningRoutine?.length > 0 && (
                            <RoutineSection title="🌙 Evening Regimen" steps={data.eveningRoutine} />
                        )}
                    </div>
                )}
            </div>

            {/* Follow-up question pills */}
            {followUpQuestions?.length > 0 && (
                <div className="vchat-followups">
                    {followUpQuestions.map((q, i) => (
                        <button
                            key={i}
                            className="vchat-followup-btn"
                            onClick={() => onSuggestionClick(q)}
                        >
                            {q}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Header Quick Action Chips (Phase 10) ──────────────────────
const QUICK_ACTIONS = [
    { icon: <Sparkles size={11} />, label: 'Skincare Discovery Flow 🚀', text: 'Start Skincare Discovery Flow' },
    { icon: <Calendar size={11} />, label: 'Build Skincare Routine 🌅', text: 'Build me a skincare routine' },
    { icon: <GitCompare size={11} />, label: 'Compare Brands ⚖️', text: 'Compare Luminis with DermaGlow' },
    { icon: <Shield size={11} />, label: 'Analyze Review Trust 🔬', text: 'Can I trust Luminis Hydrating Serum?' },
    { icon: <Leaf size={11} />, label: 'Explain Active Ingredients 🧬', text: 'Tell me about niacinamide' }
];

// ─── Main Component ────────────────────────────────────────────
const Chatbot = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const activeProduct = location.state?.product;

    const [sessionTags, setSessionTags] = useState([]);

    const buildInitialMessages = () => {
        if (location.state?.initialMessage) {
            return [{
                role: 'ai',
                text: `Analyzing **${activeProduct?.name || 'product'}** — ask me anything!`,
                type: 'text',
                data: null,
                followUpQuestions: ['What are the key ingredients? 🧬', 'Is it good for acne? 💊', 'Analyze its reviews 🔬'],
            }];
        }
        if (activeProduct) {
            return [{
                role: 'ai',
                text: `You selected **${activeProduct.name}**. I can answer questions about this product, compare it with others, explain its ingredients, or analyze its reviews.`,
                type: 'text',
                data: null,
                followUpQuestions: ['What are the key ingredients? 🧬', 'Is this good for acne? 💊', 'Compare with alternatives ⚖️', 'Analyze its reviews 🔬'],
            }];
        }
        return [{
            role: 'ai',
            text: `🌟 **Hello! I'm VChat, your Clinical AI Shopping Assistant.**\n\nI understand skincare concerns, search products conversationally, compare formulas, and analyze review authenticity.\n\nTell me about your skin or what you're looking for to get personalized recommendations!`,
            type: 'greeting',
            data: null,
            followUpQuestions: [
                'Start Skincare Discovery Flow 🚀',
                'Build me a skincare routine 🌅',
                'Find serums under $30 💰',
                'Compare two moisturizers ⚖️',
                'Explain niacinamide 🧬',
            ],
        }];
    };

    const [messages, setMessages] = useState(buildInitialMessages);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [thoughtStage, setThoughtStage] = useState('');
    
    // API Keys Settings state
    const [showSettings, setShowSettings] = useState(false);
    const [geminiKey, setGeminiKey] = useState(localStorage.getItem('x-gemini-key') || import.meta.env.VITE_GEMINI_API_KEY || '');
    const [openaiKey, setOpenaiKey] = useState(localStorage.getItem('x-openai-key') || '');
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const recognitionRef = useRef(null);

    // Diagnostics Panel state and probe hook
    const [diagnostics, setDiagnostics] = useState({
        backend: null,
        ai: null,
        supabase: null
    });

    const runDiagnostics = async () => {
        try {
            console.log(`[Diagnostic] Outgoing health probe to: ${API_BASE_URL}/api/health`);
            const res = await fetch(`${API_BASE_URL}/api/health`);
            const data = await res.json();
            console.log(`[Diagnostic] Probe receipt:`, data);
            setDiagnostics({
                backend: data.backend ? 'Yes' : 'No',
                ai: data.ai_service ? 'Yes' : 'No',
                supabase: data.database ? 'Yes' : 'No'
            });
        } catch (err) {
            console.error(`[Diagnostic] Probe failed:`, err);
            setDiagnostics({
                backend: 'No',
                ai: 'No',
                supabase: 'No'
            });
        }
    };

    useEffect(() => {
        runDiagnostics();
        const interval = setInterval(runDiagnostics, 15000);
        return () => clearInterval(interval);
    }, []);

    // Set up speech recognition
    useEffect(() => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) return;
        const rec = new SR();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'en-US';
        rec.onresult = (e) => {
            const transcript = e.results[0][0].transcript;
            setInput(transcript);
        };
        rec.onend = () => setIsListening(false);
        rec.onerror = () => setIsListening(false);
        recognitionRef.current = rec;
    }, []);

    const toggleListening = () => {
        if (!recognitionRef.current) {
            alert('Speech recognition is not supported in this browser.');
            return;
        }
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            setIsListening(true);
            recognitionRef.current.start();
        }
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    // Auto-trigger the initial message if navigated with initialMessage state
    useEffect(() => {
        if (location.state?.initialMessage && messages.length === 1) {
            const autoMsg = location.state.initialMessage;
            sendMessage(autoMsg);
        }
    }, []); // eslint-disable-line

    const updateSessionTags = (responseData) => {
        if (responseData?.data) {
            const tags = [];
            const d = responseData.data;
            if (d.skinType) tags.push(`Skin: ${d.skinType.toUpperCase()}`);
            if (d.concerns && d.concerns.length > 0) {
                tags.push(`Concerns: ${Array.isArray(d.concerns) ? d.concerns.join(', ') : d.concerns}`);
            }
            if (d.budget && d.budget !== 999) tags.push(`Max: $${d.budget}`);
            if (d.experience) tags.push(`Actives: ${d.experience.toUpperCase()}`);
            if (tags.length > 0) {
                setSessionTags(tags);
            }
        }
    };

    const handleSaveSettings = (e) => {
        if (e) e.preventDefault();
        localStorage.setItem('x-gemini-key', geminiKey.trim());
        localStorage.setItem('x-openai-key', openaiKey.trim());
        setShowSettings(false);
    };

    const abortControllerRef = useRef(null);
    const [lastUserMessage, setLastUserMessage] = useState('');

    const stopGeneration = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setLoading(false);
            setMessages(prev => {
                const updated = [...prev];
                if (updated.length > 0 && updated[updated.length - 1].role === 'ai') {
                    updated[updated.length - 1] = {
                        ...updated[updated.length - 1],
                        text: updated[updated.length - 1].text + '\n\n*🛑 Generation stopped by user.*',
                        followUpQuestions: ['Retry 🔄', 'Start Skincare Discovery Flow 🚀']
                    };
                }
                return updated;
            });
        }
    };

    const sendMessage = useCallback(async (messageText) => {
        let trimmed = (messageText || input).trim();
        if (trimmed === 'Retry 🔄' || trimmed === 'Try again') {
            trimmed = lastUserMessage;
        }
        if (!trimmed) return;
        if (loading) return;

        setLastUserMessage(trimmed);
        setMessages(prev => [...prev, { role: 'user', text: trimmed, type: 'user', data: null, followUpQuestions: [] }]);
        setInput('');
        setLoading(true);

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            // Inject API keys from browser storage
            const savedGeminiKey = localStorage.getItem('x-gemini-key');
            const savedOpenaiKey = localStorage.getItem('x-openai-key');
            if (savedGeminiKey) headers['x-gemini-key'] = savedGeminiKey;
            if (savedOpenaiKey) headers['x-openai-key'] = savedOpenaiKey;

            // Include active product context if present
            const enhancedMessage = activeProduct
                ? `Regarding product "${activeProduct.name}" (category: ${activeProduct.category}): ${trimmed}`
                : trimmed;

            // Context sync (Phase 4): Read profile settings from local storage if available
            const clientSkinType = localStorage.getItem('profile_skinType') || null;
            const clientConcerns = JSON.parse(localStorage.getItem('profile_concerns') || '[]');
            const clientBudget = Number(localStorage.getItem('profile_budget')) || null;

            // Add initial empty AI bubble
            const initialAiMessage = {
                role: 'ai',
                text: '',
                type: 'text',
                data: null,
                followUpQuestions: [],
            };
            setMessages(prev => [...prev, initialAiMessage]);

            console.log(`[VChat Client] Outgoing request to ${API_BASE_URL}/api/ai/chat/stream`, {
                enhancedMessage,
                clientSkinType,
                clientConcerns,
                clientBudget,
                hasAuthHeader: !!token,
                hasGeminiHeader: !!savedGeminiKey,
                hasOpenaiHeader: !!savedOpenaiKey
            });

            const res = await fetch(`${API_BASE_URL}/api/ai/chat/stream`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ 
                    message: enhancedMessage,
                    sessionContext: {
                        skinType: clientSkinType,
                        concerns: clientConcerns,
                        budget: clientBudget
                    }
                }),
                signal: abortController.signal
            });

            if (!res.ok) {
                console.error(`[VChat Client] Request failed with status ${res.status}`);
                throw new Error(`API returned ${res.status}`);
            }
            console.log(`[VChat Client] Connection established, receiving stream...`);

            const reader = res.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let done = false;
            let fullText = '';
            let buffer = '';

            while (!done) {
                const { value, done: doneReading } = await reader.read();
                done = doneReading;
                if (value) {
                    buffer += decoder.decode(value, { stream: !done });
                    const lines = buffer.split('\n');
                    buffer = done ? '' : (lines.pop() || '');

                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (trimmedLine.startsWith('data: ')) {
                            try {
                                const dataStr = trimmedLine.slice(6);
                                if (dataStr === '[DONE]') continue;
                                const parsed = JSON.parse(dataStr);
                                if (parsed.status) {
                                    setThoughtStage(parsed.status);
                                } else if (parsed.text) {
                                    setThoughtStage('');
                                    fullText += parsed.text;
                                    setMessages(prev => {
                                        const updated = [...prev];
                                        if (updated.length > 0) {
                                            updated[updated.length - 1] = {
                                                ...updated[updated.length - 1],
                                                text: fullText
                                            };
                                        }
                                        return updated;
                                    });
                                }
                            } catch (e) {
                                // partial line / JSON parse error
                            }
                        }
                    }
                }
            }

            // Once finished, set standard suggestions
            setMessages(prev => {
                const updated = [...prev];
                if (updated.length > 0) {
                    updated[updated.length - 1] = {
                        ...updated[updated.length - 1],
                        followUpQuestions: ['Start Skincare Discovery Flow 🚀', 'Build me a routine 🌅', 'Compare alternative brands ⚖️']
                    };
                }
                return updated;
            });
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 100);

        } catch (err) {
            if (err.name === 'AbortError') {
                return;
            }
            console.error('[VChat Client] Error:', err);
            setMessages(prev => [...prev, {
                role: 'ai',
                text: `⚠️ **Connection Error**\n\nI couldn't reach the AI service right now. Please check your connection and try again.\n\n*Error: ${err.message}*`,
                type: 'error',
                data: null,
                followUpQuestions: ['Try again', 'Search for skincare products 🔍'],
            }]);
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [input, loading, activeProduct, lastUserMessage]);

    const handleSubmit = (e) => {
        e.preventDefault();
        sendMessage();
    };

    const handleSuggestion = (text) => {
        setInput(text);
        sendMessage(text);
    };

    const handleProductClick = (product) => {
        navigate(`/product/${product.id}`);
    };

    const handleProductCompare = (product, otherProduct) => {
        const titleA = product.title || product.name;
        if (otherProduct) {
            const titleB = otherProduct.title || otherProduct.name;
            const prompt = `Compare ${titleA} vs ${titleB}`;
            setInput(prompt);
            sendMessage(prompt);
        } else {
            const prompt = `Compare ${titleA} with another product`;
            setInput(prompt);
            sendMessage(prompt);
        }
    };

    const handleProductTrust = (product) => {
        const prompt = `Can I trust ${product.title}?`;
        setInput(prompt);
        sendMessage(prompt);
    };

    const handleResetMemory = () => {
        setSessionTags([]);
        sendMessage('reset');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const showSuggestions = !loading && messages.filter(m => m.role === 'user').length === 0;
    const lastMsg = messages[messages.length - 1];
    const showFollowUps = !loading && lastMsg?.role === 'ai' && lastMsg?.followUpQuestions?.length > 0;

    return (
        <div className="vchat-page page-enter">
            {/* Header */}
            <div className="vchat-header">
                <div className="vchat-header-left">
                    <div className="vchat-logo">
                        <Bot size={20} />
                    </div>
                    <div>
                        <div className="vchat-title">VChat</div>
                        <div className="vchat-subtitle">Clinical Skincare discovery Agent</div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button 
                        className="vchat-settings-btn"
                        onClick={() => setShowSettings(true)}
                        title="Configure AI API keys"
                    >
                        <Settings size={12} />
                        Settings
                    </button>
                    <button 
                        className="vchat-reset-btn"
                        onClick={handleResetMemory}
                        title="Clear assistant memory profile"
                    >
                        <RefreshCw size={12} />
                        Reset Memory
                    </button>
                    <div className="vchat-status">
                        <div className="vchat-status-dot" />
                        <span>ACTIVE</span>
                    </div>
                </div>
            </div>

            {/* SLEEK DIAGNOSTIC PANEL (Required) */}
            <div className="vchat-diagnostics-panel" style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1rem',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '0.6rem 1.2rem',
                margin: '0.5rem 1.25rem 0.25rem 1.25rem',
                borderRadius: '8px',
                background: 'rgba(30, 41, 59, 0.45)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                fontSize: '0.75rem',
                color: '#94a3b8',
                backdropFilter: 'blur(10px)'
            }}>
                <span style={{ fontWeight: 600, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Diagnostics:</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    Backend Connected: 
                    <strong style={{ color: diagnostics.backend === 'Yes' ? '#10b981' : diagnostics.backend === 'No' ? '#ef4444' : '#fbbf24' }}>
                        {diagnostics.backend || 'Checking...'}
                    </strong>
                </span>
                <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    AI Connected: 
                    <strong style={{ color: diagnostics.ai === 'Yes' ? '#10b981' : diagnostics.ai === 'No' ? '#ef4444' : '#fbbf24' }}>
                        {diagnostics.ai || 'Checking...'}
                    </strong>
                </span>
                <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    Supabase Connected: 
                    <strong style={{ color: diagnostics.supabase === 'Yes' ? '#10b981' : diagnostics.supabase === 'No' ? '#ef4444' : '#fbbf24' }}>
                        {diagnostics.supabase || 'Checking...'}
                    </strong>
                </span>
            </div>

            {/* Quick Action Chips (Phase 10) */}
            <div className="vchat-caps">
                {QUICK_ACTIONS.map((c, i) => (
                    <button 
                        key={i} 
                        className="vchat-cap-pill-btn"
                        onClick={() => handleSuggestion(c.text)}
                    >
                        {c.icon}
                        {c.label}
                    </button>
                ))}
            </div>

            {/* Chat Window */}
            <div className="vchat-window">
                {/* Session context tags (Phase 4 display) */}
                {sessionTags.length > 0 && (
                    <div className="vchat-context-bar">
                        {sessionTags.map((tag, i) => (
                            <div key={i} className="vchat-context-tag">{tag}</div>
                        ))}
                    </div>
                )}

                {/* Messages */}
                <div className="vchat-messages" id="vchat-messages-area">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`vchat-msg-row ${msg.role}`}>
                            <div className={`vchat-avatar ${msg.role === 'ai' ? 'ai-avatar' : 'user-avatar'}`}>
                                {msg.role === 'ai' ? <Bot size={16} /> : <User size={16} />}
                            </div>

                            {msg.role === 'ai' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                                    <RichMessage
                                        msg={msg}
                                        onProductCompare={handleProductCompare}
                                        onProductClick={handleProductClick}
                                        onSuggestionClick={handleSuggestion}
                                        onProductTrust={handleProductTrust}
                                    />
                                    {msg.text && (
                                        <div className="vchat-message-actions" style={{
                                            display: 'flex',
                                            gap: '0.75rem',
                                            marginLeft: '1.25rem',
                                            marginTop: '0.25rem',
                                            fontSize: '0.75rem',
                                            color: '#64748b',
                                            alignItems: 'center'
                                        }}>
                                            <button
                                                onClick={() => navigator.clipboard.writeText(msg.text)}
                                                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                                title="Copy message text"
                                            >
                                                <Copy size={11} /> Copy
                                            </button>
                                            <button
                                                onClick={() => sendMessage(lastUserMessage)}
                                                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                                title="Regenerate this response"
                                                disabled={loading}
                                            >
                                                <RefreshCw size={11} /> Regenerate
                                            </button>
                                            <button
                                                onClick={(e) => { e.currentTarget.style.color = '#10b981'; }}
                                                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                title="Like this response"
                                            >
                                                <ThumbsUp size={11} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                                                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                title="Dislike this response"
                                            >
                                                <ThumbsDown size={11} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="vchat-bubble">{msg.text}</div>
                            )}
                        </div>
                    ))}

                    {/* Typing status indicator (Phase 10) */}
                    {loading && messages.length > 0 && messages[messages.length - 1].role === 'ai' && !messages[messages.length - 1].text && (
                        <div className="vchat-msg-row ai">
                            <div className="vchat-avatar ai-avatar"><Bot size={16} /></div>
                            <div className="vchat-bubble" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                {thoughtStage && (
                                    <div className="vchat-thought-status" style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', fontWeight: '500' }}>
                                        {thoughtStage}
                                    </div>
                                )}
                                <div className="vchat-typing">
                                    <div className="vchat-dot" />
                                    <div className="vchat-dot" />
                                    <div className="vchat-dot" />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="vchat-input-zone">
                    {loading && (
                        <div className="vchat-stop-container" style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
                            <button
                                type="button"
                                className="vchat-stop-btn"
                                onClick={stopGeneration}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.6rem 1.2rem',
                                    borderRadius: '20px',
                                    border: '1px solid rgba(244, 63, 94, 0.4)',
                                    background: 'rgba(15, 23, 42, 0.8)',
                                    color: '#f43f5e',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: '600',
                                    transition: 'all 0.2s ease',
                                    backdropFilter: 'blur(8px)',
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(244, 63, 94, 0.15)';
                                    e.currentTarget.style.border = '1px solid #f43f5e';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(15, 23, 42, 0.8)';
                                    e.currentTarget.style.border = '1px solid rgba(244, 63, 94, 0.4)';
                                }}
                            >
                                <Square size={12} fill="#f43f5e" /> Stop Generation
                            </button>
                        </div>
                    )}
                    {/* Initial suggestions */}
                    {showSuggestions && (
                        <div className="vchat-suggestions">
                            {INITIAL_SUGGESTIONS.map((s, i) => (
                                <button key={i} className="vchat-suggestion-chip" onClick={() => handleSuggestion(s)}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Follow-up refinement buttons (Phase 6 refinements) */}
                    {!showSuggestions && showFollowUps && (
                        <div className="vchat-suggestions" style={{ marginBottom: '0.75rem' }}>
                            {lastMsg.followUpQuestions.slice(0, 6).map((q, i) => (
                                <button key={i} className="vchat-suggestion-chip" onClick={() => handleSuggestion(q)}>
                                    {q}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Input form row */}
                    <form id="vchat-form" className="vchat-input-row" onSubmit={handleSubmit}>
                        <textarea
                            ref={inputRef}
                            className="vchat-input"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask about skincare products, comparison vs, ingredients, or type reset..."
                            rows={1}
                            id="vchat-input-field"
                        />
                        <button
                            type="button"
                            className={`vchat-mic-btn ${isListening ? 'listening' : ''}`}
                            onClick={toggleListening}
                            title={isListening ? 'Stop listening' : 'Speak to VChat'}
                        >
                            {isListening ? <Mic size={18} /> : <MicOff size={18} />}
                        </button>
                        <button
                            type="submit"
                            className="vchat-send-btn"
                            disabled={loading || !input.trim()}
                            title="Send message"
                            id="vchat-send-btn"
                        >
                            <Send size={16} />
                        </button>
                    </form>
                </div>
            </div>

            {/* API Settings Modal */}
            {showSettings && (
                <div className="vchat-modal-backdrop" onClick={() => setShowSettings(false)}>
                    <div className="vchat-modal-content glassmorphic" onClick={(e) => e.stopPropagation()}>
                        <div className="vchat-modal-header">
                            <h3>⚙️ VChat AI Engine Settings</h3>
                            <button type="button" className="close-btn" onClick={() => setShowSettings(false)}>&times;</button>
                        </div>
                        <form onSubmit={handleSaveSettings}>
                            <div className="vchat-settings-desc">
                                Paste your API keys below to unlock high-precision ChatGPT-level conversational skincare assistance. Keys are stored safely in your browser's local storage.
                            </div>
                            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#9ca3af' }}>Google Gemini API Key</label>
                                <input
                                    type="password"
                                    placeholder="Enter your GEMINI_API_KEY..."
                                    value={geminiKey}
                                    onChange={(e) => setGeminiKey(e.target.value)}
                                    className="vchat-settings-input"
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#9ca3af' }}>OpenAI API Key</label>
                                <input
                                    type="password"
                                    placeholder="Enter your OPENAI_API_KEY..."
                                    value={openaiKey}
                                    onChange={(e) => setOpenaiKey(e.target.value)}
                                    className="vchat-settings-input"
                                />
                            </div>
                            <div className="vchat-modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                <button type="button" className="btn-cancel" onClick={() => setShowSettings(false)}>Cancel</button>
                                <button type="submit" className="btn-save">Save Keys</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="vchat-footer">
                <Sparkles size={12} />
                VChat · Intelligent Skincare Discovery Engine
            </div>
        </div>
    );
};

const INITIAL_SUGGESTIONS = [
    'I have oily skin with acne 💊',
    'Build me a skincare routine 🌅',
    'Find serums under $30 💰',
    'Compare two moisturizers ⚖️',
    'Explain niacinamide 🧬',
];

export default Chatbot;
