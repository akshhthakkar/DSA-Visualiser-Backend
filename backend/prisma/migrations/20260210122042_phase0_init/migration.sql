-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "ProgressStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'ATTEMPTED', 'SOLVED');

-- CreateTable
CREATE TABLE "universities" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" VARCHAR(20),
    "email_domains" TEXT[],
    "country" VARCHAR(100),
    "state" VARCHAR(100),
    "city" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "max_students" INTEGER,
    "max_teachers" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "universities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verified_at" TIMESTAMPTZ(3),
    "last_login_at" TIMESTAMPTZ(3),
    "login_count" INTEGER NOT NULL DEFAULT 0,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_secret" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "user_id" UUID NOT NULL,
    "register_number" VARCHAR(50) NOT NULL,
    "degree" VARCHAR(100) NOT NULL,
    "batch" VARCHAR(20) NOT NULL,
    "university_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "teachers" (
    "user_id" UUID NOT NULL,
    "university_id" UUID NOT NULL,
    "department" VARCHAR(100),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "degree" VARCHAR(100) NOT NULL,
    "batch" VARCHAR(20) NOT NULL,
    "university_id" UUID NOT NULL,
    "primary_teacher_id" UUID NOT NULL,
    "semester" VARCHAR(20),
    "academic_year" VARCHAR(20),
    "start_date" TIMESTAMPTZ(3),
    "end_date" TIMESTAMPTZ(3),
    "max_students" INTEGER NOT NULL DEFAULT 60,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_students" (
    "id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "enrolled_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "syllabus" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "degree" VARCHAR(100) NOT NULL,
    "batch" VARCHAR(20) NOT NULL,
    "order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "syllabus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problems" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "topic" VARCHAR(100) NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "syllabus_id" UUID,
    "problem_type" VARCHAR(50) NOT NULL DEFAULT 'CODING',
    "constraints" TEXT,
    "examples" JSONB,
    "time_complexity" VARCHAR(50),
    "space_complexity" VARCHAR(50),
    "variants" JSONB,
    "visualization_type" VARCHAR(50),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_progress" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "problem_id" UUID NOT NULL,
    "status" "ProgressStatus" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "time_spent_seconds" INTEGER NOT NULL DEFAULT 0,
    "score" DECIMAL(5,2),
    "best_time_ms" INTEGER,
    "variant_used" VARCHAR(100),
    "code_submission" TEXT,
    "solved_at" TIMESTAMPTZ(3),
    "last_attempted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "student_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_fingerprint" TEXT,
    "ip_address" INET NOT NULL,
    "user_agent" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "event_type" VARCHAR(100) NOT NULL,
    "resource_type" VARCHAR(100),
    "resource_id" UUID,
    "ip_address" INET,
    "user_agent" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "universities_is_active_idx" ON "universities"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "students_register_number_key" ON "students"("register_number");

-- CreateIndex
CREATE INDEX "students_university_id_idx" ON "students"("university_id");

-- CreateIndex
CREATE INDEX "students_batch_idx" ON "students"("batch");

-- CreateIndex
CREATE INDEX "students_degree_idx" ON "students"("degree");

-- CreateIndex
CREATE INDEX "students_register_number_idx" ON "students"("register_number");

-- CreateIndex
CREATE INDEX "teachers_university_id_idx" ON "teachers"("university_id");

-- CreateIndex
CREATE INDEX "teachers_department_idx" ON "teachers"("department");

-- CreateIndex
CREATE UNIQUE INDEX "classes_code_key" ON "classes"("code");

-- CreateIndex
CREATE INDEX "classes_university_id_idx" ON "classes"("university_id");

-- CreateIndex
CREATE INDEX "classes_primary_teacher_id_idx" ON "classes"("primary_teacher_id");

-- CreateIndex
CREATE INDEX "classes_batch_idx" ON "classes"("batch");

-- CreateIndex
CREATE INDEX "classes_code_idx" ON "classes"("code");

-- CreateIndex
CREATE INDEX "classes_deleted_at_idx" ON "classes"("deleted_at");

-- CreateIndex
CREATE INDEX "class_students_student_id_idx" ON "class_students"("student_id");

-- CreateIndex
CREATE INDEX "class_students_class_id_idx" ON "class_students"("class_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_students_class_id_student_id_key" ON "class_students"("class_id", "student_id");

-- CreateIndex
CREATE INDEX "syllabus_degree_batch_idx" ON "syllabus"("degree", "batch");

-- CreateIndex
CREATE INDEX "syllabus_order_idx" ON "syllabus"("order");

-- CreateIndex
CREATE UNIQUE INDEX "problems_slug_key" ON "problems"("slug");

-- CreateIndex
CREATE INDEX "problems_topic_idx" ON "problems"("topic");

-- CreateIndex
CREATE INDEX "problems_difficulty_idx" ON "problems"("difficulty");

-- CreateIndex
CREATE INDEX "problems_syllabus_id_idx" ON "problems"("syllabus_id");

-- CreateIndex
CREATE INDEX "problems_slug_idx" ON "problems"("slug");

-- CreateIndex
CREATE INDEX "student_progress_student_id_idx" ON "student_progress"("student_id");

-- CreateIndex
CREATE INDEX "student_progress_problem_id_idx" ON "student_progress"("problem_id");

-- CreateIndex
CREATE INDEX "student_progress_status_idx" ON "student_progress"("status");

-- CreateIndex
CREATE INDEX "student_progress_solved_at_idx" ON "student_progress"("solved_at");

-- CreateIndex
CREATE UNIQUE INDEX "student_progress_student_id_problem_id_key" ON "student_progress"("student_id", "problem_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_key" ON "sessions"("refresh_token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_refresh_token_idx" ON "sessions"("refresh_token");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_event_type_idx" ON "audit_logs"("event_type");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_primary_teacher_id_fkey" FOREIGN KEY ("primary_teacher_id") REFERENCES "teachers"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_students" ADD CONSTRAINT "class_students_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_students" ADD CONSTRAINT "class_students_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problems" ADD CONSTRAINT "problems_syllabus_id_fkey" FOREIGN KEY ("syllabus_id") REFERENCES "syllabus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_progress" ADD CONSTRAINT "student_progress_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_progress" ADD CONSTRAINT "student_progress_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
