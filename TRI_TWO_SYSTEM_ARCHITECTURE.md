# Tri-Two System Architecture: Audit, Crimson, Midnight, and Burnt

## Overview

The Tri-Two system consists of four interconnected components that work together to provide comprehensive SEO analysis and optimization:

1. **Audit** - Baseline diagnostics and scoring engine
2. **Crimson** - Content creation and editing engine
3. **Midnight** - Homepage structure and decision routing engine
4. **Burnt** - System-level synthesis and action prioritization engine

---

## Page Architecture

### Admin Dashboard (`/admin`)

**File:** `app/admin/page.tsx`

**Purpose:** Central hub for accessing all four system components

**Features:**
- 4-card grid layout (one card per component)
- Each card provides:
  - Standalone execution button (navigates to dedicated page)
  - Chained flow buttons (opens modal for sequential execution)
- Modal interface for chained flows with form inputs

**Access Control:** Admin-only (checks `user.user_metadata?.role === "ADMIN"`)

---

### Audit Page (`/admin/audit`)

**File:** `app/admin/audit/page.tsx`

**Purpose:** Standalone audit execution interface

**Input:**
- URL (required)

**Flow:**
1. User enters URL
2. POST to `/api/audit`
3. Displays results: SEO Score, Title Score, Media Score, AI Score
4. Option to view full report (redirects to `/report`)

**API Endpoint:** `POST /api/audit`

**Timeout:** 30 seconds (client-side), 25 seconds (server-side)

---

### Crimson Page (`/admin/crimson`)

**File:** `app/admin/crimson/page.tsx`

**Purpose:** Standalone content optimization interface

**Input:**
- URL (required)
- Goal (required) - e.g., "Increase conversions, improve trust signals"
- Tone Preset (optional) - e.g., "Professional, Friendly, Authoritative"

**Flow:**
1. User enters URL, goal, and optional tone preset
2. POST to `/api/llm/crimson`
3. Displays results:
   - Content Edits (before/after comparisons)
   - CTA Suggestions (location, text, style, rationale)
   - Action Items (crimsonActions array)

**API Endpoint:** `POST /api/llm/crimson`

**Timeout:** 35 seconds (client-side), 30 seconds (server-side)

**Authentication:** Requires admin role

---

### Midnight Page (`/admin/midnight`)

**File:** `app/admin/midnight/page.tsx`

**Purpose:** Standalone homepage structure analysis interface

**Input:**
- URL (required)
- Mode (required):
  - `homepage_edit` - Provides layout and structure guidance
  - `route_to_crimson` - Determines content to edit and calls Crimson internally

**Flow:**
1. User enters URL and selects mode
2. POST to `/api/llm/midnight`
3. Displays results:
   - Structure Recommendations (current vs recommended, priority)
   - Action Items (midnightActions array)
   - Crimson Results (if mode is `route_to_crimson`)

**API Endpoint:** `POST /api/llm/midnight`

**Timeout:** 35 seconds (client-side), 30 seconds (server-side)

**Authentication:** Requires admin role

**Special Behavior:** When mode is `route_to_crimson`, Midnight internally calls Crimson and includes results in response

---

### Burnt Page (`/admin/burnt`)

**File:** `app/admin/burnt/page.tsx`

**Purpose:** Action scoring and full orchestration interface

**Two Tabs:**

#### Tab 1: Score Actions
**Input:**
- Actions (JSON array or one per line)

**Flow:**
1. User enters actions (parsed as JSON or line-by-line)
2. POST to `/api/llm/burnt/score`
3. Displays prioritized actions with:
   - Burnt Score (impact, confidence, effort_inverse, urgency, total)
   - Priority Band (Do now, High priority, Opportunistic, Backlog)

**API Endpoint:** `POST /api/llm/burnt/score`

**Timeout:** 30 seconds (client-side), 25 seconds (server-side)

#### Tab 2: Full Run (Orchestration)
**Input:**
- URL (required)
- Checkboxes for steps to run:
  - Run Audit
  - Run Midnight
  - Run Crimson

