export type Course = {
  id: string;
  title: string;
  createdBy: string;
  createdAt: string;
};

export type Module = {
  id: string;
  courseId: string;
  title: string;
  position: number;
};

export type Lesson = {
  id: string;
  moduleId: string;
  title: string;
  position: number;
};

export type Enrollment = {
  id: string;
  courseId: string;
  userId: string;
  role: "Student";
  enrolledAt: string;
};

export type LessonContentMetadata = {
  lessonId: string;
  provider: "gdrive" | "s3" | "r2";
  key: string;
  fileId: string;
  contentType: string;
  size: number;
  updatedAt: string;
};

export type Progress = {
  id: string;
  enrollmentId: string;
  lessonId: string;
  status: "not_started" | "in_progress" | "completed";
  completedAt?: string;
};

export type InstructorDashboard = {
  course: {
    id: string;
    title: string;
    modules: number;
    lessons: number;
    enrollments: number;
    avgCompletionPercent: number;
  };
  studentProgress: Array<{
    enrollmentId: string;
    userId: string;
    completedLessons: number;
    totalLessons: number;
    completionPercent: number;
  }>;
  storageUsage: {
    files: number;
    totalBytes: number;
    byProvider: Record<"gdrive" | "s3" | "r2", { files: number; bytes: number }>;
  };
};

export type UserUsageSnapshot = {
  createdCourses: number;
  activeEnrollments: number;
  ownedStorageBytes: number;
};

export class LmsModelError extends Error {
  constructor(readonly code: "NOT_FOUND" | "INVALID_RELATION" | "DUPLICATE" | "ACCESS_DENIED", message: string) {
    super(message);
  }
}

function pushIndex(index: Map<string, string[]>, key: string, value: string) {
  const current = index.get(key) ?? [];
  current.push(value);
  index.set(key, current);
}

export class LmsCoreStore {
  private courses = new Map<string, Course>();
  private modules = new Map<string, Module>();
  private lessons = new Map<string, Lesson>();
  private enrollments = new Map<string, Enrollment>();
  private progress = new Map<string, Progress>();
  private lessonContent = new Map<string, LessonContentMetadata>();

  private moduleIdsByCourse = new Map<string, string[]>();
  private lessonIdsByModule = new Map<string, string[]>();
  private enrollmentIdsByCourse = new Map<string, string[]>();
  private progressIdsByEnrollment = new Map<string, string[]>();
  private enrollmentByCourseUser = new Map<string, string>();

  constructor(private readonly now: () => string = () => new Date().toISOString()) {}

  createCourse(input: { id: string; title: string; createdBy: string }): Course {
    if (this.courses.has(input.id)) {
      throw new LmsModelError("DUPLICATE", `course already exists: ${input.id}`);
    }
    const course: Course = { ...input, createdAt: this.now() };
    this.courses.set(course.id, course);
    this.moduleIdsByCourse.set(course.id, []);
    this.enrollmentIdsByCourse.set(course.id, []);
    return course;
  }

  getCourse(courseId: string): Course {
    const course = this.courses.get(courseId);
    if (!course) throw new LmsModelError("NOT_FOUND", `course does not exist: ${courseId}`);
    return course;
  }

  createModule(input: { id: string; courseId: string; title: string; position: number }): Module {
    const course = this.courses.get(input.courseId);
    if (!course) {
      throw new LmsModelError("INVALID_RELATION", `course does not exist: ${input.courseId}`);
    }
    if (this.modules.has(input.id)) {
      throw new LmsModelError("DUPLICATE", `module already exists: ${input.id}`);
    }

    const moduleIds = this.moduleIdsByCourse.get(course.id) ?? [];
    for (const moduleId of moduleIds) {
      const row = this.modules.get(moduleId)!;
      if (row.position === input.position) {
        throw new LmsModelError("DUPLICATE", `module position already used in course: ${input.courseId}`);
      }
    }

    const moduleRow: Module = { ...input };
    this.modules.set(moduleRow.id, moduleRow);
    pushIndex(this.moduleIdsByCourse, input.courseId, moduleRow.id);
    this.lessonIdsByModule.set(moduleRow.id, []);
    return moduleRow;
  }

  createLesson(input: { id: string; moduleId: string; title: string; position: number }): Lesson {
    const moduleRow = this.modules.get(input.moduleId);
    if (!moduleRow) {
      throw new LmsModelError("INVALID_RELATION", `module does not exist: ${input.moduleId}`);
    }
    if (this.lessons.has(input.id)) {
      throw new LmsModelError("DUPLICATE", `lesson already exists: ${input.id}`);
    }

    const lessonIds = this.lessonIdsByModule.get(input.moduleId) ?? [];
    for (const lessonId of lessonIds) {
      const row = this.lessons.get(lessonId)!;
      if (row.position === input.position) {
        throw new LmsModelError("DUPLICATE", `lesson position already used in module: ${input.moduleId}`);
      }
    }

    const lesson: Lesson = { ...input };
    this.lessons.set(lesson.id, lesson);
    pushIndex(this.lessonIdsByModule, input.moduleId, lesson.id);

    const enrollmentIds = this.enrollmentIdsByCourse.get(moduleRow.courseId) ?? [];
    for (const enrollmentId of enrollmentIds) {
      const progressId = `${enrollmentId}:${lesson.id}`;
      this.progress.set(progressId, {
        id: progressId,
        enrollmentId,
        lessonId: lesson.id,
        status: "not_started"
      });
      pushIndex(this.progressIdsByEnrollment, enrollmentId, progressId);
    }

    return lesson;
  }

