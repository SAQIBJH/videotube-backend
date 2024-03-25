class ApiError extends Error {
    constructor(statusCode, message = "Something went wrongggg", errors = [], stack = "") {
        super(message);
        this.errors = errors;
        this.statusCode = statusCode;
        this.success = false;
        this.data = null;
        if (stack) this.stack = stack;
        else Error.captureStackTrace(this, this.constructor);
    }
}
export {ApiError}