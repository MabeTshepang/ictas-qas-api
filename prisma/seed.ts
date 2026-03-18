import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as argon2 from 'argon2';

const adapter = new PrismaMariaDb({
  host: 'localhost',
  port: 3306,
  user: 'ictas-admin',
  password: 'spectrumcs@2026',
  database: 'ictas'
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🚀 Starting Seed with FullNames and ZAMACE users...');

  // 1. CLEANUP
  await prisma.log.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
  console.log('🧹 Database wiped clean.');

  const commonPassword = 'Admin@2025!';
  const hashedPass = await argon2.hash(commonPassword);

  // 2. SEED TENANTS
  console.log('🏢 Seeding Tenants...');
  
  const moderatorTenant = await prisma.tenant.create({
    data: {
      name: "Spectrum Systems",
      subtitle: "Platform Management Console",
      type: "MODERATOR",
      status: "ACTIVE",
      branding: { overlayColor: "from-slate-900/90 to-slate-800/80", imageKey: "bgAdmin" }
    }
  });

  const bambTenant = await prisma.tenant.create({
    data: {
      name: "BAMB",
      subtitle: "Botswana Agricultural Marketing Board",
      type: "NORMAL",
      status: "ACTIVE",
      branding: { overlayColor: "from-green-900/80 to-emerald-800/60", imageKey: "bgAgri" }
    }
  });

  const zamaceTenant = await prisma.tenant.create({
    data: {
      name: "ZAMACE",
      subtitle: "Zambia Agricultural Commodities Exchange",
      type: "NORMAL",
      status: "ACTIVE",
      branding: { overlayColor: "from-blue-900/80 to-indigo-800/60", imageKey: "bgZambia" }
    }
  });

  // 3. SEED USERS (With fullName and ZAMACE entries)
  console.log('👤 Seeding Users...');
  
  // Moderator User
  const modUser = await prisma.user.create({
    data: {
      fullName: 'System Moderator',
      email: 'mod@spectrum.com',
      passwordHash: hashedPass,
      role: 'MODERATOR',
      tenantId: moderatorTenant.id
    }
  });

  // BAMB Users
  await prisma.user.create({
    data: {
      fullName: 'BAMB Administrator',
      email: 'admin@bamb.co.bw',
      passwordHash: hashedPass,
      role: 'ADMIN',
      tenantId: bambTenant.id
    }
  });

  const bambUser = await prisma.user.create({
    data: {
      fullName: 'BAMB Standard User',
      email: 'user@bamb.co.bw',
      passwordHash: hashedPass,
      role: 'USER',
      tenantId: bambTenant.id
    }
  });

  // ZAMACE Users
  await prisma.user.create({
    data: {
      fullName: 'ZAMACE Administrator',
      email: 'admin@zamace.co.zm',
      passwordHash: hashedPass,
      role: 'ADMIN',
      tenantId: zamaceTenant.id
    }
  });

  await prisma.user.create({
    data: {
      fullName: 'ZAMACE Standard User',
      email: 'user@zamace.co.zm',
      passwordHash: hashedPass,
      role: 'USER',
      tenantId: zamaceTenant.id
    }
  });

  // 4. SEED SAMPLE LOGS
  console.log('📄 Seeding Sample Activity Logs...');
  
  await prisma.log.create({
    data: {
      action: 'File Upload',
      filePath: '/uploads/bamb/bamb_q1_report.pdf',
      status: 'Sent',
      tenantId: bambTenant.id,
      userId: bambUser.id
    }
  });

  const userCount = await prisma.user.count();
  console.log(`✅ Seed Complete. Created ${userCount} users.`);
}

main()
  .catch((e) => {
    console.error('❌ SEED ERROR:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });