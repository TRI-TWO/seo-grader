import { JSDOM } from "jsdom";
import { scoreTitle, scoreMedia, type TitleMetrics, type MediaMetrics, type ScoringConfig } from "./scoring";
import scoringConfig from "./scoring-config.json";

const FETCH_TIMEOUT = 5000;
const AI_ANALYSIS_TIMEOUT = 8000;
const ROBOTS_FETCH_TIMEOUT = 3000;

const BROWSER_HEADER_PROFILE_A = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};

const BROWSER_HEADER_PROFILE_B = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};

export type AuditResults = {
  url?: string;
  finalUrl?: string;
  status?: number;
  contentType?: string | null;
  html?: string;
  robotsTxt?: string | null;
  robotsStatus?: number | null;
  sitemapXml?: string | null;
  sitemapStatus?: number | null;
  titleTag?: string;
  metaDescription?: string;
  metaDescriptionWordCount?: number;
  h1Count?: number;
  h1Texts?: string[];
  wordCount?: number;
  favicon?: boolean;
  canonicalTag?: string;
  robotsTxtFound?: boolean;
  sitemapXmlFound?: boolean;
  altCoverage?: string;
  titleScoreRaw?: number;
  titleScore10?: number;
  titleStatus?: "good" | "warn" | "bad";
  mediaScoreRaw?: number;
  mediaScore10?: number;
  mediaStatus?: "good" | "warn" | "bad";
  technicalScore?: number;
  technicalScore10?: number;
  aiScoreRaw?: number;
  aiScore10?: number;
  aiStatus?: "good" | "warn" | "bad";
  seoScore?: number;
  mediaMetrics?: any;
  aiMetrics?: any;
  partialAudit?: boolean;
  aiOptimizationTimeout?: boolean;
};

function parseRobotsTxt(robotsTxt: string): { sitemaps: string[]; crawlAllowed: boolean } {
  const sitemaps: string[] = [];
  let crawlAllowed = true;
  if (!robotsTxt) return { sitemaps, crawlAllowed };

  const lines = robotsTxt.split("\n");
  let inUserAgentBlock = false;
  let currentUserAgent = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const lowerLine = trimmed.toLowerCase();

    if (lowerLine.startsWith("sitemap:")) {
      const sitemapUrl = trimmed.substring(8).trim();
      if (sitemapUrl) sitemaps.push(sitemapUrl);
      continue;
    }

    if (lowerLine.startsWith("user-agent:")) {
      currentUserAgent = trimmed.substring(11).trim().toLowerCase();
      inUserAgentBlock = currentUserAgent === "*" || currentUserAgent === "";
      continue;
    }

    if (inUserAgentBlock && lowerLine.startsWith("disallow:")) {
      const path = trimmed.substring(9).trim();
      if (path === "/") crawlAllowed = false;
    }
  }

  return { sitemaps, crawlAllowed };
}

