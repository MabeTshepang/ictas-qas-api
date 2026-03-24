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
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swaggerDocument = __importStar(require("../swagger.json"));
const error_handler_1 = require("./middleware/error-handler");
const auth_controller_1 = require("./controllers/auth.controller");
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const tenant_routes_1 = __importDefault(require("./routes/tenant.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const tenant_controller_1 = require("./controllers/tenant.controller");
const rate_limiter_1 = require("./middleware/rate-limiter");
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : [];
const app = (0, express_1.default)();
// --- 1. Global Middleware ---
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        }
        else {
            console.error(`CORS Blocked: Origin ${origin} not allowed.`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true // Required if you decide to use cookies later
}));
app.use(express_1.default.json());
// 1. Public Auth (Stays in main app or auth.routes)
app.post('/api/auth/login', rate_limiter_1.authLimiter, auth_controller_1.login);
app.post('/api/auth/forgot-password', rate_limiter_1.authLimiter, auth_controller_1.requestReset);
app.post('/api/auth/reset-password', rate_limiter_1.authLimiter, auth_controller_1.resetPassword);
app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerDocument));
app.get('/api/tenants/public', tenant_controller_1.getPublicTenants);
// 2. Mount Routers
// This preserves /api/admin/...
app.use('/api/admin', admin_routes_1.default);
// This preserves /api/upload, /api/my-logs, etc.
app.use('/api', user_routes_1.default);
// This preserves /api/tenants/public and /tenants
app.use('/api/tenants', tenant_routes_1.default);
// --- 6. Error Handling ---
app.use(error_handler_1.globalErrorHandler);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Multi-Tenant API running on port ${PORT}`);
});
exports.default = app;
