# SEO Grader v3 - Scoring Directory

Complete directory of all scoring components, metrics, and evaluation criteria used in the SEO audit system.

---

## Overview

The SEO Grader evaluates websites across **4 main scoring categories**:

1. **Title Score** (100 points) - Weight: 45% of overall SEO score
2. **Media Score** (100 points) - Weight: 20% of overall SEO score
3. **Technical Score** (100 points) - Weight: 35% of overall SEO score
4. **AI Score** (100 points) - Informational only (not included in overall SEO score)

**Overall SEO Score Calculation:**
```
SEO Score = (Title Score × 0.45) + (Media Score × 0.20) + (Technical Score × 0.35)
```

**Status Thresholds:**
- **good**: ≥80 points
- **warn**: 50-79 points
- **bad**: <50 points

---

## 1. Title Score (100 points)

**Weight in Overall SEO Score:** 45%

### Components

#### 1.1 Locality (25 points)
**Purpose:** Evaluates if the title contains location information for local SEO.

**Scoring:**
- **25 points:** State name or abbreviation found in title
- **10 points (40%):** State name found in body only (not in title)
- **0 points:** No locality found

**Detection:**
- Checks for all 50 US states (full name and abbreviation)
- Examples: "California", "CA", "New York", "NY"

**Configuration:**
- Weight: 25 points
- Partial credit: 40% if found in body only

---

#### 1.2 Service Keywords (25 points)
**Purpose:** Evaluates if the title contains relevant service-related keywords.

**Scoring:**
- **25 points:** Strong service keyword found in title
- **10 points (40%):** Weak service keyword found in title
- **0 points:** No service keyword found

**Strong Service Keywords:**
- roofing, roofer, remodeling, remodeler
- contractor, construction, builder
- plumbing, plumber
- hvac, heating, cooling, air conditioning
- electrician, siding, windows
- kitchen, bathroom, bath
- home improvement

**Weak Service Keywords:**
- services, company, solutions, experts, team

**Configuration:**
- Weight: 25 points
- Partial credit: 40% for weak keywords

---

#### 1.3 Semantic Overlap (20 points)
**Purpose:** Evaluates how well the title matches the body content semantically.

**Scoring:**
- **20 points:** 1+ exact keyword matches between title and body
- **10 points (50%):** 1+ fuzzy/stem matches (first 4 characters)
- **0 points:** No semantic overlap

**Detection:**
- Extracts top 10 keywords from body (excluding stopwords)
- Compares title against body keywords
- Exact match: Full keyword found in title
- Fuzzy match: First 4 characters of keyword found in title

**Configuration:**
- Weight: 20 points
- Minimum exact overlap: 1 keyword
- Minimum fuzzy overlap: 1 keyword
- Partial credit: 50% for fuzzy matches

---

#### 1.4 Length (15 points)
**Purpose:** Evaluates if title length is optimal for search engines and display.

**Scoring:**
- **15 points:** Ideal length (30-65 characters)
- **5 points (33%):** Acceptable length (20-29 or 66-75 characters)
- **0 points:** Too short (<20) or too long (>75)

**Length Ranges:**
- Ideal: 30-65 characters
- Soft min: 20 characters
- Soft max: 75 characters

**Configuration:**
- Weight: 15 points
- Ideal range: 30-65 characters
- Acceptable range: 20-75 characters
- Partial credit: 33% for acceptable range

---

#### 1.5 Separators (10 points)
**Purpose:** Evaluates if title uses proper structural separators.

**Scoring:**
- **10 points:** Contains separator (|, -, or –)
- **0 points:** No separator

**Valid Separators:**
- Pipe: `|`
- Hyphen: `-`
- En dash: `–`

**Configuration:**
- Weight: 10 points
- Separators: `["|", "-", "–"]`

---

#### 1.6 Presence (5 points)
**Purpose:** Basic check that title tag exists.

**Scoring:**
- **5 points:** Title tag exists and has content
- **0 points:** No title tag or empty

**Configuration:**
- Weight: 5 points

---

### Title Score Summary

| Component | Points | Weight % |
|-----------|--------|----------|
| Locality | 25 | 25% |
| Service Keywords | 25 | 25% |
| Semantic Overlap | 20 | 20% |
| Length | 15 | 15% |
| Separators | 10 | 10% |
| Presence | 5 | 5% |
| **Total** | **100** | **100%** |

---

## 2. Media Score (100 points)

**Weight in Overall SEO Score:** 20%

### Components

