import { BaseProvider } from './BaseProvider.js';
import { supabase } from '../../db.js';
import { logger } from '../../utils/logger.js';

export class InternalDbProvider extends BaseProvider {
    constructor() {
        super('Internal Database');
    }

    async searchProducts(query, category) {
        logger.info(`[INTERNAL DB PROVIDER] Searching for: "${query}"`, 'INTERNAL_PROVIDER');
        try {
            let queryBuilder = supabase.from('products').select('*');
            
            if (category && category !== 'All' && category !== '') {
                queryBuilder = queryBuilder.eq('category', category);
            }

            const { data, error } = await queryBuilder;
            if (error) throw error;

            const products = data || [];
            
            // If no search query, return everything
            if (!query || query.trim() === '') {
                return products.map(p => this.normalize(p));
            }

            const cleanQuery = query.toLowerCase().trim();
            const filtered = products.filter(p => {
                const title = (p.title || p.name || '').toLowerCase();
                const desc = (p.description || '').toLowerCase();
                const brand = (p.brand || '').toLowerCase();
                const keywords = Array.isArray(p.keywords) ? p.keywords.join(' ').toLowerCase() : '';

                return title.includes(cleanQuery) || 
                       desc.includes(cleanQuery) || 
                       brand.includes(cleanQuery) || 
                       keywords.includes(cleanQuery);
            });

            return filtered.map(p => this.normalize(p));
        } catch (err) {
            logger.error(`[INTERNAL DB PROVIDER ERROR] search failed: ${err.message}`, 'INTERNAL_PROVIDER');
            return [];
        }
    }

    async getProduct(id) {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('id', Number(id))
                .single();

            if (error) throw error;
            return data ? this.normalize(data) : null;
        } catch (err) {
            logger.error(`[INTERNAL DB PROVIDER ERROR] getProduct failed: ${err.message}`, 'INTERNAL_PROVIDER');
            return null;
        }
    }

    async getRecommendations(productId) {
        return [];
    }

    async getRelatedProducts(productId) {
        return [];
    }

    normalize(p) {
        // Adapt products schema mapping
        return {
            id: Number(p.id),
            source: this.source,
            title: p.title || p.name || '',
            brand: p.brand || 'Generic',
            category: p.category || 'Others',
            image: p.image_url || p.thumbnail || '',
            price: Number(p.price || 0),
            originalPrice: Number(p.original_price || p.price || 0),
            rating: Number(p.rating || 0),
            reviewCount: Number(p.review_count || p.reviews_count || 0),
            availability: p.stock > 0 ? 'In Stock' : 'Out of Stock',
            productUrl: p.product_url || '',
            specifications: p.features || {}
        };
    }
}