**Flow:**
1. User enters URL and selects steps
2. POST to `/api/llm/burnt/orchestrate`
3. Displays results from all selected steps plus prioritized actions

**API Endpoint:** `POST /api/llm/burnt/orchestrate`

**Timeout:** 120 seconds (2 minutes)

**Authentication:** Requires admin role

---

## API Architecture

### Audit API

**Endpoint:** `POST /api/audit`

**File:** `app/api/audit/route.ts`

**Runtime:** `nodejs`

**Timeout:** 25 seconds

**Request:**
```typescript
{
  url: string
}
```

**Response:**
```typescript
{
  results: AuditResults
}
```

**Processing Stages:**
1. **Stage 1 (processStage1Sync):** Fast pass
   - Fetch HTML (10s timeout, 2 retries)
   - Parse title, meta description, H1 tags
   - Fetch robots.txt and sitemap.xml
   - Count words, check favicon, canonical tag

2. **Stage 2 (processStage2Sync):** Scoring
   - Extract media metrics (images, alt text, OG tags)
   - Calculate title scores (locality, service keywords, semantic, length, separators)
   - Calculate media scores
   - Calculate technical scores
   - Calculate overall SEO score

3. **Stage 3 (processStage3Sync):** AI Analysis
   - Structured answers readiness (0-25)
   - Entity clarity (0-20)
   - Extraction readiness (0-20)
   - Context completeness (0-15)
   - Trust signals (0-10)
   - Machine readability (0-10)
   - Total AI score (0-100)

**AuditResults Structure:**
```typescript
{
  url?: string;
  finalUrl?: string;
  status?: number;
  titleTag?: string;
  metaDescription?: string;
  h1Count?: number;
  wordCount?: number;
  seoScore?: number;
  titleScore10?: number;
  mediaScore10?: number;
  technicalScore10?: number;
  aiScore10?: number;
  // ... additional metrics
}
```

---

### Crimson API

**Endpoint:** `POST /api/llm/crimson`

**File:** `app/api/llm/crimson/route.ts`

**Runtime:** `nodejs`

**Timeout:** 30 seconds

**Authentication:** Requires admin role (`requireAdmin()`)

**Request:**
```typescript
{
  url: string;
  goal: string;
  tonePreset?: string;
  optionalAuditContext?: any; // Audit results if available
}
```

**Response:**
```typescript
{
  contentEdits: ContentEdit[];
  ctaSuggestions: CTASuggestion[];
  crimsonActions: Action[];
}
```

**Implementation:**
- Calls `runCrimson()` from `lib/llms/runCrimson.ts`
- Uses OpenAI GPT model (configured in `lib/llms/registry.ts`)
- Builds prompt with URL, goal, tone preset, and optional audit context
- Parses JSON response from LLM
- Returns structured content edits, CTA suggestions, and action items

**LLM Execution:**
- Model: Configured via `CRIMSON_CONFIG`
- System prompt: "You are Crimson, an SEO content optimization expert..."
- Temperature and max_tokens from config
- 30-second timeout

---

### Midnight API

**Endpoint:** `POST /api/llm/midnight`

**File:** `app/api/llm/midnight/route.ts`

**Runtime:** `nodejs`

**Timeout:** 30 seconds

**Authentication:** Requires admin role (`requireAdmin()`)

**Request:**
```typescript
{
  url: string;
  mode: 'homepage_edit' | 'route_to_crimson';
  optionalAuditContext?: any; // Audit results if available
}
```

**Response:**
```typescript
{
  structureRecommendations: StructureRecommendation[];
  midnightActions: Action[];
  optionalCrimsonArtifacts?: CrimsonOutput; // Only if mode is 'route_to_crimson'
}
```

**Implementation:**
- Calls `runMidnight()` from `lib/llms/runMidnight.ts`
- Uses OpenAI GPT model (configured in `lib/llms/registry.ts`)
- If mode is `route_to_crimson`, internally calls `runCrimson()` and includes results
- Builds prompt based on mode
- Parses JSON response from LLM