#### 2.1 Alt Text Coverage (40 points)
**Purpose:** Evaluates accessibility and image SEO through alt text.

**Scoring:**
- **40 points:** ≥90% of images have alt text
- **20 points (50%):** 50-89% of images have alt text
- **10 points (25%):** No images on page
- **0 points:** <50% of images have alt text

**Calculation:**
```
Coverage = imagesWithAlt / totalImages
```

**Configuration:**
- Weight: 40 points
- Green threshold: 90% (0.9)
- Yellow threshold: 50% (0.5)
- Partial credit: 50% for yellow, 25% if no images

---

#### 2.2 Filename Quality (30 points)
**Purpose:** Evaluates if image filenames are descriptive (not auto-generated).

**Scoring:**
- **30 points:** All filenames are descriptive (0% bad filenames)
- **15 points (50%):** ≤30% bad filenames
- **7.5 points (25%):** No images on page
- **0 points:** >30% bad filenames

**Bad Filename Detection:**
- Auto-generated prefixes: `img`, `dsc`, `pxl`, `image`, `photo`, `screenshot`
- Numeric-only: `12345.jpg`, `2024-01-01.jpg`
- Generic: `image.jpg`, `image1.jpg`

**Configuration:**
- Weight: 30 points
- Yellow threshold: ≤30% bad filenames
- Partial credit: 50% for yellow, 25% if no images

---

#### 2.3 Metadata (20 points)
**Purpose:** Evaluates Open Graph metadata for social sharing.

**Scoring:**
- **20 points:** Both OG title and OG description present
- **10 points (50%):** One of OG title or OG description present
- **0 points:** No OG metadata

**Detection:**
- `<meta property="og:title">`
- `<meta property="og:description">`

**Configuration:**
- Weight: 20 points
- Partial credit: 50% if only one present

---

#### 2.4 Image Count (10 points)
**Purpose:** Evaluates if page has sufficient visual content.

**Scoring:**
- **10 points:** ≥3 images
- **5 points (50%):** 1-2 images
- **0 points:** No images

**Configuration:**
- Weight: 10 points
- Green minimum: 3 images
- Yellow minimum: 1 image
- Partial credit: 50% for yellow

---

### Media Score Summary

| Component | Points | Weight % |
|-----------|--------|----------|
| Alt Text Coverage | 40 | 40% |
| Filename Quality | 30 | 30% |
| Metadata | 20 | 20% |
| Image Count | 10 | 10% |
| **Total** | **100** | **100%** |

---

## 3. Technical Score (100 points)

**Weight in Overall SEO Score:** 35%

### Components

#### 3.1 H1 Tags (25 points)
**Purpose:** Evaluates proper heading structure.

**Scoring:**
- **25 points:** Exactly 1 H1 tag
- **12 points (48%):** Multiple H1 tags (>1)
- **0 points:** No H1 tags

**Best Practice:** One H1 per page for clear hierarchy.

---

#### 3.2 Word Count (20 points)
**Purpose:** Evaluates content depth and comprehensiveness.

**Scoring:**
- **20 points:** ≥400 words
- **10 points (50%):** 200-399 words
- **0 points:** <200 words

**Best Practice:** 400+ words for comprehensive content.

---

#### 3.3 Canonical Tag (15 points)
**Purpose:** Evaluates duplicate content prevention.

**Scoring:**
- **15 points:** Canonical tag present
- **0 points:** No canonical tag

**Detection:**
- `<link rel="canonical" href="...">`

---

#### 3.4 Robots.txt (15 points)
**Purpose:** Evaluates crawl directive file.

**Scoring:**
- **15 points:** robots.txt found and accessible
- **0 points:** robots.txt not found or inaccessible

**Detection:**
- Fetches `/robots.txt`
- Checks HTTP status < 400

---

#### 3.5 Sitemap.xml (15 points)
**Purpose:** Evaluates XML sitemap for search engine discovery.

**Scoring:**
- **15 points:** sitemap.xml found and accessible
- **0 points:** sitemap.xml not found or inaccessible

**Detection:**
- Fetches `/sitemap.xml`
- Checks HTTP status < 400

---

#### 3.6 Meta Description (10 points)
**Purpose:** Evaluates search result snippet optimization.

**Scoring:**
- **10 points:** Meta description present
- **0 points:** Meta description missing

**Detection:**
- `<meta name="description" content="...">`

---

### Technical Score Summary

