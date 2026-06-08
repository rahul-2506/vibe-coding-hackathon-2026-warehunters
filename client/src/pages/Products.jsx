import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ProductCardExt from '../components/ProductCardExt';
import { 
    Package, 
    AlertCircle, 
    Search, 
    SlidersHorizontal, 
    Star, 
    X, 
    ShieldCheck, 
    Check, 
    RefreshCw
} from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import SkeletonLoader from '../components/SkeletonLoader';
import './ProductsScreen.css';

const getProductSubcategory = (p) => {
    if (p.subcategory) return p.subcategory;
    const nameLower = (p.title || p.name || '').toLowerCase();
    if (nameLower.includes('wash') || nameLower.includes('cleanser') || nameLower.includes('cleansing') || nameLower.includes('micellar')) {
        return 'Face Wash';
    }
    if (nameLower.includes('sunscreen') || nameLower.includes('spf') || nameLower.includes('sun block') || nameLower.includes('sun protection')) {
        return 'Sunscreen';
    }
    if (nameLower.includes('moisturizer') || nameLower.includes('cream') || nameLower.includes('butter') || nameLower.includes('lotion')) {
        return 'Moisturizer';
    }
    if (nameLower.includes('serum') || nameLower.includes('gel') || nameLower.includes('mist')) {
        return 'Serum';
    }
    if (nameLower.includes('toner')) {
        return 'Toner';
    }
    if (nameLower.includes('mask') || nameLower.includes('scrub') || nameLower.includes('peel')) {
        return 'Masks & Scrubs';
    }
    return 'Others';
};

const CATEGORY_BRANDS = {
    'All': ['Sony', 'Apple', 'Samsung', 'Dell', 'Logitech', 'Cetaphil', 'CeraVe', 'The Ordinary', 'Himalaya', 'The Derma Co', 'Minimalist', 'Nescafe', 'Tata', 'Oreo', 'Amul', 'Philips', 'Dyson', 'IKEA', 'Nike', 'Adidas', 'Levi\'s', 'Uniqlo', 'Moleskine', 'Hydro Flask', 'Manduka'],
    'Skincare & Beauty': ['Cetaphil', 'CeraVe', 'The Ordinary', 'Himalaya', 'The Derma Co', 'Minimalist'],
    'Electronics': ['Sony', 'Apple', 'Samsung', 'Dell', 'Logitech'],
    'Groceries': ['Nescafe', 'Tata', 'Oreo', 'Amul'],
    'Home & Living': ['Philips', 'Dyson', 'IKEA'],
    'Fashion & Apparel': ['Nike', 'Adidas', 'Levi\'s', 'Uniqlo'],
    'Others': ['Moleskine', 'Hydro Flask', 'Manduka']
};