**LLM Execution:**
- Model: Configured via `MIDNIGHT_CONFIG`
- System prompt: "You are Midnight, an SEO homepage structure expert..."
- Temperature and max_tokens from config
- 30-second timeout

**Special Behavior:**
- When `mode === 'route_to_crimson'`, Midnight automatically calls Crimson internally
- Crimson results are included in `optionalCrimsonArtifacts`

---

### Burnt Score API

**Endpoint:** `POST /api/llm/burnt/score`

**File:** `app/api/llm/burnt/score/route.ts`

**Runtime:** `nodejs`

**Timeout:** 25 seconds

**Authentication:** Requires admin role (`requireAdmin()`)

**Request:**
```typescript
{
  actions: Action[];
  optionalContext?: any; // Additional context for scoring
}
```

**Response:**
```typescript
{
  prioritizedActions: PrioritizedAction[];
  burntScores: BurntScore[];
}
```

**Implementation:**
- Calls `runBurnt()` from `lib/llms/runBurnt.ts`
- Uses OpenAI GPT model (configured in `lib/llms/registry.ts`)
- Scores each action on 4 dimensions (0-25 each):
  - Impact: SEO performance improvement
  - Confidence: Likelihood of success
  - Effort Inverse: Ease of implementation (higher = easier)
  - Urgency: Time sensitivity
- Total score: 0-100 (sum of 4 dimensions)
- Assigns priority bands:
  - 80-100: "Do now"
  - 60-79: "High priority"
  - 40-59: "Opportunistic"
  - 0-39: "Backlog"

**LLM Execution:**
- Model: Configured via `BURNT_CONFIG`
- System prompt: "You are Burnt, an SEO action prioritization expert..."
- Temperature and max_tokens from config
- 25-second timeout

---

### Burnt Orchestrate API

**Endpoint:** `POST /api/llm/burnt/orchestrate`

**File:** `app/api/llm/burnt/orchestrate/route.ts`

**Runtime:** `nodejs`

**Timeout:** 120 seconds (2 minutes)

**Authentication:** Requires admin role (`requireAdmin()`)

**Request:**
```typescript
{
  url: string;
  runAudit?: boolean;
  runMidnight?: boolean;
  runCrimson?: boolean;
}
```

**Response:**
```typescript
{
  audit?: AuditResults;
  midnight?: MidnightAPIResponse;
  crimson?: CrimsonAPIResponse;
  burnt: {
    prioritizedActions: PrioritizedAction[];
    burntScores: BurntScore[];
  };
}
```

**Orchestration Flow:**
1. **Step 1 (Optional):** Run Audit
   - Calls `/api/audit` internally
   - Stores results as `auditContext`

2. **Step 2 (Optional):** Run Midnight
   - Calls `/api/llm/midnight` internally
   - Passes `auditContext` as `optionalAuditContext`
   - Stores results as `midnightContext`

3. **Step 3 (Optional):** Run Crimson
   - Calls `/api/llm/crimson` internally
   - Passes `auditContext` or `midnightContext` as context
   - Stores results as `crimsonContext`

4. **Step 4:** Collect Actions
   - Aggregates `midnightActions` from Midnight
   - Aggregates `crimsonActions` from Crimson

5. **Step 5:** Score with Burnt
   - Calls `/api/llm/burnt/score` internally
   - Passes all actions and full context (audit, midnight, crimson)
   - Returns prioritized actions

**Error Handling:**
- Each step continues even if previous steps fail
- Partial results are returned if some steps fail
- Errors are logged but don't stop orchestration

---

## Chained Flow Architecture

### Client-Side Chaining Utilities

**File:** `lib/adminFlows.ts`

**Purpose:** Client-side functions for chaining multiple API calls sequentially

**Available Functions:**

1. **`runAuditToCrimson(url, goal, tonePreset?)`**
   - Runs Audit → Crimson
   - Passes audit results as `optionalAuditContext` to Crimson

