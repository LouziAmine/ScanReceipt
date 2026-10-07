import { DomainError } from '../shared-kernel/domain-error';
import { normalizeKey } from '../shared-kernel/text';
import { type Category } from './category';

/**
 * Domain service: a rule that spans the whole set of categories, so it cannot live
 * inside a single Category aggregate.
 */
export function assertUniqueCategoryName(
  name: string,
  existing: readonly Category[],
  exceptId?: string,
): void {
  const key = normalizeKey(name);
  if (existing.some((c) => c.id !== exceptId && normalizeKey(c.name) === key)) {
    throw new DomainError(`"${name.trim()}" already exists.`, 'name');
  }
}
