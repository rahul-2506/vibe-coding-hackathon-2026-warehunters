import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Sparkles, AlertTriangle, CheckCircle, Shield, RefreshCw, Leaf, ArrowRight, Star } from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';
import './IngredientScanner.css';

const IngredientScanner = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [image, setImage] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState(null);
    const [products, setProducts] = useState([]);
    const [matchedInventory, setMatchedInventory] = useState([]);

    // Fetch skincare products from backend API for local inventory mapping
    useEffect(() => {
        const fetchSkincare = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/products/category/Skincare & Beauty`);
                if (!res.ok) throw new Error(`Status ${res.status}`);
                const json = await res.json();
                if (json.success && json.data) {
                    setProducts(json.data);
                }
            } catch (err) {
                console.error("Failed to load inventory for matches:", err);
            }
        };
        fetchSkincare();
    }, []);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImage(file);
            setPreviewUrl(URL.createObjectURL(file));
            setReport(null);
            setMatchedInventory([]);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) {
            setImage(file);
            setPreviewUrl(URL.createObjectURL(file));
            setReport(null);
            setMatchedInventory([]);
        }
    };

    const runScan = async () => {
        if (!image) return;
        setLoading(true);
        setReport(null);

        const geminiKey = localStorage.getItem('x-gemini-key') || 
                          localStorage.getItem('gemini_api_key') || 
                          import.meta.env.VITE_GEMINI_API_KEY || 
                          '';

        if (!geminiKey) {
            alert("Gemini API Key is missing. Please save your API Key in the Chatbot or Admin Panel first.");
            setLoading(false);
            return;
        }

        try {
            // Read image as base64
            const reader = new FileReader();
            reader.readAsDataURL(image);
            reader.onloadend = async () => {
                const base64Data = reader.result;

                let mimeType = 'image/jpeg';
                let cleanBase64 = base64Data;
                if (base64Data.startsWith('data:')) {
                    const match = base64Data.match(/^data:([^;]+);base64,(.*)$/);
                    if (match) {
                        mimeType = match[1];
                        cleanBase64 = match[2];
                    }
                }

                try {
                    const prompt = "Look at this product label image. \nExtract all ingredients and return ONLY a JSON array:\n[\n  {\n    name: ingredient name,\n    description: one line description,\n    benefits: [benefit1, benefit2]\n  }\n]\nNo extra text, only JSON.";

                    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
                    let res = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{
                                parts: [
                                    { text: prompt },
                                    {
                                        inlineData: {
                                            mimeType: mimeType,
                                            data: cleanBase64
                                        }
                                    }
                                ]
                            }],
                            generationConfig: {
                                responseMimeType: "application/json"
                            }
                        })
                    });

                    if (res.status === 404) {
                        const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiKey}`;
                        res = await fetch(fallbackUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [{
                                    parts: [
                                        { text: prompt },
                                        {
                                            inlineData: {
                                                mimeType: mimeType,
                                                data: cleanBase64
                                            }
                                        }
                                    ]
                                }],
                                generationConfig: {
                                    responseMimeType: "application/json"
                                }
                            })
                        });
                    }

                    if (!res.ok) {
                        throw new Error(`Gemini API returned status ${res.status}`);
                    }

                    const json = await res.json();
                    const textResponse = json.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (!textResponse) {
                        throw new Error("Empty response from Gemini model");
                    }

                    let cleanText = textResponse.trim();
                    if (cleanText.startsWith('```json')) {
                        cleanText = cleanText.substring(7);
                    } else if (cleanText.startsWith('```')) {
                        cleanText = cleanText.substring(3);
                    }
                    if (cleanText.endsWith('```')) {
                        cleanText = cleanText.substring(0, cleanText.length - 3);
                    }
                    cleanText = cleanText.trim();

                    const parsedReport = JSON.parse(cleanText);
                    setReport(parsedReport);

                    // Match products locally based on keywords in extracted ingredients
                    const text = parsedReport.map(item => item.name).join(', ').toLowerCase();
                    const matches = products.filter(p => {
                        const nameMatch = text.includes((p.name || p.title || '').toLowerCase());
                        const explanationMatch = text.includes((p.explanation || p.description || '').toLowerCase());
                        const activeIngredientMatch = (p.ingredients || []).some(ing => text.includes(ing.toLowerCase()));
                        return nameMatch || explanationMatch || activeIngredientMatch;
                    });
                    
                    if (matches.length > 0) {
                        setMatchedInventory(matches.slice(0, 3));
                    } else {
                        setMatchedInventory(products.slice(0, 3));
                    }
                    setLoading(false);

                } catch (apiErr) {
                    console.error("Gemini Scan Error:", apiErr);
                    alert(`Scanning failed: ${apiErr.message}`);
                    setLoading(false);
                }
            };
        } catch (err) {
            console.error("Scanner Error:", err);
            setLoading(false);
            alert("Scanning failed. Please verify connection and try again.");
        }
    };

    const triggerReset = () => {
        setImage(null);
        setPreviewUrl(null);
        setReport(null);
        setMatchedInventory([]);
    };

    // Helper color maps
    const getRiskColor = (score) => {
        if (score >= 70) return '#ef4444'; // Red-500
        if (score >= 40) return '#f97316'; // Orange-500
        return '#10b981'; // Emerald-500
    };

    const getSafetyColor = (score) => {
        if (score >= 80) return '#10b981'; // Emerald-500
        if (score >= 50) return '#f97316'; // Orange-500
        return '#ef4444'; // Red-500
    };

    return (
        <div className="scanner-container">
            <header className="scanner-header">
                <h2>🧪 Skincare Ingredient Label Scanner</h2>
                <p>Upload a product ingredient label to detect harmful chemicals, comedogenic triggers, and view skin-type hazard risks immediately.</p>
            </header>

            <div className="scanner-content">
                {!report && (
                    <div className="upload-section glassmorphic">
                        <div 
                            className={`dropzone ${previewUrl ? 'has-preview' : ''}`}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleDrop}
                        >
                            {previewUrl ? (
                                <div className="preview-container">
                                    <img src={previewUrl} alt="Label Preview" className="label-preview" />
                                    {loading && <div className="scan-line-animation"></div>}
                                </div>
                            ) : (
                                <div className="dropzone-placeholder">
                                    <Upload size={48} className="upload-icon" />
                                    <p>Drag & drop label photo here, or <span>browse files</span></p>
                                    <small>Supports JPEG, PNG, WebP images</small>
                                </div>
                            )}
                            <input 
                                type="file" 
                                accept="image/*" 
                                onChange={handleImageChange} 
                                className="file-input-hidden" 
                                disabled={loading}
                            />
                        </div>

                        <div className="upload-actions">
                            {previewUrl && !loading && (
                                <>
                                    <button className="btn-secondary" onClick={triggerReset}>Clear</button>
                                    <button className="btn-primary" onClick={runScan}>
                                        <Sparkles size={16} /> Scan Ingredients
                                    </button>
                                </>
                            )}
                            {loading && (
                                <button className="btn-primary" disabled style={{ opacity: 0.8 }}>
                                    <RefreshCw size={16} className="animate-spin" /> Analyzing Formula...
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {report && (
                    <div className="report-layout animate-fade-in">
                        {/* Scanned Image Preview & Reset Button */}
                        <div className="report-summary glassmorphic" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', textAlign: 'center', margin: 0 }}>Scanned Product Label</h3>
                            <div className="preview-container" style={{ width: '100%', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)', overflow: 'hidden' }}>
                                <img src={previewUrl} alt="Scanned Label" className="label-preview" style={{ width: '100%', height: 'auto', maxHeight: '280px', objectFit: 'contain' }} />
                            </div>
                            <button className="btn-secondary" onClick={triggerReset} style={{ width: '100%' }}>Scan Another Product</button>
                        </div>

                        {/* Detailed Analysis Tabs/Grids */}
                        <div className="report-details">
                            <h3 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '0.5rem', background: 'linear-gradient(135deg, var(--accent-color, #f43f5e) 0%, #a855f7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', width: 'fit-content' }}>
                                Extracted Ingredients ({report.length})
                            </h3>
                            
                            {/* Ingredient Cards */}
                            {report.map((item, idx) => (
                                <div key={idx} className="detail-card glassmorphic animate-fade-in" style={{ animationDelay: `${idx * 0.1}s` }}>
                                    <div className="card-header" style={{ marginBottom: '1rem', paddingBottom: '0.5rem' }}>
                                        <Sparkles size={20} style={{ color: '#a855f7' }} />
                                        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700' }}>{item.name}</h3>
                                    </div>
                                    <p className="ing-desc" style={{ fontSize: '0.95rem', color: 'var(--text-main, #f8fafc)', marginBottom: '1rem', lineHeight: '1.5' }}>
                                        {item.description}
                                    </p>
                                    {item.benefits && item.benefits.length > 0 && (
                                        <div style={{ marginTop: '0.75rem' }}>
                                            <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted, #94a3b8)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Key Efficacy & Benefits</h4>
                                            <ul className="benefits-list">
                                                {item.benefits.map((benefit, bIdx) => (
                                                    <li key={bIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.9rem' }}>
                                                        <Leaf size={14} className="leaf-bullet" style={{ marginTop: '0.25rem' }} />
                                                        <span>{benefit}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Catalog Matches */}
                            <div className="detail-card matching glassmorphic">
                                <div className="card-header">
                                    <Shield size={20} style={{ color: '#3b82f6' }} />
                                    <h3>Recommended Safe Alternatives</h3>
                                </div>
                                <div className="matching-grid">
                                    {matchedInventory.map((item) => (
                                        <div key={item.id} className="matching-card" onClick={() => navigate(`/product/${item.id}`)}>
                                            <div className="match-thumb">🧴</div>
                                            <div className="match-info">
                                                <h4>{item.name || item.title}</h4>
                                                <span className="match-price">${Number(item.price).toFixed(2)}</span>
                                                <div className="match-rating">
                                                    <Star size={10} fill="#f59e0b" color="#f59e0b" />
                                                    <span>{Number(item.rating || 4.5).toFixed(1)}</span>
                                                </div>
                                            </div>
                                            <ArrowRight size={14} className="arrow-icon" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default IngredientScanner;
