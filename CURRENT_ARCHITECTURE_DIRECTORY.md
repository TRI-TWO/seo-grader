# SEO Grader v3 - Current Architecture Directory

Complete architecture documentation for the SEO Grader v3 system as currently implemented.

---

## 🏗️ System Architecture Overview

### Current Implementation: Synchronous Processing

The system currently uses **synchronous processing** where audits are executed immediately and results are returned directly to the frontend. The architecture supports both synchronous and asynchronous patterns, but the primary flow is synchronous.

---

## 📐 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE                           │
│                  (Next.js Frontend)                         │
│                                                              │
│  ┌──────────────┐              ┌──────────────┐            │
│  │  Home Page   │              │ Report Page  │            │
│  │  (page.tsx)  │─────────────▶│(report/page) │            │
│  └──────┬───────┘              └──────────────┘            │
│         │                                                     │
│         │ POST /api/audit                                    │
│         │ { url: "..." }                                    │
│         ▼                                                     │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│              VERCEL API ROUTE                                │
│         POST /api/audit (route.ts)                           │
│                                                              │
│  • Validates URL                                            │
│  • Executes 3-stage audit synchronously                     │
│  • Returns complete results                                 │
│  • 25-second timeout                                        │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│          AUDIT PROCESSING ENGINE                            │
│         (lib/auditStagesSync.ts)                            │
│                                                              │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Stage 1: Fast Pass (10s timeout)                    │  │
│  │ • Fetch HTML from URL                                │  │
│  │ • Parse title, meta, H1, word count                  │  │
│  │ • Fetch robots.txt, sitemap.xml                     │  │
│  └────────────────────────────────────────────────────┘  │
│                        │                                     │
│                        ▼                                     │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Stage 2: Structure + Media                        │  │
│  │ • Extract media metrics (images, alt text)         │  │
│  │ • Calculate title score (lib/scoring.ts)           │  │
│  │ • Calculate media score (lib/scoring.ts)           │  │
│  │ • Calculate technical score                        │  │
│  │ • Calculate overall SEO score                      │  │
│  └────────────────────────────────────────────────────┘  │
│                        │                                     │
│                        ▼                                     │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Stage 3: AI Optimization (8s timeout)             │  │
│  │ • Structured answers readiness                      │  │
│  │ • Entity clarity                                    │  │
│  │ • Extraction readiness                              │  │
│  │ • Context completeness                              │  │
│  │ • Trust signals                                     │  │
│  │ • Machine readability                               │  │
│  └────────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              SCORING ENGINE                                 │
│            (lib/scoring.ts)                                 │
│                                                              │
│  • scoreTitle() - Title score (0-100)                      │
│  • scoreMedia() - Media score (0-100)                       │
│  • Configuration from scoring-config.json                  │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    RESULTS                                  │
│                                                              │
│  • Overall SEO Score                                        │
│  • Title Score                                              │
│  • Media Score                                              │
│  • Technical Score                                           │
│  • AI Score                                                 │
│  • Detailed breakdowns                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Current Data Flow

### Synchronous Flow (Primary)

```
1. User enters URL on home page
   ↓
2. Frontend submits POST /api/audit with URL
   ↓
3. API route receives request
   ↓
4. processStage1Sync(url) executes:
   - Fetches HTML (10s timeout, 2 retry attempts)
   - Parses basic metadata
   - Fetches robots.txt and sitemap.xml
   ↓
5. processStage2Sync(stage1Results, US_STATES) executes:
   - Extracts media metrics
   - Calculates title score
   - Calculates media score
   - Calculates technical score
   - Calculates overall SEO score
   ↓
6. processStage3Sync(stage2Results) executes:
   - Analyzes AI optimization metrics
   - Calculates AI score
   ↓
7. Complete results returned to API route
   ↓
8. API returns JSON response with results
   ↓
9. Frontend stores results in localStorage
   ↓
10. Frontend navigates to /report page
   ↓
11. Report page displays all scores and breakdowns
```

