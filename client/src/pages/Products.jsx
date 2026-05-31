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

const Products = () => {
    const navigate = useNavigate();
    
    // Core states
    const [products, setProducts] = useState([]);
    const [visibleCount, setVisibleCount] = useState(24);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');
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

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Products
                const prodRes = await fetch(`${API_BASE_URL}/api/products/getProducts`);
                if (!prodRes.ok) throw new Error('Failed to fetch from DB');
                const resJson = await prodRes.json();
                const prodData = Array.isArray(resJson) ? resJson : (resJson.data || []);
                
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
                console.warn("DB unavailable, loading mock products for UI demonstration.");
                setProducts([
                    { id: 101, name: 'The Derma Co 1% Salicylic Acid Facewash', title: 'The Derma Co 1% Salicylic Acid Facewash', price: 15.00, category: 'Skincare & Beauty', rating: 4.8, brand: 'The Derma Co', stock: 25, trust_score: 95, image_url: 'https://cdn.dummyjson.com/products/images/beauty/Essence%20Mascara%20Lash%20Princess/thumbnail.png' },
                    { id: 102, name: 'Himalaya Purifying Neem Facewash', title: 'Himalaya Purifying Neem Facewash', price: 8.50, category: 'Skincare & Beauty', rating: 4.5, brand: 'Himalaya', stock: 40, trust_score: 82, image_url: 'https://cdn.dummyjson.com/products/images/beauty/Eyeshadow%20Palette%20with%20Mirror/thumbnail.png' },
                    { id: 103, name: 'QuantumBook Pro 15', title: 'QuantumBook Pro 15', price: 1499.99, category: 'Electronics', rating: 4.9, brand: 'Quantum', stock: 12, trust_score: 92, image_url: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500' },
                    { id: 104, name: 'CyberRig X10', title: 'CyberRig X10', price: 2100.00, category: 'Electronics', rating: 4.7, brand: 'CyberRig', stock: 5, trust_score: 88, image_url: 'https://images.unsplash.com/photo-1600861194942-f883de0dfe96?w=500' },
                    { id: 105, name: 'Classic Wooden Dining Table', title: 'Classic Wooden Dining Table', price: 450.00, category: 'Home & Living', rating: 4.3, brand: 'RusticWood', stock: 15, trust_score: 75, image_url: 'https://cdn.dummyjson.com/products/images/furniture/Annibale%20Colombo%20Bed/thumbnail.png' },
                    { id: 106, name: 'Organic Green Tea Pack', title: 'Organic Green Tea Pack', price: 12.99, category: 'Groceries', rating: 4.6, brand: 'NatureBrew', stock: 80, trust_score: 91, image_url: 'https://cdn.dummyjson.com/products/images/groceries/Apple/thumbnail.png' }
                ]);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Reset visible count when filters are updated to maintain page 1 view
    useEffect(() => {
        setVisibleCount(24);
    }, [
        activeCategory,
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

        // 2. Search query filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const matchesTitle = p.title?.toLowerCase().includes(q) || p.name?.toLowerCase().includes(q);
            const matchesBrand = p.brand?.toLowerCase().includes(q);
            const matchesDesc = p.description?.toLowerCase().includes(q);
            const matchesCategory = p.category?.toLowerCase().includes(q);
            const matchesKeywords = Array.isArray(p.keywords) && p.keywords.some(k => k.toLowerCase().includes(q));
            
            if (!matchesTitle && !matchesBrand && !matchesDesc && !matchesCategory && !matchesKeywords) {
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
                        <Search className="search-icon" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search catalog..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
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
                            return (
                                <li 
                                    key={cat} 
                                    className={`category-item ${activeCategory === cat ? 'active' : ''}`}
                                    onClick={() => {
                                        setActiveCategory(cat);
                                        setSelectedBrands([]); // reset brand filter on category shift
                                    }}
                                >
                                    <span className="category-name">{cat}</span>
                                    <span className="category-count">{count}</span>
                                </li>
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
                            Showing <strong>{sortedProducts.length}</strong> {sortedProducts.length === 1 ? 'product' : 'products'}
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
                
                {loading ? (
                    <SkeletonLoader type="product-grid" count={6} />
                ) : error ? (
                    <div className="error-banner">
                        <AlertCircle /> {error}
                    </div>
                ) : sortedProducts.length === 0 ? (
                    <div className="empty-results glass-panel">
                        <Package size={64} className="text-muted" opacity={0.3} />
                        <h3>No Products Found</h3>
                        <p className="text-muted">No items matched your selected filters. Try broadening your criteria or reset the sidebar.</p>
                        <button className="primary-btn mt-4" onClick={handleClearAll}>
                            Reset All Filters
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="products-grid">
                            {sortedProducts.slice(0, visibleCount).map((product, index) => (
                                <ProductCardExt 
                                    key={product.id} 
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
