export const CANONICAL_TEST_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:54329/aso_computacion_admin_test?schema=public";

const UNSAFE_TARGET_MESSAGE =
  "TEST_DATABASE_URL must target the isolated Prisma test database. Set it to the documented canonical test URL.";

function normalizedSearchParams(url) {
  return [...url.searchParams.entries()]
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      const keyComparison = leftKey.localeCompare(rightKey);

      return keyComparison === 0 ? leftValue.localeCompare(rightValue) : keyComparison;
    })
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

function isCanonicalTestTarget(url) {
  const canonicalUrl = new URL(CANONICAL_TEST_DATABASE_URL);

  return (
    url.protocol === canonicalUrl.protocol &&
    url.username === canonicalUrl.username &&
    url.password === canonicalUrl.password &&
    url.hostname === canonicalUrl.hostname &&
    url.port === canonicalUrl.port &&
    url.pathname === canonicalUrl.pathname &&
    normalizedSearchParams(url) === normalizedSearchParams(canonicalUrl)
  );
}

export function assertSafePrismaTestTarget(value) {
  if (!value) {
    throw new Error(UNSAFE_TARGET_MESSAGE);
  }

  try {
    const url = new URL(value);

    if (!isCanonicalTestTarget(url)) {
      throw new Error(UNSAFE_TARGET_MESSAGE);
    }

    return url;
  } catch (error) {
    if (error instanceof Error && error.message === UNSAFE_TARGET_MESSAGE) {
      throw error;
    }

    throw new Error(UNSAFE_TARGET_MESSAGE);
  }
}