### Timing
- **Stage 1:** ~5-10 seconds
- **Stage 2:** ~1-3 seconds
- **Stage 3:** ~5-8 seconds
- **Total:** ~15-25 seconds (synchronous)

---

## 🏛️ Component Architecture

### 1. Frontend Layer

#### Home Page (`app/page.tsx`)
- **Type:** Client Component
- **Responsibilities:**
  - URL input and validation
  - Form submission
  - Loading states
  - Error handling
  - Navigation to results

#### Report Page (`app/report/page.tsx`)
- **Type:** Client Component
- **Responsibilities:**
  - Read results from localStorage
  - Display all scores
  - Show detailed breakdowns
  - Visual indicators (good/warn/bad)

#### Layout (`app/layout.tsx`)
- **Type:** Server Component
- **Responsibilities:**
  - Root HTML structure
  - Metadata
  - Global CSS

---

### 2. API Layer

#### POST `/api/audit` (`app/api/audit/route.ts`)
- **Type:** Serverless Function
- **Runtime:** Node.js
- **Responsibilities:**
  - Receive URL from request
  - Execute 3-stage audit synchronously
  - Return complete results
  - Handle timeouts (25s hard limit)
  - Error handling

#### GET `/api/scrape` (`app/api/scrape/route.ts`)
- **Type:** Serverless Function
- **Runtime:** Node.js
- **Responsibilities:**
  - HTML scraping utility
  - Fetch robots.txt and sitemap.xml
  - Return raw data

#### GET `/api/states` (`app/api/states/route.ts`)
- **Type:** Serverless Function
- **Runtime:** Node.js
- **Responsibilities:**
  - Return US states data
  - Used for locality detection

---

### 3. Processing Layer

#### Audit Stages Sync (`lib/auditStagesSync.ts`)
- **Purpose:** Synchronous audit processing
- **Functions:**
  - `processStage1Sync(url)` - Fast pass
  - `processStage2Sync(stage1Results, states)` - Scoring
  - `processStage3Sync(stage2Results)` - AI analysis

#### Audit Stages Async (`lib/auditStages.ts`)
- **Purpose:** Asynchronous audit processing (available but not primary)
- **Functions:**
  - `processStage1(jobId, url)` - Fast pass with job persistence
  - `processStage2(jobId, stage1Results, states)` - Scoring with job updates
  - `processStage3(jobId, stage2Results)` - AI analysis with job updates
  - `processAuditJob(jobId, url, startFromStage?, existingResults?)` - Full processor

---

### 4. Scoring Layer

#### Scoring Engine (`lib/scoring.ts`)
- **Purpose:** Core scoring algorithms
- **Functions:**
  - `scoreTitle(metrics, config)` - Title score (0-100)
  - `scoreMedia(metrics, config)` - Media score (0-100)

#### Scoring Configuration (`lib/scoring-config.json`)
- **Purpose:** Configurable weights and thresholds
- **Contains:**
  - Status buckets (good/warn/bad)
  - Title weights and settings
  - Media weights and settings
  - Service keywords
  - Length constraints

---

### 5. Infrastructure Layer

#### Supabase Client (`lib/supabase.ts`)
- **Purpose:** PostgreSQL database client
- **Features:**
  - Singleton pattern
  - Lazy initialization
  - Service role key (admin)
  - Server-side only

#### Upstash Redis Client (`lib/upstash.ts`)
- **Purpose:** Redis client for queue, rate limiting, locking
- **Features:**
  - Singleton pattern
  - REST API (no persistent connections)
  - Rate limiting (10 req/hour)
  - Distributed locking

#### Queue System (`lib/auditQueue.ts`)
- **Purpose:** Job queue management
- **Features:**
  - FIFO queue
  - Enqueue/dequeue operations
  - Queue length and peek

---

## 📊 Scoring Architecture

### Score Calculation Flow

