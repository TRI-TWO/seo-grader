"use client";

import React, { useEffect, useState } from "react";

type GradeResult = {
  score: number; // 0–100
  message: string;
};

type TechnicalResult = {
  score: number; // 0–100
  details: {
    h1Count: number;
    h1Texts: string[];
    robotsContent: string | null;
    wordCount: number;
    bodyText: string;
    imageCount: number;
    imagesWithoutAlt: number;
    hasFavicon: boolean;
    hasCanonical: boolean;
    detectedTitle: string | null;
    totalLinks: number;
    internalLinks: number;
    externalLinks: number;
    nofollowLinks: number;
    imageBadFilenameCount: number;
    imageGoodFilenameCount: number;
  };
  messages: string[];
};

type StatusLevel = "good" | "warn" | "bad";

const STOPWORDS = new Set([
  "the",
  "and",
  "or",
  "but",
  "if",
  "a",
  "an",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "at",
  "by",
  "from",
  "about",
  "as",
  "into",
  "like",
  "through",
  "after",
  "over",
  "between",
  "out",
  "against",
  "during",
  "without",
  "before",
  "under",
  "around",
  "among",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "it",
  "this",
  "that",
  "these",
  "those",
  "you",
  "your",
  "yours",
  "their",
  "them",
  "they",
]);

const statusDotClass: Record<StatusLevel, string> = {
  good: "bg-green-500",
  warn: "bg-yellow-400",
  bad: "bg-red-500",
};

const statusTextClass: Record<StatusLevel, string> = {
  good: "text-green-700",
  warn: "text-yellow-600",
  bad: "text-red-600",
};

const extractKeywords = (text: string, limit = 10): string[] => {
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

const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const computeTitleGrade = (
  titleTag: string,
  selectedStateAbbrs: string[],
  extractedKeywords: string[],
  statesList: any[]
): GradeResult => {
  if (!titleTag) {
    return { score: 0, message: "Missing title tag." };
  }
  const tag = titleTag.toLowerCase();
  let score = 100;
  const messages: string[] = [];

  // -------- Locality detection (multi-select + fallback) --------
  let hasLocality = false;
  let checkedLocality = false;
  if (selectedStateAbbrs.length > 0 && statesList.length > 0) {
    checkedLocality = true;
    for (const abbr of selectedStateAbbrs) {
      const s = statesList.find((st: any) => st.abbr === abbr);
      if (!s) continue;
      const nameRegex = new RegExp("\\b" + escapeRegex(s.name) + "\\b", "i");
      const abbrRegex = new RegExp("\\b" + escapeRegex(s.abbr) + "\\b", "i");
      if (nameRegex.test(titleTag) || abbrRegex.test(titleTag)) {
        hasLocality = true;
        break;
      }
    }
  } else if (statesList.length > 0) {
    checkedLocality = true;
    for (const s of statesList) {
      const name = (s.name || "").toString();
      const abbr = (s.abbr || "").toString();
      if (!name && !abbr) continue;
      if (name) {
        const nameRegex = new RegExp("\\b" + escapeRegex(name) + "\\b", "i");
        if (nameRegex.test(titleTag)) {
          hasLocality = true;
          break;
        }
      }
      if (abbr) {
        const abbrRegex = new RegExp("\\b" + escapeRegex(abbr) + "\\b", "i");
        if (abbrRegex.test(titleTag)) {
          hasLocality = true;
          break;
        }
      }
    }
  }

  if (checkedLocality) {
    if (!hasLocality) {
      score -= 25;
      messages.push("No locality (city/county/state) detected.");
    } else {
      messages.push("Locality match found.");
    }
  }

  // -------- Service keyword detection --------
  const bizWords = [
    "roofing",
    "contractor",
    "remodeling",
    "kitchen",
    "bath",
    "siding",
    "windows",
    "builder",
    "home improvement",
    "plumbing",
    "hvac",
    "heating",
    "cooling",
    "construction",
  ];
  const hasBiz = bizWords.some((kw) => tag.includes(kw));
  if (!hasBiz) {
    score -= 25;
    messages.push("Missing strong service keyword.");
  } else {
    messages.push("Service keyword detected.");
  }

  // -------- Title length --------
  if (titleTag.length < 30 || titleTag.length > 65) {
    score -= 15;
    messages.push("Title tag length should be 30–65 characters.");
  } else {
    messages.push("Good title tag length.");
  }

  // -------- Separator --------
  if (!tag.includes("|") && !tag.includes("-") && !tag.includes("–")) {
    score -= 10;
    messages.push("Missing separator ('|' or '-' or '–').");
  }

  // -------- Semantic alignment with keywords --------
  if (extractedKeywords.length > 0) {
    const related = extractedKeywords.some((kw) => tag.includes(kw));
    if (!related) {
      score -= 20;
      messages.push("Title does not match extracted page keywords.");
    } else {
      messages.push("Title semantically aligned with page content.");
    }
  }

  return { score: Math.max(0, score), message: messages.join(" ") };
};

const analyzeHtml = (html: string, baseUrl?: string): TechnicalResult => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const h1s = Array.from(doc.getElementsByTagName("h1"));
  const h1Count = h1s.length;
  const h1Texts = h1s.map((h) => h.textContent?.trim() || "");

  const robotsMeta = doc.querySelector("meta[name='robots']");
  const robotsContent = robotsMeta?.getAttribute("content") || null;

  const bodyText = doc.body?.textContent || "";
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

  const imgs = Array.from(doc.getElementsByTagName("img"));
  const imageCount = imgs.length;
  const imagesWithoutAlt = imgs.filter(
    (img) => !img.getAttribute("alt") || img.getAttribute("alt")!.trim() === ""
  ).length;

  // Soft filename rules (Option B)
  let imageBadFilenameCount = 0;
  if (imageCount > 0) {
    const autoPrefixes = ["img", "dsc", "pxl", "image", "photo", "screenshot"];
    imgs.forEach((img) => {
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
        imageBadFilenameCount += 1;
      }
    });
  }
  const imageGoodFilenameCount =
    imageCount > 0 ? Math.max(0, imageCount - imageBadFilenameCount) : 0;

  const favicon =
    doc.querySelector("link[rel~='icon']") ||
    doc.querySelector("link[rel='shortcut icon']");
  const hasFavicon = !!favicon;

  const canonical = doc.querySelector("link[rel='canonical']");
  const hasCanonical = !!canonical;

  const titleEl = doc.querySelector("title");
  const detectedTitle = titleEl?.textContent?.trim() || null;

  const anchors = Array.from(doc.getElementsByTagName("a"));
  const totalLinks = anchors.length;
  let internalLinks = 0;
  let externalLinks = 0;
  let nofollowLinks = 0;
  let host: string | null = null;
  if (baseUrl) {
    try {
      host = new URL(baseUrl).hostname;
    } catch {
      host = null;
    }
  }

  anchors.forEach((a) => {
    const href = a.getAttribute("href") || "";
    const rel = a.getAttribute("rel") || "";
    if (!href) return;
    if (/nofollow/i.test(rel)) {
      nofollowLinks += 1;
    }
    if (!host) return;
    if (/^https?:\/\//i.test(href)) {
      try {
        const linkHost = new URL(href).hostname;
        if (linkHost === host) internalLinks += 1;
        else externalLinks += 1;
      } catch {
        /* ignore */
      }
    } else {
      internalLinks += 1;
    }
  });

  let score = 100;
  const messages: string[] = [];

  if (h1Count === 0) {
    score -= 25;
    messages.push("No H1 found.");
  } else if (h1Count > 1) {
    score -= 10;
    messages.push("Multiple H1 tags found.");
  } else {
    messages.push("Single H1 detected.");
  }

  if (wordCount < 300) {
    score -= 20;
    messages.push("Low word count (<300).");
  } else {
    messages.push("Healthy word count.");
  }

  if (imageCount > 0) {
    if (imagesWithoutAlt > 0) {
      score -= 10;
      messages.push(`${imagesWithoutAlt} images missing alt text.`);
    } else {
      messages.push("All images appear to have alt text.");
    }

    const badRatio = imageBadFilenameCount / imageCount;
    if (imageBadFilenameCount > 0) {
      if (badRatio > 0.5) {
        score -= 10;
        messages.push(
          `${imageBadFilenameCount} image filenames look auto-generated (IMG_1234, DSC_0001, etc.).`
        );
      } else if (badRatio > 0.2) {
        score -= 5;
        messages.push(
          "Some image filenames look auto-generated; consider renaming hero or key images."
        );
      } else {
        messages.push(
          "Most image filenames look descriptive and not auto-generated."
        );
      }
    } else {
      messages.push("Image filenames look descriptive.");
    }
  } else {
    messages.push("No images detected on the page.");
  }

  if (!hasFavicon) {
    score -= 5;
    messages.push("No favicon found.");
  }

  if (!hasCanonical) {
    score -= 5;
    messages.push("No canonical tag found.");
  }

  if (robotsContent && /noindex/i.test(robotsContent)) {
    score -= 20;
    messages.push("Page is marked noindex in meta robots.");
  }

  return {
    score: Math.max(0, score),
    details: {
      h1Count,
      h1Texts,
      robotsContent,
      wordCount,
      bodyText,
      imageCount,
      imagesWithoutAlt,
      hasFavicon,
      hasCanonical,
      detectedTitle,
      totalLinks,
      internalLinks,
      externalLinks,
      nofollowLinks,
      imageBadFilenameCount,
      imageGoodFilenameCount,
    },
    messages,
  };
};

export default function Home() {
  // Location data (multi-select states)
  const [states, setStates] = useState<any[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);

  // URL & scraping
  const [targetUrl, setTargetUrl] = useState("");
  const [scrapedUrl, setScrapedUrl] = useState<string | null>(null);
  const [httpStatus, setHttpStatus] = useState<number | null>(null);
  const [robotsTxt, setRobotsTxt] = useState<string | null>(null);
  const [robotsStatus, setRobotsStatus] = useState<number | null>(null);
  const [sitemapXml, setSitemapXml] = useState<string | null>(null);
  const [sitemapStatus, setSitemapStatus] = useState<number | null>(null);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);

  // Page content
  const [pageContent, setPageContent] = useState("");
  const [extractedKeywords, setExtractedKeywords] = useState<string[]>([]);
  const [titleTag, setTitleTag] = useState("");
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const [pageHtml, setPageHtml] = useState("");
  const [technicalResult, setTechnicalResult] =
    useState<TechnicalResult | null>(null);

  // Load states via API (no more <!DOCTYPE JSON issues)
  useEffect(() => {
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
  }, []);

  const handleCheckSeo = async () => {
    const url = targetUrl.trim();
    if (!url) {
      setScrapeError("Please enter a URL.");
      return;
    }

    setIsScraping(true);
    setScrapeError(null);

    try {
      const res = await fetch(
        `/api/scrape?url=${encodeURIComponent(url)}`
      );
      const data = await res.json();

      if (!data.success) {
        setScrapeError(data.error || "Failed to scrape URL.");
        setIsScraping(false);
        return;
      }

      const html: string = data.html || "";
      const finalUrl: string = data.finalUrl || url;

      setScrapedUrl(finalUrl);
      setHttpStatus(data.status ?? null);
      setRobotsTxt(data.robotsTxt ?? null);
      setRobotsStatus(data.robotsStatus ?? null);
      setSitemapXml(data.sitemapXml ?? null);
      setSitemapStatus(data.sitemapStatus ?? null);

      setPageHtml(html);
      const tech = analyzeHtml(html, finalUrl);
      setTechnicalResult(tech);

      const bodyText = tech.details.bodyText;
      const autoKeywords = extractKeywords(bodyText);
      setPageContent(bodyText);
      setExtractedKeywords(autoKeywords);

      const detectedTitle = tech.details.detectedTitle || "";
      setTitleTag(detectedTitle);

      const titleGrade = computeTitleGrade(
        detectedTitle,
        selectedStates,
        autoKeywords,
        states
      );
      setGradeResult(titleGrade);
    } catch (err: any) {
      setScrapeError(err?.message || "Unknown error while scraping.");
    } finally {
      setIsScraping(false);
    }
  };

  const handleManualTitleGrade = () => {
    const result = computeTitleGrade(
      titleTag,
      selectedStates,
      extractedKeywords,
      states
    );
    setGradeResult(result);
  };

  const handleManualTechnicalAudit = () => {
    if (!pageHtml) {
      setTechnicalResult(null);
      return;
    }
    const result = analyzeHtml(pageHtml, scrapedUrl || undefined);
    setTechnicalResult(result);
  };

  // Overall /10 score (title + tech)
  let overallScore10: number | null = null;
  if (gradeResult && technicalResult) {
    const normalizedTitle = gradeResult.score / 100;
    const normalizedTech = technicalResult.score / 100;
    overallScore10 = Math.round(((normalizedTitle + normalizedTech) / 2) * 10);
  }

  // Suggestions
  const suggestions: string[] = [];
  if (technicalResult) {
    const d = technicalResult.details;
    if (d.wordCount < 300) {
      suggestions.push("Increase page content to at least 300 words.");
    }
    if (d.h1Count === 0) {
      suggestions.push("Add an H1 that clearly describes the main topic.");
    } else if (d.h1Count > 1) {
      suggestions.push("Reduce to a single primary H1 for clarity.");
    }
    if (!d.hasFavicon) {
      suggestions.push("Add a favicon for better branding and UX.");
    }
    if (!d.hasCanonical) {
      suggestions.push(
        "Add a canonical tag to avoid duplicate content issues."
      );
    }
    if (!d.robotsContent) {
      suggestions.push(
        "Consider adding a meta robots tag if you need finer index control."
      );
    } else if (/noindex/i.test(d.robotsContent)) {
      suggestions.push(
        "Remove 'noindex' from meta robots if this page should appear in search results."
      );
    }
    if (d.imageCount > 0 && d.imagesWithoutAlt > 0) {
      suggestions.push(
        "Add descriptive alt text to images for accessibility and SEO."
      );
    }
    if (d.imageBadFilenameCount > 0) {
      suggestions.push(
        "Rename images with auto-generated names (IMG_1234, DSC_0001, etc.) to descriptive filenames with keywords."
      );
    }
  }

  if (!robotsTxt || (robotsStatus !== null && robotsStatus >= 400)) {
    suggestions.push("Add a robots.txt file to guide search engines.");
  }

  if (!sitemapXml || (sitemapStatus !== null && sitemapStatus >= 400)) {
    suggestions.push("Add a sitemap.xml file to help indexing.");
  }

  if (gradeResult) {
    const tag = titleTag.toLowerCase();
    // We only suggest this if user hasn't explicitly selected states that already match
    if (selectedStates.length > 0) {
      const selectedLabels: string[] = [];
      selectedStates.forEach((abbr) => {
        const found = states.find((s) => s.abbr === abbr);
        if (found) {
          selectedLabels.push(found.name, found.abbr);
        }
      });
      const anyInTitle = selectedLabels.some((label) =>
        tag.includes(label.toLowerCase())
      );
      if (!anyInTitle) {
        suggestions.push(
          "Include at least one of your selected states in the title tag for local SEO."
        );
      }
    } else {
      suggestions.push(
        "Include your target city/county/state in the title tag for local SEO."
      );
    }

    const bizWords = [
      "roofing",
      "contractor",
      "remodeling",
      "kitchen",
      "bath",
      "siding",
      "windows",
      "builder",
      "home improvement",
      "plumbing",
      "hvac",
      "heating",
      "cooling",
      "construction",
    ];
    const hasBiz = bizWords.some((kw) => tag.includes(kw));
    if (!hasBiz) {
      suggestions.push(
        "Add a clear service keyword (e.g., 'roofing', 'remodeling', 'contractor') to the title tag."
      );
    }

    if (titleTag && (titleTag.length < 30 || titleTag.length > 65)) {
      suggestions.push(
        "Adjust title length to stay within 30–65 characters for best display."
      );
    }
  }

  const uniqueSuggestions = Array.from(new Set(suggestions));

  // Status levels for dots
  const wordStatus: StatusLevel =
    technicalResult && technicalResult.details.wordCount >= 400
      ? "good"
      : technicalResult && technicalResult.details.wordCount >= 300
      ? "warn"
      : "bad";

  const hasH1Status: StatusLevel =
    technicalResult && technicalResult.details.h1Count === 1
      ? "good"
      : technicalResult && technicalResult.details.h1Count > 1
      ? "warn"
      : "bad";

  const faviconStatus: StatusLevel =
    technicalResult && technicalResult.details.hasFavicon ? "good" : "bad";

  const canonicalStatus: StatusLevel =
    technicalResult && technicalResult.details.hasCanonical ? "good" : "bad";

  const robotsFileStatus: StatusLevel =
    robotsTxt && robotsStatus !== null && robotsStatus < 400 ? "good" : "bad";

  const sitemapFileStatus: StatusLevel =
    sitemapXml && sitemapStatus !== null && sitemapStatus < 400
      ? "good"
      : "bad";

  const altStatus: StatusLevel =
    technicalResult && technicalResult.details.imageCount > 0
      ? (() => {
          const d = technicalResult.details;
          const coverage =
            d.imageCount === 0
              ? 1
              : (d.imageCount - d.imagesWithoutAlt) / d.imageCount;
          if (coverage >= 0.9) return "good";
          if (coverage >= 0.5) return "warn";
          return "bad";
        })()
      : "warn";

  const filenameStatus: StatusLevel =
    technicalResult && technicalResult.details.imageCount > 0
      ? (() => {
          const d = technicalResult.details;
          const badRatio =
            d.imageCount === 0 ? 0 : d.imageBadFilenameCount / d.imageCount;
          if (badRatio === 0) return "good";
          if (badRatio <= 0.3) return "warn";
          return "bad";
        })()
      : "warn";

  const titleQualityStatus: StatusLevel =
    gradeResult && gradeResult.score >= 80
      ? "good"
      : gradeResult && gradeResult.score >= 50
      ? "warn"
      : "bad";

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        {/* Header */}
        <header className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold">
            Tri-Two SEO Grader
          </h1>
          <p className="text-sm text-zinc-600">
            Paste a URL, optionally set your target location, and get a quick
            SEO health check with a 10-point score.
          </p>
        </header>

        {/* URL + Scan Mode */}
        <section className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 text-sm">
              <span className="font-medium">Scan Type:</span>
              <label className="flex items-center gap-1">
                <input type="radio" checked readOnly />
                <span>Free Scan</span>
              </label>
              <label className="flex items-center gap-1 opacity-50">
                <input type="radio" disabled />
                <span>Advanced Scan (coming soon)</span>
              </label>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              className="flex-1 border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-zinc-900"
              placeholder="https://www.example.com/"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
            />
            <button
              className="px-5 py-2 rounded-lg bg-black text-white text-sm font-medium hover:bg-zinc-800 disabled:opacity-60"
              onClick={handleCheckSeo}
              disabled={isScraping}
            >
              {isScraping ? "Checking..." : "Check SEO"}
            </button>
          </div>
          {scrapeError && <p className="text-sm text-red-600">{scrapeError}</p>}
          {(scrapedUrl || httpStatus !== null) && (
            <p className="text-xs text-zinc-500">
              {scrapedUrl && (
                <>
                  <strong>Final URL:</strong> {scrapedUrl}{" "}
                </>
              )}
              {httpStatus !== null && (
                <>
                  · <strong>Status:</strong> {httpStatus}
                </>
              )}
            </p>
          )}
        </section>

        {/* Main grid: detail cards + score/suggestions */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
          {/* LEFT COLUMN */}
          <div className="space-y-6">
            {/* Location Targeting (multi-select states) */}
            <section className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-4 sm:p-5 space-y-3">
              <h2 className="text-lg font-semibold">Location Targeting</h2>
              <p className="text-xs text-zinc-500">
                Optional: select one or more states so we can judge the title's
                local relevance.
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium">States</label>
                <select
                  multiple
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm bg-white text-zinc-900 h-40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={selectedStates}
                  onChange={(e) => {
                    const values = Array.from(
                      e.target.selectedOptions,
                      (opt) => (opt as HTMLOptionElement).value
                    );
                    setSelectedStates(values);
                  }}
                >
                  {states.length === 0 ? (
                    <option>Loading states...</option>
                  ) : (
                    states.map((s, i) => (
                      <option key={i} value={s.abbr}>
                        {s.name} ({s.abbr})
                      </option>
                    ))
                  )}
                </select>
              </div>
            </section>

            {/* Title & Meta */}
            <section className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Title & Meta</h2>
                <button
                  className="text-xs text-emerald-700 hover:underline"
                  onClick={handleManualTitleGrade}
                >
                  Re-grade title
                </button>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="font-medium mb-1">Title Tag</div>
                  <input
                    className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    value={titleTag}
                    onChange={(e) => setTitleTag(e.target.value)}
                    placeholder="Page title will appear here after scan, or type one manually..."
                  />
                  {gradeResult && (
                    <div className="mt-1 space-y-1">
                      <div
                        className={`flex items-center gap-2 text-xs ${statusTextClass[titleQualityStatus]}`}
                      >
                        <span
                          className={`inline-block h-2.5 w-2.5 rounded-full ${statusDotClass[titleQualityStatus]}`}
                        />
                        <span>
                          {titleQualityStatus === "good"
                            ? "Title quality: Strong"
                            : titleQualityStatus === "warn"
                            ? "Title quality: Needs minor improvements"
                            : "Title quality: Needs work"}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-600">
                        {gradeResult.message}
                      </p>
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-medium mb-1">Meta Description</div>
                  {technicalResult ? (
                    (() => {
                      const parsed = new DOMParser().parseFromString(
                        pageHtml || "<html></html>",
                        "text/html"
                      );
                      const descMeta = parsed.querySelector(
                        "meta[name='description']"
                      );
                      const content = descMeta?.getAttribute("content") || "";
                      const hasDesc = content.trim().length > 0;
                      const level: StatusLevel = hasDesc ? "good" : "bad";
                      return (
                        <div
                          className={`flex items-center gap-2 ${statusTextClass[level]}`}
                        >
                          <span
                            className={`inline-block h-2.5 w-2.5 rounded-full ${statusDotClass[level]}`}
                          />
                          <span>
                            {hasDesc ? content : "No meta description found."}
                          </span>
                        </div>
                      );
                    })()
                  ) : (
                    <p className="text-xs text-zinc-500">
                      Run a scan to detect meta description.
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Content & Semantics (word count only) */}
            <section className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-4 sm:p-5 space-y-4">
              <h2 className="text-lg font-semibold">Content & Semantics</h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Word Count</div>
                  <div
                    className={`flex items-center gap-2 ${statusTextClass[wordStatus]}`}
                  >
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${statusDotClass[wordStatus]}`}
                    />
                    <span>
                      {technicalResult
                        ? technicalResult.details.wordCount
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Technical Basics */}
            <section className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Technical Basics</h2>
                <button
                  className="text-xs text-emerald-700 hover:underline"
                  onClick={handleManualTechnicalAudit}
                >
                  Re-run technical audit
                </button>
              </div>
              {technicalResult ? (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">H1</span>
                    <span
                      className={`flex items-center gap-2 ${statusTextClass[hasH1Status]}`}
                    >
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${statusDotClass[hasH1Status]}`}
                      />
                      <span>
                        {technicalResult.details.h1Count === 0
                          ? "Missing"
                          : technicalResult.details.h1Count === 1
                          ? "1 present"
                          : `${technicalResult.details.h1Count} H1s`}
                      </span>
                    </span>
                  </div>
                  {technicalResult.details.h1Texts.length > 0 && (
                    <ul className="list-disc list-inside text-xs text-zinc-700">
                      {technicalResult.details.h1Texts.map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Favicon</span>
                    <span
                      className={`flex items-center gap-2 ${statusTextClass[faviconStatus]}`}
                    >
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${statusDotClass[faviconStatus]}`}
                      />
                      <span>
                        {technicalResult.details.hasFavicon
                          ? "Present"
                          : "Missing"}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Canonical Tag</span>
                    <span
                      className={`flex items-center gap-2 ${statusTextClass[canonicalStatus]}`}
                    >
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${statusDotClass[canonicalStatus]}`}
                      />
                      <span>
                        {technicalResult.details.hasCanonical
                          ? "Present"
                          : "Missing"}
                      </span>
                    </span>
                  </div>
                  <div>
                    <div className="font-medium mb-1">Links</div>
                    <p className="text-xs text-zinc-700">
                      {technicalResult.details.totalLinks} total ·{" "}
                      {technicalResult.details.internalLinks} internal ·{" "}
                      {technicalResult.details.externalLinks} external ·{" "}
                      {technicalResult.details.nofollowLinks} nofollow
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-500">
                  Run a scan to see technical details.
                </p>
              )}
            </section>

            {/* Image Optimization */}
            <section className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-4 sm:p-5 space-y-4">
              <h2 className="text-lg font-semibold">Image Optimization</h2>
              {technicalResult ? (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Alt Text Coverage</span>
                    <span
                      className={`flex items-center gap-2 ${statusTextClass[altStatus]}`}
                    >
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${statusDotClass[altStatus]}`}
                      />
                      <span>
                        {technicalResult.details.imageCount === 0
                          ? "No images"
                          : `${technicalResult.details.imageCount - technicalResult.details.imagesWithoutAlt} / ${technicalResult.details.imageCount} images have alt text`}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Filename Quality</span>
                    <span
                      className={`flex items-center gap-2 ${statusTextClass[filenameStatus]}`}
                    >
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${statusDotClass[filenameStatus]}`}
                      />
                      <span>
                        {technicalResult.details.imageCount === 0
                          ? "No images"
                          : technicalResult.details.imageBadFilenameCount === 0
                          ? "All filenames look descriptive"
                          : `${technicalResult.details.imageBadFilenameCount} / ${technicalResult.details.imageCount} look auto-generated`}
                      </span>
                    </span>
                  </div>
                  <div>
                    <div className="font-medium mb-1">Image Count</div>
                    <p className="text-xs text-zinc-700">
                      {technicalResult.details.imageCount} total images on the
                      page.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-500">
                  Run a scan to see image optimization metrics.
                </p>
              )}
            </section>

            {/* Crawling & Indexing */}
            <section className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-4 sm:p-5 space-y-4">
              <h2 className="text-lg font-semibold">Crawling & Indexing</h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">robots.txt</span>
                  <span
                    className={`flex items-center gap-2 ${statusTextClass[robotsFileStatus]}`}
                  >
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${statusDotClass[robotsFileStatus]}`}
                    />
                    <span>
                      {robotsTxt && robotsStatus !== null && robotsStatus < 400
                        ? "Found"
                        : "Not found"}
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">sitemap.xml</span>
                  <span
                    className={`flex items-center gap-2 ${statusTextClass[sitemapFileStatus]}`}
                  >
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${statusDotClass[sitemapFileStatus]}`}
                    />
                    <span>
                      {sitemapXml &&
                      sitemapStatus !== null &&
                      sitemapStatus < 400
                        ? "Found"
                        : "Not found"}
                    </span>
                  </span>
                </div>
                {technicalResult && (
                  <div className="text-xs text-zinc-600">
                    <div className="font-medium mb-1">Meta Robots</div>
                    <p>
                      {technicalResult.details.robotsContent
                        ? technicalResult.details.robotsContent
                        : "No meta robots tag detected."}
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN: Overall score + suggestions */}
          <div className="space-y-6">
            {/* Overall Score */}
            <section className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-5 space-y-3">
              <h2 className="text-lg font-semibold">Overall Score</h2>
              {overallScore10 !== null ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">
                      {overallScore10}
                      <span className="text-lg text-zinc-500">/10</span>
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600">
                    This score combines title relevance and technical health.
                  </p>
                </>
              ) : (
                <p className="text-sm text-zinc-500">
                  Run a scan to see a 10-point score.
                </p>
              )}
            </section>

            {/* Suggestions */}
            <section className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-5 space-y-3">
              <h2 className="text-lg font-semibold">Suggestions</h2>
              {uniqueSuggestions.length > 0 ? (
                <ul className="list-disc list-inside text-sm text-zinc-700 space-y-1">
                  {uniqueSuggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500">
                  Run a scan to see specific recommendations.
                </p>
              )}
            </section>
          </div>
        </div>

        {/* CTA */}
        <section className="bg-emerald-600 text-white rounded-2xl shadow-sm p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
          <div>
            <h2 className="text-xl font-semibold">
              Ready to level up your SEO?
            </h2>
            <p className="text-sm text-emerald-100 mt-1">
              Schedule a free consultation and we'll walk through your results
              and next steps together.
            </p>
          </div>
          <a
            href="/contact"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-white text-emerald-700 text-sm font-medium hover:bg-emerald-50"
          >
            Schedule A Free Consultation
          </a>
        </section>
      </div>
    </div>
  );
}
