-- CreateTable
CREATE TABLE "interview_sessions" (
    "id" UUID NOT NULL,
    "host_id" UUID NOT NULL,
    "candidate_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'waiting',
    "problems" JSONB,
    "problem" TEXT,
    "difficulty" VARCHAR(50),
    "room_id" VARCHAR(100) NOT NULL,
    "score" VARCHAR(50),
    "problem_codes" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "interview_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hidden_test_cases" (
    "id" UUID NOT NULL,
    "problem_id" UUID NOT NULL,
    "description" TEXT,
    "input_code" JSONB NOT NULL,
    "expected_output" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hidden_test_cases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "interview_sessions_room_id_key" ON "interview_sessions"("room_id");

-- CreateIndex
CREATE INDEX "interview_sessions_host_id_idx" ON "interview_sessions"("host_id");

-- CreateIndex
CREATE INDEX "interview_sessions_candidate_id_idx" ON "interview_sessions"("candidate_id");

-- CreateIndex
CREATE INDEX "interview_sessions_status_idx" ON "interview_sessions"("status");

-- CreateIndex
CREATE INDEX "hidden_test_cases_problem_id_idx" ON "hidden_test_cases"("problem_id");

-- AddForeignKey
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hidden_test_cases" ADD CONSTRAINT "hidden_test_cases_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;
