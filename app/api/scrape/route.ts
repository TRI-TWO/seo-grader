import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawUrl = searchParams.get("url");

    if (!rawUrl) {
      return NextResponse.json(
        { success: false, error: "Missing url parameter" },
        { status: 400 }
      );
    }

    let targetUrl = rawUrl.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = "https://" + targetUrl;
    }

    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid URL" },
        { status: 400 }
      );
    }

    const pageRes = await fetch(parsed.toString(), {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      cache: "no-store",
    });

    const html = await pageRes.text();
    const finalUrl = pageRes.url;
    const contentType = pageRes.headers.get("content-type") || null;
    const status = pageRes.status;

    const origin = new URL(finalUrl || targetUrl).origin;

    let robotsTxt: string | null = null;
    let robotsStatus: number | null = null;
    try {
      const robotsRes = await fetch(origin + "/robots.txt", {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0 Safari/537.36",
          Accept: "text/plain,*/*;q=0.8",
        },
        cache: "no-store",
      });
      robotsStatus = robotsRes.status;
      if (robotsRes.ok) {
        robotsTxt = await robotsRes.text();
      }
    } catch {
      robotsTxt = null;
      robotsStatus = null;
    }

    let sitemapXml: string | null = null;
    let sitemapStatus: number | null = null;
    try {
      const sitemapRes = await fetch(origin + "/sitemap.xml", {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0 Safari/537.36",
          Accept: "application/xml,text/xml,*/*;q=0.8",
        },
        cache: "no-store",
      });
      sitemapStatus = sitemapRes.status;
      if (sitemapRes.ok) {
        sitemapXml = await sitemapRes.text();
      }
    } catch {
      sitemapXml = null;
      sitemapStatus = null;
    }

    return NextResponse.json(
      {
        success: true,
        url: rawUrl,
        finalUrl,
        status,
        contentType,
        html,
        robotsTxt,
        robotsStatus,
        sitemapXml,
        sitemapStatus,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Unknown server error",
      },
      { status: 500 }
    );
  }
}
