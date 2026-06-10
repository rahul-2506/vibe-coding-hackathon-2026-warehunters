import React, { createContext, useState, useContext, useEffect } from 'react';

const ComparisonContext = createContext();

export const ComparisonProvider = ({ children }) => {
    const [selectedProducts, setSelectedProducts] = useState(() => {
        const saved = localStorage.getItem('selectedProducts');
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        localStorage.setItem('selectedProducts', JSON.stringify(selectedProducts));
    }, [selectedProducts]);

    const addToComparison = (product) => {
        if (selectedProducts.find(p => p.id === product.id)) {
            // Already added, remove it (toggle behavior)
            setSelectedProducts(prev => prev.filter(p => p.id !== product.id));
            return;
        }
        
        if (selectedProducts.length > 0) {
            const firstProduct = selectedProducts[0];
            if ((firstProduct.category || '').toLowerCase() !== (product.category || '').toLowerCase()) {
                alert(`You can only compare products within the same category (${firstProduct.category}).`);
                return;
            }
        }
        
        if (selectedProducts.length >= 2) {
            alert("Maximum comparison limit reached.");
            return;
        }
        
        setSelectedProducts(prev => [...prev, product]);
    };

    const removeFromComparison = (productId) => {
        setSelectedProducts(prev => prev.filter(p => p.id !== productId));
    };

    const clearComparison = () => {
        setSelectedProducts([]);
    };

    return (
        <ComparisonContext.Provider value={{ 
            selectedProducts, 
            setSelectedProducts,
            addToComparison, 
            removeFromComparison, 
            clearComparison 
        }}>
            {children}
        </ComparisonContext.Provider>
    );
};

export const useComparison = () => useContext(ComparisonContext);
