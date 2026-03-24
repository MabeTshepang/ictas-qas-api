"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.requestReset = exports.updatePassword = exports.login = void 0;
const auth_1 = require("../config/auth");
const db_1 = __importDefault(require("../config/db"));
const user_schema_1 = require("../schemas/user.schema");
const crypto = __importStar(require("node:crypto"));
const email_service_1 = require("../services/email.service");
const login = async (req, res) => {
    try {
        const { email, password } = user_schema_1.loginSchema.parse(req.body);
        const user = await db_1.default.user.findUnique({
            where: { email },
            include: { tenant: true }
        });
        // Ensure verifyPassword matches your actual utility name
        if (!user || !(await (0, auth_1.verifyPassword)(user.passwordHash, password))) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        if (user.tenant.status !== 'ACTIVE') {
            return res.status(403).json({ error: 'Tenant account is inactive' });
        }
        const token = (0, auth_1.generateToken)({ id: user.id, role: user.role, tenantId: user.tenantId });
        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                tenant: user.tenant,
                fullName: user.fullName
            }
        });
    }
    catch (error) {
        console.error("LOGIN_ERROR:", error);
        res.status(500).json({ error: 'Login failed', message: error.message });
    }
};
exports.login = login;
const updatePassword = async (req, res) => {
    const userContext = req.user;
    try {
        const { currentPassword, newPassword } = user_schema_1.updatePasswordSchema.parse(req.body);
        const user = await db_1.default.user.findUnique({ where: { id: userContext.id } });
        if (!user || !(await (0, auth_1.verifyPassword)(user.passwordHash, currentPassword))) {
            return res.status(400).json({ error: 'Current password incorrect' });
        }
        await db_1.default.user.update({
            where: { id: user.id },
            data: { passwordHash: await (0, auth_1.hashPassword)(newPassword) }
        });
        res.json({ message: 'Password updated successfully' });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.updatePassword = updatePassword;
const requestReset = async (req, res) => {
    const { email } = req.body;
    const user = await db_1.default.user.findUnique({ where: { email: email.toLowerCase() } });
    // Security: Always return success even if user doesn't exist to prevent email harvesting
    if (!user) {
        return res.json({ message: "If an account exists, a reset link has been sent." });
    }
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour
    await db_1.default.passwordReset.create({
        data: { token, userId: user.id, expiresAt, tenantId: user.tenantId }
    });
    // Build the link using your .env variable
    const resetLink = `${process.env.FRONTEND_URL}/${user.tenantId}/reset-password?token=${token}`;
    await (0, email_service_1.sendEmail)({
        to: user.email,
        subject: "Reset Your Password - ICTAS",
        html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
          <h2>Password Reset Request</h2>
          <p>Hello ${user.fullName},</p>
          <p>You requested to reset your password. Click the button below to set a new one:</p>
          <a href="${resetLink}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">
            Reset Password
          </a>
          <p>If you didn't request this, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 40px 0;" />
          <p style="font-size: 12px; color: #666;">This link will expire in 1 hour.</p>
        </div>
      `
    });
    res.json({ message: "Reset link sent successfully." });
};
exports.requestReset = requestReset;
const resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;
    const resetRecord = await db_1.default.passwordReset.findUnique({
        where: { token },
        include: { user: true }
    });
    if (!resetRecord || resetRecord.expiresAt < new Date()) {
        return res.status(400).json({ error: "Invalid or expired token." });
    }
    const hashedPassword = await (0, auth_1.hashPassword)(newPassword);
    await db_1.default.$transaction([
        db_1.default.user.update({
            where: { id: resetRecord.userId },
            data: { passwordHash: hashedPassword }
        }),
        db_1.default.passwordReset.delete({ where: { token } })
    ]);
    res.json({ message: "Password updated successfully. You can now log in." });
};
exports.resetPassword = resetPassword;