2. **`runAuditToMidnight(url, mode)`**
   - Runs Audit → Midnight
   - Passes audit results as `optionalAuditContext` to Midnight

3. **`runAuditToBurnt(url)`**
   - Runs Audit → Burnt Orchestration
   - Uses orchestrate endpoint with audit context

4. **`runCrimsonToMidnight(url, goal, tonePreset?, crimsonContext?)`**
   - Runs Crimson → Midnight
   - Passes crimson results as context to Midnight

5. **`runCrimsonToBurnt(url, goal, tonePreset?, crimsonContext?)`**
   - Runs Crimson → Burnt Scoring
   - Scores crimsonActions with Burnt

6. **`runMidnightToCrimson(url, mode, goal, tonePreset?, midnightContext?)`**
   - Runs Midnight → Crimson
   - Passes midnight results as context to Crimson

7. **`runMidnightToBurnt(url, mode, midnightContext?)`**
   - Runs Midnight → Burnt Scoring
   - Scores midnightActions with Burnt

8. **`runBurntOrchestrate(url)`**
   - Runs full orchestration (Audit → Midnight → Crimson → Burnt)
   - Uses orchestrate endpoint with all flags enabled

**Error Handling:**
- Each function throws errors if API calls fail
- Errors are caught and displayed in the admin dashboard modal

---

## Data Flow Diagrams

### Standalone Audit Flow

```
User → /admin/audit
  ↓
Enter URL
  ↓
POST /api/audit
  ↓
Stage 1: processStage1Sync (fetch & parse)
  ↓
Stage 2: processStage2Sync (scoring)
  ↓
Stage 3: processStage3Sync (AI analysis)
  ↓
Return AuditResults
  ↓
Display scores (SEO, Title, Media, AI)
```

### Standalone Crimson Flow

```
User → /admin/crimson
  ↓
Enter URL, Goal, Tone Preset
  ↓
POST /api/llm/crimson
  ↓
runCrimson() → OpenAI API
  ↓
Parse JSON response
  ↓
Return: contentEdits, ctaSuggestions, crimsonActions
  ↓
Display results
```

### Standalone Midnight Flow

```
User → /admin/midnight
  ↓
Enter URL, Select Mode
  ↓
POST /api/llm/midnight
  ↓
runMidnight() → OpenAI API
  ↓
If mode === 'route_to_crimson':
  → runCrimson() internally
  ↓
Parse JSON response
  ↓
Return: structureRecommendations, midnightActions, optionalCrimsonArtifacts
  ↓
Display results
```

### Chained Flow: Audit → Crimson

```
User → /admin (click "Run Audit → Crimson")
  ↓
Modal opens: Enter URL, Goal, Tone Preset
  ↓
runAuditToCrimson()
  ↓
Step 1: POST /api/audit → Get auditResults
  ↓
Step 2: POST /api/llm/crimson with optionalAuditContext: auditResults
  ↓
Return: { audit, crimson }
  ↓
Display combined results
```

### Chained Flow: Crimson → Midnight

```
User → /admin (click "Crimson → Midnight")
  ↓
Modal opens: Enter URL, Goal, Tone Preset
  ↓
runCrimsonToMidnight()
  ↓
Step 1: POST /api/llm/crimson → Get crimsonResults
  ↓
Step 2: POST /api/llm/midnight with optionalAuditContext: { crimson: crimsonResults }
  ↓
Return: { crimson, midnight }
  ↓
Display combined results
```

### Burnt Orchestration Flow

```
User → /admin/burnt (Full Run tab)
  ↓
Enter URL, Select steps (Audit, Midnight, Crimson)
  ↓
POST /api/llm/burnt/orchestrate
  ↓
Step 1 (if runAudit): POST /api/audit → auditContext
  ↓
Step 2 (if runMidnight): POST /api/llm/midnight with auditContext → midnightContext
  ↓
Step 3 (if runCrimson): POST /api/llm/crimson with context → crimsonContext
  ↓
Step 4: Collect allActions from midnightActions + crimsonActions
  ↓
Step 5: POST /api/llm/burnt/score with allActions + full context
  ↓
Return: { audit?, midnight?, crimson?, burnt }
  ↓
Display all results + prioritized actions
```

