# SEO Grader v3 - Complete System Design Documentation

Complete design documentation covering data models, component design, patterns, system interactions, and full Supabase schema.

---

## 🎯 System Overview

**SEO Grader v3** is a Next.js 14 application that performs comprehensive SEO audits of websites through a 3-stage processing pipeline. The system evaluates websites across multiple dimensions (Title, Media, Technical, AI) and provides actionable insights. The system uses Supabase for authentication, database, and multi-tenant organization management.

### Design Principles
1. **Synchronous Primary Flow** - Fast, immediate results
2. **Modular Scoring System** - Configurable, extensible
3. **Type-Safe Architecture** - TypeScript throughout
4. **Serverless-First** - Vercel serverless functions
5. **Multi-Tenant** - Supabase RLS for tenant isolation
6. **Database-Agnostic** - Prisma ORM + Supabase abstraction

---

## 📊 Data Models

### Prisma Schema Models

#### User Model
```typescript
model User {
  id            String                @id // Supabase auth.users.id (UUID)
  email         String                @unique
  role          UserRole              @default(VISITOR)
  createdAt     DateTime              @default(now())
  updatedAt     DateTime              @updatedAt
  audits        AuditResult[]
  appointments  CalendlyAppointment[]
  subscriptions UserSubscription[]
}

enum UserRole {
  ADMIN
  VISITOR
}
```

**Design Notes:**
- Links to Supabase `auth.users` via UUID
- Role-based access control (ADMIN/VISITOR)
- One-to-many relationships with audits, appointments, subscriptions

---

#### AuditResult Model
```typescript
model AuditResult {
  id                        String                @id @default(cuid())
  url                       String
  userEmail                 String
  user                      User?                 @relation(fields: [userEmail], references: [email])
  isPaid                    Boolean               @default(false)
  hasAppointment            Boolean               @default(false)
  rawSeoJson                Json                  // Complete audit results
  llmSummary                String?               // AI-generated summary
  contentGrade              String?               // Content quality grade
  competitorJson            Json?                 // Competitor analysis
  articleIdeas              Json?                 // Content suggestions
  companyName               String?               // Extracted company name
  // Score fields
  titleSearchRelevanceScore Int?
  technicalFoundationsScore Int?
  aiOptimizationScore       Int?
  contentSemanticsScore      Int?
  mediaOptimizationScore     Int?
  crawlabilityIndexScore     Int?
  createdAt                 DateTime              @default(now())
  appointments              CalendlyAppointment[]
}
```

**Design Notes:**
- Stores complete audit results as JSON
- Separate score fields for different dimensions
- Links to user via email
- Tracks payment and appointment status

---

#### AuditJob Model (Async Processing)
```typescript
model AuditJob {
  id           String   @id @default(uuid())
  url          String
  status       String   // "pending" | "running" | "done" | "error"
  stage        Int      @default(0) // 0, 1, 2, 3
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  errorMessage String?
  results      Json?    // Full audit result object
  
  @@index([url, status, createdAt])
  @@index([status])
}
```

**Design Notes:**
- Job-based async processing (available but not primary)
- Stage tracking (0-3) for progress
- Indexed for efficient querying
- Results stored as JSONB

---

### Supabase Schema Models

#### Profiles Table
```sql
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE,
  display_name text,
  created_at timestamptz DEFAULT now()
);
```

**Design Notes:**
- Extends Supabase `auth.users` table
- Stores additional user profile information
- One-to-one relationship with `auth.users`

---

#### Tenants Table
```sql
CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

**Design Notes:**
- Represents organizations/accounts
- Unique slug for URL-friendly identification
- Used for multi-tenant data isolation

---

#### Tenant Memberships Table
```sql
CREATE TABLE tenant_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin','member','viewer')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);
```

**Design Notes:**
- Many-to-many relationship between users and tenants
- Role-based access control (admin/member/viewer)
- Unique constraint prevents duplicate memberships
- Used by RLS policies for access control

---

#### Audits Table (Tenant-Scoped)
```sql
CREATE TABLE audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  url text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','complete','failed')),
  result_json jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Design Notes:**
