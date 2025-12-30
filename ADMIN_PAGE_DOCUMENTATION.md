# Admin Page Documentation

## Overview

The Admin Page (`/admin`) is a centralized dashboard for accessing the four core SEO tools: Audit, Crimson, Midnight, and Burnt. It provides a clean, simple interface matching the design mock with direct navigation to each tool and preserved flow functionality.

## Access Control

### Authentication
- **Admin Email**: `mgr@tri-two.com`
- **Auth Method**: Email-based check (`user.email === 'mgr@tri-two.com'`)
- **Non-Admin Behavior**: Automatic redirect to home page (`/`)
- **Unauthenticated Behavior**: Automatic redirect to login page (`/login`)

### Protection Layers
1. **Middleware** (`middleware.ts`): Server-side route protection for all `/admin/*` paths
2. **Page-Level Check**: Client-side verification in each admin page component
3. **API Routes**: Server-side `requireAdmin()` function in `lib/auth.ts`

## Design

### Visual Design
- **Background**: Dark gradient from `#0b0f1a` to `#05070d` with wave overlay
- **Layout**: 4 centered tiles in a horizontal row
- **Title**: "ADMIN PAGE" displayed at the top center
- **Wave Overlay**: Teal/blue topographic lines and grid pattern with subtle opacity

### Tile Specifications

| Tool | Color | Subtitle | Path |
|------|-------|----------|------|
| **Audit** | `#f5c451` (Yellow-orange) | SEO Scorer | `/admin/audit` |
| **Crimson** | `#e4572e` (Reddish-orange) | Content Engine | `/admin/crimson` |
| **Midnight** | `#7bd389` (Light green) | Decision Engine | `/admin/midnight` |
| **Burnt** | `#f29e4c` (Orange-brown) | Prioritization | `/admin/burnt` |

### Tile Behavior
- **Primary Action (Click)**: Navigates to the tool's dedicated page
- **Secondary Action (Right-click)**: Opens flow modal for chained operations
- **Hover Effect**: Slight scale-up animation (`hover:scale-105`)
- **Visual Feedback**: Box shadow and border styling

## Features

### Direct Tool Access
Each tile provides immediate access to its corresponding tool:
- Clicking a tile navigates to the tool's standalone page
- Each tool page has its own interface for running operations

### Flow Functionality
Chained operations are accessible via right-click on tiles:

**Available Flows:**
- **Audit → Crimson**: Run audit, then optimize content
- **Audit → Midnight**: Run audit, then analyze structure
- **Audit → Burnt**: Run audit, then prioritize actions
- **Crimson → Midnight**: Generate content, then analyze structure
- **Crimson → Burnt**: Generate content, then prioritize
- **Midnight → Crimson**: Analyze structure, then optimize content
- **Midnight → Burnt**: Analyze structure, then prioritize
- **Burnt Orchestrate**: Full orchestration (Audit → Midnight → Crimson → Burnt)

**Flow Modal:**
- Opens on right-click when tile has available flows
- Requires URL input (always)
- May require Goal input (for Crimson flows)
- May require Mode selection (for Midnight flows)
- Optional Tone Preset for content generation
- Shows loading state and error handling
- Displays results in JSON format

## Technical Implementation

### File Location
- **Path**: `app/(tools)/admin/page.tsx`
- **Route Group**: `(tools)` - inherits charcoal background layout
- **Override**: Admin page overrides background with dark gradient + wave

### Key Components

#### State Management
```typescript
- loading: boolean - Initial auth check state
- isAdmin: boolean - Admin status flag
- activeFlow: string | null - Currently active flow modal
- urlInput, goalInput, tonePresetInput, modeInput - Flow form inputs
- flowLoading, flowError, flowResults - Flow execution state
```

#### Functions
- `checkAdminAccess()`: Verifies user email matches admin requirement
- `handleTileClick()`: Primary navigation handler
- `handleTileRightClick()`: Opens flow modal for chained operations
- `handleChainFlow()`: Executes chained flow via `lib/adminFlows.ts`
- `openFlowModal()` / `closeFlowModal()`: Modal state management

### Dependencies
- **Navigation**: `next/navigation` (useRouter)
- **Auth**: `@/lib/supabase/client` (createClient)
- **Flows**: `@/lib/adminFlows` (all flow functions)
- **Layout**: Inherits from `app/(tools)/layout.tsx` (Header with BrandLogo and HamburgerMenu)

## Admin Unlock Behavior

### Report Page Unlock
When admin users run audits (from admin or public flow), they see fully unlocked reports:

**Components:**
- `app/(tools)/report/PaywallBlur.tsx`: Checks `user.email === 'mgr@tri-two.com'`
- `app/(tools)/report/ScoreBlur.tsx`: Checks `user.email === 'mgr@tri-two.com'`

**Behavior:**
- Admin users: No blur, full access to all report sections
- Public users: Paywall blur remains active on locked sections
- Authentication check: Runs client-side on component mount

## Tool Pages

### Audit (`/admin/audit`)
- **Purpose**: Baseline SEO diagnostics and scoring
- **Input**: URL (required)
- **Output**: SEO scores, title/media/AI metrics, actionable recommendations
- **API**: `POST /api/audit` (public endpoint)

### Crimson (`/admin/crimson`)
- **Purpose**: Content creation and optimization
- **Input**: URL, Goal (required), Tone Preset (optional)
- **Output**: Content edits, CTA suggestions, action items
- **API**: `POST /api/llm/crimson` (admin-only)

