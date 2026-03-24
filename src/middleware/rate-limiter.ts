import { rateLimit } from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  limit: 5, 
  message: {
    error: "Too many attempts. Please try again after 15 minutes."
  },
  standardHeaders: 'draft-7',
  legacyHeaders: false, 
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10, 
  message: {
    error: "Too many login attempts. Please try again later."
  },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});