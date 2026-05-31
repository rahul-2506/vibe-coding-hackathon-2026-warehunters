import React from 'react';
import './SkeletonLoader.css';

const SkeletonLoader = ({ type = 'product-grid', count = 3 }) => {
    const items = Array.from({ length: count });

    if (type === 'product-grid') {
        return (
            <div className="skeleton-products-grid">
                {items.map((_, idx) => (
                    <div key={idx} className="skeleton-product-card">
                        {/* Shimmer Image Placeholder */}
                        <div className="skeleton-shimmer skeleton-product-img"></div>
                        
                        {/* Shimmer Metadata & Description */}
                        <div className="skeleton-rec-details">
                            <div className="skeleton-shimmer skeleton-product-text" style={{ height: '16px', width: '80%' }}></div>
                            <div className="skeleton-shimmer skeleton-product-text"></div>
                            <div className="skeleton-shimmer skeleton-product-text short"></div>
                        </div>
                        
                        {/* Shimmer Primary Action Row */}
                        <div className="skeleton-product-actions">
                            <div className="skeleton-shimmer skeleton-product-btn"></div>
                            <div className="skeleton-shimmer skeleton-product-btn"></div>
                        </div>
                        
                        {/* Shimmer Secondary Utility Row */}
                        <div className="skeleton-product-actions" style={{ marginTop: '0' }}>
                            <div className="skeleton-shimmer skeleton-product-btn"></div>
                            <div className="skeleton-shimmer skeleton-product-btn"></div>
                            <div className="skeleton-shimmer skeleton-product-btn"></div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (type === 'recommendations') {
        return (
            <div className="skeleton-recommendations-list">
                {items.map((_, idx) => (
                    <div key={idx} className="skeleton-rec-card">
                        {/* Shimmer Left Thumbnail */}
                        <div className="skeleton-shimmer skeleton-rec-avatar"></div>
                        
                        {/* Shimmer Right Metadata Rows */}
                        <div className="skeleton-rec-details">
                            <div className="skeleton-shimmer skeleton-product-text" style={{ width: '40%', height: '18px' }}></div>
                            <div className="skeleton-shimmer skeleton-product-text"></div>
                            <div className="skeleton-shimmer skeleton-product-text short"></div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return null;
};

export default SkeletonLoader;
