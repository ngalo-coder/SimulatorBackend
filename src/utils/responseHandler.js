export function handleSuccess(res, data, message = 'Success', statusCode = 200) {
    res.status(statusCode).json({
        data,
        message
    });
}

export function handleError(res, error, log) {
    const statusCode = error.status || 500;
    const message = error.message || 'An unexpected error occurred.';

    if (log) {
        log.error(error, message);
    }

    res.status(statusCode).json({
        message,
        error: true
    });
}
