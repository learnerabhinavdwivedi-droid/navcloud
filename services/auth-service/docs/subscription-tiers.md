# Subscription tiers and soft limits

NavCloud applies account-level subscription plans with soft limit enforcement.

## Plans

- `free`
  - `maxCreatedCourses`: 2
  - `maxActiveEnrollments`: 5
  - `maxOwnedStorageBytes`: 50 MiB
- `pro`
  - `maxCreatedCourses`: 20
  - `maxActiveEnrollments`: 100
  - `maxOwnedStorageBytes`: 5 GiB
- `enterprise`
  - effectively unbounded limits

## Enforcement model

Limits are **soft**: requests are processed, but responses include `subscription.softLimitExceeded` and overage counters.
This allows product-level nudges and upgrade flows without hard-breaking active learning sessions.

## Abuse protections

- Plan changes are admin-only via `POST /subscription/plan`.
- Users cannot self-upgrade by request payload manipulation.
- Usage is server-derived from persisted LMS records; clients cannot forge usage counters.
- Free users receive explicit overage signals to prevent silent exploitation of unlimited usage.
