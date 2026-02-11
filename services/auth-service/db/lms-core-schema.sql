-- LMS core models: Course, Module, Lesson, Enrollment, Progress

CREATE TABLE courses (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE modules (
  id UUID PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position > 0),
  UNIQUE (course_id, position)
);

CREATE TABLE lessons (
  id UUID PRIMARY KEY,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position > 0),
  UNIQUE (module_id, position)
);

CREATE TABLE enrollments (
  id UUID PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role = 'Student'),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, user_id)
);

CREATE TABLE progress (
  id UUID PRIMARY KEY,
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('not_started', 'in_progress', 'completed')),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (enrollment_id, lesson_id),
  CHECK (
    (status = 'completed' AND completed_at IS NOT NULL)
    OR (status IN ('not_started', 'in_progress') AND completed_at IS NULL)
  )
);

CREATE INDEX idx_modules_course_id ON modules(course_id);
CREATE INDEX idx_lessons_module_id ON lessons(module_id);
CREATE INDEX idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX idx_enrollments_user_id ON enrollments(user_id);
CREATE INDEX idx_progress_enrollment_id ON progress(enrollment_id);
CREATE INDEX idx_progress_lesson_id ON progress(lesson_id);
CREATE INDEX idx_progress_status ON progress(status);


CREATE TABLE lesson_contents (
  lesson_id UUID PRIMARY KEY REFERENCES lessons(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('gdrive', 's3', 'r2')),
  object_key TEXT NOT NULL,
  provider_file_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lesson_contents_provider ON lesson_contents(provider);
