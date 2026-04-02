-- DropIndex
-- Remove the old unique constraint on code alone
DROP INDEX IF EXISTS "classes_code_key";

-- CreateIndex
-- Add composite unique constraint for university_id + code
-- This allows same code across different universities
CREATE UNIQUE INDEX "classes_university_id_code_key" ON "classes"("university_id", "code");

-- CreateIndex
-- Add index on degree for filtering classes by degree
CREATE INDEX "classes_degree_idx" ON "classes"("degree");

-- CreateIndex
-- Add index on is_active for filtering active classes
CREATE INDEX "classes_is_active_idx" ON "classes"("is_active");

-- CreateIndex (Partial Unique Index)
-- Academic Policy: Class codes are permanent identifiers
-- This partial unique index enforces uniqueness only for non-deleted classes
-- Prevents code reuse even after soft delete to maintain audit trail
-- READ COMMITTED isolation level (Postgres default) is sufficient with this constraint
CREATE UNIQUE INDEX "unique_active_class_code" 
ON "classes" ("university_id", "code") 
WHERE "deleted_at" IS NULL;
