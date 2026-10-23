const PLACEHOLDER_PATTERN = /^__REPLACE_[A-Z0-9_]+__$/;

export function requireRuntimeValue(name: string, value: string | undefined): string {
  const normalizedValue = value?.trim();

  if (!value || !normalizedValue || PLACEHOLDER_PATTERN.test(normalizedValue)) {
    throw new Error(`${name} must be configured with a non-placeholder value.`);
  }

  return value;
}