### Midnight (`/admin/midnight`)
- **Purpose**: Homepage structure and decision routing
- **Input**: URL, Mode (homepage_edit | route_to_crimson)
- **Output**: Structure recommendations, routing decisions
- **API**: `POST /api/llm/midnight` (admin-only)

### Burnt (`/admin/burnt`)
- **Purpose**: Action prioritization and orchestration
- **Input**: Actions array (for scoring) OR URL + flow options (for orchestration)
- **Output**: Prioritized actions with Burnt scores, priority bands
- **API**: 
  - `POST /api/llm/burnt/score` (admin-only)
  - `POST /api/llm/burnt/orchestrate` (admin-only)

## Flow Library

All flow functions are defined in `lib/adminFlows.ts`:

```typescript
- runAuditToCrimson(url, goal, tonePreset?)
- runAuditToMidnight(url, mode)
- runAuditToBurnt(url)
- runCrimsonToMidnight(url, goal, tonePreset?)
- runCrimsonToBurnt(url, goal, tonePreset?)
- runMidnightToCrimson(url, mode, goal, tonePreset?)
- runMidnightToBurnt(url, mode)
- runBurntOrchestrate(url)
```

**Flow Behavior:**
- Each flow executes tools in sequence
- Context is passed between steps (audit results → midnight/crimson, etc.)
- Partial results allowed (if one step fails, others can still complete)
- Results aggregated and returned as single response

## Error Handling

### Authentication Errors
- **Not logged in**: Redirect to `/login` with redirect parameter
- **Not admin**: Redirect to `/` (home page)
- **Auth check failure**: Redirect to `/login`

### Flow Execution Errors
- **Missing URL**: Error message in modal
- **Missing required fields**: Validation error (e.g., Goal for Crimson)
- **API errors**: Displayed in modal with status code and preview
- **JSON parse errors**: Content-type check prevents HTML response parsing

### Network Errors
- **Timeout**: 30 seconds for individual tools, 2 minutes for orchestration
- **Connection errors**: Friendly error messages with retry option

## User Experience

### Admin User Journey
1. Navigate to `/admin`
2. See 4 colored tiles with tool names and subtitles
3. Click tile → Navigate to tool page → Run operation
4. OR Right-click tile → Open flow modal → Configure and run chained flow
5. View results (unlocked for admin)

### Public User Journey
1. Navigate to `/admin`
2. Automatically redirected to `/` (home page)
3. No access to admin features

## Security Considerations

### Email-Based Auth
- **Pros**: Simple, explicit, easy to verify
- **Cons**: Requires email to be set correctly in Supabase
- **Note**: Email check is performed at multiple layers (middleware, page, API)

### Route Protection
- **Middleware**: First line of defense, runs before page render
- **Page Check**: Client-side verification, prevents unauthorized UI rendering
- **API Check**: Server-side validation for all LLM endpoints

### Admin Unlock
- **Scope**: Only affects report page visibility
- **Public Behavior**: Unchanged - paywall remains for non-admin users
- **Admin Benefit**: Can validate full output without payment

## Maintenance Notes

### Adding New Tools
1. Add tile to `tiles` array in `app/(tools)/admin/page.tsx`
2. Create tool page at `app/(tools)/admin/{tool-name}/page.tsx`
3. Add auth check matching email pattern
4. Create API route if needed (admin-only endpoints in `app/api/llm/`)

### Modifying Auth
- Update `middleware.ts` for route protection
- Update `lib/auth.ts` for API protection
- Update all admin page components
- Update PaywallBlur and ScoreBlur for unlock behavior

### Design Changes
- Background gradient: Inline style on main container
- Wave overlay: SVG elements in absolute positioned div
- Tile colors: Defined in `tiles` array `color` property
- Layout: Flexbox with centered alignment

## Testing Checklist

- [ ] Admin user (mgr@tri-two.com) can access `/admin`
- [ ] Non-admin user redirected from `/admin`
- [ ] Unauthenticated user redirected to login
- [ ] All 4 tiles render with correct colors
- [ ] Clicking tiles navigates to correct tool pages
- [ ] Right-click opens flow modal (where applicable)
- [ ] Flow modal accepts inputs and executes flows
- [ ] Admin sees unlocked reports
- [ ] Public users see paywalled reports
- [ ] Background gradient and wave overlay render correctly
- [ ] Responsive design works on mobile/tablet

## Related Files

- `app/(tools)/admin/page.tsx` - Main admin dashboard
- `app/(tools)/admin/audit/page.tsx` - Audit tool page
- `app/(tools)/admin/crimson/page.tsx` - Crimson tool page
- `app/(tools)/admin/midnight/page.tsx` - Midnight tool page
- `app/(tools)/admin/burnt/page.tsx` - Burnt tool page
- `lib/adminFlows.ts` - Flow execution functions
- `lib/auth.ts` - Authentication helpers
- `middleware.ts` - Route protection
- `app/(tools)/report/PaywallBlur.tsx` - Paywall component
- `app/(tools)/report/ScoreBlur.tsx` - Score blur component

## Version History

- **v2.0** (Current): Email-based auth, mock design match, flow preservation
- **v1.0**: Role-based auth, complex card grid with multiple buttons

---

**Last Updated**: 2025-01-15  
**Maintainer**: Development Team  
**Status**: Production Ready

