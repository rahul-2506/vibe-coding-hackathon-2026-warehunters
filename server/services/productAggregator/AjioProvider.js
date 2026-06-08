import { BaseProvider } from './BaseProvider.js';
import { searchScraper } from './searchScraper.js';

export class AjioProvider extends BaseProvider {
    constructor() {
        super('Ajio');
        this.domain = 'ajio.com';
    }

    async searchProducts(query, category) {
        const rawResults = await searchScraper.scrapeMerchant(this.domain, query, category);
        return rawResults.map(p => this.normalize(p));
    }

    async getProduct(id) {
        return null;
    }

    async getRecommendations(productId) {
        return [];
    }

    async getRelatedProducts(productId) {
        return [];
    }
}