---

## Context Passing

### Audit Context
- **Format:** Full `AuditResults` object
- **Passed to:** Crimson, Midnight (as `optionalAuditContext`)
- **Contains:** SEO scores, title scores, media scores, AI scores, metrics

### Crimson Context
- **Format:** `CrimsonAPIResponse` object
- **Passed to:** Midnight (wrapped in object: `{ crimson: crimsonResults }`)
- **Contains:** contentEdits, ctaSuggestions, crimsonActions

### Midnight Context
- **Format:** `MidnightAPIResponse` object
- **Passed to:** Crimson (wrapped in object: `{ midnight: midnightResults }`)
- **Contains:** structureRecommendations, midnightActions

### Full Context (for Burnt)
- **Format:** Object with all contexts
```typescript
{
  audit?: AuditResults;
  midnight?: MidnightAPIResponse;
  crimson?: CrimsonAPIResponse;
}
```

---

## Authentication & Authorization

**All LLM endpoints require:**
- Admin authentication via `requireAdmin()` from `lib/auth.ts`
- Checks Supabase user metadata: `user.user_metadata?.role === "ADMIN"`
- Also verifies in Prisma User table

**Audit endpoint:**
- No authentication required (public endpoint)
- Used by both public homepage and admin pages

---

## Timeouts

| Component | Client Timeout | Server Timeout |
|-----------|---------------|----------------|
| Audit | 30s | 25s |
| Crimson | 35s | 30s |
| Midnight | 35s | 30s |
| Burnt Score | 30s | 25s |
| Burnt Orchestrate | 120s | 120s |

---

## Error Handling

**Client-Side:**
- AbortController for request cancellation
- Timeout handling with user-friendly messages
- Error state display in UI
- Graceful degradation (partial results if some steps fail)

**Server-Side:**
- Try-catch blocks around all API calls
- Timeout handling with AbortController
- Error logging to console
- Appropriate HTTP status codes (400, 401, 403, 500, 504)

**Orchestration:**
- Continues even if individual steps fail
- Returns partial results
- Logs errors but doesn't stop execution

---

## File Structure

```
app/
  admin/
    page.tsx              # Main dashboard with 4-card grid
    audit/
      page.tsx           # Standalone audit page
    crimson/
      page.tsx           # Standalone crimson page
    midnight/
      page.tsx           # Standalone midnight page
    burnt/
      page.tsx           # Standalone burnt page (2 tabs)

  api/
    audit/
      route.ts           # Audit API endpoint
    llm/
      crimson/
        route.ts         # Crimson API endpoint
      midnight/
        route.ts         # Midnight API endpoint
      burnt/
        score/
          route.ts       # Burnt scoring API endpoint
        orchestrate/
          route.ts       # Burnt orchestration API endpoint

lib/
  adminFlows.ts          # Client-side chaining utilities
  llms/
    runCrimson.ts        # Crimson LLM execution
    runMidnight.ts       # Midnight LLM execution
    runBurnt.ts          # Burnt LLM execution
    types.ts             # Shared TypeScript types
    registry.ts          # LLM configuration registry
  auditStagesSync.ts     # Synchronous audit processing
  auth.ts                # Authentication utilities
```

---

## Summary

The Tri-Two system provides a comprehensive SEO analysis and optimization platform with:

1. **Four independent components** that can run standalone
2. **Flexible chaining** via client-side utilities and server-side orchestration
3. **Context passing** between components for informed decision-making
4. **Action prioritization** through Burnt's scoring system
5. **Admin-only access** for LLM components, public access for Audit
6. **Robust error handling** and timeout management
7. **Unified dashboard** for easy access to all components and flows

