/** A business rule was broken. The message is written for the person using the app. */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
