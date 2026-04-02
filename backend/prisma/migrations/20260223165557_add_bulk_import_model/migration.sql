-- CreateTable
CREATE TABLE "bulk_imports" (
    "id" UUID NOT NULL,
    "university_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "successful" INTEGER NOT NULL,
    "failed" INTEGER NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'processing',
    "failed_rows" JSONB,
    "duration_ms" INTEGER,
    "request_id" VARCHAR(100),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bulk_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bulk_imports_university_id_idx" ON "bulk_imports"("university_id");

-- CreateIndex
CREATE INDEX "bulk_imports_created_by_idx" ON "bulk_imports"("created_by");

-- CreateIndex
CREATE INDEX "bulk_imports_created_at_idx" ON "bulk_imports"("created_at");

-- AddForeignKey
ALTER TABLE "bulk_imports" ADD CONSTRAINT "bulk_imports_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulk_imports" ADD CONSTRAINT "bulk_imports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
