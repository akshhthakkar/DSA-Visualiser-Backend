import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding superadmins...');

  const passwordHash1 = await bcrypt.hash('AkshDSA@123', 12);
  const passwordHash2 = await bcrypt.hash('DivyaDSA@123', 12);

  // Super Admin 1
  await prisma.user.upsert({
    where: { email: 'aksht455@gmail.com' },
    update: {
      passwordHash: passwordHash1,
      role: 'SUPER_ADMIN',
      isActive: true,
      emailVerified: true
    },
    create: {
      name: 'Aksh',
      email: 'aksht455@gmail.com',
      passwordHash: passwordHash1,
      role: 'SUPER_ADMIN',
      isActive: true,
      emailVerified: true
    }
  });

  // Super Admin 2
  await prisma.user.upsert({
    where: { email: 'pathakdivya016@gmail.com' },
    update: {
      passwordHash: passwordHash2,
      role: 'SUPER_ADMIN',
      isActive: true,
      emailVerified: true
    },
    create: {
      name: 'Divya Pathak',
      email: 'pathakdivya016@gmail.com',
      passwordHash: passwordHash2,
      role: 'SUPER_ADMIN',
      isActive: true,
      emailVerified: true
    }
  });

  console.log('Superadmins seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