  enrollStudent(input: { id: string; courseId: string; userId: string }): Enrollment {
    if (!this.courses.has(input.courseId)) {
      throw new LmsModelError("INVALID_RELATION", `course does not exist: ${input.courseId}`);
    }
    if (this.enrollments.has(input.id)) {
      throw new LmsModelError("DUPLICATE", `enrollment already exists: ${input.id}`);
    }

    const uniqueKey = `${input.courseId}:${input.userId}`;
    if (this.enrollmentByCourseUser.has(uniqueKey)) {
      throw new LmsModelError("DUPLICATE", `student already enrolled in course: ${input.courseId}`);
    }

    const enrollment: Enrollment = {
      ...input,
      role: "Student",
      enrolledAt: this.now()
    };

    this.enrollments.set(enrollment.id, enrollment);
    this.enrollmentByCourseUser.set(uniqueKey, enrollment.id);
    pushIndex(this.enrollmentIdsByCourse, input.courseId, enrollment.id);
    this.progressIdsByEnrollment.set(enrollment.id, []);

    const lessonsInCourse = this.getLessonsForCourse(input.courseId);
    for (const lesson of lessonsInCourse) {
      const progressId = `${enrollment.id}:${lesson.id}`;
      this.progress.set(progressId, {
        id: progressId,
        enrollmentId: enrollment.id,
        lessonId: lesson.id,
        status: "not_started"
      });
      pushIndex(this.progressIdsByEnrollment, enrollment.id, progressId);
    }

    return enrollment;
  }

  attachLessonContent(input: {
    lessonId: string;
    provider: "gdrive" | "s3" | "r2";
    key: string;
    fileId: string;
    contentType: string;
    size: number;
  }): LessonContentMetadata {
    if (!this.lessons.has(input.lessonId)) {
      throw new LmsModelError("NOT_FOUND", `lesson does not exist: ${input.lessonId}`);
    }

    const metadata: LessonContentMetadata = {
      ...input,
      updatedAt: this.now()
    };

    this.lessonContent.set(input.lessonId, metadata);
    return metadata;
  }

  getLessonContent(lessonId: string): LessonContentMetadata {
    const metadata = this.lessonContent.get(lessonId);
    if (!metadata) {
      throw new LmsModelError("NOT_FOUND", `lesson content does not exist: ${lessonId}`);
    }
    return metadata;
  }

  getEnrollment(enrollmentId: string): Enrollment {
    const enrollment = this.enrollments.get(enrollmentId);
    if (!enrollment) {
      throw new LmsModelError("NOT_FOUND", `enrollment does not exist: ${enrollmentId}`);
    }
    return enrollment;
  }

  getCourseIdForModule(moduleId: string): string {
    const moduleRow = this.modules.get(moduleId);
    if (!moduleRow) {
      throw new LmsModelError("NOT_FOUND", `module does not exist: ${moduleId}`);
    }
    return moduleRow.courseId;
  }

  getCourseIdForLesson(lessonId: string): string {
    const lesson = this.lessons.get(lessonId);
    if (!lesson) {
      throw new LmsModelError("NOT_FOUND", `lesson does not exist: ${lessonId}`);
    }

    const moduleRow = this.modules.get(lesson.moduleId);
    if (!moduleRow) {
      throw new LmsModelError("INVALID_RELATION", `module does not exist for lesson: ${lessonId}`);
    }

    return moduleRow.courseId;
  }

  canUserAccessLessonContent(input: { lessonId: string; userId: string; role: "Admin" | "Instructor" | "Student" }): boolean {
    const lesson = this.lessons.get(input.lessonId);
    if (!lesson) return false;

    const moduleRow = this.modules.get(lesson.moduleId);
    if (!moduleRow) return false;

    if (input.role === "Admin") return true;
    if (input.role === "Instructor") {
      const course = this.courses.get(moduleRow.courseId);
      return !!course && course.createdBy === input.userId;
    }

    return this.enrollmentByCourseUser.has(`${moduleRow.courseId}:${input.userId}`);
  }

