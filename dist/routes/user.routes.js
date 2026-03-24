"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const upload_controller_1 = require("../controllers/upload.controller");
const admin_controller_1 = require("../controllers/admin.controller");
const multer_1 = __importDefault(require("multer"));
const auth_controller_1 = require("../controllers/auth.controller");
const user_controller_1 = require("../controllers/user.controller");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});
// Protect all routes here
router.use(auth_1.authenticate);
// Account & Profile
router.patch('/user/password', auth_controller_1.updatePassword);
// Document Pipeline (Frontend: /api/upload, /api/logs/...)
router.post('/upload', upload.single('file'), upload_controller_1.handleUpload);
router.post('/logs/:logId/re-email', admin_controller_1.reEmailLog);
router.patch('/logs/:logId', user_controller_1.updateLog);
// Discovery
router.get('/files', admin_controller_1.getFiles);
router.get('/files/:id', admin_controller_1.getFileDetails);
router.get('/my-logs', user_controller_1.getMyLogs); // Path: /api/my-logs
router.post('/logs', admin_controller_1.createLog);
// Admin-only cleanup within the /api/files path
router.delete('/files/:id', (0, auth_1.authorize)(['ADMIN']), admin_controller_1.deleteFileRecord);
exports.default = router;
