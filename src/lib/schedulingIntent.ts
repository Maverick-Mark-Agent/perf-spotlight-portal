// Frontend twin of supabase/functions/_shared/schedulingIntent.ts.
//
// Two copies exist because the edge-function module is Deno-style (URL imports,
// .ts extensions) and won't bundle through Vite. Keep these two files in sync
// when changing default templates, the assistant-name util, or the render logic.

export type SchedulingIntent =
  | 'none'
  | 'specific_time'
  | 'soft_schedule'
  | 'vague_availability'
  | 'calendar_request'
  | 'confirmation';

export const DEFLECTION_BUCKETS = [
  'specific_time',
  'soft_schedule',
  'vague_availability',
  'calendar_request',
  'confirmation',
] as const;
export type DeflectionBucket = typeof DEFLECTION_BUCKETS[number];

export type DeflectionTemplateMap = Partial<Record<DeflectionBucket, string>>;

export const DEFAULT_HIR_TEMPLATES: Record<DeflectionBucket, string> = {
  specific_time:
    'Hi {first}, thanks for getting back to me — and {timing_phrase} sounds promising. {Assistant} on our team handles the calendar and will reach out shortly to confirm that time (or find something close).',
  soft_schedule:
    'Hi {first}, sounds good. {Assistant} will reach out {timing_phrase} to get something on the books.',
  vague_availability:
    'Hi {first}, perfect — {Assistant} will be in touch {timing_phrase} to find a time that works.',
  calendar_request:
    'Hi {first}, you got it — {Assistant} will get a calendar invite over to you shortly.',
  confirmation:
    'Hi {first}, great — {Assistant} will follow up shortly to lock in a time.',
};

export const BUCKET_LABELS: Record<DeflectionBucket, string> = {
  specific_time: 'Specific time proposed',
  soft_schedule: 'Soft scheduling',
  vague_availability: 'Vague availability',
  calendar_request: 'Calendar invite request',
  confirmation: 'Confirmation / agreement',
};

export const BUCKET_HINTS: Record<DeflectionBucket, string> = {
  specific_time: 'Lead names a specific day and time (e.g. "Monday at 2pm").',
  soft_schedule: 'Lead suggests a relative timeframe (e.g. "let\'s chat tomorrow").',
  vague_availability: 'Lead expresses general availability (e.g. "I\'m around this week").',
  calendar_request: 'Lead asks for an invite (e.g. "send me an invite").',
  confirmation: 'Lead briefly confirms / agrees (e.g. "yes that works", "sounds good").',
};

const TIMING_PHRASE_FALLBACK = 'shortly';
const ASSISTANT_FALLBACK = 'our team';

export function getAssistantFirstName(
  ccEmails: ReadonlyArray<string> | null | undefined,
): string | null {
  if (!ccEmails || ccEmails.length === 0) return null;
  const first = (ccEmails[0] ?? '').trim();
  if (!first) return null;

  const at = first.indexOf('@');
  const local = (at > 0 ? first.slice(0, at) : first).trim();
  if (!local) return null;

  const token = local.split(/[._]/)[0] ?? '';
  const stripped = token.replace(/\d+$/, '');
  if (!stripped || !/^[a-zA-Z]+$/.test(stripped)) return null;

  return stripped.charAt(0).toUpperCase() + stripped.slice(1).toLowerCase();
}

interface RenderInput {
  intent: DeflectionBucket;
  first?: string | null;
  assistant: string | null;
  timingPhrase?: string | null;
  overrides?: DeflectionTemplateMap | null;
}

export function renderDeflection(input: RenderInput): string {
  const overrideText = input.overrides?.[input.intent];
  const template = overrideText && overrideText.trim().length > 0
    ? overrideText
    : DEFAULT_HIR_TEMPLATES[input.intent];

  const first = (input.first ?? '').trim() || 'there';
  const assistant = (input.assistant ?? '').trim() || ASSISTANT_FALLBACK;
  const timingPhrase = (input.timingPhrase ?? '').trim() || TIMING_PHRASE_FALLBACK;

  return template
    .replace(/\{first\}/g, first)
    .replace(/\{Assistant\}/g, assistant)
    .replace(/\{timing_phrase\}/g, timingPhrase)
    .replace(/  +/g, ' ')
    .trim();
}
