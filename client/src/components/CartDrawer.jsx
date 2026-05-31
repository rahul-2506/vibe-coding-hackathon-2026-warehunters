import React from 'react';
import { useCart } from '../context/CartContext';
import { X, Plus, Minus, Trash2, ShoppingBag, Lock, CheckCircle, ShieldCheck } from 'lucide-react';
import './CartDrawer.css';

const CartDrawer = () => {
    const { 
        cartItems, 
        isCartOpen, 
        setIsCartOpen, 
        updateQuantity, 
        removeFromCart, 
        cartTotal, 
        clearCart 
    } = useCart();
    
    const [isCheckingOut, setIsCheckingOut] = React.useState(false);
    const [orderPlaced, setOrderPlaced] = React.useState(false);

    if (!isCartOpen) return null;

    const handleCheckout = () => {
        setIsCheckingOut(true);
        setTimeout(() => {
            setIsCheckingOut(false);
            setOrderPlaced(true);
            setTimeout(() => {
                clearCart();
                setOrderPlaced(false);
                setIsCartOpen(false);
            }, 2500);
        }, 2000);
    };

    return (
        <div className="cart-overlay" onClick={() => setIsCartOpen(false)}>
            <div className="cart-drawer glass-panel" onClick={(e) => e.stopPropagation()}>
                <header className="cart-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <ShoppingBag className="text-accent" size={24} />
                        <h2>Your Clinical Cart</h2>
                    </div>
                    <button className="close-cart-btn" onClick={() => setIsCartOpen(false)}>
                        <X size={20} />
                    </button>
                </header>

                <div className="cart-items-container">
                    {orderPlaced ? (
                        <div className="checkout-success-state">
                            <CheckCircle size={64} className="success-icon" style={{ color: '#10b981' }} />
                            <h3>Audit Complete!</h3>
                            <p>Your order has been clinically verified and processed successfully.</p>
                            <span className="tx-tag">TXID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</span>
                        </div>
                    ) : isCheckingOut ? (
                        <div className="checkout-loading-state">
                            <div className="loading-scanner"></div>
                            <ShieldCheck className="loading-shield text-accent animate-pulse" size={48} />
                            <h3>Verifying Formulations...</h3>
                            <p>Our clinical database is certifying ingredient batches and batch tolerability profiles before dispatch.</p>
                        </div>
                    ) : cartItems.length === 0 ? (
                        <div className="empty-cart-state">
                            <ShoppingBag size={48} className="text-muted" opacity={0.3} />
                            <p>Your clinical cart is empty.</p>
                            <span>Add products from the catalog to proceed.</span>
                        </div>
                    ) : (
                        <div className="items-list">
                            {cartItems.map((item) => (
                                <div key={item.id} className="cart-item glass-panel">
                                    <div className="cart-item-image">
                                        {item.image_url ? (
                                            <img src={item.image_url} alt={item.name} />
                                        ) : (
                                            <ShoppingBag size={24} className="text-muted" />
                                        )}
                                    </div>
                                    <div className="cart-item-info">
                                        <h4>{item.name}</h4>
                                        <div className="cart-item-price">{Number(item.price).toFixed(2)}/-</div>
                                        <div className="quantity-controls">
                                            <button 
                                                className="qty-btn" 
                                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                            >
                                                <Minus size={12} />
                                            </button>
                                            <span className="qty-val">{item.quantity}</span>
                                            <button 
                                                className="qty-btn" 
                                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                            >
                                                <Plus size={12} />
                                            </button>
                                        </div>
                                    </div>
                                    <button 
                                        className="remove-item-btn"
                                        onClick={() => removeFromCart(item.id)}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {!orderPlaced && !isCheckingOut && cartItems.length > 0 && (
                    <footer className="cart-footer">
                        <div className="cart-summary-row">
                            <span>Subtotal</span>
                            <strong>{cartTotal.toFixed(2)}/-</strong>
                        </div>
                        <div className="cart-summary-row ship-row">
                            <span>Clinical Verification Fee</span>
                            <span className="free-tag">FREE</span>
                        </div>
                        <button className="checkout-btn bg-accent" onClick={handleCheckout}>
                            <Lock size={16} /> SECURE CHECKOUT AUDIT
                        </button>
                    </footer>
                )}
            </div>
        </div>
    );
};

export default CartDrawer;
