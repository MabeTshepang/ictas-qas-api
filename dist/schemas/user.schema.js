"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserSchema = exports.updatePasswordSchema = exports.loginSchema = void 0;
const zod_1 = require("zod");
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
});
exports.updatePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string(),
    newPassword: zod_1.z.string().min(8).regex(/[A-Z]/, "Must contain an uppercase letter"),
});
exports.createUserSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(2, "Full name is required"),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8).optional(),
    role: zod_1.z.enum(['ADMIN', 'USER', 'MODERATOR']),
    tenantId: zod_1.z.string().min(1).optional(),
});
