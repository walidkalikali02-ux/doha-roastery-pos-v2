function toNumber(value: unknown, fallback: number = 0): number {
  if (value === null || value === undefined) return fallback;
  const num = Number(value);
  return isNaN(num) ? fallback : num;
}

function safeDivide(numerator: number, denominator: number, fallback: number = 0): number {
  if (denominator === 0) return fallback;
  return numerator / denominator;
}

export { toNumber, safeDivide };