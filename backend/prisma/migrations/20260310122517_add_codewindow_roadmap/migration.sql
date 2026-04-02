-- AlterTable
ALTER TABLE "problems" ADD COLUMN     "created_by_user_id" UUID,
ADD COLUMN     "expected_output" JSONB,
ADD COLUMN     "hints" JSONB,
ADD COLUMN     "is_published" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "starter_code" JSONB;

-- CreateTable
CREATE TABLE "roadmap_chapters" (
    "id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "total_problems" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roadmap_chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap_problems" (
    "id" UUID NOT NULL,
    "chapter_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "topic" VARCHAR(100) NOT NULL,
    "leetcode_url" TEXT,
    "problem_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roadmap_problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap_progress" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "roadmap_problem_id" UUID NOT NULL,
    "status" "ProgressStatus" NOT NULL,
    "solved_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "roadmap_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "roadmap_chapters_order_idx" ON "roadmap_chapters"("order");

-- CreateIndex
CREATE INDEX "roadmap_problems_chapter_id_idx" ON "roadmap_problems"("chapter_id");

-- CreateIndex
CREATE INDEX "roadmap_progress_student_id_idx" ON "roadmap_progress"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "roadmap_progress_student_id_roadmap_problem_id_key" ON "roadmap_progress"("student_id", "roadmap_problem_id");

-- CreateIndex
CREATE INDEX "problems_is_published_idx" ON "problems"("is_published");

-- CreateIndex
CREATE INDEX "problems_created_by_user_id_idx" ON "problems"("created_by_user_id");

-- AddForeignKey
ALTER TABLE "problems" ADD CONSTRAINT "problems_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_problems" ADD CONSTRAINT "roadmap_problems_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "roadmap_chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_problems" ADD CONSTRAINT "roadmap_problems_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_progress" ADD CONSTRAINT "roadmap_progress_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_progress" ADD CONSTRAINT "roadmap_progress_roadmap_problem_id_fkey" FOREIGN KEY ("roadmap_problem_id") REFERENCES "roadmap_problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;
