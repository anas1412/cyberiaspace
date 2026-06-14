/**
 * Calculate how much to shrink a fixed-width card so it fits inside a
 * narrower column.  Returns 1 if the column is wide enough.
 *
 * @param cardWidth     — the card's intrinsic width (e.g. 280px)
 * @param colWidth      — the available column width
 * @param padding       — optional pixel padding inside the column (default 8)
 * @param minScale      — lowest scale allowed (default 0.3)
 */
export function cardScaleForWidth(
  cardWidth: number,
  colWidth: number,
  padding = 8,
  minScale = 0.3,
): number {
  const available = colWidth - padding;
  if (available <= 0) return minScale;
  return Math.max(minScale, Math.min(1, available / cardWidth));
}