- Tenant-scoped audit records
- Status enum for job tracking
- Results stored as JSONB for flexibility
- RLS policies ensure tenant isolation

---

#### LLM Runs Table
```sql
CREATE TABLE llm_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  audit_id uuid REFERENCES audits(id) ON DELETE CASCADE,
  engine text NOT NULL CHECK (engine IN ('crimson','midnight','burnt')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','complete','failed')),
  input_json jsonb,
  output_json jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Design Notes:**
- Tracks LLM execution (Crimson, Midnight, Burnt)
- Linked to audits and tenants
- Input/output stored as JSONB
- Status tracking for async operations

---

### Row Level Security (RLS) Policies

#### Helper Functions

**`current_user_is_member(tenant_id)`**
```sql
CREATE OR REPLACE FUNCTION current_user_is_member(tenant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM tenant_memberships
    WHERE tenant_memberships.tenant_id = current_user_is_member.tenant_id
      AND tenant_memberships.user_id = auth.uid()
  );
$$;
```

**`current_user_role(tenant_id)`**
```sql
CREATE OR REPLACE FUNCTION current_user_role(tenant_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role
  FROM tenant_memberships
  WHERE tenant_memberships.tenant_id = current_user_role.tenant_id
    AND tenant_memberships.user_id = auth.uid()
  LIMIT 1;
$$;
```

#### RLS Policies

**Tenants:**
- Users can view tenants they are members of

**Tenant Memberships:**
- Users can view their own memberships
- Admins can manage memberships in their tenants

**Audits:**
- Users can view audits for their tenants
- Users can create audits for their tenants
- Users can update audits for their tenants
- Admins can delete audits in their tenants

**LLM Runs:**
- Users can view llm_runs for their tenants
- Users can create llm_runs for their tenants
- Users can update llm_runs for their tenants
- Admins can delete llm_runs in their tenants

---

## 🎨 Component Design

### Page Components

#### Home Page (`app/page.tsx`)
**Type:** Client Component  
**Responsibilities:**
- URL input and validation
- Form submission to `/api/audit`
- Loading state management
- Error handling and display
- Results storage in localStorage
- Navigation to report page

**State Management:**
```typescript
const [urlInput, setUrlInput] = useState("");
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

**Key Functions:**
- `handleUrlSubmit()`: Validates URL, calls API, handles response, stores results, navigates

---

#### Report Page (`app/report/page.tsx`)
**Type:** Client Component  
**Responsibilities:**
- Read audit results from localStorage
- Display all scores (SEO, Title, Media, Technical, AI)
- Show detailed breakdowns
- Visual status indicators (good/warn/bad)
- Paywall blur for locked sections

**Data Flow:**
```
localStorage.getItem('auditResults') 
  → Parse JSON 
  → Display scores and breakdowns
```

---

#### Admin Dashboard (`app/admin/page.tsx`)
**Type:** Client Component  
**Responsibilities:**
- 4-card grid layout (Audit, Crimson, Midnight, Burnt)
- Standalone execution buttons
- Chained flow buttons with modals
- Admin role verification

**Access Control:** Checks `user.user_metadata?.role === "ADMIN"`

---

### API Route Components

#### POST `/api/audit` (`app/api/audit/route.ts`)
**Type:** Serverless Function  
**Runtime:** Node.js  
**Timeout:** 25 seconds

**Flow:**
1. Receive URL from request body
2. Validate and normalize URL
3. Execute `processStage1Sync(url)` - Fast pass
4. Execute `processStage2Sync(stage1, US_STATES)` - Scoring
5. Execute `processStage3Sync(stage2)` - AI analysis
6. Return complete results

**Response Structure:**
```typescript
{
  results: {
    url: string;
    seoScore: number;        // 0-100
    titleScoreRaw: number;       // 0-100
    mediaScoreRaw: number;       // 0-100
    technicalScore: number;      // 0-100
    aiScoreRaw: number;          // 0-100
    // ... detailed metrics
  }
}
```

---

### Library Components

#### Scoring Engine (`lib/scoring.ts`)
**Purpose:** Core scoring algorithms

**Functions:**
```typescript
function scoreTitle(metrics: TitleMetrics, config: ScoringConfig): TitleScoreBreakdown
function scoreMedia(metrics: MediaMetrics, config: ScoringConfig): MediaScoreBreakdown
```

**Input Types:**
```typescript
interface TitleMetrics {
  titleText: string;
  bodyText: string;
  localityFound: boolean;
  localityInBody: boolean;
  serviceKeywordType: 'strong' | 'weak' | 'none';
  semanticOverlap: number;
  length: number;
  hasSeparator: boolean;
}

interface MediaMetrics {
  totalImages: number;
  imagesWithAlt: number;
  badFilenameCount: number;
  hasOgTitle: boolean;
  hasOgDescription: boolean;
}
```

**Output Types:**
```typescript
interface TitleScoreBreakdown {
  total: number;              // 0-100
  locality: number;           // 0-25
  serviceKeywords: number;    // 0-25
  semantic: number;           // 0-20
  length: number;             // 0-15
  separators: number;         // 0-10
  presence: number;           // 0-5
  status: 'good' | 'warn' | 'bad';
}
```

---

#### Audit Stages (`lib/auditStagesSync.ts`)
**Purpose:** Synchronous 3-stage audit processing

**Stage 1: Fast Pass**
```typescript
function processStage1Sync(url: string): Promise<Stage1Results>
```
- Fetches HTML (10s timeout, 2 retries)
- Parses title, meta, H1, word count
- Fetches robots.txt, sitemap.xml
- Returns basic metrics

**Stage 2: Scoring**
```typescript
function processStage2Sync(
  stage1Results: Stage1Results,
  states: USState[]
): Stage2Results
```
- Extracts media metrics
- Calculates title score
- Calculates media score
- Calculates technical score
- Calculates overall SEO score

**Stage 3: AI Analysis**
```typescript
function processStage3Sync(stage2Results: Stage2Results): FinalResults
```
- Analyzes structured answers readiness
- Evaluates entity clarity
- Checks extraction readiness
- Assesses context completeness
- Evaluates trust signals
- Checks machine readability
- Calculates AI score (0-100)

---

#### Supabase Clients (`lib/supabase/`)

**Browser Client (`lib/supabase/client.ts`)**
```typescript
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Server Client (`lib/supabase/server.ts`)**
```typescript
export function createClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll, setAll } }
  );
}
```

**Middleware Client (`lib/supabase/middleware.ts`)**
```typescript
export function createClient(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll, setAll } }
  );
}
```

**Tenant Utilities (`lib/supabase/tenants.ts`)**
```typescript
export async function getUserTenants(userId: string): Promise<Tenant[]>
export async function getActiveTenant(userId: string): Promise<Tenant | null>
export async function getUserRoleInTenant(userId: string, tenantId: string): Promise<'admin' | 'member' | 'viewer' | null>
export async function ensureTenantMembership(userId: string, tenantId: string, role: 'admin' | 'member' | 'viewer'): Promise<TenantMembership | null>
```

---

## 🔄 Design Patterns

### 1. Singleton Pattern

**Used In:**
- `lib/supabase.ts` - Supabase service role client
- `lib/prisma.ts` - Prisma client
- `lib/upstash.ts` - Redis client

**Implementation:**
```typescript
// Lazy initialization with Proxy
const supabase = new Proxy({} as SupabaseClient, {
  get: (target, prop) => {
    if (!target.client) {
      target.client = createClient(url, key);
    }
    return target.client[prop];
  }
});
```

**Benefits:**
- Single instance per process
- Lazy initialization (prevents build-time errors)
- Memory efficient

---

### 2. Factory Pattern

**Used In:**
- `lib/supabase/client.ts` - Browser client factory
- `lib/supabase/server.ts` - Server client factory
- `lib/supabase/middleware.ts` - Middleware client factory

**Implementation:**
```typescript
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return createBrowserClient(url, key);
}
```

**Benefits:**
- Environment-specific client creation
- Consistent initialization
- Type safety

---

### 3. Strategy Pattern

**Used In:**
- Scoring algorithms - Different scoring strategies per metric
- Audit stages - Different processing strategies per stage

**Implementation:**
```typescript
// Scoring strategy per component
const strategies = {
  locality: scoreLocality(metrics, config),
  serviceKeywords: scoreServiceKeywords(metrics, config),
  semantic: scoreSemantic(metrics, config),
  // ...
};
```

**Benefits:**
- Extensible scoring system
- Easy to add new metrics
- Testable components

---

### 4. Configuration Pattern

**Used In:**
- `lib/scoring-config.json` - Centralized configuration

**Structure:**
```json
{
  "statusBuckets": {
    "goodMin": 80,
    "warnMin": 50
  },
  "title": {
    "weights": { ... },
    "length": { ... },
    "serviceKeywordsStrong": [ ... ],
    "serviceKeywordsWeak": [ ... ]
  },
  "media": {
    "weights": { ... },
    "altCoverageThresholds": { ... }
  }
}
```

**Benefits:**
- Easy to adjust weights without code changes
- Version control for configuration
- A/B testing capabilities

---

## 🔐 Security Design

### Authentication Flow

**Supabase Auth Integration:**
1. User registers via `POST /api/auth/register`
2. Supabase creates `auth.users` record
3. Prisma `User` record created with matching UUID
4. Session managed by Supabase cookies
5. Client components use `createClient()` from `@supabase/ssr`

**Row Level Security (RLS):**
- All Supabase tables have RLS enabled
- Policies check `tenant_memberships` for access
- Users can only see data from their tenants
- Role-based permissions (admin/member/viewer)

---

### API Security

**Environment Variables:**
- `SUPABASE_SERVICE_ROLE_KEY` - Server-side only (admin)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Client-safe (public)
- `WORKER_SECRET` - Worker authentication (if using async)

**Input Validation:**
- URL normalization and validation
- Timeout protection (prevents DoS)
- Rate limiting (if using async queue)

---

## 📈 Performance Design

### Timeout Strategy

**Stage Timeouts:**
- Stage 1: 10 seconds (HTML fetch)
- Stage 3: 8 seconds (AI analysis)
- Total API: 25 seconds (hard limit)

**Benefits:**
- Prevents infinite hangs
- Graceful degradation
- Predictable response times

---

### Caching Strategy

**Available (Not Currently Used):**
- 24-hour cache for completed audits (async flow)
- localStorage for frontend results
- Redis cache for rate limiting

**Future:**
- CDN caching for static assets
- API response caching
- Database query caching

---

### Optimization Techniques

1. **Lazy Loading:**
   - Components loaded on demand
   - Prisma client lazy initialization

2. **Code Splitting:**
   - Next.js automatic code splitting
   - Route-based chunks

3. **Asset Optimization:**
   - Image optimization (Next.js Image)
   - CSS minification
   - JavaScript tree shaking

---

## 🧪 Error Handling Design

### Error Types

**API Errors:**
```typescript
{
  error: string;           // User-friendly message
  code?: string;           // Error code
  details?: any;           // Additional context
}
```

**Job Errors (Async):**
```typescript
{
  status: 'error';
  errorMessage: string;
  errorCode?: string;
}
```

### Error Handling Strategy

1. **Graceful Degradation:**
   - Partial audits on timeout
   - Fallback values for missing data
   - Default scores when calculation fails

2. **User-Friendly Messages:**
   - No technical jargon
   - Actionable guidance
   - Clear next steps

3. **Logging:**
   - Console logs for debugging
   - Error tracking (future: Sentry)
   - Performance monitoring

---

## 🔄 Data Flow Design

### Synchronous Flow (Primary)

```
User Input (URL)
  ↓
POST /api/audit
  ↓
processStage1Sync() → Basic Metrics
  ↓
processStage2Sync() → Scores
  ↓
processStage3Sync() → AI Analysis
  ↓
Return Results → localStorage
  ↓
Display on /report
```

---

## 📊 Scoring Design

### Score Calculation

**Overall SEO Score:**
```
SEO Score = (Title × 0.45) + (Media × 0.20) + (Technical × 0.35)
```

**Status Determination:**
- `good`: ≥80 points
- `warn`: 50-79 points
- `bad`: <50 points

### Scoring Components

**Title Score (100 points, 45% weight):**
- Locality: 25 points
- Service Keywords: 25 points
- Semantic Overlap: 20 points
- Length: 15 points
- Separators: 10 points
- Presence: 5 points

**Media Score (100 points, 20% weight):**
- Alt Coverage: 40 points
- Filename Quality: 30 points
- Metadata: 20 points
- Image Count: 10 points

**Technical Score (100 points, 35% weight):**
- H1 Tags: 25 points
- Word Count: 20 points
- Canonical: 15 points
- Robots.txt: 15 points
- Sitemap.xml: 15 points
- Meta Description: 10 points

**AI Score (100 points, informational):**
- Structured Answers: 0-25 points
- Entity Clarity: 0-20 points
- Extraction Readiness: 0-20 points
- Context Completeness: 0-15 points
- Trust Signals: 0-10 points
- Machine Readiness: 0-10 points

---

## 🎨 UI/UX Design

### Visual Design System

**Color Scheme:**
- Background: `zinc-900` (dark)
- Text: `white` / `gray-300`
- Primary: `#8B4513` (brown button)
- Accent: `#16b8a6` (teal)
- Status Colors:
  - Good: Green
  - Warn: Yellow/Orange
  - Bad: Red

