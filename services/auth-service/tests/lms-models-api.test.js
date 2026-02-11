import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';

const { createAuthApp } = await import('../dist/index.js');

function buildEnv(overrides = {}) {
  return {
    PORT: '4000',
    APP_BASE_URL: 'http://localhost:4000',
    CLIENT_REDIRECT_URL: 'http://localhost:5173',
    JWT_ACCESS_SECRET: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    JWT_REFRESH_SECRET: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    JWT_ISSUER: 'navcloud-auth',
    JWT_AUDIENCE: 'navcloud',
    ACCESS_TOKEN_TTL_SECONDS: 900,
    REFRESH_TOKEN_TTL_SECONDS: 3600,
    GOOGLE_CLIENT_ID: 'test-client',
    GOOGLE_CLIENT_SECRET: 'test-secret',
    GOOGLE_REDIRECT_URI: 'http://localhost:4000/auth/google/callback',
    GOOGLE_ADMIN_EMAILS: 'admin@navcloud.io',
    GOOGLE_INSTRUCTOR_EMAILS: 'instructor@navcloud.io',
    DELIVERY_BASE_URL: 'https://files.navcloud.example/content',
    DELIVERY_SIGNING_SECRET: 'cccccccccccccccccccccccccccccccc',
    DELIVERY_URL_TTL_SECONDS: 120,
    ...overrides
  };
}

