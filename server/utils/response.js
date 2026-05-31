export const response = {
    success(res, data = {}, message = 'Operation successful', status = 200) {
        let finalData = data;
        let finalMessage = message;
        let extraKeys = {};

        // Avoid double enveloping if data is already in { success, data, ... } format
        if (data && typeof data === 'object') {
            if ('success' in data && 'data' in data) {
                finalData = data.data;
                if (data.message) {
                    finalMessage = data.message;
                }
                // Unpack any extra keys (like recommendations)
                for (const key of Object.keys(data)) {
                    if (key !== 'success' && key !== 'data' && key !== 'message' && key !== 'error') {
                        extraKeys[key] = data[key];
                    }
                }
            }
        }

        return res.status(status).json({
            success: true,
            data: finalData,
            message: finalMessage,
            error: null,
            ...extraKeys
        });
    },

    error(res, message, details = null, status = 500) {
        return res.status(status).json({
            success: false,
            data: null,
            message: message,
            error: details || message
        });
    }
};
