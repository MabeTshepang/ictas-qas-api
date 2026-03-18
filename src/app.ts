import * as dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import * as swaggerDocument from '../swagger.json';

// Configurations & Middleware
import { globalErrorHandler } from './middleware/error-handler';

// Controllers
import { login } from './controllers/auth.controller';

import adminRoutes from './routes/admin.routes';
import tenantRoutes from './routes/tenant.routes';
import userRoutes from './routes/user.routes';
import router from './routes/user.routes';
import { getPublicTenants } from './controllers/tenant.controller';

const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : [];

const app = express();

// --- 1. Global Middleware ---

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.error(`CORS Blocked: Origin ${origin} not allowed.`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // Required if you decide to use cookies later
}));
app.use(express.json());

// 1. Public Auth (Stays in main app or auth.routes)
app.post('/api/auth/login', login);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.get('/api/tenants/public', getPublicTenants);

// 2. Mount Routers
// This preserves /api/admin/...
app.use('/api/admin', adminRoutes);

// This preserves /api/upload, /api/my-logs, etc.
app.use('/api', userRoutes);

// This preserves /api/tenants/public and /tenants
app.use('/api/tenants', tenantRoutes);

// --- 6. Error Handling ---
app.use(globalErrorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Multi-Tenant API running on port ${PORT}`);
});

export default app;