  markLessonProgress(input: { enrollmentId: string; lessonId: string; actorUserId: string; status: Progress["status"] }): Progress {
    const enrollment = this.enrollments.get(input.enrollmentId);
    if (!enrollment) {
      throw new LmsModelError("NOT_FOUND", `enrollment does not exist: ${input.enrollmentId}`);
    }
    if (enrollment.userId !== input.actorUserId) {
      throw new LmsModelError("ACCESS_DENIED", "students can only update their own progress");
    }

    const lesson = this.lessons.get(input.lessonId);
    if (!lesson) {
      throw new LmsModelError("NOT_FOUND", `lesson does not exist: ${input.lessonId}`);
    }

    const moduleRow = this.modules.get(lesson.moduleId);
    if (!moduleRow || moduleRow.courseId !== enrollment.courseId) {
      throw new LmsModelError("INVALID_RELATION", "lesson is outside enrolled course");
    }

    const progressId = `${enrollment.id}:${lesson.id}`;
    const row = this.progress.get(progressId);
    if (!row) {
      throw new LmsModelError("INVALID_RELATION", "missing progress row for enrollment/lesson");
    }

    row.status = input.status;
    row.completedAt = input.status === "completed" ? this.now() : undefined;
    this.progress.set(progressId, row);
    return row;
  }

  getCourseCompletionPercent(enrollmentId: string): number {
    const enrollment = this.enrollments.get(enrollmentId);
    if (!enrollment) {
      throw new LmsModelError("NOT_FOUND", `enrollment does not exist: ${enrollmentId}`);
    }

    const progressIds = this.progressIdsByEnrollment.get(enrollmentId) ?? [];
    if (progressIds.length === 0) return 0;

    let completed = 0;
    for (const progressId of progressIds) {
      if (this.progress.get(progressId)?.status === "completed") completed += 1;
    }

    return Math.round((completed / progressIds.length) * 100);
  }

  getInstructorDashboard(input: { courseId: string; userId: string; role: "Admin" | "Instructor" }): InstructorDashboard {
    const course = this.getCourse(input.courseId);
    if (input.role === "Instructor" && course.createdBy !== input.userId) {
      throw new LmsModelError("ACCESS_DENIED", "instructor can only access own course dashboard");
    }

    const moduleIds = this.moduleIdsByCourse.get(input.courseId) ?? [];
    const lessonIds = moduleIds.flatMap((moduleId) => this.lessonIdsByModule.get(moduleId) ?? []);
    const enrollmentIds = this.enrollmentIdsByCourse.get(input.courseId) ?? [];

    const studentProgress = enrollmentIds.map((enrollmentId) => {
      const enrollment = this.enrollments.get(enrollmentId)!;
      const progressIds = this.progressIdsByEnrollment.get(enrollmentId) ?? [];

      let completedLessons = 0;
      for (const progressId of progressIds) {
        if (this.progress.get(progressId)?.status === "completed") completedLessons += 1;
      }

      const totalLessons = progressIds.length;
      const completionPercent = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);

      return {
        enrollmentId,
        userId: enrollment.userId,
        completedLessons,
        totalLessons,
        completionPercent
      };
    });

    const avgCompletionPercent =
      studentProgress.length === 0
        ? 0
        : Math.round(studentProgress.reduce((sum, row) => sum + row.completionPercent, 0) / studentProgress.length);

    const byProvider: Record<"gdrive" | "s3" | "r2", { files: number; bytes: number }> = {
      gdrive: { files: 0, bytes: 0 },
      s3: { files: 0, bytes: 0 },
      r2: { files: 0, bytes: 0 }
    };

    let files = 0;
    let totalBytes = 0;
    for (const lessonId of lessonIds) {
      const content = this.lessonContent.get(lessonId);
      if (!content) continue;
      files += 1;
      totalBytes += content.size;
      byProvider[content.provider].files += 1;
      byProvider[content.provider].bytes += content.size;
    }

    return {
      course: {
        id: course.id,
        title: course.title,
        modules: moduleIds.length,
        lessons: lessonIds.length,
        enrollments: enrollmentIds.length,
        avgCompletionPercent
      },
      studentProgress,
      storageUsage: {
        files,
        totalBytes,
        byProvider
      }
    };
  }

  getUserUsageSnapshot(userId: string): UserUsageSnapshot {
    let createdCourses = 0;
    let activeEnrollments = 0;
    let ownedStorageBytes = 0;

    const ownedCourseIds: string[] = [];
    for (const course of this.courses.values()) {
      if (course.createdBy === userId) {
        createdCourses += 1;
        ownedCourseIds.push(course.id);
      }
    }

    for (const enrollment of this.enrollments.values()) {
      if (enrollment.userId === userId) {
        activeEnrollments += 1;
      }
    }

    for (const courseId of ownedCourseIds) {
      const moduleIds = this.moduleIdsByCourse.get(courseId) ?? [];
      for (const moduleId of moduleIds) {
        const lessonIds = this.lessonIdsByModule.get(moduleId) ?? [];
        for (const lessonId of lessonIds) {
          const content = this.lessonContent.get(lessonId);
          if (content) {
            ownedStorageBytes += content.size;
          }
        }
      }
    }

    return {
      createdCourses,
      activeEnrollments,
      ownedStorageBytes
    };
  }

  private getLessonsForCourse(courseId: string): Lesson[] {
    const moduleIds = this.moduleIdsByCourse.get(courseId) ?? [];
    const lessonIds = moduleIds.flatMap((moduleId) => this.lessonIdsByModule.get(moduleId) ?? []);
    return lessonIds.map((lessonId) => this.lessons.get(lessonId)!).filter(Boolean);
  }
}