```
┌─────────────────────────────────────────────────────────┐
│                    INPUT DATA                           │
│  • HTML content                                         │
│  • Parsed metadata                                      │
│  • Media elements                                        │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              METRICS EXTRACTION                          │
│                                                          │
│  Title Metrics:                                         │
│  • Title text                                           │
│  • Locality detection (state names)                     │
│  • Service keyword detection                            │
│  • Semantic overlap (title vs body)                      │
│  • Length analysis                                       │
│                                                          │
│  Media Metrics:                                         │
│  • Total images                                         │
│  • Images with alt text                                 │
│  • Bad filename count                                   │
│  • OG tags presence                                     │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              SCORING CALCULATION                          │
│                                                          │
│  Title Score (100 points):                              │
│  • Locality: 25 points                                  │
│  • Service Keywords: 25 points                          │
│  • Semantic: 20 points                                 │
│  • Length: 15 points                                   │
│  • Separators: 10 points                                │
│  • Presence: 5 points                                   │
│                                                          │
│  Media Score (100 points):                              │
│  • Alt Coverage: 40 points                              │
│  • Filename Quality: 30 points                         │
│  • Metadata: 20 points                                 │
│  • Image Count: 10 points                              │
│                                                          │
│  Technical Score (100 points):                          │
│  • H1 Count: 25 points (1 H1)                          │
│  • Word Count: 20 points (≥400 words)                  │
│  • Canonical: 15 points                                │
│  • Robots.txt: 15 points                               │
│  • Sitemap.xml: 15 points                             │
│  • Meta Description: 10 points                          │
│                                                          │
│  AI Score (100 points):                                │
│  • Structured Answers: 0-25 points                     │
│  • Entity Clarity: 0-20 points                         │
│  • Extraction Readiness: 0-20 points                   │
│  • Context Completeness: 0-15 points                    │
│  • Trust Signals: 0-10 points                          │
│  • Machine Readability: 0-10 points                    │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│            OVERALL SEO SCORE                             │
│                                                          │
│  SEO Score = (Title × 0.45) + (Media × 0.20) +          │
│              (Technical × 0.35)                         │
│                                                          │
│  Status:                                                │
│  • good: ≥80 points                                     │
│  • warn: 50-79 points                                   │
│  • bad: <50 points                                      │
└─────────────────────────────────────────────────────────┘
```

---

## 🔐 Security Architecture

### Current Security Measures

1. **Server-Side Processing**
   - All scoring logic runs server-side
   - No client-side exposure of algorithms

2. **Environment Variables**
   - Sensitive keys stored in environment
   - Not exposed to client

3. **Input Validation**
   - URL validation and normalization
   - Timeout protection

4. **Error Handling**
   - Graceful error handling
   - No sensitive data in error messages

---

## ⚡ Performance Architecture

### Optimization Strategies

1. **Timeout Protection**
   - Stage 1: 10 seconds
   - Stage 3: 8 seconds
   - Total: 25 seconds (API limit)

2. **Retry Logic**
   - HTML fetch: 2 attempts with different User-Agent
   - Robots.txt fallback if HTML fails

3. **Efficient Processing**
   - Stage 1: Fast pass (basic data)
   - Stage 2: Scoring calculations
   - Stage 3: AI analysis (can timeout gracefully)

4. **Caching (Available)**
   - 24-hour cache for completed audits (if async)
   - localStorage for frontend results

---

## 🗄️ Data Architecture

### Data Models

