import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';
import { API_BASE_URL } from '../config/api';
import { 
    Trash2, RefreshCw, Upload, Database, CheckCircle, 
    AlertTriangle, Search, Info, User, Key, BookOpen, Layers, Activity 
} from 'lucide-react';
import './AdminPage.css';

const AdminPage = () => {
    // Current Active Tab: 'catalog' | 'memories' | 'caches' | 'knowledge'
    const [activeTab, setActiveTab] = useState('catalog');

    // API Keys state (for browser local storage)
    const [geminiKey, setGeminiKey] = useState(localStorage.getItem('x-gemini-key') || import.meta.env.VITE_GEMINI_API_KEY || '');
    const [openaiKey, setOpenaiKey] = useState(localStorage.getItem('x-openai-key') || '');

    // Catalog Ingestion state
    const [source, setSource] = useState('amazon');
    const [rawData, setRawData] = useState('');
    const [loading, setLoading] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [importError, setImportError] = useState(null);

    // Catalog Grid state
    const [products, setProducts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [catalogLoading, setCatalogLoading] = useState(false);
    const [totalProducts, setTotalProducts] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // User Memory state
    const [memories, setMemories] = useState([]);
    const [memoriesLoading, setMemoriesLoading] = useState(false);

    // System Stats state
    const [stats, setStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(false);

    // Knowledge state
    const [kbDocs, setKbDocs] = useState([]);
    const [kbLoading, setKbLoading] = useState(false);
    const [newKb, setNewKb] = useState({ topic: '', content: '', category: '', keywords: '' });
    const [kbSuccess, setKbSuccess] = useState(false);
    const [kbError, setKbError] = useState(null);

    useEffect(() => {
        if (activeTab === 'catalog') {
            fetchCatalog();
        } else if (activeTab === 'memories') {
            fetchMemories();
        } else if (activeTab === 'caches') {
            fetchStats();
        } else if (activeTab === 'knowledge') {
            fetchKnowledge();
        }
    }, [activeTab, page, searchQuery]);

    // ─── Core API calls ───
    const fetchCatalog = async () => {
        setCatalogLoading(true);
        try {
            const url = `${API_BASE_URL}/api/products?page=${page}&limit=10&q=${encodeURIComponent(searchQuery)}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to fetch catalog');
            const json = await res.json();
            if (json.success && json.data) {
                setProducts(json.data.products || []);
                setTotalPages(json.data.totalPages || 1);
                setTotalProducts(json.data.total || 0);
            }
        } catch (err) {
            console.error('Error fetching catalog:', err);
        } finally {
            setCatalogLoading(false);
        }
    };

    const fetchMemories = async () => {
        setMemoriesLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/memories`);
            if (!res.ok) throw new Error('Failed to fetch user memories');
            const json = await res.json();
            if (json.success) setMemories(json.data || []);
        } catch (err) {
            console.error('Error fetching memories:', err);
        } finally {
            setMemoriesLoading(false);
        }
    };

    const fetchStats = async () => {
        setStatsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/stats`);
            if (!res.ok) throw new Error('Failed to fetch stats');
            const json = await res.json();
            if (json.success) setStats(json.data);
        } catch (err) {
            console.error('Error fetching stats:', err);
        } finally {
            setStatsLoading(false);
        }
    };

    const fetchKnowledge = async () => {
        setKbLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/knowledge`);
            if (!res.ok) throw new Error('Failed to fetch knowledge base');
            const json = await res.json();
            if (json.success) setKbDocs(json.data || []);
        } catch (err) {
            console.error('Error fetching knowledge base:', err);
        } finally {
            setKbLoading(false);
        }
    };

    // ─── Event Handlers ───
    const handleSaveKeys = (e) => {
        e.preventDefault();
        localStorage.setItem('x-gemini-key', geminiKey.trim());
        localStorage.setItem('x-openai-key', openaiKey.trim());
        alert('API keys saved locally in this browser.');
    };

    const handleImportSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setImportError(null);
        setImportResult(null);

        try {
            let parsedData = rawData;
            if (source !== 'csv') {
                try {
                    parsedData = JSON.parse(rawData);
                } catch (e) {
                    throw new Error('Raw data must be valid JSON array.');
                }
            }

            const headers = { 'Content-Type': 'application/json' };
            if (geminiKey) headers['x-gemini-key'] = geminiKey;

            const res = await fetch(`${API_BASE_URL}/api/products/import`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ source, data: parsedData })
            });

            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || 'Import failed');

            setImportResult(json.data);
            setRawData('');
            fetchCatalog();
        } catch (err) {
            setImportError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteProduct = async (id) => {
        if (!window.confirm('Delete this product from catalog?')) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/products/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
            fetchCatalog();
            alert('Product deleted successfully');
        } catch (err) {
            alert(err.message);
        }
    };

    const handleReembedProduct = async (id) => {
        try {
            const headers = {};
            if (geminiKey) headers['x-gemini-key'] = geminiKey;
            const res = await fetch(`${API_BASE_URL}/api/products/${id}/re-embed`, { method: 'POST', headers });
            if (!res.ok) throw new Error('Embedding generation failed');
            alert('Vector embeddings generated successfully');
            fetchCatalog();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleDeleteMemory = async (userId) => {
        if (!window.confirm(`Delete persistent memory for user ${userId}?`)) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/memories/${userId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete memory failed');
            fetchMemories();
            alert('User memory deleted successfully');
        } catch (err) {
            alert(err.message);
        }
    };

    const handleClearCache = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/cache/clear`, { method: 'POST' });
            if (!res.ok) throw new Error('Clear cache failed');
            alert('System search caches cleared successfully');
        } catch (err) {
            alert(err.message);
        }
    };

    const handleAddKbDoc = async (e) => {
        e.preventDefault();
        setKbError(null);
        setKbSuccess(false);

        try {
            const headers = { 'Content-Type': 'application/json' };
            if (geminiKey) headers['x-gemini-key'] = geminiKey;

            const res = await fetch(`${API_BASE_URL}/api/admin/knowledge`, {
                method: 'POST',
                headers,
                body: JSON.stringify(newKb)
            });

            if (!res.ok) throw new Error('Failed to insert knowledge document');
            setKbSuccess(true);
            setNewKb({ topic: '', content: '', category: '', keywords: '' });
            fetchKnowledge();
        } catch (err) {
            setKbError(err.message);
        }
    };

    const handleDeleteKbDoc = async (id) => {
        if (!window.confirm('Delete this article from RAG grounding index?')) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/knowledge/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete document failed');
            fetchKnowledge();
            alert('Knowledge document deleted successfully');
        } catch (err) {
            alert(err.message);
        }
    };

    return (
        <div className="admin-container">
            <header className="admin-header">
                <div className="header-title">
                    <Database size={24} className="text-accent" />
                    <h1>ReviewLens AI Shopping Assistant Dashboard</h1>
                </div>
                <p>Manage product inventories, verify RAG documents, inspect user profiles memory, and trace usage logs.</p>
            </header>

            {/* Glassmorphic Navigation Tabs selector */}
            <div className="admin-tabs" style={{
                display: 'flex',
                gap: '0.75rem',
                margin: '1rem 0 2rem 0',
                padding: '0.4rem',
                background: 'rgba(30, 41, 59, 0.4)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px',
                backdropFilter: 'blur(10px)'
            }}>
                <button 
                    onClick={() => setActiveTab('catalog')} 
                    className={`admin-tab-btn ${activeTab === 'catalog' ? 'active' : ''}`}
                    style={{
                        padding: '0.6rem 1.2rem',
                        background: activeTab === 'catalog' ? 'rgba(99, 102, 241, 0.2)' : 'none',
                        border: activeTab === 'catalog' ? '1px solid #6366f1' : '1px solid transparent',
                        color: activeTab === 'catalog' ? '#818cf8' : '#94a3b8',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <Layers size={14} /> Catalog Ingestion
                </button>
                <button 
                    onClick={() => setActiveTab('memories')} 
                    className={`admin-tab-btn ${activeTab === 'memories' ? 'active' : ''}`}
                    style={{
                        padding: '0.6rem 1.2rem',
                        background: activeTab === 'memories' ? 'rgba(99, 102, 241, 0.2)' : 'none',
                        border: activeTab === 'memories' ? '1px solid #6366f1' : '1px solid transparent',
                        color: activeTab === 'memories' ? '#818cf8' : '#94a3b8',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <User size={14} /> Users & Memory
                </button>
                <button 
                    onClick={() => setActiveTab('caches')} 
                    className={`admin-tab-btn ${activeTab === 'caches' ? 'active' : ''}`}
                    style={{
                        padding: '0.6rem 1.2rem',
                        background: activeTab === 'caches' ? 'rgba(99, 102, 241, 0.2)' : 'none',
                        border: activeTab === 'caches' ? '1px solid #6366f1' : '1px solid transparent',
                        color: activeTab === 'caches' ? '#818cf8' : '#94a3b8',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <Activity size={14} /> Caches & Logs
                </button>
                <button 
                    onClick={() => setActiveTab('knowledge')} 
                    className={`admin-tab-btn ${activeTab === 'knowledge' ? 'active' : ''}`}
                    style={{
                        padding: '0.6rem 1.2rem',
                        background: activeTab === 'knowledge' ? 'rgba(99, 102, 241, 0.2)' : 'none',
                        border: activeTab === 'knowledge' ? '1px solid #6366f1' : '1px solid transparent',
                        color: activeTab === 'knowledge' ? '#818cf8' : '#94a3b8',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <BookOpen size={14} /> RAG Knowledge Base
                </button>
            </div>

            {/* TAB CONTENT: CATALOG INGESTION */}
            {activeTab === 'catalog' && (
                <div className="admin-layout">
                    <div className="admin-side">
                        <div className="admin-card glass-panel">
                            <h2><Key size={14} style={{ display: 'inline', marginRight: 4 }} /> API Configurations</h2>
                            <form onSubmit={handleSaveKeys} className="keys-form">
                                <div className="form-group">
                                    <label>Gemini API Key</label>
                                    <input
                                        type="password"
                                        placeholder="AIzaSy..."
                                        value={geminiKey}
                                        onChange={(e) => setGeminiKey(e.target.value)}
                                        className="admin-input"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>OpenAI API Key</label>
                                    <input
                                        type="password"
                                        placeholder="sk-proj-..."
                                        value={openaiKey}
                                        onChange={(e) => setOpenaiKey(e.target.value)}
                                        className="admin-input"
                                    />
                                </div>
                                <button type="submit" className="admin-btn secondary">Save Keys Locally</button>
                            </form>
                        </div>

                        <div className="admin-card glass-panel margin-top">
                            <h2>📥 Normalized Catalog Import</h2>
                            <form onSubmit={handleImportSubmit} className="import-form">
                                <div className="form-group">
                                    <label>Target Schema Format</label>
                                    <div className="source-toggle">
                                        {['amazon', 'flipkart', 'kaggle', 'csv'].map(src => (
                                            <button
                                                key={src}
                                                type="button"
                                                onClick={() => setSource(src)}
                                                className={`toggle-btn ${source === src ? 'active' : ''}`}
                                            >
                                                {src.toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <textarea
                                    placeholder={source === 'csv' ? "title,brand,category,price,description..." : "[\n  {\n    \"title\": \"Cetaphil wash\",\n    \"price\": 12.99\n  }\n]"}
                                    value={rawData}
                                    onChange={(e) => setRawData(e.target.value)}
                                    className="admin-textarea"
                                    rows={8}
                                    required
                                />
                                <button type="submit" className="admin-btn primary w-full" disabled={loading}>
                                    {loading ? <RefreshCw className="animate-spin" size={14} /> : <Upload size={14} />} Ingest Dataset
                                </button>
                            </form>
                        </div>
                    </div>

                    <div className="admin-main glass-panel">
                        <div className="catalog-header flex-row">
                            <h2>📦 Catalog Inspector ({totalProducts} Products)</h2>
                            <div className="search-box">
                                <Search size={16} className="search-icon" />
                                <input
                                    type="text"
                                    placeholder="Filter catalog..."
                                    value={searchQuery}
                                    onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                                    className="search-input"
                                />
                            </div>
                        </div>

                        <div className="table-wrapper">
                            {catalogLoading ? (
                                <div className="table-loading"><RefreshCw className="animate-spin" size={24} /></div>
                            ) : products.length === 0 ? (
                                <div className="table-empty"><Info size={24} /> No products found.</div>
                            ) : (
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Details</th>
                                            <th>Category</th>
                                            <th>Price</th>
                                            <th>Rating</th>
                                            <th>Vector</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {products.map(p => (
                                            <tr key={p.id}>
                                                <td className="product-cell">
                                                    <div className="product-info">
                                                        <span className="p-title">{p.title}</span>
                                                        <span className="p-brand">{p.brand}</span>
                                                    </div>
                                                </td>
                                                <td>{p.category}</td>
                                                <td>${Number(p.price).toFixed(2)}</td>
                                                <td>⭐ {Number(p.rating || 4.2).toFixed(1)}</td>
                                                <td>
                                                    <span className={`vector-badge ${p.embedding ? 'verified' : 'missing'}`}>
                                                        {p.embedding ? 'Mapped' : 'Unindexed'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="actions-cell">
                                                        <button onClick={() => handleReembedProduct(p.id)} className="action-btn reembed" title="Regenerate Vector"><RefreshCw size={12} /></button>
                                                        <button onClick={() => handleDeleteProduct(p.id)} className="action-btn delete" title="Delete product"><Trash2 size={12} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: USERS & MEMORY */}
            {activeTab === 'memories' && (
                <div className="admin-main glass-panel w-full">
                    <h2>👤 User Memory Index Profiles</h2>
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.5rem' }}>Inspect the persistent preferences, skin concern categories, budgets, and conversation summaries extracted by the LLM and stored in PostgreSQL.</p>
                    
                    <div className="table-wrapper">
                        {memoriesLoading ? (
                            <div className="table-loading"><RefreshCw className="animate-spin" size={24} /></div>
                        ) : memories.length === 0 ? (
                            <div className="table-empty"><Info size={24} /> No active user memory indexes found.</div>
                        ) : (
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>User/Session ID</th>
                                        <th>Skin Type</th>
                                        <th>Active Concerns</th>
                                        <th>Budget</th>
                                        <th>Allergies</th>
                                        <th>Conversation Summary</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {memories.map(m => (
                                        <tr key={m.user_id}>
                                            <td style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#818cf8' }}>{m.user_id}</td>
                                            <td><span className="source-badge amazon">{m.memory?.skin_type?.toUpperCase() || 'NORMAL'}</span></td>
                                            <td>{m.memory?.concerns?.join(', ') || 'None'}</td>
                                            <td>{m.memory?.budget ? `$${m.memory.budget}` : 'Unlimited'}</td>
                                            <td>{m.memory?.allergies?.join(', ') || 'None'}</td>
                                            <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem', color: '#94a3b8' }} title={m.memory?.conversation_summary}>
                                                {m.memory?.conversation_summary || 'No transcript summary.'}
                                            </td>
                                            <td>
                                                <button onClick={() => handleDeleteMemory(m.user_id)} className="action-btn delete" title="Reset preferences memory"><Trash2 size={12} /> Clear</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* TAB CONTENT: CACHES & LOGS */}
            {activeTab === 'caches' && (
                <div className="admin-layout flex-column w-full" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                        <div className="admin-card glass-panel" style={{ textAlign: 'center', padding: '1.5rem' }}>
                            <h3 style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Grounded Catalog Products</h3>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#6366f1', margin: '0.5rem 0' }}>{stats?.totalProducts || 0}</div>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Verified product rows</span>
                        </div>
                        <div className="admin-card glass-panel" style={{ textAlign: 'center', padding: '1.5rem' }}>
                            <h3 style={{ fontSize: '0.9rem', color: '#94a3b8' }}>User memory indexes</h3>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981', margin: '0.5rem 0' }}>{stats?.totalUsersWithMemory || 0}</div>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>PostgreSQL preferences entries</span>
                        </div>
                        <div className="admin-card glass-panel" style={{ textAlign: 'center', padding: '1.5rem' }}>
                            <h3 style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Active Tool hits</h3>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b', margin: '0.5rem 0' }}>{stats?.totalToolHits || 0}</div>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Planner dispatcher usage logs</span>
                        </div>
                        <div className="admin-card glass-panel" style={{ textAlign: 'center', padding: '1.5rem' }}>
                            <h3 style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Logged Reviews</h3>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ec4899', margin: '0.5rem 0' }}>{stats?.totalReviews || 0}</div>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Genuine vs suspicious entries</span>
                        </div>
                    </div>

                    <div className="admin-card glass-panel w-full">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h2>🛠️ System Caches & Tool logs</h2>
                            <button onClick={handleClearCache} className="admin-btn secondary" style={{ padding: '0.5rem 1rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '5px' }}>
                                <RefreshCw size={12} style={{ display: 'inline', marginRight: 4 }} /> Purge search cache
                            </button>
                        </div>
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.5rem' }}>VChat implements Redis and in-memory caches to secure latency responses under 2 seconds. Tap **Purge search cache** to clear product query cache maps.</p>
                        
                        <h3>Tool Calling Hits Breakdown</h3>
                        <div className="table-wrapper" style={{ marginTop: '1rem' }}>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Target Tool Name</th>
                                        <th>Estimated Hits Count</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats?.toolHitsBreakdown && Object.keys(stats.toolHitsBreakdown).length > 0 ? (
                                        Object.entries(stats.toolHitsBreakdown).map(([tool, count]) => (
                                            <tr key={tool}>
                                                <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{tool}</td>
                                                <td>{count} hits</td>
                                                <td><span className="source-badge flipkart">Active</span></td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="3" style={{ textAlign: 'center', color: '#64748b' }}>No tool usage logged yet.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: RAG KNOWLEDGE BASE */}
            {activeTab === 'knowledge' && (
                <div className="admin-layout">
                    <div className="admin-side">
                        <div className="admin-card glass-panel">
                            <h2>📚 Ground New Document</h2>
                            <form onSubmit={handleAddKbDoc} className="import-form">
                                <div className="form-group">
                                    <label>Article Topic/Title</label>
                                    <input 
                                        type="text" 
                                        value={newKb.topic}
                                        onChange={e => setNewKb({...newKb, topic: e.target.value})}
                                        placeholder="e.g. Salicylic Acid vs Retinol"
                                        className="admin-input"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Category / Subtopic</label>
                                    <input 
                                        type="text" 
                                        value={newKb.category}
                                        onChange={e => setNewKb({...newKb, category: e.target.value})}
                                        placeholder="e.g. Ingredient interactions"
                                        className="admin-input"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Keywords (comma separated)</label>
                                    <input 
                                        type="text" 
                                        value={newKb.keywords}
                                        onChange={e => setNewKb({...newKb, keywords: e.target.value})}
                                        placeholder="acne, retinol, exfoliation"
                                        className="admin-input"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Document Content Body</label>
                                    <textarea 
                                        value={newKb.content}
                                        onChange={e => setNewKb({...newKb, content: e.target.value})}
                                        placeholder="Write grounding article facts here..."
                                        className="admin-textarea"
                                        rows={6}
                                        required
                                    />
                                </div>
                                <button type="submit" className="admin-btn primary w-full">Add Grounding Document</button>
                            </form>
                            {kbSuccess && <div className="result-alert success" style={{ marginTop: '0.75rem' }}>Document added! Embedding generated successfully.</div>}
                            {kbError && <div className="result-alert error" style={{ marginTop: '0.75rem' }}>{kbError}</div>}
                        </div>
                    </div>

                    <div className="admin-main glass-panel">
                        <h2>📚 Grounding Corpus ({kbDocs.length} Articles)</h2>
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.25rem' }}> Grounding knowledge base articles used by the Hybrid Vector search during RAG generation queries.</p>
                        
                        <div className="table-wrapper">
                            {kbLoading ? (
                                <div className="table-loading"><RefreshCw className="animate-spin" size={24} /></div>
                            ) : kbDocs.length === 0 ? (
                                <div className="table-empty"><Info size={24} /> Knowledge base is empty.</div>
                            ) : (
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Topic</th>
                                            <th>Subtopic</th>
                                            <th>Content Summary</th>
                                            <th>Keywords</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {kbDocs.map(doc => (
                                            <tr key={doc.id}>
                                                <td style={{ fontWeight: 600 }}>{doc.topic}</td>
                                                <td>{doc.sub_topic || doc.category}</td>
                                                <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={doc.content}>
                                                    {doc.content}
                                                </td>
                                                <td style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{doc.keywords}</td>
                                                <td>
                                                    <button onClick={() => handleDeleteKbDoc(doc.id)} className="action-btn delete" title="Delete grounding document"><Trash2 size={12} /></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPage;
