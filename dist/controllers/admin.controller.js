"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLogs = exports.createLog = exports.reEmailLog = exports.deleteFileRecord = exports.getFileDetails = exports.getDashboardStats = exports.getFiles = void 0;
const db_1 = __importDefault(require("../config/db"));
const date_fns_1 = require("date-fns");
const azure_storage_service_1 = require("../services/azure-storage.service");
const resend_1 = require("resend");
const tenant_controller_1 = require("./tenant.controller");
const resend = new resend_1.Resend(process.env.RESEND_API_KEY);
// --- DASHBOARD & LISTING (READ) ---
const getFiles = async (req, res) => {
    const { tenantId, role, id: userId } = req.user;
    try {
        const files = await db_1.default.log.findMany({
            where: {
                // MODERATORS see everything; ADMINS/USERS see only their tenant
                ...(role !== 'MODERATOR' ? { tenantId } : {}),
                ...(role === 'USER' ? { userId } : {})
            },
            include: {
                tenant: { select: { name: true } } // Added so we know which tenant the log belongs to
            },
            orderBy: { createdAt: 'desc' }, // Changed from timestamp to createdAt
            take: 50
        });
        res.json(files);
    }
    catch (error) {
        res.status(500).json({ error: 'Could not retrieve file logs' });
    }
};
exports.getFiles = getFiles;
/**
 * Fetches all registered tenants (BAMB, ZAMACE, etc.)
 * Filters out the 'MODERATOR' tenant to keep the list focused on clients.
 */
const getDashboardStats = async (req, res) => {
    const { tenantId, role } = req.user;
    const todayStart = (0, date_fns_1.startOfDay)(new Date());
    try {
        // Determine filter based on role
        const globalFilter = role === 'MODERATOR' ? {} : { tenantId };
        const [totalStats, todayStats] = await Promise.all([
            db_1.default.log.groupBy({
                by: ['status'],
                where: globalFilter,
                _count: { _all: true }
            }),
            db_1.default.log.groupBy({
                by: ['status'],
                where: { ...globalFilter, createdAt: { gte: todayStart } },
                _count: { _all: true }
            })
        ]);
        /**
         * Helper to map Prisma group results to our specific interface keys.
         * Maps 'Sent' -> emailed, 'Failed' -> failed, etc.
         */
        const mapStats = (statsArray) => {
            const getVal = (status) => statsArray.find(s => s.status === status)?._count._all || 0;
            const emailed = getVal('Sent');
            const failed = getVal('Failed');
            const pending = getVal('Pending');
            return {
                uploaded: emailed + failed + pending, // Total uploads is the sum of all statuses
                emailed,
                pending,
                failed
            };
        };
        const responseData = {
            total: mapStats(totalStats),
            today: mapStats(todayStats)
        };
        res.json(responseData);
    }
    catch (error) {
        console.error('STATS_ERROR:', error);
        res.status(500).json({ error: 'Stats aggregation failed' });
    }
};
exports.getDashboardStats = getDashboardStats;
// --- LOG/FILE MANAGEMENT (CRUD) ---
const getFileDetails = async (req, res) => {
    const { id } = req.params;
    const { tenantId, role } = req.user;
    const file = await db_1.default.log.findFirst({
        where: {
            id,
            ...(role !== 'MODERATOR' ? { tenantId } : {})
        },
        include: { tenant: true }
    });
    if (!file)
        return res.status(404).json({ error: "Record not found" });
    res.json(file);
};
exports.getFileDetails = getFileDetails;
const deleteFileRecord = async (req, res) => {
    const { id } = req.params;
    const { tenantId, role } = req.user;
    try {
        await db_1.default.log.delete({
            where: {
                id,
                ...(role !== 'MODERATOR' ? { tenantId } : {})
            }
        });
        res.status(204).send();
    }
    catch (error) {
        res.status(404).json({ error: "Record not found" });
    }
};
exports.deleteFileRecord = deleteFileRecord;
const reEmailLog = async (req, res) => {
    const { logId } = req.params;
    const user = req.user;
    try {
        // 1. Find the log entry and verify ownership/tenant
        const log = await db_1.default.log.findFirst({
            where: { id: logId, tenantId: user.tenantId }
        });
        if (!log || !log.filePath) {
            return res.status(404).json({ error: "Log or file record not found" });
        }
        // 2. Download the encrypted buffer from Azure
        const fileBuffer = await (0, azure_storage_service_1.downloadFromAzure)(log.filePath);
        const tenant = await (0, tenant_controller_1.getTenantInfo)(user.tenantId);
        // 3. Resolve Recipients (Using the same logic as your upload)
        const receiver = process.env.RECEIVER_EMAIL;
        const fileName = log.filePath.split('/').pop() || 'document.pdf';
        // 4. Re-send via Resend
        const { error } = await resend.emails.send({
            from: `ICTAS ${tenant.name} <${process.env.SENDER_EMAIL}>`,
            to: [receiver || ''],
            cc: [process.env.CCRECEIVER_EMAIL || ''],
            bcc: [process.env.BCCRECEIVER_EMAIL || ''],
            subject: `ICTAS ${tenant.name} - Delivery Note`,
            html: `<strong>Find Attached ${tenant.name} Grain Assessment Form</strong>`,
            attachments: [{ filename: fileName, content: fileBuffer }],
        });
        if (error)
            throw new Error(error.message);
        // 5. Update the log status to "Sent"
        await db_1.default.log.update({
            where: { id: logId },
            data: { status: 'Sent', action: 'File Upload' }
        });
        res.json({ message: "Email resent successfully" });
    }
    catch (err) {
        console.error("RE-EMAIL_ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
};
exports.reEmailLog = reEmailLog;
const createLog = async (req, res) => {
    const { tenantId, id: userId } = req.user;
    const { action, status, filePath, metadata } = req.body;
    // Basic Validation
    if (!action || !status) {
        return res.status(400).json({ error: "Action and Status are required fields." });
    }
    try {
        const newLog = await db_1.default.log.create({
            data: {
                action,
                status, // e.g., 'Sent', 'Failed', 'Pending'
                filePath: filePath || null,
                metadata: metadata || {}, // Any extra JSON data
                tenantId,
                userId
            }
        });
        res.status(201).json(newLog);
    }
    catch (error) {
        console.error("CREATE_LOG_ERROR:", error);
        res.status(500).json({ error: "Failed to record log entry." });
    }
};
exports.createLog = createLog;
const getLogs = async (req, res) => {
    const { tenantId, role } = req.user;
    try {
        // If Moderator, show all logs. If Admin/User, show only their tenant's logs.
        const whereClause = role === 'MODERATOR' ? {} : { tenantId };
        const logs = await db_1.default.log.findMany({
            where: whereClause,
            include: {
                user: {
                    select: {
                        fullName: true,
                        email: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 100 // Limit to latest 100 for performance
        });
        res.json(logs);
    }
    catch (error) {
        console.error("FETCH_LOGS_ERROR:", error);
        res.status(500).json({ error: "Failed to fetch activity logs." });
    }
};
exports.getLogs = getLogs;
