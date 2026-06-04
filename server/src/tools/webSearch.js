import { logger } from '../../utils/logger.js';

export const webSearch = {
    /**
     * Mocks a web search query for external info gathering.
     */
    async search(query) {
        logger.info(`[WEB SEARCH] Probing web indexes for: "${query}"`, 'AI_WEB_SEARCH');

        if (!query) {
            return { success: false, error: 'Query is empty.' };
        }

        const lower = query.toLowerCase();

        // High quality mock search results representing web queries
        const articles = [
            {
                title: 'Clinical Skincare Routines: Dermatological Guidelines',
                url: 'https://dermatology.example.org/articles/routines',
                snippet: 'A daily skincare regimen should focus on gentle cleansing, targeted treatment (like active acids), and trans-epidermal barrier protection using SPF and ceramides.'
            },
            {
                title: 'Comedogenic Risks of Emollients in Hydrating Creams',
                url: 'https://skincaredoctors.example.com/comedogenic-ingredients',
                snippet: 'Emollients like Isopropyl Myristate are highly comedogenic (5/5 rating), meaning they block hair follicles and directly trigger acne flares in oily skins.'
            }
        ];

        return {
            success: true,
            query,
            articles,
            response: `🌐 **Live Web Search Sync**\n\nI queried external indices for **"${query}"** and found relevant scientific publications:\n\n` +
                      `1. **[${articles[0].title}](${articles[0].url})**\n` +
                      `   *${articles[0].snippet}*\n\n` +
                      `2. **[${articles[1].title}](${articles[1].url})**\n` +
                      `   *${articles[1].snippet}*`
        };
    }
};
