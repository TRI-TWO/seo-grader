import { getSupabaseClient } from '@/lib/supabase';
import type { PlumbingInboundPromptConfig, PlumbingInboundPromptSettings } from '@/lib/bot/prompts/plumbingInboundSystemPrompt';

/**
 * Structured bot prompt settings (app layer, camelCase).
 * Maps from JSONB `settings` on public.bot_clients.
 */
export type BotClientPromptSettings = {
  allowedIssueCategories: string[];
  excludedServices: string[];
  emergencyEnabled: boolean;
  afterHoursMessage: string;
  doNotQuotePrices: boolean;
};

/**
 * Normalized voice-bot client config for prompt builders (camelCase).
 */
export type BotVoiceClientConfig = {
  businessName: string;
  serviceAreaText: string;
  businessHours: string;
  fallbackPhone: string;
  fallbackEmail: string;
  greetingStyle: string;
  pricingMode: string;
  promptVersion: string;
  settings: BotClientPromptSettings;
  tradeType: string;
};

/** Snake_case row shape from public.bot_clients (Supabase). */
type BotClientRow = {
  id: string;
  business_name: string | null;
  service_area_text: string | null;
  business_hours: string | null;
  fallback_phone: string | null;
  fallback_email: string | null;
  greeting_style: string | null;
  pricing_mode: string | null;
  prompt_version: string | null;
  settings: unknown;
  trade_type: string | null;
};

const EMPTY_SETTINGS: BotClientPromptSettings = {
  allowedIssueCategories: [],
  excludedServices: [],
  emergencyEnabled: true,
  afterHoursMessage: '',
  doNotQuotePrices: true,
};

function str(value: string | null | undefined, fallback = ''): string {
  if (value == null) return fallback;
  const t = String(value).trim();
  return t || fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string').map((s) => s.trim()).filter(Boolean);
}

function readBoolean(value: unknown, defaultValue: boolean): boolean {
  if (typeof value === 'boolean') return value;
  return defaultValue;
}

/**
 * Parses JSONB settings from DB into a fully defaulted structured object.
 * Accepts either camelCase or snake_case keys from stored JSON for resilience.
 */
export function parseBotClientSettingsJson(raw: unknown): BotClientPromptSettings {
  if (!isRecord(raw)) {
    return { ...EMPTY_SETTINGS };
  }

  const allowedCamel = raw.allowedIssueCategories;
  const allowedSnake = raw.allowed_issue_categories;
  const excludedCamel = raw.excludedServices;
  const excludedSnake = raw.excluded_services;

  const categories = readStringArray(
    Array.isArray(allowedCamel) ? allowedCamel : Array.isArray(allowedSnake) ? allowedSnake : []
  );
  const excluded = readStringArray(
    Array.isArray(excludedCamel) ? excludedCamel : Array.isArray(excludedSnake) ? excludedSnake : []
  );

  const emergencyCamel = raw.emergencyEnabled;
  const emergencySnake = raw.emergency_enabled;
  const emergency =
    typeof emergencyCamel === 'boolean'
      ? emergencyCamel
      : typeof emergencySnake === 'boolean'
        ? emergencySnake
        : EMPTY_SETTINGS.emergencyEnabled;

  const afterCamel = raw.afterHoursMessage;
  const afterSnake = raw.after_hours_message;
  const afterHours =
    typeof afterCamel === 'string'
      ? afterCamel.trim()
      : typeof afterSnake === 'string'
        ? afterSnake.trim()
        : EMPTY_SETTINGS.afterHoursMessage;

  const noQuoteCamel = raw.doNotQuotePrices;
  const noQuoteSnake = raw.do_not_quote_prices;
  const doNotQuote = readBoolean(
    typeof noQuoteCamel === 'boolean' ? noQuoteCamel : noQuoteSnake,
    EMPTY_SETTINGS.doNotQuotePrices
  );

  return {
    allowedIssueCategories: categories,
    excludedServices: excluded,
    emergencyEnabled: emergency,
    afterHoursMessage: afterHours,
    doNotQuotePrices: doNotQuote,
  };
}

function normalizeRow(row: BotClientRow): BotVoiceClientConfig {
  const settings = parseBotClientSettingsJson(row.settings);

  return {
    businessName: str(row.business_name, 'Our team'),
    serviceAreaText: str(row.service_area_text),
    businessHours: str(row.business_hours),
    fallbackPhone: str(row.fallback_phone),
    fallbackEmail: str(row.fallback_email),
    greetingStyle: str(row.greeting_style, 'Warm, professional, and straightforward.'),
    pricingMode: str(row.pricing_mode, 'callback_for_estimate'),
    promptVersion: str(row.prompt_version, '1'),
    settings,
    tradeType: str(row.trade_type, 'plumbing'),
  };
}

/** Maps normalized settings to the plumbing prompt builder shape (snake_case keys). */
export function toPlumbingInboundPromptSettings(s: BotClientPromptSettings): PlumbingInboundPromptSettings {
  const out: PlumbingInboundPromptSettings = {};
  if (s.allowedIssueCategories.length) out.allowed_issue_categories = s.allowedIssueCategories;
  if (s.excludedServices.length) out.excluded_services = s.excludedServices;
  out.emergency_enabled = s.emergencyEnabled;
  if (s.afterHoursMessage) out.after_hours_message = s.afterHoursMessage;
  out.do_not_quote_prices = s.doNotQuotePrices;
  return out;
}

/** Builds {@link PlumbingInboundPromptConfig} from normalized bot client config. */
export function toPlumbingInboundPromptConfig(config: BotVoiceClientConfig): PlumbingInboundPromptConfig {
  return {
    businessName: config.businessName,
    serviceAreaText: config.serviceAreaText,
    businessHours: config.businessHours,
    fallbackPhone: config.fallbackPhone,
    fallbackEmail: config.fallbackEmail,
    greetingStyle: config.greetingStyle,
    pricingMode: config.pricingMode,
    promptVersion: config.promptVersion,
    settings: toPlumbingInboundPromptSettings(config.settings),
    tradeType: config.tradeType,
  };
}

/**
 * Loads one row from public.bot_clients by primary key.
 * @throws Error if Supabase fails or no row exists for id
 */
export async function getBotClientConfig(id: string): Promise<BotVoiceClientConfig> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('bot_clients')
    .select(
      'id, business_name, service_area_text, business_hours, fallback_phone, fallback_email, greeting_style, pricing_mode, prompt_version, settings, trade_type'
    )
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load bot_clients: ${error.message}`);
  }

  if (!data) {
    throw new Error(`bot_clients row not found for id: ${id}`);
  }

  return normalizeRow(data as BotClientRow);
}
