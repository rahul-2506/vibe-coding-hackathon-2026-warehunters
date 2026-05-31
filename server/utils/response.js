export const response = {
    /**
     * Standardized Success Response shape
     * Returns: { success: true, data: {} }
     */
    success(res, data = {}, message = 'Operation successful', status = 200) {
        let finalData = data;

        // Avoid double enveloping if data is already in { success, data, ... } format
        if (data && typeof data === 'object') {
            if ('success' in data && 'data' in data) {
                finalData = data.data;
            }
        }

        return res.status(status).json({
            success: true,
            data: finalData
        });
    },

    /**
     * Standardized Error Response shape
     * Returns: { success: false, message: "", errorCode: "" }
     */
    error(res, message, errorCode = null, status = 500) {
        const getErrorCode = (statusCode, customCode) => {
            if (customCode) return String(customCode);
            switch (statusCode) {
                case 400: return 'ERR_BAD_REQUEST';
                case 401: return 'ERR_UNAUTHORIZED';
                case 403: return 'ERR_FORBIDDEN';
                case 404: return 'ERR_NOT_FOUND';
                case 409: return 'ERR_CONFLICT';
                case 429: return 'ERR_LIMIT_EXCEEDED';
                default: return 'ERR_INTERNAL_SERVER';
            }
        };

        return res.status(status).json({
            success: false,
            message: message || 'An unexpected error occurred',
            errorCode: getErrorCode(status, errorCode)
        });
    }
};
