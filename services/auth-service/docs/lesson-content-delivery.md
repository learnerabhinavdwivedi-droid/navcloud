# Lesson Content Delivery (Cloud Files)

## Security model
- API returns **signed URLs only**; file bytes are never proxied through auth-service.
- URLs are short-lived (`DELIVERY_URL_TTL_SECONDS`, max 300s).
- Signature binds `provider + key + lessonId + userId + exp` to prevent tampering.

## Endpoints
- `PUT /lms/lessons/:lessonId/content` (Admin/Instructor)
  - stores lesson file metadata only (`provider`, `key`, `fileId`, `contentType`, `size`)
- `GET /lms/lessons/:lessonId/content-url` (authorized user)
  - validates permissions and returns signed cloud URL + expiry
- `POST /lms/content-url/verify`
  - validates signature/expiry for simulation and security checks

## Permission rules
- Admin/Instructor: allowed for lesson content access.
- Student: allowed only if enrolled in the lesson's course.
- Non-enrolled student: denied (`403`).

## Notes
- No file content is stored in LMS models.
- No file content proxying occurs in these endpoints.
