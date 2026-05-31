import React, { useState, useEffect } from 'react';
import { Package } from 'lucide-react';
import './SafeImage.css';

/**
 * SafeImage: Encapsulates lazy loading, shimmer skeleton loading, 
 * standard aspect ratios, and elegant SVG gradient fallbacks for broken image URLs.
 */
const SafeImage = ({ src, alt, className = '', aspectRatio = '1/1', ...props }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    // Validate if the URL has a correct protocol or format
    const isValidUrl = (url) => {
        if (!url || typeof url !== 'string') return false;
        const trimmed = url.trim();
        return trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:');
    };

    const handleLoad = () => {
        setLoading(false);
    };

    const handleError = () => {
        setLoading(false);
        setError(true);
        console.warn(`[Image Pipeline] Dead or broken image URL encountered: "${src}". Graceful placeholder applied.`);
    };

    const isBroken = error || !isValidUrl(src);

    useEffect(() => {
        if (!isValidUrl(src)) {
            setLoading(false);
            console.warn(`[Image Pipeline] Empty or invalid image URL: "${src || 'None'}" for product "${alt || 'Unknown'}". Graceful placeholder applied.`);
        } else {
            setLoading(true);
            setError(false);
        }
    }, [src, alt]);

    return (
        <div 
            className={`safe-image-container ${className}`} 
            style={{ aspectRatio }}
        >
            {loading && !isBroken && (
                <div className="skeleton-shimmer safe-image-skeleton" />
            )}

            {isBroken ? (
                <div className="safe-image-fallback fade-in">
                    <div className="fallback-gradient-bg" />
                    <div className="fallback-content">
                        <Package size={36} className="fallback-icon" />
                        <span className="fallback-text">No Asset Preview</span>
                    </div>
                </div>
            ) : (
                <img
                    src={src}
                    alt={alt || 'Product Image'}
                    loading="lazy"
                    decoding="async"
                    onLoad={handleLoad}
                    onError={handleError}
                    className="safe-img"
                    style={{ 
                        opacity: loading ? 0 : 1,
                        transition: 'opacity 0.25s ease-in-out'
                    }}
                    {...props}
                />
            )}
        </div>
    );
};

export default SafeImage;
