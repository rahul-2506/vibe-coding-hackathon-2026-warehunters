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

    // Fetch skincare products from Supabase for local inventory mapping
    useEffect(() => {
        const fetchSkincare = async () => {
            try {
                const { data, error } = await supabase
                    .from('products')
                    .select('*')
                    .eq('category', 'Skincare');
                if (!error && data) {
                    setProducts(data);
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

        try {
            // Read image as base64
            const reader = new FileReader();
            reader.readAsDataURL(image);
            reader.onloadend = async () => {
                const base64Data = reader.result;

                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;
                const headers = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = `Bearer ${token}`;

                const res = await fetch(`${API_BASE_URL}/api/ai/scan-ingredients`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ image: base64Data })
                });

                if (!res.ok) {
                    throw new Error(`Server returned ${res.status}`);
                }

                const json = await res.json();
                if (json.success && json.data) {
                    setReport(json.data);
                    
                    // Match products locally based on keywords in extractedText
                    const text = (json.data.extractedText || '').toLowerCase();
                    const matches = products.filter(p => {
                        const nameMatch = text.includes((p.name || p.title || '').toLowerCase());
                        const explanationMatch = text.includes((p.explanation || p.description || '').toLowerCase());
                        const activeIngredientMatch = (p.ingredients || []).some(ing => text.includes(ing.toLowerCase()));
                        return nameMatch || explanationMatch || activeIngredientMatch;
                    });
                    
                    // Fallback to top matches if no exact match
                    if (matches.length > 0) {
                        setMatchedInventory(matches.slice(0, 3));
                    } else {
                        // Return first 3 skincare products as top alternatives
                        setMatchedInventory(products.slice(0, 3));
                    }
                } else {
                    throw new Error("Invalid response format");
                }
                setLoading(false);
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
                        {/* Summary Metrics */}
                        <div className="report-summary glassmorphic">
                            <div className="score-widget">
                                <div className="circular-meter">
                                    <svg viewBox="0 0 36 36" className="circular-chart">
                                        <path className="circle-bg"
                                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        />
                                        <path className="circle"
                                            strokeDasharray={`${report.safetyScore}, 100`}
                                            stroke={getSafetyColor(report.safetyScore)}
                                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        />
                                    </svg>
                                    <div className="score-percentage" style={{ color: getSafetyColor(report.safetyScore) }}>{report.safetyScore}</div>
                                </div>
                                <div className="score-meta">
                                    <h3>Dermatological Safety Index</h3>
                                    <p>Based on ingredient toxicology, allergen density, and barrier-disrupting chemicals found.</p>
                                </div>
                            </div>

                            <hr className="divider" />

                            <div className="risk-meters">
                                <h3>Skin Sensitivity Profile</h3>
                                <div className="risk-bar-container">
                                    <div className="risk-header">
                                        <span>Dry Skin Risk</span>
                                        <span style={{ color: getRiskColor(report.risks?.dry || 0) }}>{report.risks?.dry || 0}%</span>
                                    </div>
                                    <div className="risk-bar-bg">
                                        <div className="risk-bar-fill" style={{ width: `${report.risks?.dry || 0}%`, backgroundColor: getRiskColor(report.risks?.dry || 0) }} />
                                    </div>
                                </div>

                                <div className="risk-bar-container">
                                    <div className="risk-header">
                                        <span>Acne / Comedogenic Risk</span>
                                        <span style={{ color: getRiskColor(report.risks?.acne || 0) }}>{report.risks?.acne || 0}%</span>
                                    </div>
                                    <div className="risk-bar-bg">
                                        <div className="risk-bar-fill" style={{ width: `${report.risks?.acne || 0}%`, backgroundColor: getRiskColor(report.risks?.acne || 0) }} />
                                    </div>
                                </div>

                                <div className="risk-bar-container">
                                    <div className="risk-header">
                                        <span>Irritation / Allergen Risk</span>
                                        <span style={{ color: getRiskColor(report.risks?.irritation || 0) }}>{report.risks?.irritation || 0}%</span>
                                    </div>
                                    <div className="risk-bar-bg">
                                        <div className="risk-bar-fill" style={{ width: `${report.risks?.irritation || 0}%`, backgroundColor: getRiskColor(report.risks?.irritation || 0) }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Detailed Analysis Tabs/Grids */}
                        <div className="report-details">
                            {/* Flagged Ingredients */}
                            <div className="detail-card flagged glassmorphic">
                                <div className="card-header">
                                    <AlertTriangle size={20} style={{ color: '#fbbf24' }} className="animate-pulse" />
                                    <h3>Flagged Hazard Ingredients</h3>
                                </div>
                                {report.flaggedIngredients?.length > 0 ? (
                                    <div className="ingredients-list">
                                        {report.flaggedIngredients.map((item, idx) => (
                                            <div key={idx} className="ingredient-item danger">
                                                <div className="ing-title">
                                                    <strong>{item.name}</strong>
                                                    <span className="danger-badge">Alert</span>
                                                </div>
                                                <p className="ing-desc">{item.reason}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="empty-message">🎉 No hazardous or highly comedogenic ingredients flagged!</p>
                                )}
                            </div>

                            {/* Active Benefits */}
                            <div className="detail-card benefits glassmorphic">
                                <div className="card-header">
                                    <CheckCircle size={20} style={{ color: '#10b981' }} />
                                    <h3>Clinical Active Benefits</h3>
                                </div>
                                {report.benefits?.length > 0 ? (
                                    <ul className="benefits-list">
                                        {report.benefits.map((benefit, idx) => (
                                            <li key={idx}>
                                                <Leaf size={14} className="leaf-bullet" />
                                                <span>{benefit}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="empty-message">No specific clinical active benefits identified.</p>
                                )}
                            </div>

                            {/* Catalog Matches */}
                            <div className="detail-card matching glassmorphic">
                                <div className="card-header">
                                    <Shield size={20} style={{ color: '#3b82f6' }} />
                                    <h3>Recommended Safe Inventory Alternatives</h3>
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

                        <div className="scan-controls-footer">
                            <button className="btn-secondary" onClick={triggerReset}>Scan Another Product</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default IngredientScanner;
