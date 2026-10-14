/** Values for the `{name}` placeholders of a message. */
export type MessageParams = Readonly<Record<string, string | number>>;

/** Fills `{name}` placeholders: "Limited to {max} characters." + { max: 80 }. */
export function fillMessage(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/**
 * A business rule was broken. `template` is written for the person using the app, in
 * English; the screens translate it and fill its `params`.
 */
export class DomainError extends Error {
  constructor(
    readonly template: string,
    readonly field?: string,
    readonly params?: MessageParams,
  ) {
    super(fillMessage(template, params));
    this.name = 'DomainError';
  }
}
