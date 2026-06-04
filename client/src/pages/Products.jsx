import React, { useState, useEffect } from 'react';
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
    ChevronRight,
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

const Products = () => {
    const navigate = useNavigate();
    
    // Core states
    const [products, setProducts] = useState([]);
    const [visibleCount, setVisibleCount] = useState(24);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isSearchingLive, setIsSearchingLive] = useState(false);
    const [searchedQueries, setSearchedQueries] = useState(new Set());

    // Filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');
    const [activeSubcategory, setActiveSubcategory] = useState('All');
    const [minPrice, setMinPrice] = useState('');
    const [maxPrice, setMaxPrice] = useState('');
    const [selectedBrands, setSelectedBrands] = useState([]);
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

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            // Fetch Products
            const prodRes = await fetch(`${API_BASE_URL}/api/products/getProducts`);
            if (!prodRes.ok) throw new Error('Failed to fetch from DB');
            const resJson = await prodRes.json();
            const raw = resJson.data || resJson.products || resJson;
            const prodData = Array.isArray(raw) ? raw : (Array.isArray(raw?.products) ? raw.products : []);
            
            // Double safety sanitization on client side for image URLs
            const sanitizedData = prodData.map(p => {
                let img = p.image_url || p.thumbnail || '';
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

            setProducts(sanitizedData);
        } catch (err) {
            console.error("Error loading products catalog:", err);
            setError("Unable to load products");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Reset visible count when filters are updated to maintain page 1 view
    useEffect(() => {
        setVisibleCount(24);
    }, [
        activeCategory,
        activeSubcategory,
        searchQuery,
        minPrice,
        maxPrice,
        selectedBrands,
        minRating,
        minTrustScore,
        onlyInStock,
        sortType
    ]);

    // Get list of all brands based on category
    const brands = [...new Set(products
        .filter(p => activeCategory === 'All' || p.category === activeCategory)
        .map(p => p.brand)
        .filter(Boolean)
    )].sort();

    // Reset all filters
    const handleClearAll = () => {
        setSearchQuery('');
        setActiveCategory('All');
        setActiveSubcategory('All');
        setMinPrice('');
        setMaxPrice('');
        setSelectedBrands([]);
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

    // Filter Logic
    const filteredProducts = products.filter(p => {
        // 1. Category filter
        if (activeCategory !== 'All' && p.category !== activeCategory) {
            return false;
        }

        // 1b. Subcategory filter for Skincare & Beauty
        if (activeCategory === 'Skincare & Beauty' && activeSubcategory !== 'All') {
            const prodSubcat = p.subcategory || getProductSubcategory(p);
            if (prodSubcat !== activeSubcategory) {
                return false;
            }
        }

        // 2. Search query filter
        if (searchQuery) {
            const qWords = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
            const matchesWords = qWords.every(word => {
                const matchesTitle = p.title?.toLowerCase().includes(word) || p.name?.toLowerCase().includes(word);
                const matchesBrand = p.brand?.toLowerCase().includes(word);
                const matchesDesc = p.description?.toLowerCase().includes(word);
                const matchesCategory = p.category?.toLowerCase().includes(word);
                const matchesKeywords = Array.isArray(p.keywords) && p.keywords.some(k => k.toLowerCase().includes(word));
                return matchesTitle || matchesBrand || matchesDesc || matchesCategory || matchesKeywords;
            });
            
            if (!matchesWords) {
                return false;
            }
        }

        // 3. Price filters
        if (minPrice && p.price < Number(minPrice)) return false;
        if (maxPrice && p.price > Number(maxPrice)) return false;

        // 4. Brand filters
        if (selectedBrands.length > 0 && !selectedBrands.includes(p.brand)) return false;

        // 5. Rating filters
        if (minRating && p.rating < Number(minRating)) return false;

        // 6. Trust score filters
        if (minTrustScore && (p.trust_score || 80) < Number(minTrustScore)) return false;

        // 7. Stock availability filters
        if (onlyInStock && p.stock <= 0) return false;

        return true;
    });

    // Sort Logic
    const sortedProducts = [...filteredProducts].sort((a, b) => {
        if (sortType === 'trust_score') {
            return (b.trust_score || 80) - (a.trust_score || 80);
        }
        if (sortType === 'rating') {
            return b.rating - a.rating;
        }
        if (sortType === 'price_asc') {
            return a.price - b.price;
        }
        if (sortType === 'price_desc') {
            return b.price - a.price;
        }
        return 0;
    });

    const handleLiveSearch = async (query) => {
        if (!query || query.trim() === '') return;
        const q = query.trim().toLowerCase();
        if (searchedQueries.has(q)) return;

        setIsSearchingLive(true);
        try {
            const geminiKey = localStorage.getItem('gemini_api_key') || '';
            const groqKey = localStorage.getItem('groq_api_key') || '';

            const url = `${API_BASE_URL}/api/products/search?q=${encodeURIComponent(query)}`;
            const res = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(geminiKey && { 'x-gemini-key': geminiKey }),
                    ...(groqKey && { 'x-groq-key': groqKey })
                }
            });

            if (!res.ok) throw new Error('Live search request failed');
            const dataJson = await res.json();
            const liveProds = Array.isArray(dataJson) ? dataJson : (dataJson.data || []);

            if (liveProds.length > 0) {
                setProducts(prevProducts => {
                    const merged = [...prevProducts];
                    liveProds.forEach(np => {
                        if (!merged.some(p => p.id === np.id || (p.title || '').toLowerCase() === (np.title || '').toLowerCase())) {
                            let img = np.image_url || np.thumbnail || '';
                            if (img && img.includes('cdn.dummyjson.com/product-images/')) {
                                img = img.replace('cdn.dummyjson.com/product-images/', 'cdn.dummyjson.com/products/images/');
                            }
                            merged.push({
                                ...np,
                                name: np.title || np.name || 'Unknown Product',
                                image_url: img,
                                thumbnail: img
                            });
                        }
                    });
                    return merged;
                });
            }
            
            setSearchedQueries(prev => {
                const updated = new Set(prev);
                updated.add(q);
                return updated;
            });
        } catch (err) {
            console.error("Error during live search:", err);
        } finally {
            setIsSearchingLive(false);
        }
    };

    useEffect(() => {
        if (searchQuery && filteredProducts.length === 0) {
            const q = searchQuery.trim().toLowerCase();
            if (!searchedQueries.has(q) && !isSearchingLive) {
                const timer = setTimeout(() => {
                    handleLiveSearch(searchQuery);
                }, 800);
                return () => clearTimeout(timer);
            }
        }
    }, [searchQuery, filteredProducts.length, searchedQueries, isSearchingLive]);

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

    // Calculate product count helper for each category badge
    const getCategoryCount = (catName) => {
        if (catName === 'All') return products.length;
        return products.filter(p => p.category === catName).length;
    };

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
                        {isSearchingLive ? (
                            <RefreshCw className="search-icon animate-spin text-accent" size={16} />
                        ) : (
                            <Search className="search-icon" size={16} />
                        )}
                        <input 
                            type="text" 
                            placeholder="Search catalog..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleLiveSearch(searchQuery);
                                }
                            }}
                        />
                        {searchQuery && (
                            <button className="search-clear" onClick={() => setSearchQuery('')}>
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* 2. Categorization */}
                <div className="filter-group">
                    <h4 className="filter-title">Departments</h4>
                    <ul className="category-list">
                        {categories.map(cat => {
                            const count = getCategoryCount(cat);
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
                                        <span className="category-count">{count}</span>
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
                                                const subCount = products.filter(p => 
                                                    p.category === 'Skincare & Beauty' && 
                                                    (sub.name === 'All' || (p.subcategory || getProductSubcategory(p)) === sub.name)
                                                ).length;
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
                                                        <span className="subcategory-count">{subCount}</span>
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
                    <h4 className="filter-title">Price Range ($)</h4>
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
                        <button onClick={() => { setMinPrice(''); setMaxPrice('20'); }}>Under $20</button>
                        <button onClick={() => { setMinPrice('20'); setMaxPrice('100'); }}>$20 to $100</button>
                        <button onClick={() => { setMinPrice('100'); setMaxPrice(''); }}>Over $100</button>
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
                            Explore Our Vetted Catalog
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
                
                {loading || (isSearchingLive && sortedProducts.length === 0) ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
                        {isSearchingLive && (
                            <div className="live-search-loading glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '1.25rem', border: '1px solid rgba(99, 102, 241, 0.2)', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '12px' }}>
                                <RefreshCw className="animate-spin text-accent" size={20} />
                                <span style={{ color: '#fff', fontSize: '0.95rem', fontWeight: '500' }}>Retrieving products lively from external APIs for "{searchQuery}"...</span>
                            </div>
                        )}
                        <SkeletonLoader type="product-grid" count={6} />
                    </div>
                ) : error ? (
                    <div className="empty-results glass-panel animate-glow" style={{ textAlign: 'center', padding: '3rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%', maxWidth: '600px', margin: '2rem auto' }}>
                        <AlertCircle size={48} className="text-error" style={{ color: '#ef4444' }} />
                        <h3 style={{ marginTop: '0.5rem', fontSize: '1.25rem', color: '#fff' }}>Unable to load products</h3>
                        <p className="text-muted" style={{ maxWidth: '400px', fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>Verify that the database server is running and check your local network connection. Placeholders or unconfigured environments will prevent listing.</p>
                        <button className="primary-btn mt-2" onClick={fetchData} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer', background: 'var(--accent-color)', border: 'none', color: '#fff', fontWeight: 'bold' }}>
                            <RefreshCw size={16} /> Retry Connection
                        </button>
                    </div>
                ) : sortedProducts.length === 0 ? (
                    <div className="empty-results glass-panel">
                        <Package size={64} className="text-muted" opacity={0.3} />
                        <h3>No Products Found</h3>
                        <p className="text-muted">No items matched your search filters. Try running a live external lookup, broadening your criteria, or resetting the sidebar.</p>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                            {searchQuery && (
                                <button className="primary-btn" onClick={() => handleLiveSearch(searchQuery)}>
                                    Search Lively for "{searchQuery}" 🚀
                                </button>
                            )}
                            <button className="primary-btn" onClick={handleClearAll} style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--border-color)', boxShadow: 'none' }}>
                                Reset All Filters
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {isSearchingLive && (
                            <div className="live-search-loading glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '1rem', marginBottom: '1.5rem', border: '1px solid rgba(99, 102, 241, 0.2)', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '12px', width: '100%' }}>
                                <RefreshCw className="animate-spin text-accent" size={18} />
                                <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '500' }}>Checking for more live matches for "{searchQuery}"...</span>
                            </div>
                        )}
                        <div className="products-grid">
                            {sortedProducts.slice(0, visibleCount).map((product, index) => (
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
                        {visibleCount < sortedProducts.length && (
                            <div className="load-more-container">
                                <button 
                                    className="primary-btn load-more-btn"
                                    onClick={() => setVisibleCount(prev => prev + 24)}
                                >
                                    Load More Products ({sortedProducts.length - visibleCount} remaining)
                                </button>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};

export default Products;
