# SEO Grader v3 - Complete System Directory

Complete directory structure and file organization for the SEO Grader v3 application.

---

## 📁 Root Directory Structure

```
seo-grader-v3-peach/
├── app/                          # Next.js 14 App Router (Primary Application Code)
├── components/                   # Shared React Components (Legacy/Alternative)
├── lib/                          # Core Business Logic & Utilities
├── prisma/                       # Database Schema & Migrations
├── public/                       # Static Assets (if any)
├── .gitignore                   # Git ignore rules
├── .npm-cache/                  # NPM cache (ignored)
├── next.config.js               # Next.js configuration
├── package.json                  # Dependencies & scripts
├── postcss.config.js            # PostCSS configuration
├── tailwind.config.js           # Tailwind CSS configuration
├── tsconfig.json                # TypeScript configuration
├── vercel.json                  # Vercel deployment configuration
└── [Documentation Files]        # Various .md documentation files
```

---

## 📂 app/ - Next.js App Router

### Pages (Route Components)

```
app/
├── page.tsx                      # Home page - URL input & audit submission
├── layout.tsx                    # Root layout - HTML structure, metadata, providers
├── globals.css                   # Global Tailwind CSS styles
├── providers.tsx                  # Client-side providers wrapper
│
├── about/
│   └── page.tsx                  # About page
│
├── login/
│   └── page.tsx                  # Login page with Supabase auth
│
├── reset-password/
│   ├── page.tsx                  # Password reset request page
│   └── [token]/
│       └── page.tsx              # Password reset form (with token)
│
└── report/
    ├── page.tsx                  # Report display page - shows audit results
    ├── PaywallBlur.tsx           # Paywall blur component for locked sections
    └── ScoreBlur.tsx             # Score blur component for locked scores
```

**Key Files:**
- **`app/page.tsx`**: Main entry point, URL submission form, handles audit API call, stores results in localStorage, navigates to report
- **`app/report/page.tsx`**: Reads audit results from localStorage, displays all scores (SEO, Title, Media, Technical, AI), detailed breakdowns, visual indicators
- **`app/layout.tsx`**: Root HTML structure, metadata, global CSS imports, client providers

---

### API Routes

```
app/api/
├── audit/
│   └── route.ts                  # POST /api/audit - Synchronous audit execution
│
├── scrape/
│   └── route.ts                  # GET /api/scrape - HTML scraping utility
│
├── states/
│   └── route.ts                  # GET /api/states - US states data for locality detection
│
├── auth/
│   ├── [...nextauth]/            # NextAuth route handlers (if used)
│   ├── register/
│   │   └── route.ts             # POST /api/auth/register - User registration
│   └── reset-password/
│       ├── route.ts              # POST /api/auth/reset-password - Request reset
│       └── [token]/
│           └── route.ts         # POST /api/auth/reset-password/[token] - Reset with token
│
└── calendly/
    └── webhook/
        └── route.ts              # POST /api/calendly/webhook - Calendly webhook handler
```

**Key API Endpoints:**
- **`POST /api/audit`**: Primary audit endpoint, executes 3-stage audit synchronously, returns complete results
- **`GET /api/scrape`**: Utility endpoint for HTML/robots.txt/sitemap.xml fetching
- **`GET /api/states`**: Returns US states array for locality detection in scoring
- **`POST /api/auth/register`**: User registration with Supabase
- **`POST /api/auth/reset-password`**: Password reset flow

---

### Components

```
app/components/
├── HamburgerMenu.tsx             # Navigation hamburger menu
├── Logo.tsx                      # Brand logo SVG component
└── UserMenu.tsx                  # User menu dropdown (if authenticated)
```

**Component Details:**
- **`Logo.tsx`**: SVG logo with "TRI TWO" text, used in header
- **`HamburgerMenu.tsx`**: Mobile navigation menu with links to pricing/about
- **`UserMenu.tsx`**: User account menu (login/logout/profile)

---

## 📂 lib/ - Core Business Logic

