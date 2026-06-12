/**
 * Parse a `?key=a,b,c` query param into a non-empty string[]. Repeated params
 * (`?key=a&key=b`) are also accepted and merged. Empty values are dropped so
 * a stray `?status=` doesn't widen the filter to "everything".
 *
 * Shared by list routes (activities, leads) so filter parsing can't drift.
 */
export function readMulti(searchParams: URLSearchParams, key: string): string[] {
  const raw = searchParams.getAll(key);
  return raw
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}
