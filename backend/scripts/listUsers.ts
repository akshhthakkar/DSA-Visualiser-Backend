import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log('DB_OK');
    console.log(`TOTAL_USERS=${users.length}`);
    for (const user of users) {
      console.log(
        `${user.id} | ${user.name} | ${user.email} | ${user.role} | active=${user.isActive} | createdAt=${user.createdAt.toISOString()}`
      );
    }
    return;
  } catch (error: any) {
    if (error?.code !== 'P2021') {
      throw error;
    }

    const tables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`
    );
    const userLikeTables = tables.filter((t) => t.table_name.toLowerCase().includes('user'));

    console.log('DB_OK_BUT_USERS_TABLE_MISSING');
    console.log(`TOTAL_TABLES=${tables.length}`);
    console.log(`USER_LIKE_TABLES=${userLikeTables.map((t) => t.table_name).join(',') || 'none'}`);
  }
}

main()
  .catch((error) => {
    console.error('DB_QUERY_FAILED');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
