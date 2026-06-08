import { BaseProvider } from './BaseProvider.js';
import { searchScraper } from './searchScraper.js';

export class AmazonProvider extends BaseProvider {
    constructor() {
        super('Amazon');
        this.domain = 'amazon.in';
    }

    async searchProducts(query, category) {
        const rawResults = await searchScraper.scrapeMerchant(this.domain, query, category);
        return rawResults.map(p => this.normalize(p));
    }

    async getProduct(id) {
        return null; // Wildcard detail scraper is optional, handled via web scraper fallbacks
    }

    async getRecommendations(productId) {
        return [];
    }

    async getRelatedProducts(productId) {
        return [];
    }
}
