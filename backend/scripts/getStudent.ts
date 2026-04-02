import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
    const u = await prisma.user.findFirst({ where: { email: "student@srmist.edu.in" } });
    console.log("==========================================");
    console.log("==> STUDENT ID: " + u?.id);
    console.log("==========================================");
    process.exit(0);
}
main();
