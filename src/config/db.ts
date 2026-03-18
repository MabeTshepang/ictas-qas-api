import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as dotenv from 'dotenv';

dotenv.config();

const globalForPrisma = global as unknown as { prisma: PrismaClient };

/**
 * FIXED: Instead of passing a string that the driver misparses,
 * we pass a clean configuration object.
 */
const adapter = new PrismaMariaDb({
  host: 'localhost',
  port: 3306,
  user: 'ictas-admin',
  password: 'spectrumcs@2026', // Use the raw password here, no encoding needed!
  database: 'ictas'
});

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ 
    adapter,
    log: ['query', 'error', 'warn'] 
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;