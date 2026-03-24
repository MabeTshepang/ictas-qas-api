import * as dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import * as swaggerDocument from '../swagger.json';
import { globalErrorHandler } from './middleware/error-handler';
import { login, requestReset, resetPassword } from './controllers/auth.controller';

import adminRoutes from './routes/admin.routes';
import tenantRoutes from './routes/tenant.routes';
import userRoutes from './routes/user.routes';
import router from './routes/user.routes';
import { getPublicTenants } from './controllers/tenant.controller';
import { authLimiter } from './middleware/rate-limiter';
import prisma from './config/db';

const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : [];

const app = express();

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
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
  credentials: true
}));
app.use(express.json());

app.post('/api/auth/login', authLimiter, login);
app.post('/api/auth/forgot-password', authLimiter, requestReset); 
app.post('/api/auth/reset-password', authLimiter, resetPassword);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.get('/api/tenants/public', getPublicTenants);


app.use('/api/admin', adminRoutes);

app.use('/api', userRoutes);

app.use('/api/tenants', tenantRoutes);

app.use(globalErrorHandler);

async function checkDatabaseConnection() {
  try {
    console.log('⏳ Attempting to connect to Azure MySQL via MariaDB Adapter...');
    
    await prisma.$connect();
    
    await prisma.$queryRaw`SELECT 1`;
    
    console.log('Database connection verified.');
  } catch (error) {
    console.error('DATABASE CONNECTION ERROR:');
    console.error(error);
    
    process.exit(1); 
  }
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`🚀 Multi-Tenant API running on port ${PORT}`);
  await checkDatabaseConnection();
});

export default app;