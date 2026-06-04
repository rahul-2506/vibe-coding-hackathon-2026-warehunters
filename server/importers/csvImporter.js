import { BaseImporter } from './importerService.js';

export class CSVImporter extends BaseImporter {
    constructor() {
        super('CSV');
    }

    /**
     * State-machine CSV parser that handles commas and quotes inside fields correctly.
     */
    parseCSVText(csvText) {
        const rows = [];
        let currentRow = [''];
        let inQuotes = false;

        for (let i = 0; i < csvText.length; i++) {
            const char = csvText[i];
            const nextChar = csvText[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    currentRow[currentRow.length - 1] += '"';
                    i++; // Skip next quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                currentRow.push('');
            } else if ((char === '\r' || char === '\n') && !inQuotes) {
                if (char === '\r' && nextChar === '\n') {
                    i++; // Skip LF
                }
                rows.push(currentRow);
                currentRow = [''];
            } else {
                currentRow[currentRow.length - 1] += char;
            }
        }
        
        if (currentRow.length > 1 || currentRow[0] !== '') {
            rows.push(currentRow);
        }
        
        return rows;
    }

    /**
     * Parses a CSV string and returns an array of structured records.
     */
    csvToRecords(csvText) {
        const rows = this.parseCSVText(csvText);
        if (rows.length < 2) return [];

        const headers = rows[0].map(h => h.trim().toLowerCase());
        const records = [];

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row.length < headers.length) continue;

            const record = {};
            headers.forEach((header, index) => {
                record[header] = row[index]?.trim() || '';
            });
            records.push(record);
        }

        return records;
    }

    normalizeRecord(raw) {
        // Find property matching key names from headers
        const getProp = (keys) => {
            for (const key of keys) {
                if (raw[key] !== undefined) return raw[key];
            }
            return null;
        };

        const title = getProp(['title', 'name', 'product_name', 'productname', 'item_name']);
        const externalId = getProp(['id', 'external_id', 'externalid', 'sku', 'asin', 'fsn']);
        const brand = getProp(['brand', 'brand_name', 'manufacturer']) || 'Generic';
        const category = getProp(['category', 'category_name', 'type', 'subcategory']) || 'Others';
        const description = getProp(['description', 'desc', 'summary', 'about']) || '';
        const imageUrl = getProp(['image_url', 'imageurl', 'image', 'thumbnail', 'pic']) || '';
        const productUrl = getProp(['product_url', 'producturl', 'url', 'link']) || '';
        const price = Number(getProp(['price', 'sale_price', 'selling_price', 'price_inr', 'amount'])) || 0;
        const originalPrice = Number(getProp(['original_price', 'originalprice', 'list_price', 'mrp', 'retail_price'])) || price;
        const rating = Number(getProp(['rating', 'avg_rating', 'average_rating', 'stars'])) || 4.0;
        const reviewCount = Number(getProp(['review_count', 'reviewcount', 'reviews_count', 'num_reviews'])) || 0;

        return {
            external_id: externalId,
            title,
            brand,
            category,
            description,
            image_url: imageUrl,
            product_url: productUrl,
            price,
            original_price: originalPrice,
            rating,
            review_count: reviewCount,
            features: [],
            reviews: []
        };
    }
}

export const csvImporter = new CSVImporter();
