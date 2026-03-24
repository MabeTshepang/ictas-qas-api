"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const tenant_controller_1 = require("../controllers/tenant.controller");
const multer_1 = __importDefault(require("multer"));
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});
// Protected Moderator access
router.use(auth_1.authenticate);
router.get('/logs', auth_1.authenticate, (0, auth_1.authorize)(['MODERATOR', 'ADMIN']), tenant_controller_1.getAllTenantLogs);
router.use((0, auth_1.authorize)(['MODERATOR']));
router.get('/all', auth_1.authenticate, (0, auth_1.authorize)(['MODERATOR']), tenant_controller_1.getAllTenants);
router.get('/stats', auth_1.authenticate, (0, auth_1.authorize)(['MODERATOR']), tenant_controller_1.getModDashboardStats);
router.post('/', upload.single('file'), tenant_controller_1.createTenant);
router.patch('/:id', upload.single('file'), tenant_controller_1.updateTenant);
router.delete('/:id', tenant_controller_1.deleteTenant);
exports.default = router;
