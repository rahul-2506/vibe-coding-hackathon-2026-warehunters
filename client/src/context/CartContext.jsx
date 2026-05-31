import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load cart on mount / when auth state changes
  useEffect(() => {
    const loadCart = async () => {
      let loadedItems = [];
      if (user) {
        try {
          const { data, error } = await supabase
            .from('watchlists')
            .select('items')
            .eq('user_id', user.id)
            .single();
          
          if (error) {
            console.warn('[CartContext] Supabase watchlist table/columns not matching schema, using local fallback:', error.message);
            const saved = localStorage.getItem('userCart');
            loadedItems = saved ? JSON.parse(saved) : [];
          } else {
            loadedItems = data?.items || [];
          }
        } catch (err) {
          console.warn('[CartContext] Failed to load watchlist from Supabase, using local fallback:', err);
          const saved = localStorage.getItem('userCart');
          loadedItems = saved ? JSON.parse(saved) : [];
        }
      } else {
        try {
          const saved = localStorage.getItem('userCart');
          loadedItems = saved ? JSON.parse(saved) : [];
        } catch {
          loadedItems = [];
        }
      }
      setCartItems(loadedItems);
      setLoading(false);
    };
    loadCart();
  }, [user]);

  // Sync cart updates to Supabase or localStorage
  useEffect(() => {
    if (loading) return; // avoid persisting before initial load
    const syncCart = async () => {
      if (user) {
        try {
          const { error } = await supabase.from('watchlists').upsert(
            { user_id: user.id, items: cartItems },
            { onConflict: 'user_id' }
          );
          if (error) {
            console.warn('[CartContext] Supabase watchlist sync skipped (schema mismatch):', error.message);
            localStorage.setItem('userCart', JSON.stringify(cartItems));
          }
        } catch (err) {
          console.warn('[CartContext] Supabase watchlist sync failed:', err);
          localStorage.setItem('userCart', JSON.stringify(cartItems));
        }
      } else {
        localStorage.setItem('userCart', JSON.stringify(cartItems));
      }
    };
    syncCart();
  }, [cartItems, user, loading]);

  const addToCart = (product) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId) => {
    setCartItems(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCartItems(prev =>
      prev.map(item => (item.id === productId ? { ...item, quantity } : item))
    );
  };

  const clearCart = () => setCartItems([]);

  const cartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const cartTotal = cartItems.reduce((acc, item) => acc + Number(item.price) * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        isCartOpen,
        setIsCartOpen,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartCount,
        cartTotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
