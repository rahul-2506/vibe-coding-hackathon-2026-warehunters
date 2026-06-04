import { logger } from '../../utils/logger.js';

export const agentPlanner = {
    /**
     * Plans the execution strategy based on detected intent, entities, and loaded memory context.
     * @param {string} intent - Intent from intentDetector
     * @param {Object} entities - Extracted entities
     * @param {Object} memory - Persisted user memories
     * @returns {Object} Agent plan object { goal, information_needed, missing_information, tools_to_use }
     */
    plan(intent, entities, memory = {}) {
        logger.info(`[AGENT PLANNER] Creating plan for intent=${intent}`, 'AI_PLANNER');

        const activeMemory = memory || {};
        const activeEntities = entities || {};

        const plan = {
            goal: '',
            information_needed: [],
            missing_information: [],
            tools_to_use: []
        };

        // Determine plan based on intent
        switch (intent) {
            case 'GREETING':
                plan.goal = 'greet user and describe features';
                plan.tools_to_use = [];
                break;

            case 'PRODUCT_SEARCH':
            case 'PRODUCT_RECOMMENDATION':
                plan.goal = 'discover and recommend catalog products';
                plan.information_needed = ['skin_type', 'concern', 'budget'];
                plan.tools_to_use = ['productSearch'];
                
                // Check if we have these parameters in entities or memory
                const currentSkinType = activeEntities.skin_type || activeMemory.skin_type;
                const currentConcern = activeEntities.concern || (activeMemory.concerns && activeMemory.concerns[0]);
                
                if (!currentSkinType) {
                    plan.missing_information.push('skin_type');
                }
                if (!currentConcern) {
                    plan.missing_information.push('concern');
                }
                break;

            case 'COMPARE':
                plan.goal = 'compare two products side-by-side';
                plan.information_needed = ['product_a', 'product_b'];
                plan.tools_to_use = ['comparisonTool'];

                if (!activeEntities.product_a && !activeEntities.product_b) {
                    plan.missing_information.push('product_a');
                    plan.missing_information.push('product_b');
                } else if (!activeEntities.product_a) {
                    plan.missing_information.push('product_a');
                } else if (!activeEntities.product_b) {
                    plan.missing_information.push('product_b');
                }
                break;

            case 'ROUTINE_BUILDER':
                plan.goal = 'build personalized skincare routine';
                plan.information_needed = ['skin_type', 'concern'];
                plan.tools_to_use = ['comparisonTool']; // comparison tool has routine building or productSearch

                const rSkinType = activeEntities.skin_type || activeMemory.skin_type;
                const rConcern = activeEntities.concern || (activeMemory.concerns && activeMemory.concerns[0]);

                if (!rSkinType) {
                    plan.missing_information.push('skin_type');
                }
                if (!rConcern) {
                    plan.missing_information.push('concern');
                }
                break;

            case 'PRICE_INQUIRY':
                plan.goal = 'inspect pricing or find budget products';
                plan.information_needed = ['product_a', 'budget'];
                plan.tools_to_use = ['productSearch'];
                
                if (!activeEntities.product_a && !activeEntities.brand) {
                    plan.missing_information.push('product_a');
                }
                break;

            case 'INGREDIENT_INFO':
                plan.goal = 'explain skin active ingredient safety and benefits';
                plan.information_needed = ['ingredient'];
                plan.tools_to_use = ['ingredientAnalyzer'];

                if (!activeEntities.ingredient) {
                    plan.missing_information.push('ingredient');
                }
                break;

            case 'TRUST_ANALYSIS':
                plan.goal = 'evaluate authenticity and integrity of product reviews';
                plan.information_needed = ['product_a'];
                plan.tools_to_use = ['reviewAnalyzer'];

                if (!activeEntities.product_a) {
                    plan.missing_information.push('product_a');
                }
                break;

            case 'GENERAL_CHAT':
            default:
                plan.goal = 'provide conversational chat response grounded in knowledge';
                plan.tools_to_use = ['webSearch'];
                break;
        }

        logger.info(`[AGENT PLANNER] Plan generated: Goal="${plan.goal}", MissingInfo=[${plan.missing_information.join(', ')}], Tools=[${plan.tools_to_use.join(', ')}]`, 'AI_PLANNER');
        return plan;
    }
};
