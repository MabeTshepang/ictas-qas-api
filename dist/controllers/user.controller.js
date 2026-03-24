"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeModerator = exports.getAllModerators = exports.inviteModerator = exports.updateLog = exports.getMyLogs = exports.deleteUser = exports.updateUser = exports.getAllUsers = exports.createUser = void 0;
const auth_1 = require("../config/auth");
const db_1 = __importDefault(require("../config/db"));
const user_schema_1 = require("../schemas/user.schema");
const email_service_1 = require("../services/email.service");
const zod_1 = __importDefault(require("zod"));
const createUser = async (req, res) => {
    try {
        const data = user_schema_1.createUserSchema.parse(req.body);
        const { tenantId: userTenantId, role: userRole } = req.user;
        if (userRole !== 'MODERATOR' && data.tenantId !== userTenantId) {
            return res.status(403).json({ error: "Tenant mismatch permissions" });
        }
        const newUser = await db_1.default.user.create({
            data: {
                fullName: data.fullName,
                email: data.email,
                role: data.role,
                tenantId: data.tenantId || "",
                passwordHash: await (0, auth_1.hashPassword)("Password123")
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
                tenantId: true
            }
        });
        res.status(201).json(newUser);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.createUser = createUser;
const getAllUsers = async (req, res) => {
    const { tenantId, role } = req.user;
    const users = await db_1.default.user.findMany({
        // Moderators see everyone, Admins see their tenant
        where: role === 'MODERATOR' ? {} : { tenantId },
        select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
            fullName: true,
            tenant: { select: { name: true } } // Joins the tenant name
        }
    });
    res.json(users);
};
exports.getAllUsers = getAllUsers;
const updateUser = async (req, res) => {
    const { id } = req.params;
    const { email, role: targetRole } = req.body;
    const { tenantId, role } = req.user;
    try {
        // In Prisma, we use 'update' with a composite where clause if possible, 
        // or verify existence first.
        const user = await db_1.default.user.update({
            where: {
                id,
                // Isolation: Admins can't update users outside their tenant
                ...(role !== 'MODERATOR' ? { tenantId } : {})
            },
            data: { email, role: targetRole }
        });
        res.json({ message: "User updated successfully", user });
    }
    catch (error) {
        res.status(404).json({ error: "User not found or access denied" });
    }
};
exports.updateUser = updateUser;
const deleteUser = async (req, res) => {
    const { id } = req.params;
    const { tenantId, role } = req.user;
    try {
        await db_1.default.user.delete({
            where: {
                id,
                ...(role !== 'MODERATOR' ? { tenantId } : {})
            }
        });
        res.status(204).send();
    }
    catch (error) {
        res.status(404).json({ error: "Deletion failed" });
    }
};
exports.deleteUser = deleteUser;
const getMyLogs = async (req, res) => {
    // Extract userId and tenantId from the auth middleware
    const { id: userId, tenantId } = req.user;
    try {
        const logs = await db_1.default.log.findMany({
            where: {
                userId: userId,
                tenantId: tenantId,
                action: "File Upload"
            },
            include: {
                user: {
                    select: {
                        fullName: true,
                        email: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: 50, // Limit to the last 50 entries for the dashboard view
        });
        res.json(logs);
    }
    catch (error) {
        console.error("GET_MY_LOGS_ERROR:", error);
        res.status(500).json({ error: "Failed to fetch your activity logs." });
    }
};
exports.getMyLogs = getMyLogs;
const updateLog = async (req, res) => {
    const { logId } = req.params;
    const { status, action, metadata, filePath } = req.body;
    const user = req.user;
    try {
        const existingLog = await db_1.default.log.findUnique({
            where: { id: logId }
        });
        if (!existingLog) {
            return res.status(404).json({ error: "Log entry not found" });
        }
        if (user.role !== 'MODERATOR' && existingLog.tenantId !== user.tenantId) {
            return res.status(403).json({ error: "Unauthorized: You cannot modify logs from another tenant" });
        }
        const updatedLog = await db_1.default.log.update({
            where: { id: logId },
            data: {
                status: status ?? existingLog.status,
                action: action ?? existingLog.action,
                metadata: metadata ?? existingLog.metadata,
                filePath: filePath ?? existingLog.filePath,
            }
        });
        res.json({ message: "Log updated successfully", log: updatedLog });
    }
    catch (error) {
        console.error("UPDATE_LOG_ERROR:", error.message);
        res.status(500).json({ error: "Failed to update log entry" });
    }
};
exports.updateLog = updateLog;
const inviteModerator = async (req, res) => {
    try {
        const data = user_schema_1.createUserSchema.parse(req.body);
        const { tenantId: requesterTenantId, role: requesterRole } = req.user;
        if (requesterRole !== 'MODERATOR') {
            return res.status(403).json({ error: "Access denied" });
        }
        const tempPassword = Math.random().toString(36).slice(-10);
        const passwordHash = await (0, auth_1.hashPassword)(tempPassword);
        const newMod = await db_1.default.user.create({
            data: {
                fullName: data.fullName,
                email: data.email,
                role: 'MODERATOR',
                tenantId: requesterTenantId,
                passwordHash: passwordHash
            },
            select: { id: true, fullName: true, email: true, role: true }
        });
        await (0, email_service_1.sendEmail)({
            to: newMod.email,
            subject: "Action Required: Your ICTAS QAS Moderator Account",
            html: `
        <div style="font-family: sans-serif;">
          <h2>Welcome to the Platform Team, ${newMod.fullName}</h2>
          <p>An administrator has created a moderator account for you.</p>
          <p><strong>Your Temporary Password:</strong> ${tempPassword}</p>
          <p>To get started, please go to the login page</p>
          <p></p>
          <p style="font-size: 12px; color: #666;">Authorized Personnel Only.</p>
        </div>
      `
        });
        res.status(201).json(newMod);
    }
    catch (error) {
        // Check if it's a Zod error to provide better feedback
        if (error instanceof zod_1.default.ZodError) {
            return res.status(400).json({
                error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
            });
        }
        res.status(400).json({ error: error.message });
    }
};
exports.inviteModerator = inviteModerator;
const getAllModerators = async (req, res) => {
    try {
        const { tenantId, role } = req.user;
        if (role !== 'MODERATOR')
            return res.status(403).json({ error: "Forbidden" });
        const moderators = await db_1.default.user.findMany({
            where: {
                role: 'MODERATOR',
                tenantId: tenantId
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                createdAt: true,
            }
        });
        res.json(moderators);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch moderators." });
    }
};
exports.getAllModerators = getAllModerators;
const removeModerator = async (req, res) => {
    try {
        const { id: targetId } = req.params;
        const { id: requesterId, tenantId, role } = req.user;
        if (role !== 'MODERATOR')
            return res.status(403).json({ error: "Unauthorized" });
        if (targetId === requesterId) {
            return res.status(400).json({ error: "Cannot remove yourself." });
        }
        await db_1.default.user.delete({
            where: {
                id: targetId,
                role: 'MODERATOR',
                tenantId: tenantId
            }
        });
        res.status(204).send();
    }
    catch (error) {
        res.status(404).json({ error: "Moderator not found in your organization." });
    }
};
exports.removeModerator = removeModerator;
