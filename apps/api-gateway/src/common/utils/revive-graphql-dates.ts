const GRAPHQL_DATE_FIELDS = new Set([
  'birthDate',
  'createdAt',
  'nextVisit',
  'readAt',
  'scheduledAt',
  'updatedAt',
]);

export function reviveGraphqlDates<T>(value: T, isDateValue = false): T {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map((item) => reviveGraphqlDates(item, isDateValue)) as T;
  }

  if (value instanceof Date) return value;

  if (typeof value === 'string' && isDateValue) {
    const date = new Date(value);
    return (Number.isNaN(date.getTime()) ? value : date) as T;
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        reviveGraphqlDates(nestedValue, GRAPHQL_DATE_FIELDS.has(key)),
      ]),
    ) as T;
  }

  return value;
}
