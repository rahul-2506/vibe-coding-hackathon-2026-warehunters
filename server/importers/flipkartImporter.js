import { BaseImporter } from './importerService.js';

export class FlipkartImporter extends BaseImporter {
    constructor() {
        super('Flipkart');
    }

    normalizeRecord(raw) {
        // Safe price resolution
        const price = Number(raw.price || raw.selling_price || raw.flipkart_price) || 0;
        const originalPrice = Number(raw.original_price || raw.retail_price || raw.mrp) || price;

        // Parse features / specifications
        const features = [];
        if (raw.highlights && typeof raw.highlights === 'object') {
            if (Array.isArray(raw.highlights)) {
                raw.highlights.forEach(h => {
                    features.push({ name: 'Highlight', value: String(h) });
                });
            } else {
                Object.entries(raw.highlights).forEach(([k, v]) => {
                    features.push({ name: k, value: String(v) });
                });
            }
        } else if (raw.specifications && typeof raw.specifications === 'object') {
            Object.entries(raw.specifications).forEach(([k, v]) => {
                features.push({ name: k, value: String(v) });
            });
        }

        // Parse reviews
        const reviews = [];
        if (Array.isArray(raw.reviews)) {
            raw.reviews.forEach(r => {
                reviews.push({
                    text: r.review_text || r.text || r.body || '',
                    rating: Number(r.rating || r.stars) || 4,
                    sentiment: r.sentiment || 'neutral'
                });
            });
        }

        return {
            external_id: raw.fsn || raw.external_id || raw.id || null,
            title: raw.title || raw.product_name || raw.name || '',
            brand: raw.brand || 'Generic',
            category: raw.category || 'Fashion',
            description: raw.description || raw.highlights_text || '',
            image_url: raw.image_url || (Array.isArray(raw.images) ? raw.images[0] : null) || '',
            product_url: raw.product_url || raw.url || '',
            price,
            original_price: originalPrice,
            rating: Number(raw.rating || raw.average_rating || raw.stars) || 4.0,
            review_count: Number(raw.review_count || raw.total_reviews || raw.reviews_count) || 0,
            features,
            reviews
        };
    }
}

export const flipkartImporter = new FlipkartImporter();
