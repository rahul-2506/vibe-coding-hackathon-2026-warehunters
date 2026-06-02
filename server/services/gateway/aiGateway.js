import { chatService } from './chatService.js';
import { recommendationService } from './recommendationService.js';
import { productComparisonService } from './comparisonService.js';
import { reviewAnalysisService } from './reviewAnalysisService.js';
import { reviewSummarizer } from './reviewSummarizer.js';
import { fakeReviewDetector } from './fakeReviewDetector.js';
import { memoryService } from './memoryService.js';
import { retrievalService } from './retrievalService.js';

export const aiGateway = {
    chat: chatService,
    recommendations: recommendationService,
    comparison: productComparisonService,
    reviewAnalysis: reviewAnalysisService,
    summarizer: reviewSummarizer,
    fakeDetector: fakeReviewDetector,
    memory: memoryService,
    retrieval: retrievalService
};

export default aiGateway;
export {
    chatService,
    recommendationService,
    productComparisonService,
    reviewAnalysisService,
    reviewSummarizer,
    fakeReviewDetector,
    memoryService,
    retrievalService
};
