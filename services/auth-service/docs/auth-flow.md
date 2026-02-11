# NavCloud Auth Flow (Google OAuth + RBAC)

## Auth design
1. Client calls `GET /auth/google/start`.
2. Service returns Google auth URL with minimal scopes: `openid email`.
3. Client redirects user to Google consent.
4. Google redirects back to `GET /auth/google/callback?code=...&state=...`.
5. Service validates state (10-minute TTL), exchanges code, fetches user info, and maps role:
   - `Admin` when email in `GOOGLE_ADMIN_EMAILS`
   - `Instructor` when email in `GOOGLE_INSTRUCTOR_EMAILS`
   - `Student` otherwise
6. Service returns:
   - short-lived access token (default 15 minutes)
   - refresh token (default 7 days) stored as SHA-256 hash in session store
7. Protected APIs validate JWT signature, issuer, audience, expiry, token type, and token version.
8. RBAC middleware enforces role checks per endpoint.

## APIs
- `GET /auth/google/start`
- `GET /auth/google/callback?code=...&state=...`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /rbac/admin`
- `GET /rbac/instructor`
- `GET /rbac/student`

## Token expiration handling
- Expired access token returns `401 {"error":"token_expired"}`.
- Client should call `POST /auth/refresh` with refresh token.
- Refresh rotates token/session and revokes prior refresh token.
- Reuse of old refresh token returns `401`.

## Failure cases handled
- missing or invalid OAuth callback params
- invalid/expired OAuth state (CSRF protection)
- Google token exchange or userinfo failures
- stale JWTs via `tokenVersion`
- role escalation blocked by RBAC checks
- refresh session mismatch/replay/logout reuse
