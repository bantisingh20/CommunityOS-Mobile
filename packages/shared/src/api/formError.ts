import { ApiRequestError } from './errors';
import type { ErrorCode } from '../models/envelope';

/** A screen-ready view of a failed request: one banner message + a per-field error map. */
export interface FormErrorView {
  /** Safe, user-facing message for the form-level banner / popup. Never leaks internals. */
  message: string;
  /** `{ fieldName: reason }` for binding under each input (empty when none). */
  fieldErrors: Readonly<Record<string, string>>;
}

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

/**
 * Friendly, user-facing message per stable {@link ErrorCode}. We deliberately DON'T show the raw
 * server message to the user (it can read technical or leak hints); instead each code maps to plain
 * language. Field-level reasons (from the envelope `fieldErrors`) are still shown under inputs.
 */
const FRIENDLY_BY_CODE: Partial<Record<ErrorCode, string>> = {
  // Neutral, context-free message: UNAUTHENTICATED happens both on a bad login AND when a session
  // ends mid-use (token expired / revoked elsewhere). The login screen overrides this with a
  // credential-specific message for its OWN failed sign-in; everywhere else "session ended" is
  // correct — never claim wrong credentials on an in-app screen.
  UNAUTHENTICATED: 'Your session has ended. Please sign in again.',
  FORBIDDEN: "You don't have permission to do that.",
  NOT_FOUND: "We couldn't find what you were looking for.",
  CONFLICT: 'That action conflicts with the current state. Please refresh and try again.',
  VALIDATION_ERROR: 'Please check the highlighted fields and try again.',
  RATE_LIMITED: 'Too many attempts. Please wait a moment and try again.',
  PAYLOAD_TOO_LARGE: 'That file is too large. Please choose a smaller one.',
  UNSUPPORTED_MEDIA_TYPE: 'That file type is not supported.',
  INTEGRATION_FAILURE: "We couldn't reach the server. Check your connection and try again.",
  INTERNAL_ERROR: GENERIC_MESSAGE,
};

/** The friendly top-line message for an error code (falls back to the generic message). */
export function friendlyMessageForCode(code: ErrorCode): string {
  return FRIENDLY_BY_CODE[code] ?? GENERIC_MESSAGE;
}

/**
 * Normalize any thrown error from the API client into a {@link FormErrorView} the screens render.
 * The banner/popup message is a FRIENDLY, code-mapped sentence (never the raw server/internal text,
 * security first). Field-level reasons from the envelope are preserved for binding under inputs.
 * A VALIDATION_ERROR that carries only field errors suppresses the banner so messages aren't
 * duplicated. A transport/parse failure (not an ApiRequestError) collapses to the generic message.
 */
export function toFormError(err: unknown): FormErrorView {
  // Diagnostic log (dev aid): record the REAL error — code, HTTP status, correlation id and the
  // server message — to the console/logcat so an intermittent failure can be diagnosed from
  // `adb logcat`. The user still only sees the friendly message below. No secrets are logged
  // (tokens/passwords never reach an ApiRequestError; the server message is a safe business line).
  if (err instanceof ApiRequestError) {
    // eslint-disable-next-line no-console
    console.warn(
      `[API-ERROR] code=${err.code} http=${err.httpStatus} corr=${err.correlationId} msg=${err.message}` +
        (Object.keys(err.fieldErrorMap).length ? ` fields=${JSON.stringify(err.fieldErrorMap)}` : ''),
    );
  } else if (err instanceof Error) {
    // eslint-disable-next-line no-console
    console.warn(`[API-ERROR] non-api error: ${err.name}: ${err.message}`);
  } else {
    // eslint-disable-next-line no-console
    console.warn('[API-ERROR] unknown error value');
  }

  if (err instanceof ApiRequestError) {
    const hasFieldErrors = Object.keys(err.fieldErrorMap).length > 0;
    // For validation errors with per-field messages, suppress the banner (fields already explain it).
    if (err.code === 'VALIDATION_ERROR' && hasFieldErrors) {
      return { message: '', fieldErrors: err.fieldErrorMap };
    }
    // CONFLICT / VALIDATION_ERROR carry a specific, safe, user-facing business message from the
    // server (e.g. "That phone is already in use", "This resident already has a login"). Prefer it
    // over the generic code-mapped line so the user sees the real reason; fall back to the friendly
    // code message when the server didn't provide text.
    if ((err.code === 'CONFLICT' || err.code === 'VALIDATION_ERROR') && err.message.trim().length > 0) {
      return { message: err.message, fieldErrors: err.fieldErrorMap };
    }
    // A locked account is UNAUTHENTICATED, but the user needs the SPECIFIC reason (not the generic
    // "wrong credentials") so they know to wait rather than keep guessing their password. The server
    // sends a safe "temporarily locked" message — surface it verbatim for that case.
    if (err.code === 'UNAUTHENTICATED' && /lock/i.test(err.message)) {
      return { message: err.message, fieldErrors: err.fieldErrorMap };
    }
    return { message: friendlyMessageForCode(err.code), fieldErrors: err.fieldErrorMap };
  }
  return { message: GENERIC_MESSAGE, fieldErrors: {} };
}
