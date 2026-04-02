// prisma/seed.ts
// Seed script — populates all 11 tables with realistic test data.
// Run: npx tsx prisma/seed.ts

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

const BCRYPT_ROUNDS = 12;
const PASSWORD = 'Student@123'; // Same password for all seed users

async function main() {
  console.log('🌱 Seeding database...\n');

  // ============================================
  // 1. Universities
  // ============================================
  const university = await prisma.university.create({
    data: {
      name: 'SRM Institute of Science and Technology',
      shortName: 'SRMIST',
      emailDomains: ['srmist.edu.in', 'srmuniv.edu.in'],
      country: 'India',
      state: 'Tamil Nadu',
      city: 'Chennai',
      isActive: true,
      maxStudents: 500,
      maxTeachers: 50,
    },
  });
  console.log(`✅ University: ${university.name} (${university.id})`);

  const annaUniversity = await prisma.university.create({
    data: {
      name: 'Anna University',
      shortName: 'AU',
      emailDomains: ['annauniv.edu', 'au.edu.in'],
      country: 'India',
      state: 'Tamil Nadu',
      city: 'Chennai',
      isActive: true,
      maxStudents: 1000,
      maxTeachers: 100,
    },
  });
  console.log(`✅ University: ${annaUniversity.name} (${annaUniversity.id})`);

  // ============================================
  // 2. Users (6 students + 1 teacher + 1 admin + 1 super_admin)
  // ============================================
  const passwordHash = await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS);

  const studentData = [
    {
      name: 'Akshay Kumar',
      email: 'akshay.kumar@srmist.edu.in',
      regNo: 'RA2211003010001',
      degree: 'B.Tech CSE',
      batch: '2022',
    },
    {
      name: 'Priya Sharma',
      email: 'priya.sharma@srmist.edu.in',
      regNo: 'RA2211003010002',
      degree: 'B.Tech CSE',
      batch: '2022',
    },
    {
      name: 'Rahul Verma',
      email: 'rahul.verma@srmist.edu.in',
      regNo: 'RA2211003010003',
      degree: 'B.Tech CSE',
      batch: '2022',
    },
    {
      name: 'Sneha Reddy',
      email: 'sneha.reddy@srmist.edu.in',
      regNo: 'RA2211003010004',
      degree: 'B.Tech CSE',
      batch: '2023',
    },
    {
      name: 'Vikram Patel',
      email: 'vikram.patel@srmist.edu.in',
      regNo: 'RA2211003010005',
      degree: 'B.Tech CSE',
      batch: '2023',
    },
    {
      name: 'Divya Pathak',
      email: 'divya.pathak@srmist.edu.in',
      regNo: 'RA2211003010006',
      degree: 'B.Tech CSE',
      batch: '2022',
    },
  ];

  const studentUsers = [];
  for (const s of studentData) {
    const user = await prisma.user.create({
      data: {
        name: s.name,
        email: s.email,
        passwordHash,
        role: 'STUDENT',
        isActive: true,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        loginCount: 0,
      },
    });
    studentUsers.push({ user, ...s });
  }
  console.log(`✅ Users: ${studentUsers.length} students created`);

  const teacherUser = await prisma.user.create({
    data: {
      name: 'Dr. Anitha Raghavan',
      email: 'anitha.r@srmist.edu.in',
      passwordHash: await bcrypt.hash('Teacher@123', BCRYPT_ROUNDS),
      role: 'TEACHER',
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      loginCount: 0,
    },
  });
  console.log(`✅ Users: 1 teacher created`);

  // Admin user (for Phase 5 testing)
  const adminUser = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@srmist.edu.in',
      passwordHash: await bcrypt.hash('Admin@123', BCRYPT_ROUNDS),
      role: 'ADMIN',
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      loginCount: 0,
    },
  });
  console.log(`✅ Users: 1 admin created`);

  // SUPER_ADMIN user (for Phase 5 testing)
  const superAdminUser = await prisma.user.create({
    data: {
      name: 'Super Admin',
      email: 'superadmin@srmist.edu.in',
      passwordHash: await bcrypt.hash('SuperAdmin@123', BCRYPT_ROUNDS),
      role: 'SUPER_ADMIN',
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      loginCount: 0,
    },
  });
  console.log(`✅ Users: 1 super_admin created`);

  // Link Admin & SuperAdmin to SRMIST via Teacher profile
  await prisma.teacher.create({
    data: {
      userId: adminUser.id,
      universityId: university.id,
      department: 'Administration',
    },
  });
  await prisma.teacher.create({
    data: {
      userId: superAdminUser.id,
      universityId: university.id,
      department: 'Administration',
    },
  });
  console.log(`✅ Admin profiles: linked to ${university.shortName}`);

  // ============================================
  // 3. Students (profile rows)
  // ============================================
  const students = [];
  for (const s of studentUsers) {
    const student = await prisma.student.create({
      data: {
        userId: s.user.id,
        registerNumber: s.regNo,
        degree: s.degree,
        batch: s.batch,
        universityId: university.id,
      },
    });
    students.push(student);
  }
  console.log(`✅ Students: ${students.length} profiles created`);

  // ============================================
  // 4. Teachers (profile rows)
  // ============================================
  const teacher = await prisma.teacher.create({
    data: {
      userId: teacherUser.id,
      universityId: university.id,
      department: 'Computer Science',
    },
  });
  console.log(`✅ Teacher: ${teacherUser.name} (${teacher.userId})`);

  // Second teacher for Anna University
  const annaTeacherUser = await prisma.user.create({
    data: {
      name: 'Prof. Karthik Suresh',
      email: 'karthik.s@annauniv.edu',
      passwordHash: await bcrypt.hash('Teacher@123', BCRYPT_ROUNDS),
      role: 'TEACHER',
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      loginCount: 0,
    },
  });
  const annaTeacher = await prisma.teacher.create({
    data: {
      userId: annaTeacherUser.id,
      universityId: annaUniversity.id,
      department: 'Information Technology',
    },
  });
  console.log(`✅ Teacher: ${annaTeacherUser.name} (${annaTeacher.userId})`);

  // ============================================
  // 5. Classes (6 diverse classes)
  // ============================================
  // SRMIST Classes
  const dsa_class = await prisma.class.create({
    data: {
      name: 'Data Structures & Algorithms - Section A',
      code: 'CSE-2025-DSA-A',
      degree: 'BACHELORS',
      batch: '2022',
      universityId: university.id,
      primaryTeacherId: teacher.userId,
      semester: '4',
      startDate: new Date('2025-08-01T00:00:00Z'),
      endDate: new Date('2026-05-31T23:59:59Z'),
      isActive: true,
    },
  });
  console.log(`✅ Class: ${dsa_class.name} (${dsa_class.code})`);

  const webdev_class = await prisma.class.create({
    data: {
      name: 'Web Development',
      code: 'CSE-2024-WEB',
      degree: 'BACHELORS',
      batch: '2023',
      universityId: university.id,
      primaryTeacherId: teacher.userId,
      semester: '5',
      startDate: new Date('2024-01-01T00:00:00Z'),
      endDate: new Date('2024-05-31T23:59:59Z'),
      isActive: false,
    },
  });
  console.log(`✅ Class: ${webdev_class.name} (${webdev_class.code}) [inactive]`);

  const masters_ml_class = await prisma.class.create({
    data: {
      name: 'Machine Learning',
      code: 'CSE-2025-ML',
      degree: 'MASTERS',
      batch: '2025',
      universityId: university.id,
      primaryTeacherId: teacher.userId,
      semester: '2',
      startDate: new Date('2025-01-01T00:00:00Z'),
      endDate: new Date('2025-05-31T23:59:59Z'),
      isActive: true,
    },
  });
  console.log(`✅ Class: ${masters_ml_class.name} (${masters_ml_class.code}) [MASTERS]`);

  // Anna University Classes
  const anna_ai_class = await prisma.class.create({
    data: {
      name: 'Artificial Intelligence',
      code: 'IT-2025-AI',
      degree: 'BACHELORS',
      batch: '2023',
      universityId: annaUniversity.id,
      primaryTeacherId: annaTeacher.userId,
      semester: '6',
      startDate: new Date('2025-02-01T00:00:00Z'),
      endDate: new Date('2025-06-30T23:59:59Z'),
      isActive: true,
    },
  });
  console.log(`✅ Class: ${anna_ai_class.name} (${anna_ai_class.code})`);

  // Soft-deleted class with unique code 'SOFT-DELETE-TEST'
  const deleted_class = await prisma.class.create({
    data: {
      name: 'Old Database Course',
      code: 'SOFT-DELETE-TEST',
      degree: 'BACHELORS',
      batch: '2021',
      universityId: university.id,
      primaryTeacherId: teacher.userId,
      semester: '3',
      startDate: new Date('2023-08-01T00:00:00Z'),
      endDate: new Date('2024-05-31T23:59:59Z'),
      isActive: false,
      deletedAt: new Date('2024-06-15T10:30:00Z'),
    },
  });
  console.log(`✅ Class: ${deleted_class.name} (${deleted_class.code}) [soft-deleted]`);

  // Another Anna University class with same code structure (tests partial unique index)
  const anna_duplicate_code_test = await prisma.class.create({
    data: {
      name: 'Advanced DSA',
      code: 'CSE-2025-DSA-A', // Same code as SRMIST class, but different university
      degree: 'MASTERS',
      batch: '2025',
      universityId: annaUniversity.id,
      primaryTeacherId: annaTeacher.userId,
      semester: '1',
      startDate: new Date('2025-08-01T00:00:00Z'),
      endDate: new Date('2026-01-31T23:59:59Z'),
      isActive: true,
    },
  });
  console.log(
    `✅ Class: ${anna_duplicate_code_test.name} (${anna_duplicate_code_test.code}) [partial unique index test]`
  );

  // ============================================
  // 6. ClassStudent (enroll first 5 students — Divya Pathak left unenrolled)
  // ============================================
  const enrolledStudents = students.slice(0, 5);
  for (const student of enrolledStudents) {
    await prisma.classStudent.create({
      data: {
        classId: dsa_class.id,
        studentId: student.userId,
      },
    });
  }
  console.log(
    `✅ ClassStudents: ${enrolledStudents.length} enrollments (Divya Pathak unenrolled — add via teacher dashboard)`
  );

  // ============================================
  // 7. Syllabus (2 units)
  // ============================================
  const unit1 = await prisma.syllabus.create({
    data: {
      title: 'Arrays & Strings',
      degree: 'B.Tech CSE',
      batch: '2022',
      order: 1,
    },
  });

  const unit2 = await prisma.syllabus.create({
    data: {
      title: 'Linked Lists & Stacks',
      degree: 'B.Tech CSE',
      batch: '2022',
      order: 2,
    },
  });
  console.log(`✅ Syllabus: 2 units`);

  // ============================================
  // 8. Problems (5 problems)
  // ============================================
  const problems = await Promise.all([
    prisma.problem.create({
      data: {
        title: 'Two Sum',
        slug: 'two-sum',
        description:
          'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
        topic: 'Arrays',
        difficulty: 'EASY',
        syllabusId: unit1.id,
        problemType: 'CODING',
        constraints: '2 <= nums.length <= 10^4, -10^9 <= nums[i] <= 10^9',
        examples: [
          {
            input: 'nums = [2,7,11,15], target = 9',
            output: '[0,1]',
            explanation: 'Because nums[0] + nums[1] == 9',
          },
        ],
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(n)',
        visualizationType: 'array',
      },
    }),
    prisma.problem.create({
      data: {
        title: 'Valid Parentheses',
        slug: 'valid-parentheses',
        description:
          'Given a string s containing just the characters (, ), {, }, [ and ], determine if the input string is valid.',
        topic: 'Stacks',
        difficulty: 'EASY',
        syllabusId: unit2.id,
        problemType: 'CODING',
        constraints: '1 <= s.length <= 10^4',
        examples: [
          { input: 's = "()"', output: 'true' },
          { input: 's = "()[]{}"', output: 'true' },
        ],
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(n)',
        visualizationType: 'stack',
      },
    }),
    prisma.problem.create({
      data: {
        title: 'Maximum Subarray',
        slug: 'maximum-subarray',
        description:
          'Given an integer array nums, find the subarray with the largest sum, and return its sum.',
        topic: 'Arrays',
        difficulty: 'MEDIUM',
        syllabusId: unit1.id,
        problemType: 'CODING',
        constraints: '1 <= nums.length <= 10^5',
        examples: [
          {
            input: 'nums = [-2,1,-3,4,-1,2,1,-5,4]',
            output: '6',
            explanation: 'Subarray [4,-1,2,1] has the largest sum.',
          },
        ],
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(1)',
        visualizationType: 'array',
      },
    }),
    prisma.problem.create({
      data: {
        title: 'Reverse Linked List',
        slug: 'reverse-linked-list',
        description:
          'Given the head of a singly linked list, reverse the list, and return the reversed list.',
        topic: 'Linked Lists',
        difficulty: 'EASY',
        syllabusId: unit2.id,
        problemType: 'CODING',
        constraints: '0 <= Number of nodes <= 5000',
        examples: [{ input: 'head = [1,2,3,4,5]', output: '[5,4,3,2,1]' }],
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(1)',
        visualizationType: 'linkedlist',
      },
    }),
    prisma.problem.create({
      data: {
        title: 'Sort Colors',
        slug: 'sort-colors',
        description:
          'Given an array nums with n objects colored red, white, or blue, sort them in-place so that objects of the same color are adjacent.',
        topic: 'Arrays',
        difficulty: 'MEDIUM',
        syllabusId: unit1.id,
        problemType: 'CODING',
        constraints: 'n == nums.length, 1 <= n <= 300, nums[i] is 0, 1, or 2',
        examples: [{ input: 'nums = [2,0,2,1,1,0]', output: '[0,0,1,1,2,2]' }],
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(1)',
        visualizationType: 'array',
      },
    }),
  ]);
  console.log(`✅ Problems: 5 created`);

  // ============================================
  // 9. StudentProgress (varied per student)
  // ============================================
  const progressData = [
    // Akshay — solved 3, in-progress 1, not started 1
    {
      studentIdx: 0,
      problemIdx: 0,
      status: 'SOLVED' as const,
      attempts: 2,
      timeSpent: 1200,
      score: 95.0,
      solvedAt: new Date('2026-01-15'),
    },
    {
      studentIdx: 0,
      problemIdx: 1,
      status: 'SOLVED' as const,
      attempts: 1,
      timeSpent: 600,
      score: 100.0,
      solvedAt: new Date('2026-01-20'),
    },
    {
      studentIdx: 0,
      problemIdx: 2,
      status: 'SOLVED' as const,
      attempts: 3,
      timeSpent: 2400,
      score: 85.5,
      solvedAt: new Date('2026-02-01'),
    },
    {
      studentIdx: 0,
      problemIdx: 3,
      status: 'IN_PROGRESS' as const,
      attempts: 1,
      timeSpent: 300,
      score: null,
      solvedAt: null,
    },
    // Priya — solved 2, attempted 1
    {
      studentIdx: 1,
      problemIdx: 0,
      status: 'SOLVED' as const,
      attempts: 1,
      timeSpent: 800,
      score: 100.0,
      solvedAt: new Date('2026-01-10'),
    },
    {
      studentIdx: 1,
      problemIdx: 2,
      status: 'SOLVED' as const,
      attempts: 2,
      timeSpent: 1800,
      score: 90.0,
      solvedAt: new Date('2026-01-25'),
    },
    {
      studentIdx: 1,
      problemIdx: 4,
      status: 'ATTEMPTED' as const,
      attempts: 2,
      timeSpent: 900,
      score: null,
      solvedAt: null,
    },
    // Rahul — solved 1, in-progress 2
    {
      studentIdx: 2,
      problemIdx: 0,
      status: 'SOLVED' as const,
      attempts: 3,
      timeSpent: 1500,
      score: 80.0,
      solvedAt: new Date('2026-02-05'),
    },
    {
      studentIdx: 2,
      problemIdx: 1,
      status: 'IN_PROGRESS' as const,
      attempts: 1,
      timeSpent: 400,
      score: null,
      solvedAt: null,
    },
    {
      studentIdx: 2,
      problemIdx: 3,
      status: 'IN_PROGRESS' as const,
      attempts: 1,
      timeSpent: 200,
      score: null,
      solvedAt: null,
    },
    // Sneha — solved all 5
    {
      studentIdx: 3,
      problemIdx: 0,
      status: 'SOLVED' as const,
      attempts: 1,
      timeSpent: 500,
      score: 100.0,
      solvedAt: new Date('2026-01-08'),
    },
    {
      studentIdx: 3,
      problemIdx: 1,
      status: 'SOLVED' as const,
      attempts: 1,
      timeSpent: 700,
      score: 100.0,
      solvedAt: new Date('2026-01-12'),
    },
    {
      studentIdx: 3,
      problemIdx: 2,
      status: 'SOLVED' as const,
      attempts: 2,
      timeSpent: 1600,
      score: 92.0,
      solvedAt: new Date('2026-01-18'),
    },
    {
      studentIdx: 3,
      problemIdx: 3,
      status: 'SOLVED' as const,
      attempts: 1,
      timeSpent: 900,
      score: 98.0,
      solvedAt: new Date('2026-01-22'),
    },
    {
      studentIdx: 3,
      problemIdx: 4,
      status: 'SOLVED' as const,
      attempts: 2,
      timeSpent: 1100,
      score: 88.0,
      solvedAt: new Date('2026-02-01'),
    },
    // Vikram — not started anything yet (no rows)
  ];

  for (const p of progressData) {
    await prisma.studentProgress.create({
      data: {
        studentId: students[p.studentIdx]!.userId,
        problemId: problems[p.problemIdx]!.id,
        status: p.status,
        attempts: p.attempts,
        timeSpentSeconds: p.timeSpent,
        score: p.score,
        solvedAt: p.solvedAt,
        lastAttemptedAt: p.solvedAt ?? new Date(),
      },
    });
  }
  console.log(`✅ StudentProgress: ${progressData.length} records`);

  // ============================================
  // 10. Sessions (1 active session per student)
  // ============================================
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  for (const s of studentUsers) {
    await prisma.session.create({
      data: {
        userId: s.user.id,
        ipAddress: '192.168.1.' + (Math.floor(Math.random() * 200) + 10),
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DSA-Visualizer-Seed',
        refreshToken: `seed-refresh-${s.user.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        expiresAt,
      },
    });
  }
  console.log(`✅ Sessions: 5 active`);

  // ============================================
  // 11. AuditLogs (signup events for all users)
  // ============================================
  const allUsers = [
    ...studentUsers.map((s) => s.user),
    teacherUser,
    annaTeacherUser,
    adminUser,
    superAdminUser,
  ];
  for (const u of allUsers) {
    await prisma.auditLog.create({
      data: {
        userId: u.id,
        eventType: 'AUTH_SIGNUP',
        resourceType: 'USER',
        resourceId: u.id,
        ipAddress: '127.0.0.1',
        userAgent: 'seed-script',
        metadata: { role: u.role, seeded: true },
      },
    });
  }
  console.log(`✅ AuditLogs: ${allUsers.length} signup events`);

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n📊 Seed Summary:');
  console.log('  Universities:     2  (SRMIST + Anna University)');
  console.log(
    `  Users:            ${allUsers.length}  (${studentUsers.length} students + 2 teachers + 1 admin + 1 super_admin)`
  );
  console.log(`  Students:         ${students.length}`);
  console.log('  Teachers:         2');
  console.log('  Admins:           1');
  console.log('  Super Admins:     1');
  console.log('  Classes:          6  (3 SRMIST + 3 Anna, mixed states)');
  console.log(`  ClassStudents:    ${enrolledStudents.length}  (Divya Pathak unenrolled)`);

  console.log('  Syllabus:         2');
  console.log('  Problems:         5');
  console.log(`  StudentProgress:  ${progressData.length}`);
  console.log('  Sessions:         5');
  console.log(`  AuditLogs:        ${allUsers.length}`);
  console.log(`\n🔑 Login credentials:`);
  console.log(`  Students:    <email> / ${PASSWORD}`);
  console.log(`  Teachers:`);
  console.log(`    SRMIST:    anitha.r@srmist.edu.in / Teacher@123`);
  console.log(`    Anna:      karthik.s@annauniv.edu / Teacher@123`);
  console.log(`  Admin:       admin@srmist.edu.in / Admin@123`);
  console.log(`  SuperAdmin:  superadmin@srmist.edu.in / SuperAdmin@123`);
  console.log('\n✨ Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