export async function processStage1Sync(url: string): Promise<Partial<AuditResults>> {
  let targetUrl = url.trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = "https://" + targetUrl;
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return {
      url,
      finalUrl: targetUrl,
      status: 0,
      partialAudit: true,
    };
  }

  const origin = parsed.origin;
  let pageRes: Response | null = null;
  let html = "";
  let finalUrl = targetUrl;
  let contentType: string | null = null;
  let status = 0;
  let fetchSuccess = false;

  try {
    const controller1 = new AbortController();
    const timeoutId1 = setTimeout(() => controller1.abort(), FETCH_TIMEOUT);
    try {
      pageRes = await fetch(parsed.toString(), {
        method: "GET",
        redirect: "follow",
        headers: BROWSER_HEADER_PROFILE_A,
        cache: "no-store",
        signal: controller1.signal,
      });
      clearTimeout(timeoutId1);
      if (pageRes.ok || (pageRes.status >= 200 && pageRes.status < 500)) {
        html = await pageRes.text();
        finalUrl = pageRes.url;
        contentType = pageRes.headers.get("content-type") || null;
        status = pageRes.status;
        fetchSuccess = true;
      }
    } catch {
      clearTimeout(timeoutId1);
    }
  } catch {}

  if (!fetchSuccess) {
    try {
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), FETCH_TIMEOUT);
      try {
        pageRes = await fetch(parsed.toString(), {
          method: "GET",
          redirect: "follow",
          headers: BROWSER_HEADER_PROFILE_B,
          cache: "no-store",
          signal: controller2.signal,
        });
        clearTimeout(timeoutId2);
        if (pageRes.ok || (pageRes.status >= 200 && pageRes.status < 500)) {
          html = await pageRes.text();
          finalUrl = pageRes.url;
          contentType = pageRes.headers.get("content-type") || null;
          status = pageRes.status;
          fetchSuccess = true;
        }
      } catch {
        clearTimeout(timeoutId2);
      }
    } catch {}
  }

  let robotsTxt: string | null = null;
  let robotsStatus: number | null = null;
  let sitemapXml: string | null = null;
  let sitemapStatus: number | null = null;
  let technicalData: any = {};

  if (!fetchSuccess) {
    try {
      const robotsController = new AbortController();
      const robotsTimeoutId = setTimeout(() => robotsController.abort(), ROBOTS_FETCH_TIMEOUT);
      try {
        const robotsRes = await fetch(origin + "/robots.txt", {
          method: "GET",
          redirect: "follow",
          headers: BROWSER_HEADER_PROFILE_A,
          cache: "no-store",
          signal: robotsController.signal,
        });
        clearTimeout(robotsTimeoutId);

        robotsStatus = robotsRes.status;
        if (robotsRes.ok) {
          robotsTxt = await robotsRes.text();
          const parsedRobots = parseRobotsTxt(robotsTxt);
          technicalData = {
            robots: {
              found: true,
              crawlAllowed: parsedRobots.crawlAllowed,
            },
            sitemaps: parsedRobots.sitemaps,
          };
        }
      } catch {
        clearTimeout(robotsTimeoutId);
        robotsTxt = null;
        robotsStatus = null;
      }
    } catch {
      robotsTxt = null;
      robotsStatus = null;
    }

    return {
      url,
      finalUrl: targetUrl,
      status: 0,
      robotsTxt,
      robotsStatus,
      robotsTxtFound: robotsTxt !== null && robotsStatus !== null && robotsStatus < 400,
      sitemapXmlFound: false,
      ...(Object.keys(technicalData).length > 0 ? { technical: technicalData } : {}),
      partialAudit: true,
    };
  }

  try {
    const robotsRes = await fetch(origin + "/robots.txt", {
      method: "GET",
      redirect: "follow",
      headers: BROWSER_HEADER_PROFILE_A,
      cache: "no-store",
      signal: AbortSignal.timeout(ROBOTS_FETCH_TIMEOUT),
    });
    robotsStatus = robotsRes.status;
    if (robotsRes.ok) {
      robotsTxt = await robotsRes.text();
    }
  } catch {
    robotsTxt = null;
    robotsStatus = null;
  }

  try {
    const sitemapRes = await fetch(origin + "/sitemap.xml", {
      method: "GET",
      redirect: "follow",
      headers: BROWSER_HEADER_PROFILE_A,
      cache: "no-store",
      signal: AbortSignal.timeout(ROBOTS_FETCH_TIMEOUT),
    });
    sitemapStatus = sitemapRes.status;
    if (sitemapRes.ok) {
      sitemapXml = await sitemapRes.text();
    }
  } catch {
    sitemapXml = null;
    sitemapStatus = null;
  }

  const doc = new JSDOM(html).window.document;

  const titleEl = doc.querySelector("title");
  const titleTag = titleEl?.textContent?.trim() || "Title Tag";

  const metaDesc = doc.querySelector('meta[name="description"]');
  const metaDescription = metaDesc?.getAttribute("content") || "Missing";
  const metaDescriptionWordCount =
    metaDescription !== "Missing"
      ? metaDescription.split(/\s+/).filter(Boolean).length
      : 0;

  const h1s = Array.from(doc.querySelectorAll("h1"));
  const h1Count = h1s.length;
  const h1Texts = h1s.map((h) => h.textContent?.trim() || "");

  const bodyText = doc.body?.textContent || "";
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

  const favicon =
    doc.querySelector('link[rel="icon"]') ||
    doc.querySelector('link[rel="shortcut icon"]') ||
    doc.querySelector('link[rel="apple-touch-icon"]');
  const hasFavicon = !!favicon;

  const canonical = doc.querySelector('link[rel="canonical"]');
  const canonicalTag = canonical ? "Canonical tag detected" : "Viewport meta tag detected";

  const hasRobotsTxt = robotsTxt !== null && robotsStatus !== null && robotsStatus < 400;
  const hasSitemapXml = sitemapXml !== null && sitemapStatus !== null && sitemapStatus < 400;

  return {
    url,
    finalUrl,
    status,
    contentType,
    html,
    robotsTxt,
    robotsStatus,
    sitemapXml,
    sitemapStatus,
    titleTag,
    metaDescription,
    metaDescriptionWordCount,
    h1Count,
    h1Texts,
    wordCount,
    favicon: hasFavicon,
    canonicalTag,
    robotsTxtFound: hasRobotsTxt,
    sitemapXmlFound: hasSitemapXml,
  };
}

export async function processStage2Sync(
  stage1Results: Partial<AuditResults>,
  states: any[]
): Promise<Partial<AuditResults>> {
  try {
    const html = stage1Results.html || "";
    const doc = new JSDOM(html).window.document;

    const images = Array.from(doc.querySelectorAll("img"));
    const totalImages = images.length;
    const imagesWithAlt = images.filter(
      (img) => img.getAttribute("alt") && img.getAttribute("alt")!.trim() !== ""
    ).length;

    const autoPrefixes = ["img", "dsc", "pxl", "image", "photo", "screenshot"];
    let badFilenameCount = 0;

    images.forEach((img) => {
      const src = img.getAttribute("src") || "";
      if (!src) return;
      const filePart = src.split("?")[0].split("#")[0].split("/").pop() || "";
      if (!filePart) return;
      const lower = filePart.toLowerCase();
      const base = lower.replace(/\.[a-z0-9]+$/i, "");
      const isAutoPrefix = autoPrefixes.some((p) => base.startsWith(p));
      const isNumericOnly = /^[0-9_-]+$/.test(base);
      const isGenericImage = /^image\d*$/i.test(base);
      if (isAutoPrefix || isNumericOnly || isGenericImage) {
        badFilenameCount += 1;
      }
    });

    const ogTitle = doc.querySelector('meta[property="og:title"]');
    const ogDescription = doc.querySelector('meta[property="og:description"]');
    const ogTitlePresent = !!ogTitle;
    const ogDescriptionPresent = !!ogDescription;

    const altCoverage =
      totalImages > 0
        ? `${imagesWithAlt}/${totalImages} images have alt text`
        : "No images";

    const mediaMetrics: MediaMetrics = {
      totalImages,
      imagesWithAlt,
      badFilenameCount,
      ogTitlePresent,
      ogDescriptionPresent,
    };

    const extractKeywords = (text: string, limit = 10): string[] => {
      const STOPWORDS = new Set([
        "the", "and", "or", "but", "if", "a", "an", "to", "of", "in", "on", "for", "with", "at", "by",
        "from", "about", "as", "into", "like", "through", "after", "over", "between", "out", "against",
        "during", "without", "before", "under", "around", "among", "is", "are", "was", "were", "be",
        "been", "being", "it", "this", "that", "these", "those", "you", "your", "yours", "their", "them", "they",
      ]);

      if (!text) return [];
      const cleaned = text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOPWORDS.has(w));

      const freq: Record<string, number> = {};
      cleaned.forEach((w) => (freq[w] = (freq[w] || 0) + 1));

      return Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([word]) => word);
    };

    const title = stage1Results.titleTag === "Title Tag" ? "" : stage1Results.titleTag || "";
    const titleLower = title.toLowerCase();
    const hasTitleTag = title.length > 0;

    const bodyText = doc.body?.textContent || "";
    const bodyKeywords = extractKeywords(bodyText);

    let hasLocalityInTitle = false;
    let hasLocalityInBodyOnly = false;
    const bodyLower = bodyText.toLowerCase();

    for (const state of states) {
      const stateName = state.name.toLowerCase();
      const stateAbbr = state.abbr.toLowerCase();
      if (titleLower.includes(stateName) || titleLower.includes(stateAbbr)) {
        hasLocalityInTitle = true;
        break;
      }
      if (bodyLower.includes(stateName) || bodyLower.includes(stateAbbr)) {
        hasLocalityInBodyOnly = true;
      }
    }

    const cfg = scoringConfig as ScoringConfig;
    const hasStrongServiceKeyword = cfg.title.serviceKeywordsStrong.some(kw => titleLower.includes(kw));
    const hasWeakServiceKeyword = cfg.title.serviceKeywordsWeak.some(kw => titleLower.includes(kw));

    let semanticExactOverlapCount = 0;
    let semanticFuzzyOverlapCount = 0;

    if (bodyKeywords.length > 0) {
      bodyKeywords.forEach(kw => {
        if (titleLower.includes(kw)) {
          semanticExactOverlapCount++;
        } else {
          const kwStem = kw.substring(0, 4);
          if (titleLower.includes(kwStem)) {
            semanticFuzzyOverlapCount++;
          }
        }
      });
    }

    const titleMetrics: TitleMetrics = {
      title,
      hasTitleTag,
      bodyKeywords,
      hasLocalityInTitle,
      hasLocalityInBodyOnly,
      hasStrongServiceKeyword,
      hasWeakServiceKeyword,
      semanticExactOverlapCount,
      semanticFuzzyOverlapCount,
    };

    const titleScores = scoreTitle(titleMetrics, cfg);
    const mediaScores = scoreMedia(mediaMetrics, cfg);

    let technicalScore = 0;
    if (stage1Results.h1Count === 1) technicalScore += 25;
    else if ((stage1Results.h1Count || 0) > 1) technicalScore += 12;

    if ((stage1Results.wordCount || 0) >= 400) technicalScore += 20;
    else if ((stage1Results.wordCount || 0) >= 200) technicalScore += 10;

    if (stage1Results.canonicalTag?.includes("Canonical")) technicalScore += 15;
    if (stage1Results.robotsTxtFound) technicalScore += 15;
    if (stage1Results.sitemapXmlFound) technicalScore += 15;
    if (stage1Results.metaDescription !== "Missing") technicalScore += 10;

    technicalScore = Math.min(100, technicalScore);
    const technicalScore10 = Math.round(technicalScore / 10);

    const overallScore = Math.round(
      (titleScores.raw * 0.45) +
      (mediaScores.raw * 0.20) +
      (technicalScore * 0.35)
    );

    return {
      ...stage1Results,
      altCoverage,
      titleScoreRaw: titleScores.raw,
      titleScore10: titleScores.score10,
      titleStatus: titleScores.status,
      mediaScoreRaw: mediaScores.raw,
      mediaScore10: mediaScores.score10,
      mediaStatus: mediaScores.status,
      technicalScore,
      technicalScore10,
      seoScore: overallScore,
      mediaMetrics,
    };
  } catch {
    return {
      ...stage1Results,
      partialAudit: true,
    };
  }
}

