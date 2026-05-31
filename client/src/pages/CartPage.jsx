import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { ArrowLeft, Bell, Trash2, Play, Square, Wifi, Sparkles, RefreshCw, ShieldAlert } from 'lucide-react';
import SafeImage from '../components/SafeImage';
import './CartPage.css';
import { API_BASE_URL } from '../config/api';

const CartPage = () => {
    const navigate = useNavigate();
    const { cartItems, removeFromCart, clearCart } = useCart();

    // Watchlist States keyed by product ID
    const [targetPrices, setTargetPrices] = useState({});
    const [checkingStatus, setCheckingStatus] = useState({});
    const [scanLogs, setScanLogs] = useState({});
    const [notifications, setNotifications] = useState({});
    const [intervals, setIntervals] = useState({});

    // Stable reference to active interval IDs to prevent useEffect cleanup bugs
    const intervalsRef = useRef({});

    // Request browser notification permissions on mount
    useEffect(() => {
        if ("Notification" in window) {
            if (Notification.permission === "default") {
                Notification.requestPermission();
            }
        }
    }, []);

    // Cleanup active intervals on unmount
    useEffect(() => {
        return () => {
            Object.values(intervalsRef.current).forEach(clearInterval);
        };
    }, []);

    const handlePriceChange = (productId, val) => {
        setTargetPrices(prev => ({ ...prev, [productId]: val }));
    };

    const stopLiveChecking = (itemId) => {
        if (intervalsRef.current[itemId]) {
            clearInterval(intervalsRef.current[itemId]);
            delete intervalsRef.current[itemId];
        }
        setCheckingStatus(prev => ({ ...prev, [itemId]: false }));
        setScanLogs(prev => ({
            ...prev,
            [itemId]: [...(prev[itemId] || []), {
                time: new Date().toLocaleTimeString(),
                message: "Scanning daemon manually suspended.",
                type: "system"
            }]
        }));
    };

    const startLiveChecking = (item) => {
        const target = targetPrices[item.id];
        if (!target || Number(target) <= 0) {
            alert("Please enter a target price first!");
            return;
        }

        // Reset scanning indicators for this item
        setCheckingStatus(prev => ({ ...prev, [item.id]: true }));
        setNotifications(prev => ({ ...prev, [item.id]: null }));
        setScanLogs(prev => ({
            ...prev,
            [item.id]: [{ time: new Date().toLocaleTimeString(), message: "Continuous real live scanner launched...", type: "system" }]
        }));

        let tick = 0;

        const checkPrice = async () => {
            tick++;
            
            setScanLogs(prev => ({
                ...prev,
                [item.id]: [...(prev[item.id] || []), {
                    time: new Date().toLocaleTimeString(),
                    message: `Scraping external platforms for: ${item.name}...`,
                    type: "scan"
                }]
            }));

            try {
                const res = await fetch(`${API_BASE_URL}/api/ai/scrape-price`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ product_name: item.name })
                });

                if (!res.ok) {
                    throw new Error("Scraper blocked or failed to find price");
                }
                
                const data = await res.json();
                const scannedPrice = data.price;
                const targetPlatform = data.platform || 'Flipkart';

                setScanLogs(prev => ({
                    ...prev,
                    [item.id]: [...(prev[item.id] || []), {
                        time: new Date().toLocaleTimeString(),
                        message: `✅ Scraped ${targetPlatform}: Live Price = ₹${scannedPrice}/-`,
                        type: "scan"
                    }]
                }));

                // Check match
                if (scannedPrice <= Number(target)) {
                    if (intervalsRef.current[item.id]) clearInterval(intervalsRef.current[item.id]);
                    delete intervalsRef.current[item.id];
                    setCheckingStatus(prev => ({ ...prev, [item.id]: false }));
                    setNotifications(prev => ({
                        ...prev,
                        [item.id]: {
                            platform: targetPlatform,
                            price: scannedPrice,
                            title: "🎉 Target Price Matched!",
                            message: `Excellent! ${targetPlatform} matched your target price of ₹${target}/- with a live rate of ₹${scannedPrice}/-!`
                        }
                    }));

                    // Native HTML5 Browser OS Notification Alert
                    if ("Notification" in window && Notification.permission === "granted") {
                        new Notification("🚨 Skincare Price Alert!", {
                            body: `Excellent! ${item.name} has matched your alert price of ₹${target}/-! Live deal found at ₹${scannedPrice}/- on ${targetPlatform}!`,
                            requireInteraction: true
                        });
                    }

                    // Clinical audio alert
                    try {
                        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                        const oscillator = audioCtx.createOscillator();
                        const gainNode = audioCtx.createGain();
                        oscillator.type = 'sine';
                        oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
                        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
                        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
                        oscillator.connect(gainNode);
                        gainNode.connect(audioCtx.destination);
                        oscillator.start();
                        oscillator.stop(audioCtx.currentTime + 0.4);
                    } catch (e) {
                        console.log("Audio blocked");
                    }
                }
            } catch (err) {
                setScanLogs(prev => ({
                    ...prev,
                    [item.id]: [...(prev[item.id] || []), {
                        time: new Date().toLocaleTimeString(),
                        message: `⚠️ Scraper issue: ${err.message}. Retrying...`,
                        type: "error"
                    }]
                }));
            }

            // Stop after 15 ticks to avoid IP bans
            if (tick >= 15) {
                if (intervalsRef.current[item.id]) clearInterval(intervalsRef.current[item.id]);
                delete intervalsRef.current[item.id];
                setCheckingStatus(prev => ({ ...prev, [item.id]: false }));
                setScanLogs(prev => ({
                    ...prev,
                    [item.id]: [...(prev[item.id] || []), {
                        time: new Date().toLocaleTimeString(),
                        message: "Monitoring session timed out. Adjust threshold or restart.",
                        type: "error"
                    }]
                }));
            }
        };

        checkPrice();
        const intervalId = setInterval(checkPrice, 10000);
        intervalsRef.current[item.id] = intervalId;
    };

    return (
        <div className="cart-page-container">
            <header className="cart-header">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <ArrowLeft size={18} /> Back
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Bell className="text-accent text-glow" size={26} />
                    <h1>AI Price Watchlist</h1>
                </div>
            </header>

            {cartItems.length === 0 ? (
                <div className="empty-cart-view glass-panel">
                    <Bell size={56} opacity={0.3} className="text-muted" />
                    <h2>Your Price Watchlist is Empty</h2>
                    <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto 1.5rem auto' }}>
                        Add clinical skincare products to your watchlist from the catalog to monitor live prices continuously across major platforms.
                    </p>
                    <Link to="/products" className="continue-btn" style={{ textDecoration: 'none', display: 'inline-block' }}>
                        Browse Skincare Catalog
                    </Link>
                </div>
            ) : (
                <div className="watchlist-layout">
                    <div className="watchlist-header-bar">
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                            Currently monitoring <strong>{cartItems.length}</strong> items. Set your target price threshold and launch continuous checks.
                        </p>
                        <button className="clear-watchlist-btn" onClick={clearCart}>
                            Clear All Items
                        </button>
                    </div>

                    <div className="watchlist-grid">
                        {cartItems.map((item) => {
                            const isChecking = checkingStatus[item.id] || false;
                            const itemLogs = scanLogs[item.id] || [];
                            const notification = notifications[item.id];
                            const target = targetPrices[item.id] || '';

                            return (
                                <div key={item.id} className="watchlist-card glass-panel">
                                    {notification && (
                                        <div className="card-notification-alert">
                                            <Bell className="swinging-bell" size={20} />
                                            <div className="alert-body">
                                                <h4>{notification.title}</h4>
                                                <p>{notification.message}</p>
                                                <button className="view-deal-btn" onClick={() => window.open('https://amazon.in', '_blank')}>
                                                    View Live Deal on {notification.platform}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="card-top-row">
                                        <div className="item-img-box">
                                            <SafeImage src={item.image_url} alt={item.name} />
                                        </div>
                                        <div className="item-info">
                                            <span className="item-cat text-accent">{item.category}</span>
                                            <h3>{item.name}</h3>
                                            <div className="current-price-row">
                                                <span>Base Store Price:</span>
                                                <strong>₹{Number(item.price).toFixed(2)}/-</strong>
                                            </div>
                                        </div>
                                        <button className="remove-watch-btn" onClick={() => removeFromCart(item.id)} title="Remove from Watchlist">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    {/* Price Alert Form Controls */}
                                    <div className="price-alert-setup">
                                        <div className="alert-input-box">
                                            <label htmlFor={`target-${item.id}`}>Target Alert Price (₹)</label>
                                            <div className="alert-input-field">
                                                <span>₹</span>
                                                <input 
                                                    id={`target-${item.id}`}
                                                    type="number" 
                                                    placeholder="Enter your price"
                                                    value={target}
                                                    onChange={(e) => handlePriceChange(item.id, e.target.value)}
                                                    disabled={isChecking}
                                                />
                                            </div>
                                        </div>

                                        <button 
                                            className={`start-live-check-btn ${isChecking ? 'checking stopping-btn' : ''}`}
                                            onClick={() => isChecking ? stopLiveChecking(item.id) : startLiveChecking(item)}
                                            style={{
                                                background: isChecking ? '#ef4444' : 'var(--accent-color)',
                                                boxShadow: isChecking ? '0 4px 10px rgba(239, 68, 68, 0.25)' : '0 4px 10px rgba(99, 102, 241, 0.25)'
                                            }}
                                        >
                                            {isChecking ? (
                                                <>
                                                    <Square size={14} fill="white" />
                                                    Stop Scanner
                                                </>
                                            ) : (
                                                <>
                                                    <Play size={14} fill="white" />
                                                    Start Live Checking
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {/* Terminal Feed logs for each individual product */}
                                    <div className="watchlist-terminal-box">
                                        <div className="term-header">
                                            <span>
                                                <Wifi size={12} className={isChecking ? "text-accent animate-pulse" : "text-muted"} />
                                                Live Ticker Console
                                            </span>
                                            {isChecking && <span className="term-active-badge">SCANNING</span>}
                                        </div>
                                        <div className="term-body">
                                            {itemLogs.length === 0 ? (
                                                <div className="term-placeholder">
                                                    <ShieldAlert size={20} opacity={0.3} />
                                                    <span>Waiting for scanning session</span>
                                                </div>
                                            ) : (
                                                itemLogs.map((log, idx) => (
                                                    <div key={idx} className={`term-line ${log.type}`}>
                                                        <span className="term-time">[{log.time}]</span>
                                                        <span className="term-msg">{log.message}</span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CartPage;