| Component | Points | Weight % |
|-----------|--------|----------|
| H1 Tags | 25 | 25% |
| Word Count | 20 | 20% |
| Canonical Tag | 15 | 15% |
| Robots.txt | 15 | 15% |
| Sitemap.xml | 15 | 15% |
| Meta Description | 10 | 10% |
| **Total** | **100** | **100%** |

---

## 4. AI Score (100 points)

**Informational Only** - Not included in overall SEO score calculation.

### Components

#### 4.1 Structured Answer Readiness (0-25 points)
**Purpose:** Evaluates if content is structured for AI extraction and featured snippets.

**Scoring:**
- **25 points:** FAQ format OR (Q&A pattern + definition blocks)
- **15 points:** (Q&A OR definitions OR step-by-step) + list structure
- **10 points:** List structure OR headings (≥3)
- **5 points:** Default minimum

**Detection:**
- FAQ patterns: `/faq|frequently asked|questions? and answers?/i`
- Q&A patterns: `/(?:^|\n)\s*[Qq]:|question:|answer:|a:/m`
- Definition blocks: `/(?:^|\n)\s*(?:what is|definition|means?|refers to)/i`
- Step-by-step: `/(?:^|\n)\s*(?:step \d+|first|second|third|then|next|finally)/i`
- List structure: `doc.querySelectorAll("ol, ul").length > 2`
- Headings: `doc.querySelectorAll("h1, h2, h3, h4, h5, h6").length >= 3`

---

#### 4.2 Entity Clarity (0-20 points)
**Purpose:** Evaluates semantic clarity and entity density for AI understanding.

**Scoring:**
- **20 points:** Consistent naming + ≥5 entity terms + supporting entities
- **14 points:** Consistent naming + ≥3 entity terms
- **8 points:** Consistent naming OR ≥2 entity terms
- **4 points:** Default minimum

**Detection:**
- Primary entity: H1 tag content
- Supporting entities: `/location|address|city|state|phone|email|contact|about|services?|products?/i`
- Entity terms: Count of `company|business|service|product|location|address|contact` in body
- Consistent naming: H1 exists and has content

---

#### 4.3 Extraction Readiness (0-20 points)
**Purpose:** Evaluates how easily AI can extract structured information.

**Scoring:**
- **20 points:** Modular structure + short paragraphs + ≥3 lists
- **14 points:** Modular structure + short paragraphs
- **8 points:** Modular structure OR (≥1 list + ≥3 headings)
- **4 points:** Default minimum

**Detection:**
- Lists: `doc.querySelectorAll("ul, ol").length`
- Tables: `doc.querySelectorAll("table").length`
- Headings: `doc.querySelectorAll("h1, h2, h3, h4, h5, h6").length`
- Paragraphs: `doc.querySelectorAll("p").length`
- Average paragraph length: `bodyText.length / paragraphs`
- Short paragraphs: Average < 500 characters
- Modular structure: (lists ≥ 2 OR tables ≥ 1 OR headings ≥ 4)

---

#### 4.4 Context Completeness (0-15 points)
**Purpose:** Evaluates if content answers key questions (What, Why, How, Who, When, Pitfalls).

**Scoring:**
- **15 points:** 5-6 context types present
- **11 points:** 4 context types present
- **7 points:** 3 context types present
- **4 points:** 2 context types present
- **2 points:** Default minimum

**Detection:**
- What: `/(?:what|definition|is|are|means?)/i`
- Why: `/(?:why|benefits?|advantages?|importance|matters?)/i`
- How: `/(?:how|process|steps?|procedure|method)/i`
- Who: `/(?:who|for|target|audience|customers?|clients?)/i`
- When: `/(?:when|time|schedule|duration|timing)/i`
- Pitfalls: `/(?:avoid|prevent|common (?:mistakes?|issues?|problems?)|pitfalls?)/i`

---

#### 4.5 Trust Signals (0-10 points)
**Purpose:** Evaluates credibility indicators for AI systems.

**Scoring:**
- **10 points:** 5-6 trust signals present
- **7 points:** 4 trust signals present
- **5 points:** 3 trust signals present
- **3 points:** 2 trust signals present
- **1 point:** Default minimum

**Detection:**
- Author: `/(?:author|written by|by [A-Z])/i` OR `<meta name="author">`
- About link: Links containing "about|contact|company" in text or href
- Citations: `/(?:source|reference|citation|according to|studies?|research)/i`
- Updated date: `/(?:updated|last modified|published|date)/i` OR article meta tags
- Contact info: `/(?:phone|email|address|contact|call|@)/i`
- Brand entity: `<meta property="og:site_name">` OR `<meta name="application-name">`

