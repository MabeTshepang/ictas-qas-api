"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalErrorHandler = void 0;
const zod_1 = require("zod");
const globalErrorHandler = (err, req, res, next) => {
    console.error(`[Error]: ${err.message}`);
    if (err instanceof zod_1.ZodError) {
        return res.status(400).json({ error: 'Validation Failed', details: err.errors });
    }
    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({ error: 'Invalid or missing token' });
    }
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        tenantId: req.user?.id // Useful for debugging multi-tenant issues
    });
};
exports.globalErrorHandler = globalErrorHandler;
