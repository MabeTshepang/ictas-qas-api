import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export const globalErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(`[Error]: ${err.message}`);

  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Validation Failed', details: err.errors });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Invalid or missing token' });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    tenantId: (req as any).user?.id // Useful for debugging multi-tenant issues
  });
};