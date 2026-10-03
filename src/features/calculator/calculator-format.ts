export type DecimalPlaces = number | null;

export interface FractionParts {
  numerator: number;
  denominator: number;
}

const MAX_FRACTION_DENOMINATOR = 10_000;
const FRACTION_TOLERANCE = 1e-10;

export function normaliseNumber(value: number) {
  return value === 0 ? 0 : value;
}

export function formatNumber(value: number, decimalPlaces: DecimalPlaces = null) {
  const normalised = normaliseNumber(value);
  const absolute = Math.abs(normalised);

  if (decimalPlaces !== null) {
    if (absolute >= 1e12) return normalised.toExponential(decimalPlaces);
    const rounded = Number(normalised.toFixed(decimalPlaces));
    return rounded.toFixed(decimalPlaces);
  }

  if (absolute !== 0 && (absolute >= 1e12 || absolute < 1e-9)) {
    return Number.parseFloat(normalised.toPrecision(12))
      .toExponential(10)
      .replace(/\.0+e/, 'e')
      .replace(/(\.\d*?[1-9])0+e/, '$1e');
  }

  return String(Number.parseFloat(normalised.toPrecision(12)));
}

export function fractionPartsForValue(value: number): FractionParts | null {
  if (!Number.isFinite(value) || Number.isInteger(value)) return null;

  const sign = value < 0 ? -1 : 1;
  const target = Math.abs(value);
  let remainder = target;
  let previousNumerator = 0;
  let numerator = 1;
  let previousDenominator = 1;
  let denominator = 0;

  for (let iteration = 0; iteration < 32; iteration += 1) {
    const whole = Math.floor(remainder);
    const nextNumerator = whole * numerator + previousNumerator;
    const nextDenominator = whole * denominator + previousDenominator;

    if (nextDenominator > MAX_FRACTION_DENOMINATOR) break;

    const approximation = nextNumerator / nextDenominator;
    if (nextDenominator > 1 && Math.abs(approximation - target) <= FRACTION_TOLERANCE) {
      return { numerator: sign * nextNumerator, denominator: nextDenominator };
    }

    previousNumerator = numerator;
    numerator = nextNumerator;
    previousDenominator = denominator;
    denominator = nextDenominator;

    const fractional = remainder - whole;
    if (fractional <= Number.EPSILON) break;
    remainder = 1 / fractional;
  }

  return null;
}

export function fractionForValue(value: number) {
  const fraction = fractionPartsForValue(value);
  return fraction ? `${fraction.numerator}/${fraction.denominator}` : null;
}
