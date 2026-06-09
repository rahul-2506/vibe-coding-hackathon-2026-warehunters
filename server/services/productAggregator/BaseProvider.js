/**
 * Base Provider Interface for ReviewLens Marketplace Aggregator.
 * All marketplace providers must extend this class and implement its methods.
 */
export class BaseProvider {
    constructor(sourceName) {
        this.source = sourceName;
    }

    /**
     * Search products on the marketplace.
     * @param {string} query - The search query.
     * @param {string} [category] - Optional category filter.
     * @returns {Promise<Array>} Normalized product array.
     */
    async searchProducts(query, category) {
        throw new Error(`searchProducts() not implemented for provider ${this.source}`);
    }

    /**
     * Retrieve a specific product by ID.
     * @param {string|number} id - Product ID.
     * @returns {Promise<Object|null>} Normalized product object or null.
     */
    async getProduct(id) {
        throw new Error(`getProduct() not implemented for provider ${this.source}`);
    }

    /**
     * Get recommendations for a product.
     * @param {string|number} productId - Product ID.
     * @returns {Promise<Array>} Array of normalized recommended products.
     */
    async getRecommendations(productId) {
        throw new Error(`getRecommendations() not implemented for provider ${this.source}`);
    }

    /**
     * Get related products for a product.
     * @param {string|number} productId - Product ID.
     * @returns {Promise<Array>} Array of normalized related products.
     */
    async getRelatedProducts(productId) {
        throw new Error(`getRelatedProducts() not implemented for provider ${this.source}`);
    }

    /**
     * Normalize raw marketplace data into the ReviewLens v2 unified schema.
     * @param {Object} rawData - Raw data from provider.
     * @returns {Object} Normalized product object.
     */
    normalize(rawData) {
        return {
            id: rawData.id || `scraped-${this.source}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            source: this.source,
            title: rawData.title || rawData.name || '',
            brand: rawData.brand || 'Generic',
            category: rawData.category || 'Others',
            image: rawData.image || rawData.image_url || rawData.thumbnail || '',
            price: Number(rawData.price || rawData.current_price || 0),
            originalPrice: Number(rawData.originalPrice || rawData.original_price || rawData.price || 0),
            rating: Number(rawData.rating || 0),
            reviewCount: Number(rawData.reviewCount || rawData.review_count || rawData.reviews_count || 0),
            availability: rawData.availability || (rawData.stock > 0 ? 'In Stock' : 'Out of Stock'),
            productUrl: rawData.productUrl || rawData.product_url || '',
            specifications: rawData.specifications || rawData.features || {}
        };
    }
}
