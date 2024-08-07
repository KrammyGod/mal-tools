import util from 'util';
class MALAPIError extends Error {
    constructor(responseData) {
        // Gives a prettified output of the response data
        super(util.inspect(responseData, { depth: null, colors: true }));
    }
}
class MALBadRequestError extends MALAPIError {
    constructor(responseData) {
        responseData.code = 400;
        super(responseData);
    }
};
class MALUnauthorizedError extends MALAPIError {
    constructor(responseData) {
        responseData.code = 401;
        responseData.devMessage = 'The access token is likely invalid or has expired, please re-authenticate.';
        super(responseData);
    }
};

/**
 * This one is pretty bad, the description says DoS detected
 * likely is the returned status of API rate limits.
 * In hopes that this is the determining status, we should always
 * stop all requests if we get this error.
 */
class MALForbiddenError extends MALAPIError {
    constructor(responseData) {
        responseData.code = 403;
        super(responseData);
    }
};
class MALNotFoundError extends MALAPIError {
    constructor(responseData) {
        responseData.code = 404;
        super(responseData);
    }
};

/**
 * Given a non-200 status code, return the appropriate MAL error
 * @param {number} status The status code of the response
 * @param {Object} jsonBody The JSON body of the response
 */
export default function GetMALError(status, jsonBody) {
    switch(status) {
        case 400:
            return new MALBadRequestError(jsonBody);
        case 401:
            return new MALUnauthorizedError(jsonBody);
        case 403:
            return new MALForbiddenError(jsonBody);
        case 404:
            return new MALNotFoundError(jsonBody);
        default:
            return new MALAPIError(jsonBody);
    }
}
