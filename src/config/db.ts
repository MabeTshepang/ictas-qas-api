import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as dotenv from 'dotenv';
import { hostname } from 'os';

dotenv.config();

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const adapter = new PrismaMariaDb({
  host: process.env.DB_HOST || 'ictasbw-db.mysql.database.azure.com',
  port: 3306,
  user: process.env.DB_USER || 'ictas_admin',
  password: process.env.DB_PASSWORD || 'spectrumcs@2026',
  database: process.env.DB_NAME || 'ictas',
  ssl: true
});

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ 
    adapter,
    log: ['query', 'error', 'warn'] 
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;