#### Audit Results Structure
```typescript
{
  // Stage 1
  url: string;
  finalUrl: string;
  status: number;
  html: string;
  titleTag: string;
  metaDescription: string;
  h1Count: number;
  wordCount: number;
  robotsTxtFound: boolean;
  sitemapXmlFound: boolean;
  
  // Stage 2
  titleScoreRaw: number;      // 0-100
  titleScore10: number;        // 0-10
  titleStatus: "good" | "warn" | "bad";
  mediaScoreRaw: number;       // 0-100
  mediaScore10: number;        // 0-10
  mediaStatus: "good" | "warn" | "bad";
  technicalScore: number;      // 0-100
  technicalScore10: number;    // 0-10
  seoScore: number;            // 0-100 (weighted)
  
  // Stage 3
  aiScoreRaw: number;          // 0-100
  aiScore10: number;           // 0-10
  aiStatus: "good" | "warn" | "bad";
  aiMetrics: {
    structuredAnswers: number;
    entityClarity: number;
    extractionReadiness: number;
    contextCompleteness: number;
    trustSignals: number;
    machineReadability: number;
  };
  
  // Flags
  partialAudit: boolean;
  aiOptimizationTimeout: boolean;
}
```

---

## 🚀 Deployment Architecture

### Current Deployment

**Platform:** Vercel
- **Framework:** Next.js 14
- **Runtime:** Node.js (serverless functions)
- **Timeout:** 25 seconds (synchronous endpoint)

### Configuration

**Vercel (`vercel.json`):**
- Framework: nextjs
- Cron job: Hourly worker trigger (backup, not primary)

**Environment Variables:**
- `SUPABASE_URL` - Database URL
- `SUPABASE_SERVICE_ROLE_KEY` - Database key
- `UPSTASH_REDIS_REST_URL` - Redis URL (if using async)
- `UPSTASH_REDIS_REST_TOKEN` - Redis token (if using async)

---

## 🔄 Alternative Architecture (Available)

### Asynchronous Processing

The system includes infrastructure for asynchronous processing:

1. **Job Queue** (`lib/auditQueue.ts`)
   - Redis-based FIFO queue
   - Job persistence

2. **Job Persistence** (`lib/supabase.ts`)
   - Database storage for job state
   - Status tracking (pending/running/done/error)
   - Stage tracking (0-3)

3. **Async Processing** (`lib/auditStages.ts`)
   - Job-based processing
   - Status updates per stage
   - Error handling with job updates

4. **Rate Limiting** (`lib/upstash.ts`)
   - 10 requests per hour per IP
   - Distributed locking

**Note:** Currently not the primary flow, but infrastructure is in place.

---

## 📈 Scalability Considerations

### Current Limitations

1. **Synchronous Processing**
   - 25-second timeout limit
   - Single request blocks until complete
   - No concurrent processing

2. **No Queue System (Primary)**
   - Direct processing
   - No job persistence (primary flow)
   - No retry mechanism

### Scalability Options

1. **Switch to Async**
   - Use existing async infrastructure
   - Job queue for concurrent processing
   - Job persistence for reliability

2. **Background Functions**
   - Vercel Background Functions
   - Longer timeout limits
   - Better for long-running jobs

3. **Horizontal Scaling**
   - Multiple workers
   - Queue-based distribution
   - Load balancing

---

## 🔍 Monitoring & Observability

### Current State

- **Logging:** Console logs in API routes
- **Error Handling:** Try-catch blocks with error messages
- **Status Tracking:** Results include flags (partialAudit, timeout)

### Future Enhancements

- Structured logging
- Error tracking (Sentry, etc.)
- Performance monitoring
- Job status dashboard (if async)

---

## 📝 Summary

### Current Architecture: Synchronous Processing

**Flow:**
1. User submits URL
2. API executes 3-stage audit synchronously
3. Results returned immediately
4. Frontend displays results

**Key Characteristics:**
- ✅ Simple and straightforward
- ✅ Fast response (15-25 seconds)
- ✅ No infrastructure dependencies (primary flow)
- ⚠️ Limited by 25-second timeout
- ⚠️ No job persistence (primary flow)
- ⚠️ No concurrent processing

**Infrastructure Available:**
- Async processing infrastructure exists
- Queue system available
- Job persistence available
- Rate limiting available
- Can switch to async if needed

This architecture provides a solid foundation that can scale to async processing when needed.