```
lib/
├── scoring.ts                    # Core scoring algorithms (title & media)
├── scoring-config.json           # Scoring weights, thresholds, keywords
├── auditStagesSync.ts            # Synchronous 3-stage audit processing (PRIMARY)
├── auditStages.ts                # Asynchronous 3-stage audit processing (available)
├── auditQueue.ts                 # Redis queue management (if using async)
├── auth.ts                       # Authentication utilities (Supabase)
├── email.ts                      # Email utilities (SendGrid/Supabase)
├── prisma.ts                     # Prisma client initialization
├── supabase.ts                   # Supabase client (service role, server-side)
│
└── supabase/
    ├── client.ts                 # Browser Supabase client (@supabase/ssr)
    ├── server.ts                # Server Supabase client (@supabase/ssr)
    └── middleware.ts             # Middleware Supabase client (@supabase/ssr)
```

**Key Library Files:**
- **`lib/scoring.ts`**: `scoreTitle()`, `scoreMedia()` - Core scoring algorithms
- **`lib/scoring-config.json`**: All weights, thresholds, service keywords, status buckets
- **`lib/auditStagesSync.ts`**: `processStage1Sync()`, `processStage2Sync()`, `processStage3Sync()` - Primary audit pipeline
- **`lib/supabase/client.ts`**: Browser-side Supabase client for auth
- **`lib/supabase/server.ts`**: Server-side Supabase client for API routes
- **`lib/prisma.ts`**: Prisma client singleton for database queries

---

## 📂 prisma/ - Database Schema

```
prisma/
├── schema.prisma                 # Prisma schema definition
└── migrations/
    └── add_paywall_and_llm_models/
        └── migration.sql         # Migration for paywall/LLM models
```

**Schema Models:**
- **`User`**: User accounts (linked to Supabase auth.users)
- **`AuditResult`**: Historical audit results with scores
- **`AuditJob`**: Job queue for async processing (if used)
- **`CalendlyAppointment`**: Calendly appointment tracking
- **`SubscriptionPlan`**: Subscription plan definitions
- **`UserSubscription`**: User subscription records

**Note:** Supabase also has additional tables created via SQL migrations (organizations, clients, sites, audits, llm_runs, etc.)

---

## 📂 components/ - Legacy Components

```
components/
├── HamburgerMenu.tsx             # Alternative/legacy hamburger menu
└── Logo.tsx                      # Alternative/legacy logo component
```

**Note:** These appear to be duplicates or legacy versions. The app uses `app/components/` versions.

---

## 📄 Configuration Files

### Root Configuration

```
├── package.json                  # Dependencies, scripts (build includes prisma generate)
├── tsconfig.json                # TypeScript compiler configuration
├── next.config.js               # Next.js framework configuration
├── tailwind.config.js           # Tailwind CSS configuration
├── postcss.config.js            # PostCSS configuration
├── vercel.json                  # Vercel deployment & cron configuration
└── .gitignore                   # Git ignore patterns
```

**Key Configuration:**
- **`package.json`**: Scripts include `prisma generate` in build and postinstall
- **`vercel.json`**: Cron job configuration (hourly worker trigger, backup only)
- **`next.config.js`**: Next.js framework settings

---

## 📚 Documentation Files

### Architecture & Design
- `ARCHITECTURE_BREAKDOWN.md` - Full async architecture documentation
- `CURRENT_ARCHITECTURE_DIRECTORY.md` - Current synchronous implementation
- `GRADING_CODE_DIRECTORY.md` - Grading code file reference
- `SCORING_DIRECTORY.md` - Scoring criteria breakdown
- `SYSTEM_DIRECTORY.md` - This file
- `SYSTEM_DESIGN.md` - Design patterns & data models
- `SYSTEM_ARCHITECTURE.md` - Architecture overview

### Setup & Deployment
- `SUPABASE_CONNECTION_SETUP.md` - Database connection guide
- `SUPABASE_CREDENTIALS.md` - Credentials reference
- `LOGIN_SYSTEM_SETUP.md` - Authentication setup
- `VERCEL_ENV_VARS_SETUP.md` - Environment variables guide
- `DEPLOYMENT.md` - Deployment instructions
- `FINAL_DEPLOY.md` - Final deployment checklist

### Troubleshooting
- `VERCEL_BUILD_FIX.md` - Build issue fixes
- `VERCEL_DEPLOYMENT_ISSUE_REPORT.md` - Deployment issues
- `DEBUG_WORKER.md` - Worker debugging
- `TROUBLESHOOT_STUCK_JOBS.md` - Job troubleshooting