**Typography:**
- Headings: Bold, large (text-5xl to text-7xl)
- Body: Regular (text-base to text-xl)
- Font: System sans-serif (no custom fonts currently)

**Layout:**
- Header: Logo (left), Hamburger Menu (right)
- Content: Centered, max-width containers
- Responsive: Mobile-first, Tailwind breakpoints

---

### Component States

**Loading States:**
- Spinner animation
- Progress text ("Running SEO audit...")
- Timeout warning ("This may take up to 25 seconds")

**Error States:**
- Red error box
- Clear error message
- Retry option

**Success States:**
- Score display with color coding
- Detailed breakdowns
- Visual indicators (good/warn/bad)

---

## 🔧 Configuration Design

### Environment Variables

**Required:**
```bash
DATABASE_URL=postgresql://...          # Prisma connection
SUPABASE_URL=https://...               # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY=...          # Server-side key
NEXT_PUBLIC_SUPABASE_URL=https://...   # Client-side URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=...      # Client-side key
```

**Optional:**
```bash
SENDGRID_API_KEY=...                   # Email sending
SENDGRID_FROM_EMAIL=...                # From address
UPSTASH_REDIS_REST_URL=...             # Redis (if async)
UPSTASH_REDIS_REST_TOKEN=...           # Redis token
WORKER_SECRET=...                      # Worker auth
```

---

## 📝 Summary

This system design emphasizes:
- **Modularity** - Separated concerns, reusable components
- **Type Safety** - TypeScript throughout
- **Configurability** - JSON-based configuration
- **Extensibility** - Easy to add new metrics/stages
- **Performance** - Timeout protection, efficient processing
- **User Experience** - Clear feedback, graceful errors
- **Security** - RLS, environment variables, input validation
- **Multi-Tenant** - Supabase RLS for tenant isolation

The design supports both **synchronous** (current) and **asynchronous** (available) processing patterns, providing flexibility for different use cases and scale requirements.

