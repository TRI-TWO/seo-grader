"use client";

import React, { useEffect, useState, Suspense, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { scoreTitle, scoreMedia, type TitleMetrics, type MediaMetrics, type ScoringConfig } from "@/lib/scoring";
import scoringConfig from "@/lib/scoring-config.json";
import PaywallBlur from "./PaywallBlur";
import ScoreBlur from "./ScoreBlur";
import { createClient } from "@/lib/supabase/client";
// BrandLogo and HamburgerMenu are now in the layout

// TypeScript declaration for Calendly
declare global {
  interface Window {
    Calendly?: {
      initInlineWidget: (options: { url: string; parentElement: HTMLElement }) => void;
      initPopupWidget: (options: { url: string }) => void;
    };
  }
}

type AuditData = {
  titleTag: string;
  metaDescription: string;
  metaDescriptionWordCount: number;
  h1Count: number;
  h1Texts: string[];
  wordCount: number;
  favicon: boolean;
  canonicalTag: string;
  robotsTxt: boolean;
  sitemapXml: boolean;
  altCoverage: string;
  seoScore: number;
  titleScoreRaw: number;
  titleScore10: number;
  titleStatus: "good" | "warn" | "bad";
  mediaScoreRaw: number;
  mediaScore10: number;
  mediaStatus: "good" | "warn" | "bad";
  aiScoreRaw: number;
  aiScore10: number;
  aiStatus: "good" | "warn" | "bad";
};

type AIMetrics = {
  structuredAnswers: number; // 0-25
  entityClarity: number; // 0-20
  extractionReadiness: number; // 0-20
  contextCompleteness: number; // 0-15
  trustSignals: number; // 0-10
  machineReadability: number; // 0-10
};

function ReportPageContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [auditData, setAuditData] = useState<AuditData | null>(null);
  const [finalUrl, setFinalUrl] = useState("");
  const [apiData, setApiData] = useState<any>(null);
  const [states, setStates] = useState<any[]>([]);
  const [aiMetrics, setAiMetrics] = useState<AIMetrics | null>(null);
  const [mediaMetrics, setMediaMetrics] = useState<any>(null);
  const [partialAudit, setPartialAudit] = useState<boolean>(false);
  const [showCalendlyModal, setShowCalendlyModal] = useState<boolean>(false);
  const [calendlyScriptLoaded, setCalendlyScriptLoaded] = useState<boolean>(false);
  const calendlyWidgetRef = useRef<HTMLDivElement>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  // Helper function to truncate URL at domain extension
  const truncateUrlAtDomain = (url: string): string => {
    if (!url) return "";
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      // Match domain with TLD (2-4 chars) or country code TLD (e.g., .co.uk)
      const match = hostname.match(/^([^/]+\.(?:[a-z]{2,4}|[a-z]{2}\.[a-z]{2}))/i);
      if (match) {
        return `${urlObj.protocol}//${match[1]}`;
      }
      return `${urlObj.protocol}//${hostname}`;
    } catch {
      const match = url.match(/^https?:\/\/([^/]+\.(?:[a-z]{2,4}|[a-z]{2}\.[a-z]{2}))/i);
      if (match) {
        return match[0];
      }
      return url;
    }
  };

  // Calendly modal handler
  const handleScheduleClick = () => {
    setShowCalendlyModal(true);
  };

  // Close Calendly modal
  const handleCloseCalendlyModal = () => {
    setShowCalendlyModal(false);
  };

  // Calculate AI metrics if not already set - ALWAYS from actual HTML, never placeholders
  // This hook MUST be called before any conditional returns (React hooks rule)
  useEffect(() => {
    if (!aiMetrics && apiData?.html) {
      try {
        const calculatedMetrics = extractAIMetrics(apiData.html);
        setAiMetrics(calculatedMetrics);
      } catch (err) {
        console.error("Error calculating AI metrics from HTML:", err);
        // Don't set placeholder values - metrics remain null until we can calculate properly
        // The audit should always provide HTML, so this should rarely happen
      }
    }
    // If no HTML available, metrics remain null - we'll calculate when HTML becomes available
    // NEVER set placeholder/default values - only use actual calculated results
  }, [apiData?.html, aiMetrics]);

  // Initialize Calendly widget when modal opens and script is loaded
  useEffect(() => {
    if (showCalendlyModal && calendlyScriptLoaded && calendlyWidgetRef.current && window.Calendly) {
      // Clear any existing content
      if (calendlyWidgetRef.current) {
        calendlyWidgetRef.current.innerHTML = '';
      }
      
      // Initialize the inline widget
      try {
        window.Calendly.initInlineWidget({
          url: 'https://calendly.com/mgr-tri-two?background_color=1a1a1a&text_color=ffffff&primary_color=16b8a6',
          parentElement: calendlyWidgetRef.current
        });
      } catch (error) {
        console.error('Error initializing Calendly widget:', error);
      }
    }
  }, [showCalendlyModal, calendlyScriptLoaded]);

  useEffect(() => {
    // Load states data
    const loadStates = async () => {
      try {
        const res = await fetch("/api/states");
        const json = await res.json();
        setStates(json || []);
      } catch (err) {
        console.error("Failed to load states:", err);
        setStates([]);
      }
    };
    loadStates();

    // Load results from localStorage
    // Use a small delay to ensure localStorage is available after navigation
    const loadResults = () => {
      if (typeof window !== 'undefined') {
        const resultsJson = localStorage.getItem('auditResults');
        console.log("Loading from localStorage:", { 
          hasResults: !!resultsJson,
          length: resultsJson?.length || 0,
          allKeys: Object.keys(localStorage)
        });
      
      if (resultsJson) {
        try {
          const results = JSON.parse(resultsJson);
          console.log("Parsed results:", {
            hasSeoScore: !!results.seoScore,
            hasTitleScore: !!results.titleScoreRaw,
            hasMediaScore: !!results.mediaScoreRaw,
            hasAiScore: !!results.aiScoreRaw,
            partialAudit: results.partialAudit,
            url: results.url,
            keys: Object.keys(results),
          });
          
          // Only clear localStorage after successful processing
          // Don't clear it yet - wait until we've set all state
          
          // Process results
          setFinalUrl(results.finalUrl || results.url || "");
          setPartialAudit(results.partialAudit || false);
          
          // Set API data structure for compatibility
          setApiData({
            success: true,
            url: results.url,
            finalUrl: results.finalUrl || results.url,
            status: results.status || 0,
            contentType: results.contentType,
            html: results.html || "",
            robotsTxt: results.robotsTxt,
            robotsStatus: results.robotsStatus,
            sitemapXml: results.sitemapXml,
            sitemapStatus: results.sitemapStatus,
          });

          // Parse HTML if available for display
          const html = results.html || "";
          let parsed: any = {};
          if (html) {
            parsed = parseHTML(html, {
              robotsTxt: results.robotsTxt,
              robotsStatus: results.robotsStatus,
              sitemapXml: results.sitemapXml,
              sitemapStatus: results.sitemapStatus,
            });
          }

          // Use scores from results (already calculated server-side)
          // NEVER use placeholder 0s - only use actual calculated values from the audit
          setAuditData({
            ...parsed,
            titleTag: results.titleTag || parsed.titleTag || "Title Tag",
            metaDescription: results.metaDescription || parsed.metaDescription || "Missing",
            metaDescriptionWordCount: results.metaDescriptionWordCount ?? parsed.metaDescriptionWordCount ?? 0,
            h1Count: results.h1Count ?? parsed.h1Count ?? 0,
            h1Texts: results.h1Texts || parsed.h1Texts || [],
            wordCount: results.wordCount ?? parsed.wordCount ?? 0,
            favicon: results.favicon !== undefined ? results.favicon : (parsed.favicon || false),
            canonicalTag: results.canonicalTag || parsed.canonicalTag || "Missing",
            robotsTxt: results.robotsTxtFound !== undefined ? results.robotsTxtFound : (parsed.robotsTxt || false),
            sitemapXml: results.sitemapXmlFound !== undefined ? results.sitemapXmlFound : (parsed.sitemapXml || false),
            altCoverage: results.altCoverage || parsed.altCoverage || "No images",
            seoScore: results.seoScore ?? 0, // Only 0 if actually calculated as 0
            titleScoreRaw: results.titleScoreRaw ?? 0, // Only 0 if actually calculated as 0
            titleScore10: results.titleScore10 ?? 0, // Only 0 if actually calculated as 0
            titleStatus: results.titleStatus || "bad",
            mediaScoreRaw: results.mediaScoreRaw ?? 0, // Only 0 if actually calculated as 0
            mediaScore10: results.mediaScore10 ?? 0, // Only 0 if actually calculated as 0
            mediaStatus: results.mediaStatus || "bad",
            aiScoreRaw: results.aiScoreRaw ?? 0, // Only 0 if actually calculated as 0
            aiScore10: results.aiScore10 ?? 0, // Only 0 if actually calculated as 0
            aiStatus: results.aiStatus || "bad",
          });

          // Set metrics if available - ALWAYS use calculated values, never placeholders
          if (results.mediaMetrics) {
            setMediaMetrics(results.mediaMetrics);
          }
          
          // AI Metrics: Always calculate from actual HTML, never use placeholder values
          if (results.aiMetrics) {
            // Use server-calculated metrics
            setAiMetrics(results.aiMetrics);
          } else {
            // Calculate from HTML - this ensures we always have real results
            const htmlForCalculation = html || results.html || apiData?.html || "";
            if (htmlForCalculation) {
              try {
                const calculatedMetrics = extractAIMetrics(htmlForCalculation);
                setAiMetrics(calculatedMetrics);
              } catch (err) {
                console.error("Error calculating AI metrics from HTML:", err);
                // If calculation fails, we still need to calculate from whatever we have
                // Don't set placeholder values - calculate from available data
                // If we truly can't calculate, metrics will remain null until we can
              }
            }
            // If no HTML available, metrics remain null - we'll calculate in useEffect when HTML becomes available
          }

          // Clear localStorage after successful processing
          localStorage.removeItem('auditResults');
          setLoading(false);
        } catch (err) {
          console.error("Error parsing results from localStorage:", err, resultsJson);
          setError("Failed to load audit results. Please try submitting again.");
          setLoading(false);
          // Don't clear localStorage on error - let user retry
        }
      } else {
        // No results found in localStorage
        console.warn("No audit results found in localStorage");
        setError("No audit results found. Please submit a URL from the homepage.");
        setLoading(false);
      }
      }
    };
    
    // Small delay to ensure localStorage is available after navigation
    const timer = setTimeout(loadResults, 50);
    return () => clearTimeout(timer);
  }, []);

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const supabase = createClient();
        const { data: { user }, error } = await supabase.auth.getUser();
        if (!error && user && user.email === 'mgr@tri-two.com') {
          setIsAdmin(true);
        }
      } catch (err) {
        console.error("Error checking admin status:", err);
      }
    };
    checkAdmin();
  }, []);

  const parseHTML = (html: string, apiData: any): Omit<AuditData, "seoScore" | "titleScoreRaw" | "titleScore10" | "titleStatus" | "mediaScoreRaw" | "mediaScore10" | "mediaStatus" | "aiScoreRaw" | "aiScore10" | "aiStatus"> => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Title Tag
    const titleEl = doc.querySelector("title");
    const titleTag = titleEl?.textContent?.trim() || "Title Tag";

    // Meta Description
    const metaDesc = doc.querySelector('meta[name="description"]');
    const metaDescription = metaDesc?.getAttribute("content") || "Missing";
    const metaDescriptionWordCount = metaDescription !== "Missing" 
      ? metaDescription.split(/\s+/).filter(Boolean).length 
      : 0;

    // H1 Tags
    const h1s = Array.from(doc.querySelectorAll("h1"));
    const h1Count = h1s.length;
    const h1Texts = h1s.map((h) => h.textContent?.trim() || "");

    // Word Count
    const bodyText = doc.body?.textContent || "";
    const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

    // Favicon
    const favicon =
      doc.querySelector('link[rel="icon"]') ||
      doc.querySelector('link[rel="shortcut icon"]') ||
      doc.querySelector('link[rel="apple-touch-icon"]');
    const hasFavicon = !!favicon;

    // Canonical Tag
    const canonical = doc.querySelector('link[rel="canonical"]');
    const canonicalTag = canonical ? "Canonical tag detected" : "Viewport meta tag detected";

    // Alt Coverage
    const images = Array.from(doc.querySelectorAll("img"));
    const imagesWithAlt = images.filter(
      (img) => img.getAttribute("alt") && img.getAttribute("alt")!.trim() !== ""
    ).length;
    const totalImages = images.length;
    const altCoverage =
      totalImages > 0
        ? `${imagesWithAlt}/${totalImages} images have alt text`
        : "No images";

    // Check robots.txt and sitemap.xml from API
    const hasRobotsTxt = apiData?.robotsTxt && apiData?.robotsStatus < 400;
    const hasSitemapXml = apiData?.sitemapXml && apiData?.sitemapStatus < 400;

    return {
      titleTag,
      metaDescription,
      metaDescriptionWordCount,
      h1Count,
      h1Texts,
      wordCount,
      favicon: hasFavicon,
      canonicalTag,
      robotsTxt: hasRobotsTxt,
      sitemapXml: hasSitemapXml,
      altCoverage,
    };
  };

  // Extract keywords from body text
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

  // Extract title metrics for scoring library
  const extractTitleMetrics = (
    parsed: Omit<AuditData, "seoScore" | "titleScoreRaw" | "titleScore10" | "titleStatus" | "mediaScoreRaw" | "mediaScore10" | "mediaStatus" | "aiScoreRaw" | "aiScore10" | "aiStatus">,
    html: string,
    states: any[]
  ): TitleMetrics => {
    const title = parsed.titleTag === "Title Tag" ? "" : parsed.titleTag;
    const titleLower = title.toLowerCase();
    const hasTitleTag = title.length > 0;

    // Extract body keywords
    const bodyText = new DOMParser().parseFromString(html, "text/html").body?.textContent || "";
    const bodyKeywords = extractKeywords(bodyText);

    // Check locality
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

    // Check service keywords
    const cfg = scoringConfig as ScoringConfig;
    const hasStrongServiceKeyword = cfg.title.serviceKeywordsStrong.some(kw => titleLower.includes(kw));
    const hasWeakServiceKeyword = cfg.title.serviceKeywordsWeak.some(kw => titleLower.includes(kw));

    // Check semantic overlap
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

    return {
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
  };

  // Extract media metrics for scoring library
  const extractMediaMetrics = (html: string): MediaMetrics => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const images = Array.from(doc.querySelectorAll("img"));
    const totalImages = images.length;
    const imagesWithAlt = images.filter(
      (img) => img.getAttribute("alt") && img.getAttribute("alt")!.trim() !== ""
    ).length;

    // Check for bad filenames
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

    // Check OG metadata
    const ogTitle = doc.querySelector('meta[property="og:title"]');
    const ogDescription = doc.querySelector('meta[property="og:description"]');
    const ogTitlePresent = !!ogTitle;
    const ogDescriptionPresent = !!ogDescription;

    return {
      totalImages,
      imagesWithAlt,
      badFilenameCount,
      ogTitlePresent,
      ogDescriptionPresent,
    };
  };

  // Extract AI Optimization metrics
  const extractAIMetrics = (html: string): AIMetrics => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const bodyText = doc.body?.textContent || "";
    const bodyLower = bodyText.toLowerCase();

    // 1. Structured Answer Readiness (0-25)
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

    // 2. Semantic Clarity & Entity Density (0-20)
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

    // 3. AI Extraction Friendliness (0-20)
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

    // 4. Context Completeness (0-15)
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

    // 5. AI Trust Signals (0-10)
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

    // 6. Machine Readability & Formatting (0-10)
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

    return {
      structuredAnswers,
      entityClarity,
      extractionReadiness,
      contextCompleteness,
      trustSignals,
      machineReadability,
    };
  };

  // Score AI Optimization
  const scoreAI = (metrics: AIMetrics): { raw: number; score10: number; status: "good" | "warn" | "bad" } => {
    const raw = Math.min(100, Math.max(0,
      metrics.structuredAnswers +
      metrics.entityClarity +
      metrics.extractionReadiness +
      metrics.contextCompleteness +
      metrics.trustSignals +
      metrics.machineReadability
    ));
    const score10 = Math.round(raw / 10);
    const status: "good" | "warn" | "bad" = raw >= 80 ? "good" : raw >= 50 ? "warn" : "bad";
    return { raw, score10, status };
  };

  // Calculate technical score
  const calculateTechnicalScore = (parsed: Omit<AuditData, "seoScore" | "titleScoreRaw" | "titleScore10" | "titleStatus" | "mediaScoreRaw" | "mediaScore10" | "mediaStatus" | "aiScoreRaw" | "aiScore10" | "aiStatus">): number => {
    let score = 0;
    
    // H1 structure (25 points)
    if (parsed.h1Count === 1) score += 25;
    else if (parsed.h1Count > 1) score += 12;
    
    // Word count (20 points)
    if (parsed.wordCount >= 400) score += 20;
    else if (parsed.wordCount >= 200) score += 10;
    
    // Canonical (15 points)
    if (parsed.canonicalTag.includes("Canonical")) score += 15;
    
    // robots.txt (15 points)
    if (parsed.robotsTxt) score += 15;
    
    // sitemap.xml (15 points)
    if (parsed.sitemapXml) score += 15;
    
    // Meta description (10 points)
    if (parsed.metaDescription !== "Missing") score += 10;
    
    return Math.min(100, score);
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 81) return "bg-green-500";
    if (score >= 61) return "bg-yellow-400";
    return "bg-red-500";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-white mb-4">Loading Audit Results...</div>
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#16b8a6' }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !auditData) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-red-500 mb-4">Error</div>
          <div className="text-gray-400 mb-4">{error || "Failed to load audit data"}</div>
          <Link
            href="/"
            className="px-6 py-2 text-white rounded-lg transition"
            style={{ backgroundColor: '#16b8a6' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#14a895'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#16b8a6'}
          >
            Go Back
          </Link>
        </div>
      </div>
    );
  }

  // Safety checks to prevent crashes
  if (!auditData || !apiData) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-red-500 mb-4">Error</div>
          <div className="text-gray-400 mb-4">Missing audit data</div>
          <Link
            href="/"
            className="px-6 py-2 text-white rounded-lg transition"
            style={{ backgroundColor: '#16b8a6' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#14a895'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#16b8a6'}
          >
            Go Back
          </Link>
        </div>
      </div>
    );
  }

  // Calculate title metrics for display
  const titleMetrics = extractTitleMetrics(
    {
      titleTag: auditData.titleTag || "Title Tag",
      metaDescription: auditData.metaDescription || "Missing",
      metaDescriptionWordCount: auditData.metaDescriptionWordCount || 0,
      h1Count: auditData.h1Count || 0,
      h1Texts: auditData.h1Texts || [],
      wordCount: auditData.wordCount || 0,
      favicon: auditData.favicon || false,
      canonicalTag: auditData.canonicalTag || "Missing",
      robotsTxt: auditData.robotsTxt || false,
      sitemapXml: auditData.sitemapXml || false,
      altCoverage: auditData.altCoverage || "No images",
    },
    apiData?.html || "",
    states || []
  );

  // Calculate alt coverage percentage with safety check
  const altCoverageMatch = (auditData.altCoverage || "").match(/(\d+)\/(\d+)/);
  const altCoveragePercent = altCoverageMatch 
    ? (parseInt(altCoverageMatch[1]) / parseInt(altCoverageMatch[2])) * 100 
    : 0;

  // Parse HTML for OG metadata with safety check
  const parser = new DOMParser();
  const doc = parser.parseFromString(apiData?.html || "", "text/html");
  const ogTitle = doc.querySelector('meta[property="og:title"]');
  const ogDescription = doc.querySelector('meta[property="og:description"]');

  // Calculate technical score for display
  const technicalScore = calculateTechnicalScore({
    titleTag: auditData.titleTag || "Title Tag",
    metaDescription: auditData.metaDescription || "Missing",
    metaDescriptionWordCount: auditData.metaDescriptionWordCount || 0,
    h1Count: auditData.h1Count || 0,
    h1Texts: auditData.h1Texts || [],
    wordCount: auditData.wordCount || 0,
    favicon: auditData.favicon || false,
    canonicalTag: auditData.canonicalTag || "Missing",
    robotsTxt: auditData.robotsTxt || false,
    sitemapXml: auditData.sitemapXml || false,
    altCoverage: auditData.altCoverage || "No images",
  });
  const technicalScore10 = Math.round(technicalScore / 10);

  // Collect all priority actions organized by priority level
  const highPriorityItems: { label: string; value: string }[] = [];
  const mediumPriorityItems: { label: string; value: string }[] = [];
  const lowPriorityItems: { label: string; value: string }[] = [];
  
  // AI Optimization Priority Actions
  if (auditData.aiStatus === "bad") {
    // RED (0-49) - High Priority
    highPriorityItems.push({ label: "Add explicit answer structures", value: "FAQs, definitions, step-by-step lists" });
    highPriorityItems.push({ label: "Define primary entity clearly", value: "What business/service is, who it's for" });
    highPriorityItems.push({ label: "Remove AI-blocking layout issues", value: "Break up text walls, remove popups" });
    highPriorityItems.push({ label: "Add minimum trust signal", value: "Author, about page, contact, or date" });
    highPriorityItems.push({ label: "Fix machine readability", value: "Heading hierarchy, semantic HTML, schema" });
  } else if (auditData.aiStatus === "warn") {
    // YELLOW (50-79) - Medium Priority
    mediumPriorityItems.push({ label: "Expand entity relationships", value: "Related services, tools, locations" });
    mediumPriorityItems.push({ label: "Improve answer modularity", value: "Convert long paragraphs to short blocks" });
    mediumPriorityItems.push({ label: "Strengthen context completeness", value: "What, why, how, who, when" });
    mediumPriorityItems.push({ label: "Add light trust enhancers", value: "Internal links, citations, team bios" });
    mediumPriorityItems.push({ label: "Add schema where applicable", value: "FAQ, Article, Product, LocalBusiness" });
  } else {
    // GREEN (80-100) - Low Priority
    lowPriorityItems.push({ label: "Add comparative answer blocks", value: "X vs Y, best options for audiences" });
    lowPriorityItems.push({ label: "Add decision-support content", value: "Cost ranges, timelines, tradeoffs" });
    lowPriorityItems.push({ label: "Add multimedia with semantic support", value: "Video + transcript, descriptive alt text" });
    lowPriorityItems.push({ label: "Maintain freshness", value: "Updated dates, seasonal updates, new FAQs" });
    lowPriorityItems.push({ label: "Expand into topic clusters", value: "Supporting AI topic clusters" });
  }

  // Add other priority items based on audit results
  if (auditData.titleStatus === "bad") {
    highPriorityItems.push({ label: "Fix title tag", value: "Add or improve title tag with service keywords and locality" });
  } else if (auditData.titleStatus === "warn") {
    mediumPriorityItems.push({ label: "Optimize title tag", value: "Improve title structure and keyword placement" });
  }

  if (auditData.mediaStatus === "bad") {
    highPriorityItems.push({ label: "Add alt text to images", value: "Improve image accessibility and SEO" });
  } else if (auditData.mediaStatus === "warn") {
    mediumPriorityItems.push({ label: "Improve image optimization", value: "Add missing alt text and optimize filenames" });
  }

  if (auditData.h1Count === 0) {
    highPriorityItems.push({ label: "Add H1 tag", value: "Include a single, descriptive H1 heading" });
  } else if (auditData.h1Count > 1) {
    mediumPriorityItems.push({ label: "Fix H1 structure", value: "Use only one H1 tag per page" });
  }

  if (auditData.wordCount < 200) {
    highPriorityItems.push({ label: "Increase content length", value: "Add more substantive content (aim for 400+ words)" });
  } else if (auditData.wordCount < 400) {
    mediumPriorityItems.push({ label: "Expand content", value: "Add more detailed content to reach 400+ words" });
  }

  if (!auditData.robotsTxt) {
    mediumPriorityItems.push({ label: "Add robots.txt", value: "Create robots.txt file for crawl directives" });
  }

  if (!auditData.sitemapXml) {
    mediumPriorityItems.push({ label: "Add sitemap.xml", value: "Create sitemap.xml for better indexing" });
  }

  return (
    <>
      {/* Partial Audit Warning Banner */}
      {partialAudit && (
        <div className="bg-yellow-600 border-b border-yellow-700 px-6 py-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="text-white font-semibold">
                This site blocked automated access. Partial audit displayed. Some checks may be missing or incomplete.
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Header Section (without BrandLogo/HamburgerMenu - those are in layout) */}
      <div className="border-b border-zinc-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center">
          {/* Title and URL */}
          <div className="flex-1 ml-8">
            <h1 className="text-4xl font-bold text-white">Audit Results</h1>
            <p className="text-3xl text-gray-400 mt-1">{truncateUrlAtDomain(finalUrl || "")}</p>
          </div>

          {/* Right side: Score - Fully right justified */}
          <div className="flex items-center gap-4 ml-auto">
            {/* SEO Score Badge */}
            <div className="flex flex-col items-end gap-2">
              <div className={`${getScoreBadgeColor(auditData.seoScore)} text-white px-6 py-4 rounded-lg transform rotate-[-8deg] shadow-lg`}>
                <div className="text-sm font-bold uppercase tracking-wide">SEO SCORE</div>
                <ScoreBlur isPaywalled={true}>
                  <div className="text-8xl font-bold leading-none mt-1">{auditData.seoScore}</div>
                </ScoreBlur>
              </div>
              <button className={`px-4 py-1.5 ${getScoreBadgeColor(auditData.seoScore)} text-white text-sm font-medium rounded hover:opacity-90 transition`}>
                {auditData.seoScore >= 81 ? "GOOD" : auditData.seoScore >= 61 ? "WARNING" : "ISSUE"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Results - Three Column Layout */}
      <main className="w-full px-6 py-8 space-y-6">
        {/* Row 1: Title & Relevance (1), Technical Foundations (2), AI Optimization (3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Title & Search Relevance */}
            <section className="bg-zinc-800 rounded-lg border border-zinc-700 p-6 flex flex-col">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-white mb-2">Title & Search Relevance</h2>
                <p className="text-gray-400 text-base">Weighted Score: 40-50% | Title Score: {auditData.titleScore10}/10</p>
                <p className="text-gray-300 text-sm mt-2">
                {titleMetrics.hasLocalityInTitle && titleMetrics.hasStrongServiceKeyword
                    ? "Title optimization looks good."
                    : "Your title does not clearly communicate your service or location, reducing your ability to rank for local-intent searches."}
                </p>
              </div>
              <div className="space-y-4 mt-4">
                <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-base font-medium text-gray-300 mb-1">Title Tag</div>
                    <div className="text-3xl text-white">{auditData.titleTag === "Title Tag" ? "Title Tag" : auditData.titleTag}</div>
                  </div>
                  <div className={`px-3 py-1 rounded text-xs font-medium ${auditData.titleTag !== "Title Tag" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                    {auditData.titleTag !== "Title Tag" ? "OK" : "ISSUE"}
                  </div>
                </div>
                <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-base font-medium text-gray-300 mb-1">Title contains locality</div>
                    <div className="text-3xl text-white">{titleMetrics.hasLocalityInTitle ? "Yes" : "No"}</div>
                  </div>
                  <div className={`px-3 py-1 rounded text-xs font-medium ${titleMetrics.hasLocalityInTitle ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                    {titleMetrics.hasLocalityInTitle ? "OK" : "ISSUE"}
                  </div>
                </div>
                <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-base font-medium text-gray-300 mb-1">Title contains service keyword</div>
                    <div className="text-3xl text-white">{titleMetrics.hasStrongServiceKeyword || titleMetrics.hasWeakServiceKeyword ? "Yes" : "No"}</div>
                  </div>
                  <div className={`px-3 py-1 rounded text-xs font-medium ${titleMetrics.hasStrongServiceKeyword || titleMetrics.hasWeakServiceKeyword ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                    {titleMetrics.hasStrongServiceKeyword || titleMetrics.hasWeakServiceKeyword ? "OK" : "ISSUE"}
                  </div>
                </div>
                <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-base font-medium text-gray-300 mb-1">Title semantic match</div>
                    <div className="text-3xl text-white">{titleMetrics.semanticExactOverlapCount > 0 ? "Match" : titleMetrics.semanticFuzzyOverlapCount > 0 ? "Partial match" : "No match"}</div>
                  </div>
                  <div className={`px-3 py-1 rounded text-xs font-medium ${titleMetrics.semanticExactOverlapCount > 0 ? "bg-green-500 text-white" : titleMetrics.semanticFuzzyOverlapCount > 0 ? "bg-yellow-400 text-white" : "bg-red-500 text-white"}`}>
                    {titleMetrics.semanticExactOverlapCount > 0 ? "OK" : titleMetrics.semanticFuzzyOverlapCount > 0 ? "WARNING" : "ISSUE"}
                  </div>
                </div>
                <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-base font-medium text-gray-300 mb-1">Title length</div>
                    <div className="text-3xl text-white">{auditData.titleTag === "Title Tag" ? 0 : auditData.titleTag.length} characters</div>
                  </div>
                  <div className={`px-3 py-1 rounded text-xs font-medium ${(auditData.titleTag === "Title Tag" ? 0 : auditData.titleTag.length) >= 30 && (auditData.titleTag === "Title Tag" ? 0 : auditData.titleTag.length) <= 65 ? "bg-green-500 text-white" : (auditData.titleTag === "Title Tag" ? 0 : auditData.titleTag.length) >= 20 && (auditData.titleTag === "Title Tag" ? 0 : auditData.titleTag.length) <= 75 ? "bg-yellow-400 text-white" : "bg-red-500 text-white"}`}>
                    {(auditData.titleTag === "Title Tag" ? 0 : auditData.titleTag.length) >= 30 && (auditData.titleTag === "Title Tag" ? 0 : auditData.titleTag.length) <= 65 ? "OK" : (auditData.titleTag === "Title Tag" ? 0 : auditData.titleTag.length) >= 20 && (auditData.titleTag === "Title Tag" ? 0 : auditData.titleTag.length) <= 75 ? "WARNING" : "ISSUE"}
                  </div>
                </div>
                <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-base font-medium text-gray-300 mb-1">Title structure</div>
                    <div className="text-3xl text-white">{auditData.titleTag.includes("|") || auditData.titleTag.includes("-") || auditData.titleTag.includes("–") ? "Has separator" : "No separator"}</div>
                  </div>
                  <div className={`px-3 py-1 rounded text-xs font-medium ${auditData.titleTag.includes("|") || auditData.titleTag.includes("-") || auditData.titleTag.includes("–") ? "bg-green-500 text-white" : "bg-yellow-400 text-white"}`}>
                    {auditData.titleTag.includes("|") || auditData.titleTag.includes("-") || auditData.titleTag.includes("–") ? "OK" : "WARNING"}
                  </div>
                </div>
              </div>
            </section>

          {/* Column 2: Technical Foundations */}
          <section className="bg-zinc-800 rounded-lg border border-zinc-700 p-6 flex flex-col">
              <div className="mb-4">
              <h2 className="text-2xl font-bold text-white mb-2">Technical Foundations</h2>
              <p className="text-gray-400 text-base">Weighted Score: ~35% | Technical Score: {technicalScore10}/10</p>
                <p className="text-gray-300 text-sm mt-2">
                {auditData.canonicalTag.includes("Canonical") && auditData.robotsTxt && auditData.sitemapXml && auditData.favicon
                  ? "Technical foundations look solid."
                  : "These technical elements help search engines crawl and understand your site. Missing canonical or robots.txt reduces consistency in indexing."}
                </p>
              </div>
              <div className="space-y-4 mt-4">
                <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex-1">
                  <div className="text-base font-medium text-gray-300 mb-1">Canonical Tag</div>
                  <div className="text-3xl text-white">{auditData.canonicalTag.includes("Canonical") ? "Present" : "Missing"}</div>
                  </div>
                <div className={`px-3 py-1 rounded text-xs font-medium ${auditData.canonicalTag.includes("Canonical") ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                  {auditData.canonicalTag.includes("Canonical") ? "OK" : "ISSUE"}
                  </div>
                </div>
                <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex-1">
                  <div className="text-base font-medium text-gray-300 mb-1">robots.txt</div>
                  <div className="text-3xl text-white">{auditData.robotsTxt ? "Found" : "Not found"}</div>
                  </div>
                <div className={`px-3 py-1 rounded text-xs font-medium ${auditData.robotsTxt ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                  {auditData.robotsTxt ? "OK" : "ISSUE"}
                  </div>
                </div>
                  <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
                    <div className="flex-1">
                  <div className="text-base font-medium text-gray-300 mb-1">sitemap.xml</div>
                  <div className="text-3xl text-white">{auditData.sitemapXml ? "Found" : "Not found"}</div>
                    </div>
                <div className={`px-3 py-1 rounded text-xs font-medium ${auditData.sitemapXml ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                  {auditData.sitemapXml ? "OK" : "ISSUE"}
                </div>
              </div>
              <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-base font-medium text-gray-300 mb-1">Favicon</div>
                  <div className="text-3xl text-white">{auditData.favicon ? "Present" : "Missing"}</div>
                </div>
                <div className={`px-3 py-1 rounded text-xs font-medium ${auditData.favicon ? "bg-green-500 text-white" : "bg-yellow-400 text-white"}`}>
                  {auditData.favicon ? "OK" : "WARNING"}
                </div>
              </div>
              <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-base font-medium text-gray-300 mb-1">Meta Description</div>
                  <div className="text-3xl text-white">{auditData.metaDescription !== "Missing" ? "Present" : "Missing"}</div>
                </div>
                <div className={`px-3 py-1 rounded text-xs font-medium ${auditData.metaDescription !== "Missing" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                  {auditData.metaDescription !== "Missing" ? "OK" : "ISSUE"}
                </div>
              </div>
              <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-base font-medium text-gray-300 mb-1">Page load status</div>
                  <div className="text-3xl text-white">{apiData?.status === 200 ? "200 OK" : `${apiData?.status || "Error"}`}</div>
                </div>
                <div className={`px-3 py-1 rounded text-xs font-medium ${apiData?.status === 200 ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                  {apiData?.status === 200 ? "OK" : "ISSUE"}
                  </div>
              </div>
              </div>
            </section>

          {/* Column 3: AI Optimization */}
          <section className="bg-zinc-800 rounded-lg border border-zinc-700 p-6 flex flex-col">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-white mb-2">AI Optimization</h2>
              <p className="text-gray-400 text-base">AI Score: {auditData.aiScore10}/10</p>
              <p className="text-gray-300 text-sm mt-2">
                {auditData.aiScoreRaw >= 80
                  ? "Page is highly interpretable, trusted, and easily extractable by AI systems."
                  : auditData.aiScoreRaw >= 50
                  ? "AI can interpret the page, but with reduced confidence and shallow extraction."
                  : "AI systems cannot reliably interpret, trust, or extract answers from this page."}
              </p>
            </div>
            {/* Only blur the scored metrics section, keep title visible */}
            <PaywallBlur isPaywalled={true}>
              <div className="space-y-4 mt-4">
                <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-base font-medium text-gray-300 mb-1">Structured Answer Readiness</div>
                    <div className="text-3xl text-white">{aiMetrics ? `${aiMetrics.structuredAnswers}/25` : "Calculating..."}</div>
                  </div>
                  <div className={`px-3 py-1 rounded text-xs font-medium ${aiMetrics && aiMetrics.structuredAnswers >= 20 ? "bg-green-500 text-white" : aiMetrics && aiMetrics.structuredAnswers >= 10 ? "bg-yellow-400 text-white" : "bg-red-500 text-white"}`}>
                    {aiMetrics && aiMetrics.structuredAnswers >= 20 ? "OK" : aiMetrics && aiMetrics.structuredAnswers >= 10 ? "WARNING" : "ISSUE"}
                  </div>
                </div>
                <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-base font-medium text-gray-300 mb-1">Semantic Clarity & Entity Density</div>
                    <div className="text-3xl text-white">{aiMetrics ? `${aiMetrics.entityClarity}/20` : "Calculating..."}</div>
                  </div>
                  <div className={`px-3 py-1 rounded text-xs font-medium ${aiMetrics && aiMetrics.entityClarity >= 15 ? "bg-green-500 text-white" : aiMetrics && aiMetrics.entityClarity >= 8 ? "bg-yellow-400 text-white" : "bg-red-500 text-white"}`}>
                    {aiMetrics && aiMetrics.entityClarity >= 15 ? "OK" : aiMetrics && aiMetrics.entityClarity >= 8 ? "WARNING" : "ISSUE"}
                  </div>
                </div>
                <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-base font-medium text-gray-300 mb-1">AI Extraction Friendliness</div>
                    <div className="text-3xl text-white">{aiMetrics ? `${aiMetrics.extractionReadiness}/20` : "Calculating..."}</div>
                  </div>
                  <div className={`px-3 py-1 rounded text-xs font-medium ${aiMetrics && aiMetrics.extractionReadiness >= 15 ? "bg-green-500 text-white" : aiMetrics && aiMetrics.extractionReadiness >= 8 ? "bg-yellow-400 text-white" : "bg-red-500 text-white"}`}>
                    {aiMetrics && aiMetrics.extractionReadiness >= 15 ? "OK" : aiMetrics && aiMetrics.extractionReadiness >= 8 ? "WARNING" : "ISSUE"}
                  </div>
                </div>
                <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-base font-medium text-gray-300 mb-1">Context Completeness</div>
                    <div className="text-3xl text-white">{aiMetrics ? `${aiMetrics.contextCompleteness}/15` : "Calculating..."}</div>
                  </div>
                  <div className={`px-3 py-1 rounded text-xs font-medium ${aiMetrics && aiMetrics.contextCompleteness >= 12 ? "bg-green-500 text-white" : aiMetrics && aiMetrics.contextCompleteness >= 7 ? "bg-yellow-400 text-white" : "bg-red-500 text-white"}`}>
                    {aiMetrics && aiMetrics.contextCompleteness >= 12 ? "OK" : aiMetrics && aiMetrics.contextCompleteness >= 7 ? "WARNING" : "ISSUE"}
                  </div>
                </div>
                <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-base font-medium text-gray-300 mb-1">AI Trust Signals</div>
                    <div className="text-3xl text-white">{aiMetrics ? `${aiMetrics.trustSignals}/10` : "Calculating..."}</div>
                  </div>
                  <div className={`px-3 py-1 rounded text-xs font-medium ${aiMetrics && aiMetrics.trustSignals >= 8 ? "bg-green-500 text-white" : aiMetrics && aiMetrics.trustSignals >= 4 ? "bg-yellow-400 text-white" : "bg-red-500 text-white"}`}>
                    {aiMetrics && aiMetrics.trustSignals >= 8 ? "OK" : aiMetrics && aiMetrics.trustSignals >= 4 ? "WARNING" : "ISSUE"}
                  </div>
                </div>
                <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-base font-medium text-gray-300 mb-1">Machine Readability & Formatting</div>
                    <div className="text-3xl text-white">{aiMetrics ? `${aiMetrics.machineReadability}/10` : "Calculating..."}</div>
                  </div>
                  <div className={`px-3 py-1 rounded text-xs font-medium ${aiMetrics && aiMetrics.machineReadability >= 8 ? "bg-green-500 text-white" : aiMetrics && aiMetrics.machineReadability >= 5 ? "bg-yellow-400 text-white" : "bg-red-500 text-white"}`}>
                    {aiMetrics && aiMetrics.machineReadability >= 8 ? "OK" : aiMetrics && aiMetrics.machineReadability >= 5 ? "WARNING" : "ISSUE"}
                  </div>
                </div>
              </div>
            </PaywallBlur>
          </section>
          </div>

        {/* Row 2: Content & Semantics (1), Media Optimization (2), Crawlability & Indexing (3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Column 1: Content & Semantics */}
            <section className="bg-zinc-800 rounded-lg border border-zinc-700 p-6 flex flex-col">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-white mb-2">Content & Semantics</h2>
              <p className="text-gray-300 text-sm mt-2">
                Connected to semantic and partial technical score. {auditData.wordCount >= 400 && auditData.h1Count === 1
                  ? "Content structure looks good."
                  : "Your page could benefit from clearer content structure and more descriptive heading tags to improve indexability and topic relevance."}
              </p>
            </div>
            <div className="space-y-4 mt-4">
              <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-base font-medium text-gray-300 mb-1">Word Count</div>
                  <div className="text-3xl text-white">{auditData.wordCount} words</div>
                </div>
                <div className={`px-3 py-1 rounded text-xs font-medium ${auditData.wordCount >= 400 ? "bg-green-500 text-white" : auditData.wordCount >= 200 ? "bg-yellow-400 text-white" : "bg-red-500 text-white"}`}>
                  {auditData.wordCount >= 400 ? "OK" : auditData.wordCount >= 200 ? "WARNING" : "ISSUE"}
                </div>
              </div>
              <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-base font-medium text-gray-300 mb-1">H1 Tags</div>
                  <div className="text-3xl text-white">{auditData.h1Count === 0 ? "No H1 tags" : `${auditData.h1Count} H1 tag${auditData.h1Count > 1 ? "s" : ""}`}</div>
                </div>
                <div className={`px-3 py-1 rounded text-xs font-medium ${auditData.h1Count === 1 ? "bg-green-500 text-white" : auditData.h1Count === 0 ? "bg-red-500 text-white" : "bg-yellow-400 text-white"}`}>
                  {auditData.h1Count === 1 ? "OK" : auditData.h1Count === 0 ? "ISSUE" : "WARNING"}
                </div>
              </div>
              <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-base font-medium text-gray-300 mb-1">H1 Content</div>
                  <div className="text-base text-white line-clamp-2">{auditData.h1Texts.length > 0 ? auditData.h1Texts[0] : "Unknown"}</div>
                </div>
                <div className={`px-3 py-1 rounded text-xs font-medium ${auditData.h1Texts.length > 0 ? "bg-green-500 text-white" : "bg-yellow-400 text-white"}`}>
                  {auditData.h1Texts.length > 0 ? "OK" : "WARNING"}
                </div>
              </div>
            </div>
          </section>

          {/* Column 2: Media Optimization */}
          <section className="bg-zinc-800 rounded-lg border border-zinc-700 p-6 flex flex-col">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-white mb-2">Media Optimization</h2>
              <p className="text-gray-400 text-base">Weighted Score: ~20% | Media Score: {auditData.mediaScore10}/10</p>
              <p className="text-gray-300 text-sm mt-2">
                {altCoveragePercent >= 90
                  ? "Media optimization looks good."
                  : "Images are missing alt text, reducing accessibility and limiting image SEO signals."}
              </p>
            </div>
            <div className="space-y-4 mt-4">
              <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-base font-medium text-gray-300 mb-1">Alt text coverage</div>
                  <div className="text-3xl text-white">{auditData.altCoverage}</div>
                </div>
                <div className={`px-3 py-1 rounded text-xs font-medium ${altCoveragePercent >= 90 ? "bg-green-500 text-white" : altCoveragePercent >= 50 ? "bg-yellow-400 text-white" : altCoveragePercent > 0 ? "bg-red-500 text-white" : "bg-green-500 text-white"}`}>
                  {altCoveragePercent >= 90 ? "OK" : altCoveragePercent >= 50 ? "WARNING" : altCoveragePercent > 0 ? "ISSUE" : "OK"}
                </div>
              </div>
              <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-base font-medium text-gray-300 mb-1">Filename quality</div>
                  <div className="text-3xl text-white">{mediaMetrics && altCoverageMatch ? `${parseInt(altCoverageMatch[2]) - (mediaMetrics.badFilenameCount || 0)}/${altCoverageMatch[2]} good filenames` : altCoverageMatch ? `${altCoverageMatch[2]}/${altCoverageMatch[2]} good filenames` : "0/0 good filenames"}</div>
                </div>
                <div className={`px-3 py-1 rounded text-xs font-medium ${auditData.mediaScoreRaw >= 80 ? "bg-green-500 text-white" : auditData.mediaScoreRaw >= 50 ? "bg-yellow-400 text-white" : "bg-red-500 text-white"}`}>
                  {auditData.mediaScoreRaw >= 80 ? "OK" : auditData.mediaScoreRaw >= 50 ? "WARNING" : "ISSUE"}
                </div>
              </div>
              <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-base font-medium text-gray-300 mb-1">Image count</div>
                  <div className="text-3xl text-white">{altCoverageMatch ? `${altCoverageMatch[2]} images` : "0 images"}</div>
                </div>
                <div className={`px-3 py-1 rounded text-xs font-medium ${altCoverageMatch && parseInt(altCoverageMatch[2]) >= 3 ? "bg-green-500 text-white" : altCoverageMatch && parseInt(altCoverageMatch[2]) >= 1 ? "bg-yellow-400 text-white" : "bg-green-500 text-white"}`}>
                  OK
                </div>
              </div>
              <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-base font-medium text-gray-300 mb-1">OG metadata</div>
                  <div className="text-3xl text-white">{ogTitle && ogDescription ? "Both present" : ogTitle || ogDescription ? "Partial" : "Missing"}</div>
                </div>
                <div className={`px-3 py-1 rounded text-xs font-medium ${ogTitle && ogDescription ? "bg-green-500 text-white" : ogTitle || ogDescription ? "bg-yellow-400 text-white" : "bg-red-500 text-white"}`}>
                  {ogTitle && ogDescription ? "OK" : ogTitle || ogDescription ? "WARNING" : "ISSUE"}
                </div>
              </div>
            </div>
          </section>

          {/* Column 3: Crawlability & Indexing */}
          <section className="bg-zinc-800 rounded-lg border border-zinc-700 p-6 flex flex-col">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-white mb-2">Crawlability & Indexing</h2>
              <p className="text-gray-400 text-base">AI Score: {auditData.aiScore10}/10</p>
              <p className="text-gray-300 text-sm mt-2">
                {auditData.robotsTxt && auditData.sitemapXml && apiData?.status === 200
                  ? "Crawlability looks good."
                  : "Search engines may struggle to crawl your site reliably due to missing or misconfigured crawl directives."}
              </p>
            </div>
            <div className="space-y-4 mt-4">
              <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-base font-medium text-gray-300 mb-1">robots.txt</div>
                  <div className="text-3xl text-white">{auditData.robotsTxt ? "Accessible" : "Not found"}</div>
                </div>
                <div className={`px-3 py-1 rounded text-xs font-medium ${auditData.robotsTxt ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                  {auditData.robotsTxt ? "OK" : "ISSUE"}
                </div>
              </div>
              <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-base font-medium text-gray-300 mb-1">sitemap.xml</div>
                  <div className="text-3xl text-white">{auditData.sitemapXml ? "Accessible" : "Not found"}</div>
                </div>
                <div className={`px-3 py-1 rounded text-xs font-medium ${auditData.sitemapXml ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                  {auditData.sitemapXml ? "OK" : "ISSUE"}
                </div>
              </div>
              <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-base font-medium text-gray-300 mb-1">Page load status</div>
                  <div className="text-3xl text-white">{apiData?.status === 200 ? "200 OK" : `${apiData?.status || "Error"}`}</div>
                </div>
                <div className={`px-3 py-1 rounded text-xs font-medium ${apiData?.status === 200 ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                  {apiData?.status === 200 ? "OK" : "ISSUE"}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Row 3: Priority Actions (Left + Center) and CTA/Pricing (Right) */}
        <div className={`grid grid-cols-1 ${isAdmin ? 'lg:grid-cols-1' : 'lg:grid-cols-3'} gap-6 mt-6 items-start`}>
          {/* Left + Center Columns: Priority Action Items */}
          <div className={isAdmin ? 'lg:col-span-1' : 'lg:col-span-2'}>
            <section className="bg-zinc-800 rounded-lg border border-zinc-700 p-6 h-full">
              <h2 className="text-2xl font-bold text-white mb-6">Priority Action Items</h2>
              
              {/* Admin-only helper text */}
              {isAdmin && (
                <p className="text-gray-400 text-sm mb-4">
                  These actions can be diagnosed, optimized, or prioritized using the tools below.
                </p>
              )}
              
              {/* Only blur the content sections, keep title visible */}
              <PaywallBlur isPaywalled={true}>
                {/* High Priority (Red Issues) */}
                {highPriorityItems.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-red-500 mb-3">High Priority</h3>
                    <div className="space-y-3">
                      {highPriorityItems.map((item, index) => (
                        <div key={`high-${index}`} className="bg-zinc-900 rounded-lg p-4 border-l-4 border-red-500">
                          <div className="text-base font-medium text-white mb-1">{item.label}</div>
                          <div className="text-sm text-gray-300">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Medium Priority (Yellow Issues) */}
                {mediumPriorityItems.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-yellow-400 mb-3">Medium Priority</h3>
                    <div className="space-y-3">
                      {mediumPriorityItems.map((item, index) => (
                        <div key={`medium-${index}`} className="bg-zinc-900 rounded-lg p-4 border-l-4 border-yellow-400">
                          <div className="text-base font-medium text-white mb-1">{item.label}</div>
                          <div className="text-sm text-gray-300">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Low Priority (Green Issues) */}
                {lowPriorityItems.length > 0 && (
                  <div>
                    <h3 className="text-xl font-bold text-green-500 mb-3">Low Priority</h3>
                    <div className="space-y-3">
                      {lowPriorityItems.map((item, index) => (
                        <div key={`low-${index}`} className="bg-zinc-900 rounded-lg p-4 border-l-4 border-green-500">
                          <div className="text-base font-medium text-white mb-1">{item.label}</div>
                          <div className="text-sm text-gray-300">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </PaywallBlur>

              {/* Admin-only Next Steps Panel */}
              {isAdmin && (
                <div className="mt-6 pt-6 border-t border-zinc-700">
                  <button
                    onClick={() => {
                      // Collect all action items
                      const allActions = [
                        ...highPriorityItems,
                        ...mediumPriorityItems,
                        ...lowPriorityItems
                      ];
                      // Format as: "Label: Value on {url}"
                      const formattedActions = allActions.map(item => 
                        `${item.label}: ${item.value} on ${finalUrl}`
                      ).join('\n');
                      const encodedActions = encodeURIComponent(formattedActions);
                      router.push(`/admin/burnt?tab=score&actions=${encodedActions}`);
                    }}
                    className="w-full text-left px-6 py-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-lg transition"
                  >
                    <div className="font-semibold text-white mb-1">Organize these actions</div>
                    <div className="text-sm text-gray-400">Prioritize action items into an execution order</div>
                  </button>
                </div>
              )}
            </section>
          </div>

          {/* Right Column: CTA, Pricing, and Upgrade Button - Dynamically positioned to center with Priority Actions */}
          {!isAdmin && (
            <div className="flex flex-col space-y-4 lg:sticky lg:top-6" style={{ alignSelf: 'center' }}>
              {/* CTA Button */}
              <div className="bg-zinc-800 rounded-lg border border-zinc-700 p-6">
                <button 
                  onClick={handleScheduleClick}
                  className="w-full text-white font-bold text-xl px-8 py-4 rounded-lg transition shadow-lg"
                  style={{ backgroundColor: '#16b8a6' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#14a895'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#16b8a6'}
                >
                  Schedule FREE Consultation
                </button>
              </div>

              {/* Upgrade Results Button */}
              <div className="bg-zinc-800 rounded-lg border border-zinc-700 p-6">
                <button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-xl px-8 py-4 rounded-lg transition shadow-lg">
                  $5.99 Upgrade Results
                </button>
              </div>

              {/* Pricing Cards */}
              {/* Base Plan - Full Width */}
              <div className="bg-red-500 rounded-lg p-6 text-center">
                <div className="text-3xl font-bold text-white mb-2">$299</div>
                <div className="text-xl font-semibold text-white mb-2">Base Tier</div>
                <div className="text-red-100 text-sm">Essential Monthly Local SEO Maintenance</div>
              </div>

              {/* Pro and Enterprise Plans - Side by Side */}
              <div className="grid grid-cols-2 gap-3">
                {/* Pro Plan */}
                <div className="bg-orange-500 rounded-lg p-6 text-center">
                  <div className="text-2xl font-bold text-white mb-2">$499</div>
                  <div className="text-lg font-semibold text-white mb-2">Pro Tier</div>
                  <div className="text-orange-100 text-xs">Growth-Focused SEO for Competitive Markets</div>
                </div>

                {/* Enterprise Plan */}
                <div className="rounded-lg p-6 text-center" style={{ backgroundColor: '#16b8a6' }}>
                  <div className="text-2xl font-bold text-white mb-2">$699</div>
                  <div className="text-lg font-semibold text-white mb-2">Enterprise Tier</div>
                  <div className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>Regional SEO + Multi-Location Dominance</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Calendly Modal Overlay */}
      {showCalendlyModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
          onClick={handleCloseCalendlyModal}
        >
          <div 
            className="bg-zinc-900 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={handleCloseCalendlyModal}
              className="absolute top-4 right-4 z-10 text-white hover:text-gray-300 bg-zinc-800 rounded-full p-2 transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Calendly Inline Widget */}
            <div 
              ref={calendlyWidgetRef}
              style={{ minWidth: '320px', height: '700px', width: '100%' }}
            />
          </div>
        </div>
      )}

      {/* Calendly Widget Script */}
      <Script
        src="https://assets.calendly.com/assets/external/widget.js"
        strategy="lazyOnload"
        onLoad={() => {
          setCalendlyScriptLoaded(true);
          console.log('Calendly script loaded');
        }}
        onError={(e) => {
          console.error('Error loading Calendly script:', e);
        }}
      />
    </>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-white mb-4">Loading...</div>
          <div className="text-gray-400">Preparing report page</div>
        </div>
      </div>
    }>
      <ReportPageContent />
    </Suspense>
  );
}