export async function processStage3Sync(
  stage2Results: Partial<AuditResults>
): Promise<Partial<AuditResults>> {
  let aiTimeout = false;

  try {
    const html = stage2Results.html || "";
    const doc = new JSDOM(html).window.document;
    const bodyText = doc.body?.textContent || "";

    const extractAIMetrics = async (): Promise<any> => {
      return new Promise((resolve) => {
        const timeoutId = setTimeout(() => {
          aiTimeout = true;
          resolve({
            structuredAnswers: 5,
            entityClarity: 4,
            extractionReadiness: 4,
            contextCompleteness: 2,
            trustSignals: 1,
            machineReadability: 3,
          });
        }, AI_ANALYSIS_TIMEOUT);

        (async () => {
          try {
            let structuredAnswers = 0;
            const hasFAQ = /faq|frequently asked|questions? and answers?/i.test(bodyText);
            const hasQAPattern = /(?:^|\n)\s*[Qq]:|question:|answer:|a:/m.test(bodyText);
            const hasDefinitionBlocks = /(?:^|\n)\s*(?:what is|definition|means?|refers to)/i.test(bodyText);
            const hasStepByStep = /(?:^|\n)\s*(?:step \d+|first|second|third|then|next|finally)/i.test(bodyText);
            const hasListStructure = doc.querySelectorAll("ol, ul").length > 2;
            const hasHeadings = doc.querySelectorAll("h1, h2, h3, h4, h5, h6").length >= 3;

            if (hasFAQ || (hasQAPattern && hasDefinitionBlocks)) {
              structuredAnswers = 25;
            } else if ((hasQAPattern || hasDefinitionBlocks || hasStepByStep) && hasListStructure) {
              structuredAnswers = 15;
            } else if (hasListStructure || hasHeadings) {
              structuredAnswers = 10;
            } else {
              structuredAnswers = 5;
            }

            let entityClarity = 0;
            const hasPrimaryEntity = doc.querySelector("h1")?.textContent?.trim() || "";
            const hasSupportingEntities = /(?:location|address|city|state|phone|email|contact|about|services?|products?)/i.test(bodyText);
            const entityTerms = (bodyText.match(/\b(?:company|business|service|product|location|address|contact)\b/gi) || []).length;
            const hasConsistentNaming = hasPrimaryEntity.length > 0;

            if (hasConsistentNaming && entityTerms >= 5 && hasSupportingEntities) {
              entityClarity = 20;
            } else if (hasConsistentNaming && entityTerms >= 3) {
              entityClarity = 14;
            } else if (hasConsistentNaming || entityTerms >= 2) {
              entityClarity = 8;
            } else {
              entityClarity = 4;
            }

            let extractionReadiness = 0;
            const lists = doc.querySelectorAll("ul, ol").length;
            const tables = doc.querySelectorAll("table").length;
            const headings = doc.querySelectorAll("h1, h2, h3, h4, h5, h6").length;
            const paragraphs = doc.querySelectorAll("p").length;
            const avgParagraphLength = paragraphs > 0 ? bodyText.length / paragraphs : 0;
            const hasShortParagraphs = avgParagraphLength < 500;
            const hasModularStructure = lists >= 2 || tables >= 1 || headings >= 4;

            if (hasModularStructure && hasShortParagraphs && lists >= 3) {
              extractionReadiness = 20;
            } else if (hasModularStructure && hasShortParagraphs) {
              extractionReadiness = 14;
            } else if (hasModularStructure || (lists >= 1 && headings >= 3)) {
              extractionReadiness = 8;
            } else {
              extractionReadiness = 4;
            }

            let contextCompleteness = 0;
            const hasWhat = /(?:what|definition|is|are|means?)/i.test(bodyText);
            const hasWhy = /(?:why|benefits?|advantages?|importance|matters?)/i.test(bodyText);
            const hasHow = /(?:how|process|steps?|procedure|method)/i.test(bodyText);
            const hasWho = /(?:who|for|target|audience|customers?|clients?)/i.test(bodyText);
            const hasWhen = /(?:when|time|schedule|duration|timing)/i.test(bodyText);
            const hasPitfalls = /(?:avoid|prevent|common (?:mistakes?|issues?|problems?)|pitfalls?)/i.test(bodyText);

            const contextCount = [hasWhat, hasWhy, hasHow, hasWho, hasWhen, hasPitfalls].filter(Boolean).length;
            if (contextCount >= 5) {
              contextCompleteness = 15;
            } else if (contextCount >= 4) {
              contextCompleteness = 11;
            } else if (contextCount >= 3) {
              contextCompleteness = 7;
            } else if (contextCount >= 2) {
              contextCompleteness = 4;
            } else {
              contextCompleteness = 2;
            }

            let trustSignals = 0;
            const hasAuthor = /(?:author|written by|by [A-Z])/i.test(bodyText) || doc.querySelector('meta[name="author"]');
            const hasAboutLink = Array.from(doc.querySelectorAll("a")).some(a =>
              /about|contact|company/i.test(a.textContent || "") || /about|contact/i.test(a.getAttribute("href") || "")
            );
            const hasCitations = /(?:source|reference|citation|according to|studies?|research)/i.test(bodyText);
            const hasUpdatedDate = /(?:updated|last modified|published|date)/i.test(bodyText) ||
              doc.querySelector('meta[property="article:modified_time"]') ||
              doc.querySelector('meta[property="article:published_time"]');
            const hasContactInfo = /(?:phone|email|address|contact|call|@)/i.test(bodyText);
            const hasBrandEntity = doc.querySelector('meta[property="og:site_name"]') ||
              doc.querySelector('meta[name="application-name"]');

            const trustCount = [hasAuthor, hasAboutLink, hasCitations, hasUpdatedDate, hasContactInfo, hasBrandEntity].filter(Boolean).length;
            if (trustCount >= 5) {
              trustSignals = 10;
            } else if (trustCount >= 4) {
              trustSignals = 7;
            } else if (trustCount >= 3) {
              trustSignals = 5;
            } else if (trustCount >= 2) {
              trustSignals = 3;
            } else {
              trustSignals = 1;
            }

            let machineReadability = 0;
            const hasHeadingHierarchy = doc.querySelector("h1") && doc.querySelector("h2");
            const hasSemanticHTML = doc.querySelector("main, article, section, nav, header, footer");
            const hasSchemaFAQ = doc.querySelector('[itemtype*="FAQPage"], [itemtype*="Question"]');
            const hasSchemaArticle = doc.querySelector('[itemtype*="Article"], [itemtype*="BlogPosting"]');
            const hasSchema = hasSchemaFAQ || hasSchemaArticle;
            const duplicateIds = Array.from(doc.querySelectorAll("[id]")).map(el => el.id);
            const hasDuplicateIds = duplicateIds.length !== new Set(duplicateIds).size;
            const hiddenText = doc.querySelectorAll('[style*="display:none"], [style*="visibility:hidden"], .hidden, [hidden]').length;
            const hasHiddenTextTricks = hiddenText > 2;

            if (hasHeadingHierarchy && hasSemanticHTML && hasSchema && !hasDuplicateIds && !hasHiddenTextTricks) {
              machineReadability = 10;
            } else if (hasHeadingHierarchy && hasSemanticHTML && !hasDuplicateIds) {
              machineReadability = 7;
            } else if (hasHeadingHierarchy || hasSemanticHTML) {
              machineReadability = 5;
            } else {
              machineReadability = 3;
            }

            clearTimeout(timeoutId);
            resolve({
              structuredAnswers,
              entityClarity,
              extractionReadiness,
              contextCompleteness,
              trustSignals,
              machineReadability,
            });
          } catch {
            clearTimeout(timeoutId);
            resolve({
              structuredAnswers: 5,
              entityClarity: 4,
              extractionReadiness: 4,
              contextCompleteness: 2,
              trustSignals: 1,
              machineReadability: 3,
            });
          }
        })();
      });
    };

    const aiMetrics = await extractAIMetrics();

    const aiScoreRaw = Math.min(100, Math.max(0,
      aiMetrics.structuredAnswers +
      aiMetrics.entityClarity +
      aiMetrics.extractionReadiness +
      aiMetrics.contextCompleteness +
      aiMetrics.trustSignals +
      aiMetrics.machineReadability
    ));
    const aiScore10 = Math.round(aiScoreRaw / 10);
    const aiStatus: "good" | "warn" | "bad" = aiScoreRaw >= 80 ? "good" : aiScoreRaw >= 50 ? "warn" : "bad";

    return {
      ...stage2Results,
      aiScoreRaw,
      aiScore10,
      aiStatus,
      aiMetrics,
      aiOptimizationTimeout: aiTimeout,
      partialAudit: aiTimeout || stage2Results.partialAudit,
    };
  } catch {
    return {
      ...stage2Results,
      partialAudit: true,
      aiOptimizationTimeout: true,
    };
  }
}

