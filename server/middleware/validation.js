import { z } from 'zod';
import { response } from '../utils/response.js';
import { logger } from '../utils/logger.js';

// Generic schema validator runner
const validateSchema = (schema, property = 'body') => {
    return (req, res, next) => {
        try {
            // Validate property (body, query, or params) against schema
            const validated = schema.parse(req[property]);
            req[`validated${property.charAt(0).toUpperCase() + property.slice(1)}`] = validated;
            next();
        } catch (err) {
            if (err instanceof z.ZodError) {
                const issues = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
                logger.warn(`[VALIDATION FAIL] Invalid input in ${property}: ${issues}`, 'SECURITY');
                return response.error(res, `Input validation failed: ${issues}`, err.errors, 400);
            }
            next(err);
        }
    };
};

// 1. Auth Validation Schemas
const loginSchema = z.object({
    email: z.string().email('Invalid email address format'),
    password: z.string().min(6, 'Password must be at least 6 characters long')
});

const registrationSchema = z.object({
    username: z.string().min(3, 'Username must be at least 3 characters long').max(30),
    email: z.string().email('Invalid email address format'),
    password: z.string().min(6, 'Password must be at least 6 characters long')
});

// 2. Chat Validation Schema
const chatInputSchema = z.object({
    message: z.string().min(1, 'Message cannot be empty').max(2000, 'Message is too long (max 2000 chars)'),
    sessionContext: z.object({
        skinType: z.string().nullable().optional(),
        concerns: z.array(z.string()).optional(),
        budget: z.number().nullable().optional()
    }).optional()
});

// 3. Product Search Validation Schema
const productSearchSchema = z.object({
    query: z.string().optional().default(''),
    category: z.string().optional(),
    minPrice: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
    maxPrice: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
    minTrust: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
    sort: z.string().optional().default('trust_score')
});

// 4. Review Submission Validation Schema
const reviewSubmissionSchema = z.object({
    product_name: z.string().min(2, 'Product name is required'),
    rating: z.union([z.number(), z.string()]).transform(val => typeof val === 'string' ? parseInt(val, 10) : val).refine(val => val >= 1 && val <= 5, 'Rating must be an integer between 1 and 5'),
    review_text: z.string().min(5, 'Review text must be at least 5 characters long').max(5000),
    emoji: z.string().min(1, 'Emoji is required'),
    source: z.string().optional().default('Customer'),
    experience_mood: z.string().optional().default('😐 Neutral'),
    highlight_categories: z.array(z.string()).optional().default([]),
    recommendation: z.string().optional().default('🤔 Maybe'),
    discovery_source: z.string().optional().default('Own Research'),
    confidence_score: z.number().min(0).max(100).optional().default(50),
    image_url: z.string().url('Invalid image URL format').or(z.literal('')).optional(),
    user_id: z.string().uuid('Invalid user UUID format').nullable().optional()
});

// 5. Product Comparison Validation Schema
const comparisonSchema = z.object({
    product1Id: z.union([z.number(), z.string()]).transform(val => typeof val === 'string' ? parseInt(val, 10) : val),
    product2Id: z.union([z.number(), z.string()]).transform(val => typeof val === 'string' ? parseInt(val, 10) : val),
    preferences: z.array(z.string()).optional().default([])
});

export const validate = {
    login: validateSchema(loginSchema, 'body'),
    registration: validateSchema(registrationSchema, 'body'),
    chat: validateSchema(chatInputSchema, 'body'),
    search: validateSchema(productSearchSchema, 'query'),
    review: validateSchema(reviewSubmissionSchema, 'body'),
    compare: validateSchema(comparisonSchema, 'body')
};
