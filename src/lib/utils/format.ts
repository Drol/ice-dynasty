/**
 * Formatting utilities for Ice Dynasty
 */

type NotationStyle = 'standard' | 'scientific' | 'engineering';

const SUFFIXES = [
  '',
  'K', // thousand
  'M', // million
  'B', // billion
  'T', // trillion
  'Qa', // quadrillion
  'Qi', // quintillion
  'Sx', // sextillion
  'Sp', // septillion
  'Oc', // octillion
  'No', // nonillion
  'Dc', // decillion
];

/**
 * Format a large number with appropriate suffix
 * Default: no decimals for cleaner UI
 */
export function formatNumber(
  value: number,
  style: NotationStyle = 'standard',
  decimals: number = 0
): string {
  if (!Number.isFinite(value)) return '0';
  if (value < 0) return '-' + formatNumber(-value, style, decimals);

  if (style === 'scientific') {
    return formatScientific(value, decimals);
  }

  if (style === 'engineering') {
    return formatEngineering(value, decimals);
  }

  // Standard notation with suffixes
  if (value < 1000) {
    return Math.round(value).toString();
  }

  const tier = Math.floor(Math.log10(value) / 3);

  if (tier >= SUFFIXES.length) {
    return formatScientific(value, decimals);
  }

  const scaled = value / Math.pow(1000, tier);
  // Use 1 decimal for values like 1.5K, but none for 15K
  const displayDecimals = scaled < 10 ? 1 : 0;
  return scaled.toFixed(displayDecimals) + SUFFIXES[tier];
}

function formatScientific(value: number, decimals: number): string {
  if (value === 0) return '0';
  const exponent = Math.floor(Math.log10(value));
  const mantissa = value / Math.pow(10, exponent);
  return `${mantissa.toFixed(decimals)}e${exponent}`;
}

function formatEngineering(value: number, decimals: number): string {
  if (value === 0) return '0';
  const exponent = Math.floor(Math.log10(value) / 3) * 3;
  const mantissa = value / Math.pow(10, exponent);
  return `${mantissa.toFixed(decimals)}e${exponent}`;
}

/**
 * Format time duration in human-readable format
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.floor(seconds)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours < 24) {
    return `${hours}h ${remainingMinutes}m`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  return `${days}d ${remainingHours}h`;
}

/**
 * Format money with currency symbol
 */
export function formatMoney(value: number, style: NotationStyle = 'standard'): string {
  return '$' + formatNumber(value, style);
}
