# LMS Core Data Models

## Entities and relationships
- **Course** (1) -> (N) **Module**
- **Module** (1) -> (N) **Lesson**
- **Course** (1) -> (N) **Enrollment**
- **Enrollment** (1) -> (N) **Progress**
- **Lesson** (1) -> (N) **Progress**

`Progress` is the per-student, per-lesson status row that links learning state to an enrollment context.

## Scalability validation
- Foreign keys and indexes optimize course/module/lesson traversal and per-student progress reads.
- `UNIQUE(course_id, position)` and `UNIQUE(module_id, position)` keep ordering deterministic without sequence scans.
- `UNIQUE(course_id, user_id)` prevents duplicate enrollments under write concurrency.
- `UNIQUE(enrollment_id, lesson_id)` prevents duplicate progress rows per student/lesson.

## Access control model
- Only `Admin`/`Instructor` can create Course/Module/Lesson.
- Students can enroll only themselves.
- Students can update progress only for their own enrollment.
- Cross-course progress writes are rejected.

## Inconsistency checks fixed
- Prevented module creation for non-existent course.
- Prevented lesson creation for non-existent module.
- Prevented progress writes for lessons outside enrolled course.
- Enforced completion semantics (`completed_at` set only when status is `completed`).
