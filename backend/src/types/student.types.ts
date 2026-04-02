// src/types/student.types.ts
// DTO shapes for student dashboard endpoints — Phase 2.
// Rule: services return these DTOs, never raw Prisma shapes.
// Controllers are pure pass-through.

export interface StudentProfileDTO {
  id: string;
  name: string;
  email: string;
  registerNumber: string;
  degree: string;
  batch: string;
  university: {
    id: string;
    name: string;
  };
}

export interface ProgressSummaryDTO {
  totalProblems: number;
  notStarted: number;
  inProgress: number;
  attempted: number;
  solved: number;
}

export interface RecentActivityDTO {
  problemId: string;
  problemTitle: string;
  difficulty: string;
  topic: string;
  status: string;
  attempts: number;
  lastAttemptedAt: Date | null;
}

export interface StudentDashboardDTO {
  student: StudentProfileDTO;
  progress: ProgressSummaryDTO;
  recentActivity: RecentActivityDTO[];
}

export interface StudentProgressDTO {
  summary: ProgressSummaryDTO;
}
