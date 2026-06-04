import { BaseImporter } from './importerService.js';

export class AmazonImporter extends BaseImporter {
    constructor() {
        super('Amazon');
    }

    normalizeRecord(raw) {
        // Safe price resolution
        const price = Number(raw.price || raw.sale_price || raw.price_inr || raw.amount) || 0;
        const originalPrice = Number(raw.original_price || raw.list_price || raw.mrp) || price;

        // Parse specifications/features
        const features = [];
        if (raw.features && typeof raw.features === 'object') {
            if (Array.isArray(raw.features)) {
                raw.features.forEach(f => {
                    if (typeof f === 'object' && f.name && f.value) {
                        features.push(f);
                    } else if (typeof f === 'string') {
                        const parts = f.split(':');
                        features.push({
                            name: parts[0]?.trim() || 'Feature',
                            value: parts[1]?.trim() || f
                        });
                    }
                });
            } else {
                Object.entries(raw.features).forEach(([k, v]) => {
                    features.push({ name: k, value: String(v) });
                });
            }
        } else if (raw.specifications && typeof raw.specifications === 'object') {
            Object.entries(raw.specifications).forEach(([k, v]) => {
                features.push({ name: k, value: String(v) });
            });
        }

        // Parse reviews list
        const reviews = [];
        if (Array.isArray(raw.reviews)) {
            raw.reviews.forEach(r => {
                reviews.push({
                    text: r.review_text || r.text || r.body || '',
                    rating: Number(r.rating || r.stars) || 4,
                    sentiment: r.sentiment || 'neutral'
                });
            });
        } else if (Array.isArray(raw.customer_reviews)) {
            raw.customer_reviews.forEach(r => {
                reviews.push({
                    text: r.review_text || r.text || r.body || '',
                    rating: Number(r.rating || r.stars) || 4,
                    sentiment: r.sentiment || 'neutral'
                });
            });
        }

        return {
            external_id: raw.asin || raw.external_id || raw.id || null,
            title: raw.title || raw.product_name || raw.name || '',
            brand: raw.brand || 'Generic',
            category: raw.category || 'Electronics',
            description: raw.description || raw.about_item || raw.bullets || '',
            image_url: raw.image_url || raw.main_image || raw.imageUrl || '',
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

export const amazonImporter = new AmazonImporter();
