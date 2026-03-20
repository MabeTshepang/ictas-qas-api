import { rateLimit } from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5, // Limit each IP to 5 requests per window
  message: {
    error: "Too many attempts. Please try again after 15 minutes."
  },
  standardHeaders: 'draft-7', // Draft-7: combined `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// A slightly more relaxed one for general login attempts
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10, 
  message: {
    error: "Too many login attempts. Please try again later."
  },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});