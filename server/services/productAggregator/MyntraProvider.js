import { BaseProvider } from './BaseProvider.js';
import { searchScraper } from './searchScraper.js';

export class MyntraProvider extends BaseProvider {
    constructor() {
        super('Myntra');
        this.domain = 'myntra.com';
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
