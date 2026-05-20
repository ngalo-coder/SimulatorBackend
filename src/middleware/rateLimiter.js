import rateLimit from 'express-rate-limit';

/**
 * Generic rate limiter factory
 * @param {number} maxAttempts - Maximum number of requests allowed
 * @param {number} windowMinutes - Time window in minutes
 */
export const rateLimiter = (maxAttempts = 10, windowMinutes = 15) => {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: maxAttempts,
    message: { message: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false
  });
};

export const endSessionLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { message: 'Too many session end requests' },
    standardHeaders: true,
    legacyHeaders: false
});

export const progressLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { message: 'Too many progress requests' },
    standardHeaders: true,
    legacyHeaders: false
});