---

#### 4.6 Machine Readability (0-10 points)
**Purpose:** Evaluates HTML structure quality for AI parsing.

**Scoring:**
- **10 points:** Heading hierarchy + semantic HTML + schema + no duplicate IDs + no hidden text tricks
- **7 points:** Heading hierarchy + semantic HTML + no duplicate IDs
- **5 points:** Heading hierarchy OR semantic HTML
- **3 points:** Default minimum

**Detection:**
- Heading hierarchy: H1 exists AND H2 exists
- Semantic HTML: `doc.querySelector("main, article, section, nav, header, footer")`
- Schema: FAQ schema OR Article schema
- Duplicate IDs: Check for duplicate `id` attributes
- Hidden text: Count of `[style*="display:none"], [style*="visibility:hidden"], .hidden, [hidden]`
- Hidden text tricks: >2 hidden elements

---

### AI Score Summary

| Component | Points | Range |
|-----------|--------|-------|
| Structured Answer Readiness | 0-25 | 25% |
| Entity Clarity | 0-20 | 20% |
| Extraction Readiness | 0-20 | 20% |
| Context Completeness | 0-15 | 15% |
| Trust Signals | 0-10 | 10% |
| Machine Readability | 0-10 | 10% |
| **Total** | **0-100** | **100%** |

---

## Overall Score Calculation

### Formula

```
Overall SEO Score = (Title Score × 0.45) + (Media Score × 0.20) + (Technical Score × 0.35)
```

### Weight Distribution

| Score Type | Weight | Contribution |
|------------|--------|--------------|
| Title Score | 45% | 0-45 points |
| Media Score | 20% | 0-20 points |
| Technical Score | 35% | 0-35 points |
| **Total** | **100%** | **0-100 points** |

### Status Determination

- **good**: Overall SEO Score ≥ 80
- **warn**: Overall SEO Score 50-79
- **bad**: Overall SEO Score < 50

---

## Additional Metrics Tracked

### Content Metrics
- **Word Count:** Total words in body text
- **H1 Count:** Number of H1 tags
- **H1 Texts:** Array of H1 tag contents
- **Meta Description Word Count:** Words in meta description

### Technical Metrics
- **Favicon:** Boolean - favicon present
- **Canonical Tag:** String - canonical URL or "Missing"
- **Robots.txt Found:** Boolean - robots.txt accessible
- **Sitemap.xml Found:** Boolean - sitemap.xml accessible
- **Page Load Status:** HTTP status code (200 = OK)

### Media Metrics
- **Total Images:** Count of `<img>` tags
- **Images With Alt:** Count of images with non-empty alt text
- **Bad Filename Count:** Count of auto-generated/numeric filenames
- **OG Title Present:** Boolean
- **OG Description Present:** Boolean
- **Alt Coverage:** String - "X/Y images have alt text" or "No images"

### AI Metrics (Detailed Breakdown)
- **structuredAnswers:** 0-25 points
- **entityClarity:** 0-20 points
- **extractionReadiness:** 0-20 points
- **contextCompleteness:** 0-15 points
- **trustSignals:** 0-10 points
- **machineReadability:** 0-10 points

---

## Configuration File

All scoring weights and thresholds are configurable via `lib/scoring-config.json`:

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
    "serviceKeywordsWeak": [ ... ],
    "semantic": { ... },
    "structure": { ... }
  },
  "media": {
    "weights": { ... },
    "altCoverageThresholds": { ... },
    "badFilenameYellowMaxRatio": 0.3,
    "imageCount": { ... }
  }
}
```

---

## Scoring Files

- **`lib/scoring.ts`** - Core scoring algorithms
- **`lib/scoring-config.json`** - Configuration and weights
- **`lib/auditStagesSync.ts`** - Stage 2 (scoring) and Stage 3 (AI) processing

---

## Summary

The SEO Grader evaluates **22 distinct components** across 4 scoring categories:

1. **Title Score:** 6 components (locality, service keywords, semantic, length, separator, presence)
2. **Media Score:** 4 components (alt coverage, filename quality, metadata, image count)
3. **Technical Score:** 6 components (H1, word count, canonical, robots.txt, sitemap.xml, meta description)
4. **AI Score:** 6 components (structured answers, entity clarity, extraction, context, trust, readability)

All components are weighted and combined to produce a comprehensive SEO assessment from 0-100 points.

