import { logger } from '../../utils/logger.js';

export const reasoningEngine = {
    /**
     * Builds the reasoning context before generating a response.
     * This object helps direct the Response Generator and is not shown to users.
     */
    compileReasoning(params) {
        const { intent, entities, memory, plan, ragContext } = params;

        logger.info(`[REASONING ENGINE] Compiling reasoning object for intent=${intent}`, 'AI_REASONING');

        // Compile strategy based on missing info or tools
        let responseStrategy = 'Direct answer using retrieved context.';
        if (plan.missing_information && plan.missing_information.length > 0) {
            responseStrategy = `Ask clarifying follow-up question for missing parameters: ${plan.missing_information.join(', ')}.`;
        } else if (intent === 'COMPARE') {
            responseStrategy = 'Generate side-by-side product comparison markdown grid and suggest best value winner.';
        } else if (intent === 'ROUTINE_BUILDER') {
            responseStrategy = 'Generate structured morning and evening regimen routines with target clinical details.';
        } else if (intent === 'INGREDIENT_INFO') {
            responseStrategy = 'Explain the active compounds mechanism of action, concentration limits, and skin compatibility.';
        } else if (intent === 'TRUST_ANALYSIS') {
            responseStrategy = 'Show integrity audit score, suspicious duplicating counts, and genuine customer quotes.';
        } else if (intent === 'GREETING') {
            responseStrategy = 'Warm welcome greeting, explaining conversational discovery flows, routine setups, and product matches.';
        }

        const reasoning = {
            intent: intent,
            user_profile: {
                skin_type: memory.skin_type || entities.skin_type || 'normal',
                concerns: memory.concerns || (entities.concern ? [entities.concern] : []),
                budget: memory.budget || entities.budget || null,
                allergies: memory.allergies || [],
                favorite_brands: memory.favorite_brands || []
            },
            required_tools: plan.tools_to_use || [],
            retrieved_knowledge: (ragContext?.knowledgeSnippets || []).map(k => `${k.topic}: ${k.content}`),
            response_strategy: responseStrategy
        };

        logger.info(`[REASONING ENGINE] Compiled: Strategy="${reasoning.response_strategy}"`, 'AI_REASONING');
        return reasoning;
    }
};
