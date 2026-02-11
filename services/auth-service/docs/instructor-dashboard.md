# Instructor Dashboard Backend Logic

## Aggregates exposed
`GET /lms/instructor/dashboard/:courseId` returns:
- **Course summary**: modules, lessons, enrollments, average completion.
- **Student progress**: per enrollment completed lessons and completion percent.
- **Storage usage**: file count and bytes by provider (`gdrive`/`s3`/`r2`).

## Security constraints
- Roles allowed: `Admin`, `Instructor`.
- `Instructor` is restricted to courses where `course.createdBy === instructorUserId`.
- Students cannot access dashboard endpoint.

## Performance notes
The LMS store maintains secondary indexes:
- `moduleIdsByCourse`
- `lessonIdsByModule`
- `enrollmentIdsByCourse`
- `progressIdsByEnrollment`
- `enrollmentByCourseUser`

Dashboard aggregation uses these indexes to avoid full-map scans on large datasets.