const Products = () => {
    const navigate = useNavigate();
    
    // Core states
    const [products, setProducts] = useState([]);
    const [nextCursor, setNextCursor] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [totalEstimate, setTotalEstimate] = useState(0);

    // Filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');
    const [activeSubcategory, setActiveSubcategory] = useState('All');
    const [minPrice, setMinPrice] = useState('');
    const [maxPrice, setMaxPrice] = useState('');
    const [selectedBrands, setSelectedBrands] = useState([]);
    const [selectedMerchants, setSelectedMerchants] = useState([]);
    const [minRating, setMinRating] = useState(0);
    const [minTrustScore, setMinTrustScore] = useState(0);
    const [onlyInStock, setOnlyInStock] = useState(false);
    const [sortType, setSortType] = useState('trust_score');

    // Accordion/Expand states for filters on smaller displays
    const [showMobileFilters, setShowMobileFilters] = useState(false);

    // Standardized Categories
    const categories = [
        'All', 
        'Skincare & Beauty', 
        'Electronics', 
        'Groceries', 
        'Home & Living', 
        'Fashion & Apparel', 
        'Others'
    ];

    // Debounce search query to prevent excessive API requests
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedQuery(searchQuery);
        }, 500);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    // Fetch Products with pagination
    const fetchProducts = useCallback(async (cursorVal = 0, isInitial = false) => {
        if (isInitial) {
            setLoading(true);
        }
        setError('');
        try {
            const geminiKey = localStorage.getItem('gemini_api_key') || '';
            const groqKey = localStorage.getItem('groq_api_key') || '';

            const params = new URLSearchParams();
            if (debouncedQuery) params.append('q', debouncedQuery);
            if (activeCategory !== 'All') params.append('category', activeCategory);
            if (activeCategory === 'Skincare & Beauty' && activeSubcategory !== 'All') {
                params.append('subcategory', activeSubcategory);
            }
            if (minPrice) params.append('priceMin', minPrice);
            if (maxPrice) params.append('priceMax', maxPrice);
            if (selectedBrands.length > 0) params.append('brand', selectedBrands.join(','));
            if (selectedMerchants.length > 0) params.append('marketplace', selectedMerchants.join(','));
            if (minRating > 0) params.append('minRating', String(minRating));
            if (minTrustScore > 0) params.append('minTrustScore', String(minTrustScore));
            if (onlyInStock) params.append('onlyInStock', 'true');
            if (sortType) params.append('sort', sortType);
            
            params.append('limit', '20');
            params.append('cursor', String(cursorVal));

            const url = `${API_BASE_URL}/api/products/search?${params.toString()}`;
            const res = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(geminiKey && { 'x-gemini-key': geminiKey }),
                    ...(groqKey && { 'x-groq-key': groqKey })
                }
            });

            if (!res.ok) throw new Error('Failed to fetch from DB');
            const resJson = await res.json();
            const { products: fetchedList, nextCursor: newCursor, totalEstimate: totalEst } = resJson.data || {};
            
            const sanitized = (fetchedList || []).map(p => {
                let img = p.image_url || p.thumbnail || p.image || '';
                if (img && img.includes('cdn.dummyjson.com/product-images/')) {
                    img = img.replace('cdn.dummyjson.com/product-images/', 'cdn.dummyjson.com/products/images/');
                }
                return {
                    ...p,
                    name: p.title || p.name || 'Unknown Product',
                    image_url: img,
                    thumbnail: img
                };
            });

            setProducts(prev => isInitial ? sanitized : [...prev, ...sanitized]);
            setNextCursor(newCursor);
            setHasMore(newCursor !== null && newCursor !== undefined);
            setTotalEstimate(totalEst || 0);
        } catch (err) {
            console.error("Error loading products catalog:", err);
            setError("Unable to load products");
        } finally {
            setLoading(false);
        }
    }, [
        debouncedQuery,
        activeCategory,
        activeSubcategory,
        minPrice,
        maxPrice,
        selectedBrands,
        selectedMerchants,
        minRating,
        minTrustScore,
        onlyInStock,
        sortType
    ]);

    // Reset list and fetch page 1 whenever filters change
    useEffect(() => {
        fetchProducts(0, true);
    }, [
        debouncedQuery,
        activeCategory,
        activeSubcategory,
        minPrice,
        maxPrice,
        selectedBrands,
        selectedMerchants,
        minRating,
        minTrustScore,
        onlyInStock,
        sortType,
        fetchProducts
    ]);

    // Reset all filters
    const handleClearAll = () => {
        setSearchQuery('');
        setDebouncedQuery('');
        setActiveCategory('All');
        setActiveSubcategory('All');
        setMinPrice('');
        setMaxPrice('');
        setSelectedBrands([]);
        setSelectedMerchants([]);
        setMinRating(0);
        setMinTrustScore(0);
        setOnlyInStock(false);
        setSortType('trust_score');
    };

    // Toggle brand in multi-select checklist
    const handleBrandToggle = (brandName) => {
        if (selectedBrands.includes(brandName)) {
            setSelectedBrands(selectedBrands.filter(b => b !== brandName));
        } else {
            setSelectedBrands([...selectedBrands, brandName]);
        }
    };

    // Toggle merchant in multi-select checklist
    const handleMerchantToggle = (merchantName) => {
        if (selectedMerchants.includes(merchantName)) {
            setSelectedMerchants(selectedMerchants.filter(m => m !== merchantName));
        } else {
            setSelectedMerchants([...selectedMerchants, merchantName]);
        }
    };

    // Navigation triggers
    const handleChat = (product) => {
        navigate('/chatbot', { state: { product } });
    };

    const handleFeedback = (product) => {
        navigate(`/product/${product.id}`, { state: { product } });
    };

    const handleCompare = (product) => {
        navigate('/chatbot', { state: { product, initialMessage: `Compare ${product.name} with similar products in the ${product.category} category.` } });
    };

    // Intersection observer for infinite scroll
    const observer = useRef();
    const sentinelRef = useCallback(node => {
        if (loading) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore && nextCursor !== null && nextCursor !== undefined) {
                fetchProducts(nextCursor, false);
            }
        });
        if (node) observer.current.observe(node);
    }, [loading, hasMore, nextCursor, fetchProducts]);

    const brands = CATEGORY_BRANDS[activeCategory] || CATEGORY_BRANDS['All'];

    return (
        <div className="products-screen-container">
            {/* Left sidebar: E-commerce Premium Filter Panel */}
            <aside className={`products-internal-sidebar glass-panel ${showMobileFilters ? 'mobile-open' : ''}`}>
                <div className="sidebar-header-row">
                    <div className="sidebar-title">
                        <SlidersHorizontal className="text-accent" size={20} />
                        <h2>Filters</h2>
                    </div>
                    <button className="clear-all-btn" onClick={handleClearAll}>
                        <RefreshCw size={12} /> Clear All
                    </button>
                    {showMobileFilters && (
                        <button className="close-filters-btn" onClick={() => setShowMobileFilters(false)}>
                            <X size={18} />
                        </button>
                    )}
                </div>

                {/* 1. Keyword search inside sidebar */}
                <div className="filter-group">
                    <h4 className="filter-title">Search</h4>
                    <div className="search-input-wrapper">
                        {loading && products.length === 0 ? (
                            <RefreshCw className="search-icon animate-spin text-accent" size={16} />
                        ) : (
                            <Search className="search-icon" size={16} />
                        )}
                        <input 
                            type="text" 
                            placeholder="Search catalog..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button className="search-clear" onClick={() => { setSearchQuery(''); setDebouncedQuery(''); }}>
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Marketplace Filter */}
                <div className="filter-group">
                    <h4 className="filter-title">Marketplaces</h4>
                    <div className="brand-checklist scroll-container" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                        {[
                            'Internal Database',
                            'Amazon',
                            'Flipkart',
                            'Myntra',
                            'Nykaa',
                            'Ajio',
                            'Croma',
                            'Reliance Digital'
                        ].map(merchant => {
                            const isChecked = selectedMerchants.includes(merchant);
                            return (
                                <label key={merchant} className="checkbox-label" style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem', cursor: 'pointer' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={isChecked}
                                        onChange={() => handleMerchantToggle(merchant)}
                                        style={{ display: 'none' }}
                                    />
                                    <span className="custom-checkbox" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', marginRight: '8px', background: isChecked ? 'var(--accent-color)' : 'transparent' }}>
                                        {isChecked && <Check size={10} color="#fff" />}
                                    </span>
                                    <span className="brand-text" style={{ fontSize: '0.85rem', color: '#fff' }}>{merchant === 'Internal Database' ? 'Internal Store' : merchant}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>

                {/* 2. Categorization */}
                <div className="filter-group">
                    <h4 className="filter-title">Departments</h4>
                    <ul className="category-list">
                        {categories.map(cat => {
                            const isSkincare = cat === 'Skincare & Beauty';
                            return (
                                <React.Fragment key={cat}>
                                    <li 
                                        className={`category-item ${activeCategory === cat ? 'active' : ''}`}
                                        onClick={() => {
                                            setActiveCategory(cat);
                                            setActiveSubcategory('All');
                                            setSelectedBrands([]); // reset brand filter on category shift
                                        }}
                                    >
                                        <span className="category-name">{cat}</span>
                                    </li>
                                    
                                    {isSkincare && activeCategory === 'Skincare & Beauty' && (
                                        <ul className="subcategory-list animate-slide-down">
                                            {[
                                                { name: 'All', icon: '✨' },
                                                { name: 'Face Wash', icon: '💧' },
                                                { name: 'Sunscreen', icon: '☀️' },
                                                { name: 'Moisturizer', icon: '🧴' },
                                                { name: 'Serum', icon: '🧪' },
                                                { name: 'Toner', icon: '🌸' },
                                                { name: 'Masks & Scrubs', icon: '🎭' },
                                                { name: 'Others', icon: '📦' }
                                            ].map(sub => {
                                                return (
                                                    <li 
                                                        key={sub.name}
                                                        className={`subcategory-item ${activeSubcategory === sub.name ? 'active' : ''}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveSubcategory(sub.name);
                                                        }}
                                                    >
                                                        <span className="subcategory-left">
                                                            <span className="subcategory-icon">{sub.icon}</span>
                                                            <span className="subcategory-name">{sub.name}</span>
                                                        </span>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </ul>
                </div>

                {/* 3. Price Range Filter */}
                <div className="filter-group">
                    <h4 className="filter-title">Price Range (₹)</h4>
                    <div className="price-inputs">
                        <input 
                            type="number" 
                            placeholder="Min" 
                            value={minPrice}
                            onChange={(e) => setMinPrice(e.target.value)}
                        />
                        <span className="price-separator">-</span>
                        <input 
                            type="number" 
                            placeholder="Max" 
                            value={maxPrice}
                            onChange={(e) => setMaxPrice(e.target.value)}
                        />
                    </div>
                    <div className="price-presets">
                        <button onClick={() => { setMinPrice(''); setMaxPrice('2000'); }}>Under ₹2,000</button>
                        <button onClick={() => { setMinPrice('2000'); setMaxPrice('10000'); }}>₹2k to ₹10k</button>
                        <button onClick={() => { setMinPrice('10000'); setMaxPrice(''); }}>Over ₹10k</button>
                    </div>
                </div>

                {/* 4. Brand Checklist Filter */}
                {brands.length > 0 && (
                    <div className="filter-group">
                        <h4 className="filter-title">Brands</h4>
                        <div className="brand-checklist scroll-container">
                            {brands.map(brand => (
                                <label key={brand} className="checkbox-label">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedBrands.includes(brand)}
                                        onChange={() => handleBrandToggle(brand)}
                                    />
                                    <span className="custom-checkbox">
                                        {selectedBrands.includes(brand) && <Check size={10} />}
                                    </span>
                                    <span className="brand-text">{brand}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                {/* 5. Rating Stars Filter */}
                <div className="filter-group">
                    <h4 className="filter-title">Customer Review</h4>
                    <div className="ratings-list">
                        {[4, 3, 2].map(starVal => (
                            <button 
                                key={starVal}
                                className={`rating-filter-row ${minRating === starVal ? 'active' : ''}`}
                                onClick={() => setMinRating(minRating === starVal ? 0 : starVal)}
                            >
                                <div className="stars-row">
                                    {[1, 2, 3, 4, 5].map(starIndex => (
                                        <Star 
                                            key={starIndex}
                                            size={14} 
                                            className={starIndex <= starVal ? "star-filled" : "star-empty"}
                                        />
                                    ))}
                                </div>
                                <span className="rating-row-text">& Up</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 6. AI Trust Score filter */}
                <div className="filter-group">
                    <h4 className="filter-title">AI Trust Score</h4>
                    <div className="trust-filter-section">
                        <div className="trust-header">
                            <ShieldCheck size={16} className="text-accent" />
                            <span>Min Score: <strong>{minTrustScore || 'Any'}</strong></span>
                        </div>
                        <input 
                            type="range" 
                            min="0" 
                            max="95" 
                            step="5"
                            value={minTrustScore} 
                            onChange={(e) => setMinTrustScore(Number(e.target.value))}
                            className="trust-slider"
                        />
                        <div className="trust-slider-labels">
                            <span>Any</span>
                            <span>Safe (70+)</span>
                            <span>Highly Trusted (85+)</span>
                        </div>
                    </div>
                </div>

                {/* 7. Availability Filter */}
                <div className="filter-group last-group">
                    <label className="checkbox-label toggle-label">
                        <input 
                            type="checkbox" 
                            checked={onlyInStock}
                            onChange={(e) => setOnlyInStock(e.target.checked)}
                        />
                        <span className="custom-checkbox">
                            {onlyInStock && <Check size={10} />}
                        </span>
                        <span className="toggle-text">Exclude Out of Stock</span>
                    </label>
                </div>
            </aside>

            {/* Main inventory display area */}
            <main className="products-main-area">
                {/* Header Toolbar: Results display + dynamic sort + mobile toggle */}
                <header className="inventory-toolbar glass-panel">
                    <div className="toolbar-info">
                        <button 
                            className="mobile-filters-trigger" 
                            onClick={() => setShowMobileFilters(true)}
                        >
                            <SlidersHorizontal size={16} /> Filters
                        </button>
                        <span className="results-count">
                            {products.length > 0 ? `Showing ${products.length} of ${totalEstimate} vetted matches` : 'Explore Our Vetted Catalog'}
                        </span>
                    </div>

                    <div className="toolbar-sort">
                        <label htmlFor="sort-dropdown">Sort by:</label>
                        <select 
                            id="sort-dropdown"
                            value={sortType}
                            onChange={(e) => setSortType(e.target.value)}
                            className="sort-dropdown-input"
                        >
                            <option value="trust_score">Best Trust Score</option>
                            <option value="rating">Highest Rating</option>
                            <option value="price_asc">Price: Low to High</option>
                            <option value="price_desc">Price: High to Low</option>
                        </select>
                    </div>
                </header>
                
                {loading && products.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
                        <SkeletonLoader type="product-grid" count={6} />
                    </div>
                ) : error ? (
                    <div className="empty-results glass-panel animate-glow" style={{ textAlign: 'center', padding: '3rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%', maxWidth: '600px', margin: '2rem auto' }}>
                        <AlertCircle size={48} className="text-error" style={{ color: '#ef4444' }} />
                        <h3 style={{ marginTop: '0.5rem', fontSize: '1.25rem', color: '#fff' }}>Unable to load products</h3>
                        <p className="text-muted" style={{ maxWidth: '400px', fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>Verify that the database server is running and check your local network connection. Placeholders or unconfigured environments will prevent listing.</p>
                        <button className="primary-btn mt-2" onClick={() => fetchProducts(0, true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer', background: 'var(--accent-color)', border: 'none', color: '#fff', fontWeight: 'bold' }}>
                            <RefreshCw size={16} /> Retry Connection
                        </button>
                    </div>
                ) : products.length === 0 ? (
                    <div className="empty-results glass-panel">
                        <Package size={64} className="text-muted" opacity={0.3} />
                        <h3>No Products Found</h3>
                        <p className="text-muted">No items matched your search filters. Try broadening your criteria or resetting the sidebar.</p>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                            <button className="primary-btn" onClick={handleClearAll} style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--border-color)', boxShadow: 'none' }}>
                                Reset All Filters
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="products-grid">
                            {products.map((product, index) => (
                                <ProductCardExt 
                                    key={product.id || `scraped-${product.title || product.name}-${index}`} 
                                    index={index}
                                    product={product} 
                                    onAddChat={handleChat}
                                    onViewFeedback={handleFeedback}
                                    onCompare={handleCompare}
                                />
                            ))}
                        </div>
                        {hasMore && (
                            <div ref={sentinelRef} className="load-more-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '2rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
                                <RefreshCw className="animate-spin text-accent" size={16} />
                                Loading more products...
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};

export default Products;
