import { supabase } from '../db.js';
import { embeddingService } from '../services/embeddingService.js';

export class BaseImporter {
    constructor(sourceName) {
        this.sourceName = sourceName;
    }

    /**
     * Override this method in subclasses to map raw records to standard product layout.
     * Must return an object with:
     * {
     *   external_id: string,
     *   title: string,
     *   brand: string,
     *   category: string,
     *   description: string,
     *   image_url: string,
     *   product_url: string,
     *   price: number,
     *   original_price: number,
     *   rating: number,
     *   review_count: number,
     *   features: Array<{ name: string, value: string }>,
     *   reviews: Array<{ text: string, rating: number, sentiment: string }>
     * }
     */
    normalizeRecord(rawRecord) {
        throw new Error('normalizeRecord must be implemented by subclass');
    }

    /**
     * Executes the ingestion pipeline on an array of raw records.
     */
    async importData(rawRecords, geminiKey = null, openaiKey = null) {
        if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
            return { success: false, message: 'No records provided for import', stats: null };
        }

        let insertedCount = 0;
        let updatedCount = 0;
        let featuresCount = 0;
        let reviewsCount = 0;
        let errorCount = 0;
        const errors = [];

        console.log(`[Importer: ${this.sourceName}] Ingesting ${rawRecords.length} records...`);

        for (const raw of rawRecords) {
            try {
                // 1. Normalize
                const normalized = this.normalizeRecord(raw);
                if (!normalized.title) {
                    throw new Error('Normalized record is missing a title');
                }

                normalized.source = this.sourceName;

                // 2. Generate Embedding
                const embeddingText = `${normalized.title} ${normalized.brand || ''} ${normalized.category || ''} ${normalized.description || ''}`.trim();
                const embedding = await embeddingService.generateEmbedding(embeddingText, geminiKey, openaiKey);

                // Prepare db columns matching table schema
                const productDbData = {
                    external_id: normalized.external_id || null,
                    title: normalized.title,
                    name: normalized.title, // keep frontend compatibility
                    brand: normalized.brand || 'Generic',
                    category: normalized.category || 'Others',
                    description: normalized.description || '',
                    image_url: normalized.image_url || '',
                    thumbnail: normalized.image_url || '', // keep frontend compatibility
                    product_url: normalized.product_url || '',
                    price: Number(normalized.price) || 0,
                    original_price: Number(normalized.original_price) || Number(normalized.price) || 0,
                    rating: Number(normalized.rating) || 4.0,
                    review_count: Number(normalized.review_count) || 0,
                    reviews_count: Number(normalized.review_count) || 0, // sync legacy reviews_count
                    source: normalized.source,
                    last_updated: new Date().toISOString(),
                    embedding: embedding
                };

                // 3. Deduplicate & Upsert in Supabase
                let product_id = null;
                
                // Try checking by external_id first if available
                let existingProduct = null;
                if (productDbData.external_id) {
                    const { data, error } = await supabase
                        .from('products')
                        .select('id')
                        .eq('external_id', productDbData.external_id)
                        .maybeSingle();
                    
                    if (!error && data) {
                        existingProduct = data;
                    }
                }

                // If not found by external_id, fallback to exact matching of title + source
                if (!existingProduct) {
                    const { data, error } = await supabase
                        .from('products')
                        .select('id')
                        .eq('title', productDbData.title)
                        .eq('source', productDbData.source)
                        .maybeSingle();
                    
                    if (!error && data) {
                        existingProduct = data;
                    }
                }

                if (existingProduct) {
                    // Update
                    const { error } = await supabase
                        .from('products')
                        .update(productDbData)
                        .eq('id', existingProduct.id);
                    
                    if (error) throw error;
                    product_id = existingProduct.id;
                    updatedCount++;
                } else {
                    // Insert
                    const { data, error } = await supabase
                        .from('products')
                        .insert(productDbData)
                        .select('id')
                        .single();
                    
                    if (error) throw error;
                    product_id = data.id;
                    insertedCount++;
                }

                // 4. Ingest features if present
                if (product_id && Array.isArray(normalized.features) && normalized.features.length > 0) {
                    // Delete existing features for this product first to prevent duplicates
                    await supabase.from('product_features').delete().eq('product_id', product_id);

                    const featuresToInsert = normalized.features.map(f => ({
                        product_id,
                        feature_name: f.name || f.feature_name,
                        feature_value: String(f.value || f.feature_value)
                    }));

                    const { error: featError } = await supabase
                        .from('product_features')
                        .insert(featuresToInsert);

                    if (featError) {
                        console.error(`[Importer Warning] Failed to insert features for product ${product_id}:`, featError.message);
                    } else {
                        featuresCount += featuresToInsert.length;
                    }
                }

                // 5. Ingest reviews if present
                if (product_id && Array.isArray(normalized.reviews) && normalized.reviews.length > 0) {
                    // Delete existing reviews in product_reviews for this product first
                    await supabase.from('product_reviews').delete().eq('product_id', product_id);

                    const reviewsToInsert = normalized.reviews.map(r => ({
                        product_id,
                        review_text: r.text || r.review_text,
                        rating: Number(r.rating) || 4,
                        sentiment: r.sentiment || 'neutral'
                    }));

                    const { error: revError } = await supabase
                        .from('product_reviews')
                        .insert(reviewsToInsert);

                    if (revError) {
                        console.error(`[Importer Warning] Failed to insert reviews for product ${product_id}:`, revError.message);
                    } else {
                        reviewsCount += reviewsToInsert.length;
                    }
                }

            } catch (err) {
                errorCount++;
                errors.push({
                    recordIndex: rawRecords.indexOf(raw),
                    title: raw.title || raw.name || 'Unknown',
                    error: err.message
                });
                console.error(`[Importer Error] Ingesting record failed:`, err.message);
            }
        }

        console.log(`[Importer: ${this.sourceName}] Ingestion summary: Inserted ${insertedCount}, Updated ${updatedCount}, Features ${featuresCount}, Reviews ${reviewsCount}, Errors ${errorCount}`);

        return {
            success: errorCount < rawRecords.length,
            stats: {
                insertedCount,
                updatedCount,
                featuresCount,
                reviewsCount,
                errorCount,
                errors
            }
        };
    }
}
