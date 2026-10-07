import { DomainError } from '@domain';

/** An application-level failure the person can act on (lost scan, damaged backup…). */
export class AppError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** The message to show for an error: ours are written for people, anything else is generic. */
export function messageOf(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  return error instanceof AppError || error instanceof DomainError ? error.message : fallback;
}
