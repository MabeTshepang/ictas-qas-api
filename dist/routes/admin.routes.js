"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const admin_controller_1 = require("../controllers/admin.controller");
const user_controller_1 = require("../controllers/user.controller");
const router = (0, express_1.Router)();
// Apply Auth and Admin role to all routes in this file
router.use(auth_1.authenticate);
router.use((0, auth_1.authorize)(['ADMIN', 'MODERATOR']));
// Dashboard Metrics
router.get('/stats', admin_controller_1.getDashboardStats);
router.get('/logs', admin_controller_1.getLogs);
// User Management CRUD
router.get('/users', user_controller_1.getAllUsers);
router.post('/users', user_controller_1.createUser);
router.patch('/users/:id', user_controller_1.updateUser);
router.delete('/users/:id', user_controller_1.deleteUser);
router.get('/moderator/users', user_controller_1.getAllModerators);
router.post('/moderator/users', user_controller_1.inviteModerator);
router.delete('/moderator/users/:id', user_controller_1.removeModerator);
exports.default = router;
