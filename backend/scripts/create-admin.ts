import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password.js';
import * as readline from 'readline/promises';

const prisma = new PrismaClient();
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

async function createAdmin() {
  console.log('--- Create Admin User ---');
  const name = await rl.question('Name: ');
  const email = await rl.question('Email: ');
  const password = await rl.question('Password: ');

  if (!name || !email || !password) {
    console.error('All fields are required.');
    process.exit(1);
  }

  try {
    const hashedPassword = await hashPassword(password);

    // Auto-create a default university if none exists for the admin, or let it connect
    let university = await prisma.university.findFirst();
    if (!university) {
      university = await prisma.university.create({
        data: { name: 'Default Admin University', shortName: 'DAU' },
      });
    }

    const admin = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashedPassword,
        role: 'SUPER_ADMIN',
      },
    });

    console.log(`Successfully created admin user: ${admin.email}`);
  } catch (error) {
    console.error('Error creating admin:', error);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

createAdmin();
