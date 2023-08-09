/**
 * Convert strings into title case
 *
 * @example
 * `linz-imagery-bucket` => `LinzImageryBucket`
 * `linz_imagery_bucket` => `LinzImageryBucket`
 * `linz imagery bucket` => `LinzImageryBucket`
 *
 * @param text String to title case
 * @returns titled case string
 */
export function titleCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/(?:^|[\s-_/])\w/g, (match) => match.toUpperCase())
    .replace(/[\s-_]/g, '');
}
