import { PrismaClient, Role, TenantStatus, TenantType } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as dotenv from 'dotenv';

dotenv.config();
const adapter = new PrismaMariaDb({
  host: process.env.DB_HOST || 'ictasbw-db.mysql.database.azure.com',
  port: 3306,
  user: process.env.DB_USER || 'ictas_admin',
  password: process.env.DB_PASSWORD || 'spectrumcs@2026',
  database: process.env.DB_NAME || 'ictas',
  ssl: true
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- Starting Full Database Seed ---');

  const tenants = [
    {
      id: 'cmmugsbjb0000cwo8axmn52ul',
      name: 'Spectrum Analytics',
      subtitle: 'Platform Management Console',
      status: TenantStatus.ACTIVE,
      type: TenantType.MODERATOR,
      branding: { overlayColor: 'from-slate-900/90 to-slate-800/80', imageKey: 'bgAdmin' },
      fileSlug: 'spectrum-admin'
    },
    {
      id: 'cmmugsbjy0001cwo8j9bhdwsh',
      name: 'BAMB',
      subtitle: 'Botswana Agricultural Marketing Board',
      status: TenantStatus.ACTIVE,
      type: TenantType.NORMAL,
      branding: { overlayColor: 'from-green-900/80 to-emerald-800/60', imageKey: 'https://ik.imagekit.io/ef7gdvmbs/ictas/bg-agriculture.jpg' },
      fileSlug: 'bamb'
    },
    {
      id: 'cmmugsbk50002cwo8qz9645v3',
      name: 'ZAMACE',
      subtitle: 'Zambia Agricultural Commodities Exchange',
      status: TenantStatus.ACTIVE,
      type: TenantType.NORMAL,
      branding: { overlayColor: 'from-blue-900/80 to-indigo-800/60', imageKey: 'https://ik.imagekit.io/ef7gdvmbs/ictas/bg-commodity.jpg' },
      fileSlug: 'zamace'
    },
    {
      id: 'cmmx5f7ks0000sko8d6of7mnd',
      name: 'BAMB Gaborone',
      subtitle: null,
      status: TenantStatus.ACTIVE,
      type: TenantType.NORMAL,
      branding: { imageKey: 'https://ik.imagekit.io/ef7gdvmbs/ictas/tenant_bg_1773905309310_dJadJAuPP.jpg', overlayColor: 'from-purple-900/80 to-purple-800/80' },
      fileSlug: 'bamb-gaborone'
    }
  ];

  for (const t of tenants) {
    await prisma.tenant.upsert({
      where: { id: t.id },
      update: {},
      create: t,
    });
  }
  console.log('✅ All Tenants seeded.');

  const users = [
    { id: 'cmmugsbkf0003cwo8hskh46s7', fullName: 'System Moderator', email: 'mod@spectrum.com', passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$P1M2aYRRmpXzYbUP/ezz8g$V0acq0W0ew2X74Lk+kXneLB04y2+NKFLNz7y+rhtdyU', role: Role.MODERATOR, tenantId: 'cmmugsbjb0000cwo8axmn52ul' },
    { id: 'cmmugsbkn0004cwo81d07f2ef', fullName: 'BAMB Administrator', email: 'admin@bamb.co.bw', passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$P1M2aYRRmpXzYbUP/ezz8g$V0acq0W0ew2X74Lk+kXneLB04y2+NKFLNz7y+rhtdyU', role: Role.ADMIN, tenantId: 'cmmugsbjy0001cwo8j9bhdwsh' },
    { id: 'cmmugsbl40005cwo8azc0ej3w', fullName: 'BAMB Standard User', email: 'user@bamb.co.bw', passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$P1M2aYRRmpXzYbUP/ezz8g$V0acq0W0ew2X74Lk+kXneLB04y2+NKFLNz7y+rhtdyU', role: Role.USER, tenantId: 'cmmugsbjy0001cwo8j9bhdwsh' },
    { id: 'cmmumj4mk0000y8o8zkwwjr8w', fullName: 'Test User', email: 'test@bamb.co.bw', passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$N46TA6pSf3TYmQlua/0UGg$XS/UmN2Y67zj7Xjewy735J9fT3fWtLM/hGLmUOVV3l0', role: Role.USER, tenantId: 'cmmugsbjy0001cwo8j9bhdwsh' },
    { id: 'cmmx5f7nx0001sko8up5oxkmg', fullName: 'Tshepang Mabe', email: 'tshepangmabej@gmail.com', passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$eC64XLhHCJBVIMd47ArNPA$nLeuW20R2UZGn7W2EDQjnHxcOa0cftwm8vsn2JURHXI', role: Role.ADMIN, tenantId: 'cmmx5f7ks0000sko8d6of7mnd' },
    { id: 'cmmxb0dm20000c0o8tyk82e6m', fullName: 'Tshepang Mabe', email: 'tshepangm@spectrumcs.co.bw', passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$F68JgvO12+BNTFmviKO9vA$GRWCckZRn3n6TujswFs6a5VaJPLHR+LnywShPNTxHd0', role: Role.MODERATOR, tenantId: 'cmmugsbjb0000cwo8axmn52ul' }
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: {},
      create: u,
    });
  }
  console.log('✅ All Users seeded.');

  await prisma.log.createMany({
    data: [
      { id: 'cmmui35gd0000tko8lneee6o8', userId: 'cmmugsbkn0004cwo81d07f2ef', action: 'User Login', status: 'Sent', tenantId: 'cmmugsbjy0001cwo8j9bhdwsh', createdAt: new Date('2026-03-17 10:59:46.893') },
      { id: 'cmmuph6ti0000f0o8h4fpmn9o', userId: 'cmmumj4mk0000y8o8zkwwjr8w', action: 'File Upload', status: 'Sent', filePath: 'https://ictasstore.blob.core.windows.net/uploads/cmmugsbjy0001cwo8j9bhdwsh/2026/3/pandamatenga_1773757598253_D800.pdf', tenantId: 'cmmugsbjy0001cwo8j9bhdwsh', createdAt: new Date('2026-03-17 14:26:39.143') },
      { id: 'cmmxicr7q0001poo8jqa8msbw', userId: 'cmmugsbkn0004cwo81d07f2ef', action: 'User Login', status: 'Success', tenantId: 'cmmugsbjy0001cwo8j9bhdwsh', createdAt: new Date('2026-03-19 13:30:33.538') }
    ],
    skipDuplicates: true
  });

  console.log('✅ Sample Logs seeded.');

  console.log('✅ Password Resets seeded.');
  console.log('--- Seeding Completed ---');
}

main()
  .catch((e) => {
    console.error('❌ SEED ERROR:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });