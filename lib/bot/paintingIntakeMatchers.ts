/**
 * First-pass painting issue router for voice intake.
 * Supports paint + light trim only; rejects plumbing/electrical/windows/doors.
 */

import { normalizeUtterance } from '@/lib/bot/kitchenSinkLeakOnlyMatchers';

export const INTERIOR_PAINT_ISSUE = 'interior_paint' as const;
export const EXTERIOR_PAINT_ISSUE = 'exterior_paint' as const;
export const LIGHT_TRIM_ISSUE = 'light_trim_work' as const;
export const GENERAL_PAINT_ISSUE = 'general_painting' as const;

export type PaintingIntakeIssue =
  | typeof INTERIOR_PAINT_ISSUE
  | typeof EXTERIOR_PAINT_ISSUE
  | typeof LIGHT_TRIM_ISSUE
  | typeof GENERAL_PAINT_ISSUE;

export const SUPPORTED_PAINTING_INTAKE_ISSUES: ReadonlySet<string> = new Set([
  INTERIOR_PAINT_ISSUE,
  EXTERIOR_PAINT_ISSUE,
  LIGHT_TRIM_ISSUE,
  GENERAL_PAINT_ISSUE,
]);

function offLane(n: string): boolean {
  const hardNo = [
    /\b(plumb|pipe|faucet|toilet|drain|sewer|water\s*heater|spigot|sprinkler)\b/i,
    /\b(electric|electrical|wiring|outlet|breaker|panel)\b/i,
    /\b(window|windows|door|doors|install|replacement)\b/i,
    /\b(deck\s+boards?\s+replac|replace\s+.*deck\s+boards?)\b/i,
    /\b(roof|hvac|furnace|air\s*conditioning|pest)\b/i,
  ];
  return hardNo.some((re) => {
    re.lastIndex = 0;
    return re.test(n);
  });
}

export type PaintingIssueCaptureResult =
  | { accepted: true; issue: PaintingIntakeIssue }
  | { accepted: false; rejectReason: string | null };

export function matchPaintingIntakeIssue(raw: string): PaintingIssueCaptureResult {
  const n = normalizeUtterance(raw);
  if (!n) {
    return { accepted: false, rejectReason: 'unclear' };
  }
  if (offLane(n)) {
    return { accepted: false, rejectReason: 'off_lane' };
  }

  if (
    /\b(kitchen|bathroom|bedroom|living\s+room|dining\s+room|hallway|basement|office)\b/.test(n) &&
    /\b(paint|painting|repaint|walls?|ceilings?|cabinet|cabinets)\b/.test(n)
  ) {
    return { accepted: true, issue: INTERIOR_PAINT_ISSUE };
  }

  if (
    /\b(trim|baseboard|base\s*board|casing|frame|frames|crown\s*molding|molding|moulding)\b/.test(n) &&
    /\b(light|minor|touch\s*up|paint|painting|repaint)\b/.test(n)
  ) {
    return { accepted: true, issue: LIGHT_TRIM_ISSUE };
  }
  if (/\b(interior|inside|indoors?)\b/.test(n) && /\b(paint|painting|repaint|paint job)\b/.test(n)) {
    return { accepted: true, issue: INTERIOR_PAINT_ISSUE };
  }
  if (
    /\b(exterior|outside|outdoor|house\s+outside|siding|fence|deck|garage\s+door|fascia|soffit|stucco)\b/.test(n) &&
    /\b(paint|painting|repaint|stain|staining)\b/.test(n)
  ) {
    return { accepted: true, issue: EXTERIOR_PAINT_ISSUE };
  }
  if (/\b(paint|painting|repaint|paint\s+job|stain|staining)\b/.test(n)) {
    return { accepted: true, issue: GENERAL_PAINT_ISSUE };
  }
  return { accepted: false, rejectReason: 'unclear' };
}

export function paintingIssueAckLine(issue: PaintingIntakeIssue): string {
  switch (issue) {
    case INTERIOR_PAINT_ISSUE:
      return "Got it — interior painting. What's your name?";
    case EXTERIOR_PAINT_ISSUE:
      return "Got it — exterior painting. What's your name?";
    case LIGHT_TRIM_ISSUE:
      return "Got it — light trim work. What's your name?";
    case GENERAL_PAINT_ISSUE:
      return "Got it — painting project. What's your name?";
    default:
      return "Got it. What's your name?";
  }
}