---

## 🔍 File Type Breakdown

### TypeScript Files (.ts, .tsx)
- **Pages**: `app/**/page.tsx` - Next.js route components
- **API Routes**: `app/api/**/route.ts` - Serverless API endpoints
- **Components**: `app/components/*.tsx` - React components
- **Library**: `lib/*.ts` - Business logic, utilities
- **Config**: `*.config.js` - Configuration files

### JSON Files
- **`lib/scoring-config.json`**: Scoring configuration
- **`package.json`**: Dependencies & scripts
- **`tsconfig.json`**: TypeScript config
- **`vercel.json`**: Vercel config

### Database Files
- **`prisma/schema.prisma`**: Prisma schema
- **`prisma/migrations/**/*.sql`**: SQL migrations

### CSS Files
- **`app/globals.css`**: Global Tailwind styles

---

## 📊 Code Organization Principles

### 1. **App Router Structure**
- All routes defined by folder structure in `app/`
- `page.tsx` = route component
- `route.ts` = API endpoint
- `layout.tsx` = shared layout

### 2. **Separation of Concerns**
- **`app/`**: UI components, pages, API routes
- **`lib/`**: Business logic, utilities, data access
- **`prisma/`**: Database schema & migrations

### 3. **Client vs Server**
- **Client Components**: `"use client"` directive (interactive UI)
- **Server Components**: Default (data fetching, SEO)
- **API Routes**: Serverless functions (backend logic)

### 4. **Naming Conventions**
- **Components**: PascalCase (`Logo.tsx`, `HamburgerMenu.tsx`)
- **Utilities**: camelCase (`scoring.ts`, `auditStagesSync.ts`)
- **Routes**: kebab-case folders (`reset-password/`, `webhook/`)

---

## 🎯 Key Entry Points

### User Flow Entry Points
1. **`app/page.tsx`** - Home page (URL input)
2. **`app/report/page.tsx`** - Results display
3. **`app/login/page.tsx`** - Authentication

### API Entry Points
1. **`app/api/audit/route.ts`** - Primary audit endpoint
2. **`app/api/auth/register/route.ts`** - User registration
3. **`app/api/auth/reset-password/route.ts`** - Password reset

### Processing Entry Points
1. **`lib/auditStagesSync.ts`** - Synchronous audit processing
2. **`lib/scoring.ts`** - Scoring calculations
3. **`lib/supabase/client.ts`** - Browser auth client

---

## 📦 Dependencies Overview

### Core Framework
- **next** (^14.0.0) - Next.js framework
- **react** (^18.2.0) - React library
- **typescript** (^5.0.0) - TypeScript

### Database & Auth
- **@prisma/client** (^5.16.1) - Prisma ORM
- **@supabase/supabase-js** (^2.87.1) - Supabase client
- **@supabase/ssr** (^0.8.0) - Supabase SSR helpers

### Utilities
- **jsdom** (^24.0.0) - HTML parsing
- **bcryptjs** (^3.0.3) - Password hashing
- **@sendgrid/mail** (^8.1.6) - Email sending

### Styling
- **tailwindcss** (^3.3.0) - CSS framework
- **postcss** (^8.4.0) - CSS processing
- **autoprefixer** (^10.4.0) - CSS vendor prefixes

---

## 🔄 Build & Development

### Scripts (package.json)
- **`dev`**: `next dev` - Development server
- **`build`**: `prisma generate && next build` - Production build
- **`start`**: `next start` - Production server
- **`lint`**: `next lint` - ESLint
- **`postinstall`**: `prisma generate` - Auto-generate Prisma client

### Build Process
1. **Prisma Generate**: Generates Prisma Client from schema
2. **Next.js Build**: Compiles TypeScript, bundles assets, optimizes
3. **Vercel Deploy**: Deploys serverless functions and static assets

---

## 📝 Summary

This directory structure follows **Next.js 14 App Router** conventions with:
- **Clear separation** between UI (`app/`), logic (`lib/`), and data (`prisma/`)
- **Type-safe** TypeScript throughout
- **Serverless** API routes for backend logic
- **Component-based** React architecture
- **Database-first** with Prisma schema
- **Comprehensive** documentation for all aspects

The system is organized for **scalability**, **maintainability**, and **developer experience**.

