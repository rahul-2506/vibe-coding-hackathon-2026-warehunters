export const feedbackValidator = {
    validateSubmission(payload) {
        const { product_name, rating, review_text, emoji, source } = payload;
        
        if (!product_name) return 'product_name is required';
        if (rating === undefined || rating === null) return 'rating is required';
        if (!review_text) return 'review_text is required';
        if (!emoji) return 'emoji is required';
        if (!source) return 'source is required';
        
        const ratingVal = parseInt(rating, 10);
        if (isNaN(ratingVal) || ratingVal < 1 || ratingVal > 5) {
            return 'rating must be an integer between 1 and 5';
        }
        
        return null;
    }
};
