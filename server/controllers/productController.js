import { productService } from '../services/productService.js';
import { supabase } from '../db.js';
import { response } from '../utils/response.js';

export const productController = {
    async getAll(req, res, next) {
        try {
            const { page, limit, category, subcategory, q, sort } = req.query;
            
            if (page || limit) {
                const paginated = await productService.getPaginatedProducts({
                    page: Number(page) || 1,
                    limit: Number(limit) || 24,
                    category,
                    subcategory,
                    searchQuery: q,
                    sort
                });
                return response.success(res, paginated);
            }
            
            const products = await productService.searchProducts(q, category, sort, subcategory);
            return response.success(res, products);
        } catch (err) {
            next(err);
        }
    },

    async getById(req, res, next) {
        try {
            const product = await productService.getProductById(req.params.id);
            if (!product) {
                return response.error(res, 'Product not found', null, 404);
            }
            return response.success(res, product);
        } catch (err) {
            next(err);
        }
    },

    async getByCategory(req, res, next) {
        try {
            const products = await productService.getProductsByCategory(req.params.name);
            return response.success(res, products);
        } catch (err) {
            next(err);
        }
    },

    async getReviews(req, res, next) {
        try {
            const productId = Number(req.params.id);
            
            const { data: reviews, error } = await supabase
                .from('reviews')
                .select('*')
                .eq('product_id', productId)
                .order('created_at', { ascending: false });
                
            if (error) {
                console.error('[productController] Supabase reviews query failed:', error.message);
                throw error;
            }
            
            return response.success(res, reviews || []);
        } catch (err) {
            next(err);
        }
    }
};
