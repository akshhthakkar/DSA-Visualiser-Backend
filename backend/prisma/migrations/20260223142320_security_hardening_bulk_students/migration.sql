/*
  Warnings:

  - A unique constraint covering the columns `[register_number,university_id]` on the table `students` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "students_register_number_key";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "must_reset_password" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "students_register_number_university_id_key" ON "students"("register_number", "university_id");
