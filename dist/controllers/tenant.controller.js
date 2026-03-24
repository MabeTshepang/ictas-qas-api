"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTenant = exports.updateTenant = exports.createTenant = exports.getModDashboardStats = exports.getPublicTenants = exports.getAllTenantLogs = exports.getAllTenants = exports.getTenantInfo = void 0;
const db_1 = __importDefault(require("../config/db"));
const azure_storage_service_1 = require("../services/azure-storage.service");
const imagekit_service_1 = require("../services/imagekit.service");
const auth_1 = require("../config/auth");
const getTenantInfo = async (tenantId) => {
    try {
        const tenant = await db_1.default.tenant.findUnique({
            where: { id: tenantId },
            select: {
                name: true,
                fileSlug: true,
            },
        });
        if (!tenant)
            throw new Error("Tenant context not found");
        return tenant;
    }
    catch (error) {
        console.error("GET_TENANT_INFO_ERROR:", error);
        throw error;
    }
};
exports.getTenantInfo = getTenantInfo;
const getAllTenants = async (req, res) => {
    try {
        const tenants = await db_1.default.tenant.findMany({
            where: {
                type: {
                    not: 'MODERATOR'
                }
            },
            select: {
                id: true,
                name: true,
                subtitle: true,
                status: true,
                type: true,
                branding: true,
                createdAt: true,
                _count: {
                    select: { users: true }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });
        res.json(tenants);
    }
    catch (error) {
        console.error('GET_TENANTS_ERROR:', error);
        res.status(500).json({
            error: 'Failed to fetch tenants',
            message: error.message
        });
    }
};
exports.getAllTenants = getAllTenants;
const getAllTenantLogs = async (req, res) => {
    const { tenantId, role } = req.user;
    try {
        const logs = await db_1.default.log.findMany({
            where: {
                ...(role !== 'MODERATOR' ? { tenantId } : {}),
                action: "File Upload"
            },
            include: {
                user: {
                    select: { fullName: true, email: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(logs);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch tenant activity." });
    }
};
exports.getAllTenantLogs = getAllTenantLogs;
const getPublicTenants = async (req, res) => {
    try {
        const tenants = await db_1.default.tenant.findMany({
            where: {
                status: 'ACTIVE',
                type: 'NORMAL'
            },
            select: {
                id: true,
                name: true,
                subtitle: true,
                branding: true,
            },
            orderBy: {
                name: 'asc'
            }
        });
        res.json(tenants);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
exports.getPublicTenants = getPublicTenants;
const getModDashboardStats = async (req, res) => {
    try {
        const tenants = await db_1.default.tenant.findMany({
            include: {
                _count: {
                    select: { users: true }
                }
            }
        });
        const logStats = await db_1.default.log.groupBy({
            by: ['tenantId', 'status'],
            _count: {
                id: true
            },
            where: {
                action: 'File Upload' // Only count file-related events
            }
        });
        const totalEvents = await db_1.default.log.count();
        const formattedStats = tenants.map(tenant => {
            const tenantLogs = logStats.filter(l => l.tenantId === tenant.id);
            return {
                tenantId: tenant.id,
                name: tenant.name,
                userCount: tenant._count.users,
                uploadCount: tenantLogs.reduce((acc, curr) => acc + curr._count.id, 0),
                pendingCount: tenantLogs.find(l => l.status === 'Pending')?._count.id || 0,
                failedCount: tenantLogs.find(l => l.status === 'Failed')?._count.id || 0,
                sentCount: tenantLogs.find(l => l.status === 'Sent')?._count.id || 0,
            };
        });
        res.json({
            tenants: formattedStats,
            totalEvents
        });
    }
    catch (error) {
        console.error("STATS_ERROR:", error.message);
        res.status(500).json({ error: "Failed to compile platform statistics" });
    }
};
exports.getModDashboardStats = getModDashboardStats;
const createTenant = async (req, res) => {
    const { name, overlayColor, adminName, adminEmail } = req.body;
    const file = req.file;
    try {
        if (!file)
            return res.status(400).json({ error: "Branding image is required" });
        if (!adminName || !adminEmail) {
            return res.status(400).json({ error: "Initial admin details (name/email) are required" });
        }
        const imageKey = await (0, imagekit_service_1.uploadToImageKit)(file.buffer, file.originalname);
        const result = await db_1.default.$transaction(async (tx) => {
            const tenant = await tx.tenant.create({
                data: {
                    name,
                    branding: JSON.stringify({ imageKey, overlayColor }),
                    fileSlug: ""
                }
            });
            const newUser = await tx.user.create({
                data: {
                    fullName: adminName,
                    email: adminEmail.toLowerCase().trim(),
                    role: 'ADMIN',
                    tenantId: tenant.id,
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
            return { tenant, admin: newUser };
        });
        res.status(201).json({
            message: "Tenant created successfully",
            tenant: result.tenant,
            admin: result.admin
        });
    }
    catch (error) {
        console.error("PROVISIONING_ERROR:", error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: "A user with this email address already exists." });
        }
        res.status(500).json({ error: error.message || "Failed to provision tenant resources" });
    }
};
exports.createTenant = createTenant;
const updateTenant = async (req, res) => {
    const { id } = req.params;
    const { name, overlayColor } = req.body;
    const file = req.file;
    try {
        let updateData = { name };
        if (file) {
            const fileName = `branding/${id}_bg_${Date.now()}.jpg`;
            const imageKey = await (0, azure_storage_service_1.uploadBrandingToAzure)(file.buffer, fileName);
            updateData.branding = {
                imageKey,
                overlayColor: overlayColor
            };
        }
        else if (overlayColor) {
            const current = await db_1.default.tenant.findUnique({ where: { id } });
            const existingBranding = JSON.parse(current?.branding || '{}');
            updateData.branding = JSON.stringify({
                ...existingBranding,
                overlayColor
            });
        }
        const updated = await db_1.default.tenant.update({
            where: { id },
            data: updateData
        });
        res.json(updated);
    }
    catch (error) {
        res.status(500).json({ error: "Update failed" });
    }
};
exports.updateTenant = updateTenant;
const deleteTenant = async (req, res) => {
    const { id: tenantId } = req.params;
    try {
        await db_1.default.$transaction([
            db_1.default.log.deleteMany({ where: { tenantId } }),
            db_1.default.user.deleteMany({ where: { tenantId } }),
            db_1.default.passwordReset.deleteMany({ where: { user: { tenantId } } }),
            db_1.default.tenant.delete({ where: { id: tenantId } }),
        ]);
        res.json({
            message: "Tenant and all associated users and logs have been purged successfully."
        });
    }
    catch (error) {
        console.error("DELETE_TENANT_ERROR:", error);
        res.status(500).json({
            error: "Failed to delete tenant. An internal error occurred during the purge."
        });
    }
};
exports.deleteTenant = deleteTenant;