async function call(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

async function oauthLogin(baseUrl, code) {
  const start = await call(baseUrl, '/auth/google/start');
  const callback = await call(baseUrl, `/auth/google/callback?code=${code}&state=${start.body.state}`);
  assert.equal(callback.status, 200);
  return callback.body;
}

test('lms core models enforce relationships, access control, and progress integrity', async () => {
  const baseTime = new Date('2026-01-01T00:00:00.000Z');
  let offsetMs = 0;
  let seq = 1;
  const app = createAuthApp(buildEnv(), {
    now: () => new Date(baseTime.getTime() + offsetMs),
    randomId: () => `id-${seq++}`,
    google: {
      getAuthorizationUrl: (state) => `https://accounts.google.com/mock?state=${state}`,
      exchangeCodeForProfile: async (code) => {
        if (code === 'instructor-code') return { email: 'instructor@navcloud.io', name: 'Instructor' };
        if (code === 'student-a-code') return { email: 'studenta@navcloud.io', name: 'Student A' };
        if (code === 'student-b-code') return { email: 'studentb@navcloud.io', name: 'Student B' };
        if (code === 'instructor-other-code') return { email: 'otherinstructor@navcloud.io', name: 'Other Instructor' };
        throw new Error('bad_code');
      }
    }
  });

  const server = app.listen(0);
  const addr = server.address();
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    const instructor = await oauthLogin(baseUrl, 'instructor-code');
    const studentA = await oauthLogin(baseUrl, 'student-a-code');
    const studentB = await oauthLogin(baseUrl, 'student-b-code');

    const createCourse = await call(baseUrl, '/lms/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${instructor.accessToken}` },
      body: JSON.stringify({ id: 'course-1', title: 'Cloud Foundations' })
    });
    assert.equal(createCourse.status, 201);

    const createModule = await call(baseUrl, '/lms/modules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${instructor.accessToken}` },
      body: JSON.stringify({ id: 'module-1', courseId: 'course-1', title: 'Basics', position: 1 })
    });
    assert.equal(createModule.status, 201);

    const createLesson = await call(baseUrl, '/lms/lessons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${instructor.accessToken}` },
      body: JSON.stringify({ id: 'lesson-1', moduleId: 'module-1', title: 'Intro', position: 1 })
    });
    assert.equal(createLesson.status, 201);

    const studentCannotCreateCourse = await call(baseUrl, '/lms/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentA.accessToken}` },
      body: JSON.stringify({ id: 'course-denied', title: 'Denied' })
    });
    assert.equal(studentCannotCreateCourse.status, 403);

    const enrollment = await call(baseUrl, '/lms/enrollments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentA.accessToken}` },
      body: JSON.stringify({ id: 'enroll-1', courseId: 'course-1', userId: studentA.user.id })
    });
    assert.equal(enrollment.status, 201);

    const unauthorizedEnrollment = await call(baseUrl, '/lms/enrollments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentA.accessToken}` },
      body: JSON.stringify({ id: 'enroll-2', courseId: 'course-1', userId: studentB.user.id })
    });
    assert.equal(unauthorizedEnrollment.status, 403);

    const progressUpdate = await call(baseUrl, '/lms/progress', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentA.accessToken}` },
      body: JSON.stringify({ enrollmentId: 'enroll-1', lessonId: 'lesson-1', status: 'completed' })
    });
    assert.equal(progressUpdate.status, 200);
    assert.equal(progressUpdate.body.status, 'completed');

    const completion = await call(baseUrl, '/lms/enrollments/enroll-1/completion', {
      headers: { Authorization: `Bearer ${studentA.accessToken}` }
    });
    assert.equal(completion.status, 200);
    assert.equal(completion.body.completion, 100);


    const dashboardForOwner = await call(baseUrl, '/lms/instructor/dashboard/course-1', {
      headers: { Authorization: `Bearer ${instructor.accessToken}` }
    });
    assert.equal(dashboardForOwner.status, 200);
    assert.equal(dashboardForOwner.body.course.modules, 1);
    assert.equal(dashboardForOwner.body.course.lessons, 1);
    assert.equal(dashboardForOwner.body.course.enrollments, 1);
    assert.equal(dashboardForOwner.body.storageUsage.totalBytes, 0);
    assert.equal(dashboardForOwner.body.studentProgress[0].completionPercent, 100);


    const attachContent = await call(baseUrl, '/lms/lessons/lesson-1/content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${instructor.accessToken}` },
      body: JSON.stringify({
        provider: 'gdrive',
        key: 'courses/course-1/module-1/lesson-1.pdf',
        fileId: 'gdrive-file-1',
        contentType: 'application/pdf',
        size: 2048
      })
    });
    assert.equal(attachContent.status, 201);

    const dashboardAfterContent = await call(baseUrl, '/lms/instructor/dashboard/course-1', {
      headers: { Authorization: `Bearer ${instructor.accessToken}` }
    });
    assert.equal(dashboardAfterContent.status, 200);
    assert.equal(dashboardAfterContent.body.storageUsage.totalBytes, 2048);

    const contentUrl = await call(baseUrl, '/lms/lessons/lesson-1/content-url', {
      headers: { Authorization: `Bearer ${studentA.accessToken}` }
    });
    assert.equal(contentUrl.status, 200);
    assert.ok(contentUrl.body.url.startsWith('https://files.navcloud.example/content/gdrive/'));
    assert.equal(contentUrl.body.expiresInSeconds, 120);

    const urlObject = new URL(contentUrl.body.url);
    const verifyValid = await call(baseUrl, '/lms/content-url/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentA.accessToken}` },
      body: JSON.stringify({
        provider: 'gdrive',
        key: decodeURIComponent(urlObject.pathname.split('/').slice(3).join('/')),
        lessonId: urlObject.searchParams.get('lessonId'),
        userId: urlObject.searchParams.get('uid'),
        exp: urlObject.searchParams.get('exp'),
        sig: urlObject.searchParams.get('sig')
      })
    });
    assert.equal(verifyValid.status, 200);
    assert.equal(verifyValid.body.valid, true);

    const forbiddenContentUrl = await call(baseUrl, '/lms/lessons/lesson-1/content-url', {
      headers: { Authorization: `Bearer ${studentB.accessToken}` }
    });
    assert.equal(forbiddenContentUrl.status, 403);

    const tamperedVerify = await call(baseUrl, '/lms/content-url/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentA.accessToken}` },
      body: JSON.stringify({
        provider: 'gdrive',
        key: 'courses/course-1/module-1/tampered.pdf',
        lessonId: urlObject.searchParams.get('lessonId'),
        userId: urlObject.searchParams.get('uid'),
        exp: urlObject.searchParams.get('exp'),
        sig: urlObject.searchParams.get('sig')
      })
    });
    assert.equal(tamperedVerify.status, 200);
    assert.equal(tamperedVerify.body.valid, false);

    offsetMs = 121000;
    const expiredVerify = await call(baseUrl, '/lms/content-url/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentA.accessToken}` },
      body: JSON.stringify({
        provider: 'gdrive',
        key: decodeURIComponent(urlObject.pathname.split('/').slice(3).join('/')),
        lessonId: urlObject.searchParams.get('lessonId'),
        userId: urlObject.searchParams.get('uid'),
        exp: urlObject.searchParams.get('exp'),
        sig: urlObject.searchParams.get('sig')
      })
    });
    assert.equal(expiredVerify.status, 200);
    assert.equal(expiredVerify.body.valid, false);

    const unauthorizedProgressWrite = await call(baseUrl, '/lms/progress', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentB.accessToken}` },
      body: JSON.stringify({ enrollmentId: 'enroll-1', lessonId: 'lesson-1', status: 'in_progress' })
    });
    assert.equal(unauthorizedProgressWrite.status, 403);

    const createForeignCourse = await call(baseUrl, '/lms/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${instructor.accessToken}` },
      body: JSON.stringify({ id: 'course-2', title: 'Other Course' })
    });
    assert.equal(createForeignCourse.status, 201);

    const createForeignModule = await call(baseUrl, '/lms/modules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${instructor.accessToken}` },
      body: JSON.stringify({ id: 'module-2', courseId: 'course-2', title: 'Other Module', position: 1 })
    });
    assert.equal(createForeignModule.status, 201);

    const createForeignLesson = await call(baseUrl, '/lms/lessons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${instructor.accessToken}` },
      body: JSON.stringify({ id: 'lesson-2', moduleId: 'module-2', title: 'Other Lesson', position: 1 })
    });
    assert.equal(createForeignLesson.status, 201);


    const otherInstructor = await oauthLogin(baseUrl, 'instructor-other-code');
    const forbiddenDashboard = await call(baseUrl, '/lms/instructor/dashboard/course-1', {
      headers: { Authorization: `Bearer ${otherInstructor.accessToken}` }
    });
    assert.equal(forbiddenDashboard.status, 403);

    const forbiddenModuleWrite = await call(baseUrl, '/lms/modules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${otherInstructor.accessToken}` },
      body: JSON.stringify({ id: 'module-forbidden', courseId: 'course-1', title: 'Should Fail', position: 99 })
    });
    assert.equal(forbiddenModuleWrite.status, 403);

    const forbiddenContentAttach = await call(baseUrl, '/lms/lessons/lesson-1/content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${otherInstructor.accessToken}` },
      body: JSON.stringify({
        provider: 'gdrive',
        key: 'courses/course-1/module-1/abuse.pdf',
        fileId: 'abuse-file',
        contentType: 'application/pdf',
        size: 512
      })
    });
    assert.equal(forbiddenContentAttach.status, 403);

    const forbiddenContentUrlForInstructor = await call(baseUrl, '/lms/lessons/lesson-1/content-url', {
      headers: { Authorization: `Bearer ${otherInstructor.accessToken}` }
    });
    assert.equal(forbiddenContentUrlForInstructor.status, 403);

    const studentCannotReadOtherCompletion = await call(baseUrl, '/lms/enrollments/enroll-1/completion', {
      headers: { Authorization: `Bearer ${studentB.accessToken}` }
    });
    assert.equal(studentCannotReadOtherCompletion.status, 403);

    const invalidCrossCourseProgress = await call(baseUrl, '/lms/progress', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentA.accessToken}` },
      body: JSON.stringify({ enrollmentId: 'enroll-1', lessonId: 'lesson-2', status: 'completed' })
    });
    assert.equal(invalidCrossCourseProgress.status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});


test('instructor dashboard aggregates large datasets efficiently', async () => {
  let seq = 1;
  const app = createAuthApp(buildEnv(), {
    now: () => new Date('2026-01-01T00:00:00.000Z'),
    randomId: () => `id-${seq++}`,
    google: {
      getAuthorizationUrl: (state) => `https://accounts.google.com/mock?state=${state}`,
      exchangeCodeForProfile: async (code) => {
        if (code === 'instructor-code') return { email: 'instructor@navcloud.io', name: 'Instructor' };
        if (code.startsWith('student-')) return { email: `${code}@navcloud.io`, name: code };
        throw new Error('bad_code');
      }
    }
  });

  const server = app.listen(0);
  const addr = server.address();
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    const instructor = await oauthLogin(baseUrl, 'instructor-code');

    const c = await call(baseUrl, '/lms/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${instructor.accessToken}` },
      body: JSON.stringify({ id: 'course-big', title: 'Scale Course' })
    });
    assert.equal(c.status, 201);

    for (let m = 1; m <= 10; m += 1) {
      const mod = await call(baseUrl, '/lms/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${instructor.accessToken}` },
        body: JSON.stringify({ id: `m-${m}`, courseId: 'course-big', title: `M${m}`, position: m })
      });
      assert.equal(mod.status, 201);

      for (let l = 1; l <= 20; l += 1) {
        const lessonId = `l-${m}-${l}`;
        const lesson = await call(baseUrl, '/lms/lessons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${instructor.accessToken}` },
          body: JSON.stringify({ id: lessonId, moduleId: `m-${m}`, title: lessonId, position: l })
        });
        assert.equal(lesson.status, 201);

        if (l % 10 === 0) {
          const content = await call(baseUrl, `/lms/lessons/${lessonId}/content`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${instructor.accessToken}` },
            body: JSON.stringify({
              provider: 'gdrive',
              key: `courses/course-big/${lessonId}.pdf`,
              fileId: `file-${lessonId}`,
              contentType: 'application/pdf',
              size: 1024
            })
          });
          assert.equal(content.status, 201);
        }
      }
    }

    for (let i = 1; i <= 150; i += 1) {
      const student = await oauthLogin(baseUrl, `student-${i}`);
      const enroll = await call(baseUrl, '/lms/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${student.accessToken}` },
        body: JSON.stringify({ id: `e-${i}`, courseId: 'course-big', userId: student.user.id })
      });
      assert.equal(enroll.status, 201);

      for (let k = 1; k <= 10; k += 1) {
        const progress = await call(baseUrl, '/lms/progress', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${student.accessToken}` },
          body: JSON.stringify({ enrollmentId: `e-${i}`, lessonId: `l-1-${k}`, status: 'completed' })
        });
        assert.equal(progress.status, 200);
      }
    }

    const startedAt = Date.now();
    const dashboard = await call(baseUrl, '/lms/instructor/dashboard/course-big', {
      headers: { Authorization: `Bearer ${instructor.accessToken}` }
    });
    const elapsedMs = Date.now() - startedAt;

    assert.equal(dashboard.status, 200);
    assert.equal(dashboard.body.course.modules, 10);
    assert.equal(dashboard.body.course.lessons, 200);
    assert.equal(dashboard.body.course.enrollments, 150);
    assert.equal(dashboard.body.storageUsage.files, 20);
    assert.ok(elapsedMs < 2000);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('subscription tiers apply soft limits and prevent free-plan abuse loopholes', async () => {
  let seq = 1;
  const app = createAuthApp(buildEnv({ GOOGLE_INSTRUCTOR_EMAILS: 'instructor@navcloud.io,freeinstructor@navcloud.io' }), {
    now: () => new Date('2026-01-01T00:00:00.000Z'),
    randomId: () => `id-${seq++}`,
    google: {
      getAuthorizationUrl: (state) => `https://accounts.google.com/mock?state=${state}`,
      exchangeCodeForProfile: async (code) => {
        if (code === 'admin-code') return { email: 'admin@navcloud.io', name: 'Admin' };
        if (code === 'instructor-free-code') return { email: 'freeinstructor@navcloud.io', name: 'Free Instructor' };
        if (code === 'student-free-code') return { email: 'freestudent@navcloud.io', name: 'Free Student' };
        throw new Error('bad_code');
      }
    }
  });

  const server = app.listen(0);
  const addr = server.address();
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    const admin = await oauthLogin(baseUrl, 'admin-code');
    const freeInstructor = await oauthLogin(baseUrl, 'instructor-free-code');
    const freeStudent = await oauthLogin(baseUrl, 'student-free-code');

    const initialPlan = await call(baseUrl, '/subscription/me', {
      headers: { Authorization: `Bearer ${freeInstructor.accessToken}` }
    });
    assert.equal(initialPlan.status, 200);
    assert.equal(initialPlan.body.plan, 'free');
    assert.equal(initialPlan.body.softLimit.createdCoursesExceededBy, 0);

    const studentCannotEscalateOwnPlan = await call(baseUrl, '/subscription/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${freeStudent.accessToken}` },
      body: JSON.stringify({ userId: freeStudent.user.id, plan: 'enterprise' })
    });
    assert.equal(studentCannotEscalateOwnPlan.status, 403);

    for (let i = 1; i <= 3; i += 1) {
      const createCourse = await call(baseUrl, '/lms/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${freeInstructor.accessToken}` },
        body: JSON.stringify({ id: `free-course-${i}`, title: `Free Course ${i}` })
      });
      assert.equal(createCourse.status, 201);
      if (i <= 2) {
        assert.equal(createCourse.body.subscription.softLimitExceeded, false);
      }
      if (i === 3) {
        assert.equal(createCourse.body.subscription.softLimitExceeded, true);
        assert.equal(createCourse.body.subscription.softLimit.createdCoursesExceededBy, 1);
      }
    }

    const enrollTarget = await call(baseUrl, '/lms/enrollments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${freeStudent.accessToken}` },
      body: JSON.stringify({ id: 'free-enrollment', courseId: 'free-course-1', userId: freeStudent.user.id })
    });
    assert.equal(enrollTarget.status, 201);

    const adminUpgrade = await call(baseUrl, '/subscription/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.accessToken}` },
      body: JSON.stringify({ userId: freeInstructor.user.id, plan: 'pro' })
    });
    assert.equal(adminUpgrade.status, 200);
    assert.equal(adminUpgrade.body.plan, 'pro');

    const afterUpgrade = await call(baseUrl, '/subscription/me', {
      headers: { Authorization: `Bearer ${freeInstructor.accessToken}` }
    });
    assert.equal(afterUpgrade.status, 200);
    assert.equal(afterUpgrade.body.plan, 'pro');
    assert.equal(afterUpgrade.body.softLimit.createdCoursesExceededBy, 0);

    const adminDowngrade = await call(baseUrl, '/subscription/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.accessToken}` },
      body: JSON.stringify({ userId: freeInstructor.user.id, plan: 'free' })
    });
    assert.equal(adminDowngrade.status, 200);

    const afterDowngrade = await call(baseUrl, '/subscription/me', {
      headers: { Authorization: `Bearer ${freeInstructor.accessToken}` }
    });
    assert.equal(afterDowngrade.status, 200);
    assert.equal(afterDowngrade.body.plan, 'free');
    assert.equal(afterDowngrade.body.softLimit.createdCoursesExceededBy, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
