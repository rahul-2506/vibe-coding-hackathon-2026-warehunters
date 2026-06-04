import { logger } from '../../utils/logger.js';
import { memoryManager } from './memoryManager.js';

// Import tools dynamically to prevent circular dependencies
let productSearchTool = null;
let comparisonTool = null;
let reviewAnalyzerTool = null;
let ingredientAnalyzerTool = null;
let webSearchTool = null;

async function loadTools() {
    if (!productSearchTool) {
        productSearchTool = (await import('../tools/productSearch.js')).productSearch;
        comparisonTool = (await import('../tools/comparisonTool.js')).comparisonTool;
        reviewAnalyzerTool = (await import('../tools/reviewAnalyzer.js')).reviewAnalyzer;
        ingredientAnalyzerTool = (await import('../tools/ingredientAnalyzer.js')).ingredientAnalyzer;
        webSearchTool = (await import('../tools/webSearch.js')).webSearch;
    }
}

export const toolRouter = {
    /**
     * Executes the planned tool with specific parameters.
     */
    async execute(plan, entities, userId = 'anonymous', keys = {}) {
        await loadTools();

        const toolName = plan.tools_to_use[0];
        logger.info(`[TOOL ROUTER] Routing to tool: ${toolName || 'none'}`, 'AI_ROUTER');

        if (!toolName) {
            return { success: true, message: 'No tool execution required.' };
        }

        try {
            let result = null;

            switch (toolName) {
                case 'productSearch':
                    const query = entities.product_a || entities.brand || '';
                    result = await productSearchTool.search({
                        query,
                        category: entities.category || null,
                        skinType: entities.skin_type || null,
                        concern: entities.concern || null,
                        budget: entities.budget || null
                    });
                    
                    const count = result.products ? result.products.length : 0;
                    await memoryManager.logToolUsage(userId, 'productSearch', query, count);
                    break;

                case 'comparisonTool':
                    const prodA = entities.product_a || '';
                    const prodB = entities.product_b || '';
                    result = await comparisonTool.compare(prodA, prodB, keys);
                    
                    await memoryManager.logToolUsage(userId, 'comparisonTool', `${prodA} vs ${prodB}`, result.success ? 1 : 0);
                    break;

                case 'reviewAnalyzer':
                    const prod = entities.product_a || '';
                    result = await reviewAnalyzerTool.analyze(prod, keys);
                    
                    await memoryManager.logToolUsage(userId, 'reviewAnalyzer', prod, result.success ? 1 : 0);
                    break;

                case 'ingredientAnalyzer':
                    const ingredient = entities.ingredient || '';
                    result = await ingredientAnalyzerTool.analyze(ingredient);
                    
                    await memoryManager.logToolUsage(userId, 'ingredientAnalyzer', ingredient, result.success ? 1 : 0);
                    break;

                case 'webSearch':
                    const webQuery = entities.product_a || '';
                    result = await webSearchTool.search(webQuery);
                    
                    await memoryManager.logToolUsage(userId, 'webSearch', webQuery, result.success ? 1 : 0);
                    break;

                default:
                    logger.warn(`[TOOL ROUTER] Unknown tool name: ${toolName}`, 'AI_ROUTER');
                    result = { success: false, error: `Tool ${toolName} not supported.` };
            }

            return result;
        } catch (err) {
            logger.error(`[TOOL ROUTER] Execution failure on tool ${toolName}: ${err.message}`, 'AI_ROUTER');
            return { success: false, error: err.message };
        }
    }
};
