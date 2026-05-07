// Scheduling-intent deflection — types, defaults, utils, renderer.
//
// Single source of truth shared by:
//   - universal-bison-webhook : validates the classifier's intent label
//   - process-auto-reply-queue : renders the deterministic deflection draft
//   - audit-ai-reply           : (indirectly via the prompt) flags drafts that
//                                confirm a specific time when they shouldn't
//
// All Maverick clients run home-insurance-renewal so DEFAULT_HIR_TEMPLATES
// ships as the global default. Per-workspace JSONB overrides on
// client_registry.auto_reply_deflection_templates take precedence.

export type SchedulingIntent =
  | 'none'
  | 'specific_time'
  | 'soft_schedule'
  | 'vague_availability'
  | 'calendar_request'
  | 'confirmation';

export const SCHEDULING_INTENTS: ReadonlyArray<SchedulingIntent> = [
  'none',
  'specific_time',
  'soft_schedule',
  'vague_availability',
  'calendar_request',
  'confirmation',
] as const;

export function isSchedulingIntent(v: unknown): v is SchedulingIntent {
  return typeof v === 'string'
    && (SCHEDULING_INTENTS as ReadonlyArray<string>).includes(v);
}

export type DeflectionTemplateMap = Partial<
  Record<Exclude<SchedulingIntent, 'none'>, string>
>;

// Defaults tuned for home-insurance-renewal context. Intentionally do NOT
// re-pitch the renewal — the lead already replied positively, so the
// deflection's only job is to acknowledge + hand off to the named assistant.
// The actual renewal conversation happens on the call.
export const DEFAULT_HIR_TEMPLATES: Required<DeflectionTemplateMap> = {
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

// What the templates render when {timing_phrase} would otherwise be empty
// or low-confidence. Keeps the sentence grammatical without committing to
// a phrase the classifier didn't actually pull from the reply.
const TIMING_PHRASE_FALLBACK = 'shortly';

// What {Assistant} renders when cc_emails doesn't yield a parseable name.
// Templates use "our team" gracefully — "{Assistant} will reach out" still
// reads fine as "our team will reach out".
const ASSISTANT_FALLBACK = 'our team';

/**
 * Extract the assistant's first name from cc_emails. The first cc address
 * on a Maverick reply template is the agent's assistant (Andrew, Becky, …).
 *
 * Returns null on anything we can't parse so the caller can fall back to
 * "our team" rather than render a weird value.
 *
 * Examples:
 *   andrew.jflowerree1@farmersagency.com -> "Andrew"
 *   Becky.jschroder@farmersagency.com    -> "Becky"
 *   becky_jones@x.com                    -> "Becky"
 *   123@x.com                            -> null
 *   ''                                   -> null
 */
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
  intent: Exclude<SchedulingIntent, 'none'>;
  // Lead's first name. Empty string -> renders as "Hi there" to avoid "Hi ,".
  first?: string | null;
  // The assistant's first name (output of getAssistantFirstName) or null.
  assistant: string | null;
  // The verbatim phrase the classifier extracted ("Monday at 2pm", "tomorrow")
  // or null if it couldn't extract one cleanly.
  timingPhrase?: string | null;
  // Per-workspace overrides — any subset of the five buckets. Missing keys
  // fall through to DEFAULT_HIR_TEMPLATES.
  overrides?: DeflectionTemplateMap | null;
}

export interface RenderedDeflection {
  text: string;
  templateUsed: 'override' | 'default';
}

/**
 * Render a deflection draft for a given intent + workspace context.
 * Pure function — no I/O. Safe to test in isolation.
 */
export function renderDeflection(input: RenderInput): RenderedDeflection {
  const overrideText = input.overrides?.[input.intent];
  const template = overrideText && overrideText.trim().length > 0
    ? overrideText
    : DEFAULT_HIR_TEMPLATES[input.intent];

  const first = (input.first ?? '').trim() || 'there';
  const assistant = (input.assistant ?? '').trim() || ASSISTANT_FALLBACK;
  const timingPhrase = (input.timingPhrase ?? '').trim() || TIMING_PHRASE_FALLBACK;

  const text = template
    .replace(/\{first\}/g, first)
    .replace(/\{Assistant\}/g, assistant)
    .replace(/\{timing_phrase\}/g, timingPhrase)
    // Tidy up any double-spaces that result from a stripped-then-fallback
    // phrase (defensive — the templates above don't currently produce this).
    .replace(/  +/g, ' ')
    .trim();

  return {
    text,
    templateUsed: overrideText && overrideText.trim().length > 0 ? 'override' : 'default',
  };
}

// Sentinel value the worker writes to auto_reply_queue.generation_model when
// it took the deflection path. Lets analytics / debugging see at a glance
// that no LLM was involved in drafting the text.
export const DEFLECTION_GENERATION_MODEL = 'deterministic_deflection_v1';
