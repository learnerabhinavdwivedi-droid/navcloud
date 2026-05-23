# NavCloud — Premium AI-Powered Cloud Intelligence

> **Ultra-fast edge streaming • Semantic vector search • Usage-based SaaS billing**

NavCloud is a **premium, domain-driven serverless** cloud platform that combines AI-powered file intelligence with enterprise-grade storage. Built to handle large-scale concurrency and AI-heavy workloads.

## ✨ What Makes NavCloud Premium

| Feature | NavCloud | Traditional Cloud |
|---------|----------|-------------------|
| **Search** | Semantic (Vector Search) | Keyword-based |
| **Architecture** | Domain-Driven Serverless | Traditional Monolith |
| **File Intelligence** | AI tags, summaries, auto-sort | Manual organization |
| **Speed** | Ultra-Fast (Edge Functions) | Standard CDN |
| **Pricing** | Usage-Based (Modern SaaS) | Flat Tier |

## 🏗️ Architecture

### Domain-Driven Directory Structure

```
navcloud/
├── apps/
│   └── web/                              # React + Vite frontend
│       └── src/
│           ├── core/                     # Encryption, streaming utilities
│           ├── features/                 # Self-contained domain modules
│           │   ├── auth/                 # Authentication (Google OAuth)
│           │   ├── drive/                # File management + uploads
│           │   ├── billing/              # Usage dashboard + Stripe
│           │   └── search/               # Semantic vector search
│           ├── design-system/            # "Glass-Dark" UI kit
│           │   ├── tokens.css            # CSS custom properties
│           │   ├── glass-card.tsx         # Glassmorphism containers
│           │   ├── neural-loader.tsx      # AI loading animations
│           │   ├── nav-button.tsx         # Premium buttons
│           │   └── atoms/                # Input, Badge, Dialog
│           └── server/                   # Supabase client wrappers
├── services/
│   ├── auth-service/                     # Express + JWT + RBAC
│   │   └── src/
│   │       ├── validators/               # Centralized Zod schemas
│   │       ├── lms/                      # Course/module/lesson models
│   │       └── storage/                  # Multi-provider storage (GDrive, S3, R2)
│   └── ai-service/                       # Gemini-powered file intelligence
│       └── src/
│           ├── embeddings.ts             # Vector embedding generation
│           ├── tagger.ts                 # Semantic file tagging
│           ├── summarizer.ts             # AI file summaries
│           └── index.ts                  # Processing pipeline orchestrator
└── infrastructure/
    ├── k8s/                              # Kubernetes manifests
    └── supabase/
        └── migrations/
            ├── 001_vector_search.sql     # pgvector + HNSW indexing
            ├── 002_live_folders.sql       # Smart auto-sorting rules
            └── 003_billing_tables.sql    # Stripe metered billing
```

## 🧠 Agentic File Intelligence

NavCloud doesn't just store files — it **understands** them.

### Semantic Search
Instead of searching for `invoice.pdf`, search for:
> *"the paper I signed with the lawyer in March"*

Powered by **Gemini text-embedding-004** + **pgvector** with HNSW indexing for sub-100ms similarity search across millions of embeddings.

### Smart Auto-Sorters (Live Folders)
Create AI-powered folders that automatically organize files:
- **Tag Match**: "All files tagged with `tax` or `legal`"
- **Content Match**: "Files containing contract language"
- **Type Match**: "All PDFs and Word documents"
- **Composite**: Combine multiple rules with AND/OR logic

### Upload Pipeline
```
User uploads file
  → Extract text content
  → Gemini Flash: Generate summary + 5 semantic tags
  → Gemini Embedding: Generate 768-dim vector
  → Store in Supabase (file_embeddings table)
  → Evaluate all Live Folder rules
  → Update file card with AI insights
```

## 💎 Design System: "Glass-Dark"

A **2026 Apple-esque** design language built on:

- **Glassmorphism**: Semi-transparent `backdrop-blur` surfaces with gradient borders
- **Deep Ocean Palette**: HSL-tailored dark theme (`hsl(222, 25%, 7%)` base)
- **Electric Cyan Accent**: `hsl(185, 90%, 55%)` with glow effects
- **Premium Typography**: Outfit (display) + Inter (body) + JetBrains Mono (code)
- **Micro-animations**: CSS keyframe animations for fade-in, slide-up, float, and shimmer

## 💳 Usage-Based Billing

| Plan | Storage | AI Credits/mo | Price |
|------|---------|---------------|-------|
| **Free** | 50 GB | 50 | $0 |
| **Pro** | 500 GB | 500 | $12/mo |
| **Enterprise** | 5 TB | Unlimited | Custom |

Powered by **Stripe Metered Billing** with real-time usage tracking.

## 🛡️ Security

- **AES-256-GCM** client-side encryption via Web Crypto API
- **JWT access + refresh tokens** with token version rotation
- **HMAC-SHA256** signed content delivery URLs with TTL
- **Zod schema validation** on every API boundary (zero `any` types)
- **RBAC**: Admin → Instructor → Student role hierarchy

## 🚀 Quick Start

```bash
# Install web dependencies
cd apps/web && npm install

# Start the frontend
npm run dev

# Install auth service dependencies
cd ../../services/auth-service && npm install

# Start the backend
npm run dev

# Run Supabase migrations (requires Supabase CLI)
supabase migration up
```

## Engineering Workflow

1. Implement only the requested feature.
2. Add tests (or clearly document test coverage when tests are not available).
3. Validate behavior mentally and with runnable checks, then identify failures.
4. Fix every detected issue before moving forward.
5. Verify edge cases.
6. Confirm the feature works end-to-end.
7. Only then proceed to the next task.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite 5 + TypeScript |
| Backend | Express 4 + JWT + Zod |
| Database | PostgreSQL + pgvector |
| AI/ML | Gemini 2.0 Flash + text-embedding-004 |
| Storage | Google Drive + S3 + R2 (multi-provider) |
| Billing | Stripe Metered Billing |
| Infrastructure | Docker + Kubernetes |
| Platform | Supabase (Auth, DB, Edge Functions, Storage) |
