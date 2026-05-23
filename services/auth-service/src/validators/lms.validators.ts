/**
 * NavCloud Premium — LMS Validators
 * Centralized Zod schemas for all LMS-related request/response validation.
 */

import { z } from "zod";

// ============================================================================
// Course Schemas
// ============================================================================

export const CreateCourseRequestSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
});
export type CreateCourseRequest = z.infer<typeof CreateCourseRequestSchema>;

export const CourseResponseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  createdBy: z.string().min(1),
  createdAt: z.string(),
});
export type CourseResponse = z.infer<typeof CourseResponseSchema>;

// ============================================================================
// Module Schemas
// ============================================================================

export const CreateModuleRequestSchema = z.object({
  id: z.string().min(1),
  courseId: z.string().min(1),
  title: z.string().min(1),
  position: z.number().int().positive(),
});
export type CreateModuleRequest = z.infer<typeof CreateModuleRequestSchema>;

// ============================================================================
// Lesson Schemas
// ============================================================================

export const CreateLessonRequestSchema = z.object({
  id: z.string().min(1),
  moduleId: z.string().min(1),
  title: z.string().min(1),
  position: z.number().int().positive(),
});
export type CreateLessonRequest = z.infer<typeof CreateLessonRequestSchema>;

export const AttachContentRequestSchema = z.object({
  provider: z.enum(["gdrive", "s3", "r2"]),
  key: z.string().min(1),
  fileId: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().int().nonnegative(),
});
export type AttachContentRequest = z.infer<typeof AttachContentRequestSchema>;

// ============================================================================
// Enrollment Schemas
// ============================================================================

export const CreateEnrollmentRequestSchema = z.object({
  id: z.string().min(1),
  courseId: z.string().min(1),
  userId: z.string().min(1),
});
export type CreateEnrollmentRequest = z.infer<typeof CreateEnrollmentRequestSchema>;

// ============================================================================
// Progress Schemas
// ============================================================================

export const LessonStatusSchema = z.enum(["not_started", "in_progress", "completed"]);
export type LessonStatus = z.infer<typeof LessonStatusSchema>;

export const UpdateProgressRequestSchema = z.object({
  enrollmentId: z.string().min(1),
  lessonId: z.string().min(1),
  status: LessonStatusSchema,
});
export type UpdateProgressRequest = z.infer<typeof UpdateProgressRequestSchema>;

// ============================================================================
// Content URL Verification
// ============================================================================

export const VerifyContentUrlRequestSchema = z.object({
  provider: z.enum(["gdrive", "s3", "r2"]),
  key: z.string().min(1),
  lessonId: z.string().min(1),
  userId: z.string().min(1),
  exp: z.string().min(1),
  sig: z.string().min(1),
});
export type VerifyContentUrlRequest = z.infer<typeof VerifyContentUrlRequestSchema>;

// ============================================================================
// Instructor Dashboard Response
// ============================================================================

export const StorageProviderStatsSchema = z.object({
  files: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
});

export const InstructorDashboardResponseSchema = z.object({
  course: z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    modules: z.number().int().nonnegative(),
    lessons: z.number().int().nonnegative(),
    enrollments: z.number().int().nonnegative(),
    avgCompletionPercent: z.number().nonnegative(),
  }),
  studentProgress: z.array(
    z.object({
      enrollmentId: z.string().min(1),
      userId: z.string().min(1),
      completedLessons: z.number().int().nonnegative(),
      totalLessons: z.number().int().nonnegative(),
      completionPercent: z.number().nonnegative(),
    })
  ),
  storageUsage: z.object({
    files: z.number().int().nonnegative(),
    totalBytes: z.number().int().nonnegative(),
    byProvider: z.object({
      gdrive: StorageProviderStatsSchema,
      s3: StorageProviderStatsSchema,
      r2: StorageProviderStatsSchema,
    }),
  }),
});
export type InstructorDashboardResponse = z.infer<typeof InstructorDashboardResponseSchema>;
