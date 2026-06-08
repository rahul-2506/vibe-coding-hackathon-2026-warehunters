import { BaseProvider } from './BaseProvider.js';
import { searchScraper } from './searchScraper.js';

export class RelianceDigitalProvider extends BaseProvider {
    constructor() {
        super('Reliance Digital');
        this.domain = 'reliancedigital.in';
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
