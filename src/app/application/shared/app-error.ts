import { DomainError, type MessageParams, fillMessage } from '@domain';

/** An application-level failure the person can act on (lost scan, damaged backup…). */
export class AppError extends Error {
  readonly params?: MessageParams;

  constructor(
    readonly template: string,
    details: { readonly cause?: unknown; readonly params?: MessageParams } = {},
  ) {
    super(fillMessage(template, details.params), { cause: details.cause });
    this.name = 'AppError';
    if (details.params) this.params = details.params;
  }
}

/** A message for the person, in English, with the values of its `{name}` placeholders. */
export interface UserMessage {
  readonly text: string;
  readonly params?: MessageParams;
}

/** The message to show for an error: ours are written for people, anything else is generic. */
export function messageOf(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): UserMessage {
  if (error instanceof AppError || error instanceof DomainError) {
    return error.params ? { text: error.template, params: error.params } : { text: error.template };
  }
  return { text: fallback };
}
