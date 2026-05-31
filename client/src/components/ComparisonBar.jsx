import React from 'react';
import { useComparison } from '../context/ComparisonContext';
import { X, GitCompare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ComparisonBar = () => {
    const { selectedProducts, removeFromComparison, clearComparison } = useComparison();
    const navigate = useNavigate();

    if (selectedProducts.length === 0) return null;

    return (
        <div className="comparison-bar glass-panel animate-slide-up">
            <div className="comparison-bar-content">
                <div className="selected-items">
                    {selectedProducts.map(product => (
                        <div key={product.id} className="selected-product-chip">
                            <img src={product.image_url} alt={product.name} />
                            <span>{product.name.split(' ').slice(0, 2).join(' ')}</span>
                            <button onClick={() => removeFromComparison(product.id)}>
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                    {selectedProducts.length < 2 && (
                        <div className="comparison-placeholder">
                            Select one more to compare
                        </div>
                    )}
                </div>
                
                <div className="comparison-actions">
                    <button 
                        className="btn-clear" 
                        onClick={clearComparison}
                    >
                        Clear
                    </button>
                    <button 
                        className="btn-compare-now" 
                        disabled={selectedProducts.length < 2}
                        onClick={() => navigate('/compare')}
                    >
                        <GitCompare size={18} />
                        Compare Now
                    </button>
                </div>
            </div>

            <style jsx>{`
                .comparison-bar {
                    position: fixed;
                    bottom: 2rem;
                    left: 50%;
                    transform: translateX(-50%);
                    width: auto;
                    min-width: 400px;
                    max-width: 90%;
                    background: rgba(15, 15, 20, 0.85);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 100px;
                    padding: 0.75rem 1.5rem;
                    z-index: 1000;
                    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
                }

                .comparison-bar-content {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 2rem;
                }

                .selected-items {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .selected-product-chip {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    background: rgba(255, 255, 255, 0.05);
                    padding: 0.25rem 0.75rem 0.25rem 0.25rem;
                    border-radius: 50px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }

                .selected-product-chip img {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    object-fit: cover;
                }

                .selected-product-chip span {
                    font-size: 0.85rem;
                    font-weight: 500;
                    color: white;
                }

                .selected-product-chip button {
                    background: none;
                    border: none;
                    color: rgba(255, 255, 255, 0.5);
                    cursor: pointer;
                    display: flex;
                    padding: 2px;
                }

                .selected-product-chip button:hover {
                    color: white;
                }

                .comparison-placeholder {
                    font-size: 0.85rem;
                    color: rgba(255, 255, 255, 0.4);
                    font-style: italic;
                    padding-left: 0.5rem;
                }

                .comparison-actions {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .btn-clear {
                    background: none;
                    border: none;
                    color: rgba(255, 255, 255, 0.5);
                    font-size: 0.85rem;
                    cursor: pointer;
                    padding: 0.5rem 1rem;
                }

                .btn-clear:hover {
                    color: white;
                }

                .btn-compare-now {
                    background: linear-gradient(135deg, var(--accent-color) 0%, #a855f7 100%);
                    color: white;
                    border: none;
                    padding: 0.6rem 1.5rem;
                    border-radius: 50px;
                    font-weight: 700;
                    font-size: 0.9rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .btn-compare-now:hover:not(:disabled) {
                    transform: scale(1.05);
                    box-shadow: 0 0 20px rgba(99, 102, 241, 0.4);
                }

                .btn-compare-now:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    background: #333;
                }

                @keyframes slide-up {
                    from { transform: translate(-50%, 100%); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }

                .animate-slide-up {
                    animation: slide-up 0.5s cubic-bezier(0.4, 0, 0.2, 1);
                }
            `}</style>
        </div>
    );
};

export default ComparisonBar;
