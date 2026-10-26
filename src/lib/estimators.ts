/**
 * Transparent, deliberately simple models. Every constant is named so the
 * assumptions are visible and easy to tune. These are estimates, not lab results.
 */

export const NOMINAL_CELL_VOLTAGE = 3.85; // V, typical Li-ion nominal

export interface UsageProfile {
  /** Hours per day the screen is on. */
  screenOnHours: number;
  /** Average display brightness, 0..1. */
  brightness: number;
  /** Refresh rate in use, Hz. */
  refreshHz: number;
  /** Average SoC/modem load, 0..1 (0 = idle-ish browsing, 1 = sustained gaming). */
  load: number;
}

export interface EnduranceResult {
  /** Average draw while the screen is on, W. */
  activePowerW: number;
  /** Average draw in standby, W. */
  standbyPowerW: number;
  /** Usable energy after aging/conversion losses, Wh. */
  usableWh: number;
  /** Screen-on hours obtainable from one full charge at this duty cycle. */
  screenOnHoursPerCharge: number;
  /** Days of use per charge at this profile. */
  daysPerCharge: number;
}

const SCREEN_BASE_W = 0.25;
const SCREEN_PER_HZ_W = 0.003;
const SCREEN_PER_BRIGHTNESS_W = 0.8;
const SOC_IDLE_W = 0.4;
const SOC_FULL_LOAD_W = 2.2;
const STANDBY_W = 0.05;
const CONVERSION_EFFICIENCY = 0.9;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function estimateEndurance(capacityMah: number, usage: UsageProfile): EnduranceResult {
  const brightness = clamp(usage.brightness, 0, 1);
  const load = clamp(usage.load, 0, 1);
  const screenOn = clamp(usage.screenOnHours, 0, 24);

  const screenW = SCREEN_BASE_W + SCREEN_PER_HZ_W * Math.max(0, usage.refreshHz) + SCREEN_PER_BRIGHTNESS_W * brightness;
  const socW = SOC_IDLE_W + (SOC_FULL_LOAD_W - SOC_IDLE_W) * load;
  const activePowerW = screenW + socW;
  const usableWh = (Math.max(0, capacityMah) / 1000) * NOMINAL_CELL_VOLTAGE * CONVERSION_EFFICIENCY;

  const duty = screenOn / 24;
  const avgW = duty * activePowerW + (1 - duty) * STANDBY_W;
  const hoursPerCharge = avgW > 0 ? usableWh / avgW : 0;

  return {
    activePowerW,
    standbyPowerW: STANDBY_W,
    usableWh,
    screenOnHoursPerCharge: hoursPerCharge * duty,
    daysPerCharge: duty > 0 ? hoursPerCharge / 24 : 0,
  };
}

/* ---------- Camera sensor visualizer ---------- */

/**
 * Parse an optical format like "1/1.28in" into its denominator.
 * Returns undefined for anything it cannot read.
 */
export function parseOpticalFormat(format: string | undefined): number | undefined {
  if (!format) return undefined;
  const m = /1\s*\/\s*(\d+(?:\.\d+)?)/.exec(format);
  return m ? Number(m[1]) : undefined;
}

/** Diagonal of a 1-inch-type sensor, mm. Used as the scaling anchor. */
const ONE_INCH_DIAGONAL_MM = 13.2;

/**
 * Approximate sensor geometry from optical format, assuming a 4:3 active area.
 * Real sensors vary by manufacturer, so treat this as a visual comparison aid.
 */
export function sensorGeometry(format: string | undefined): { diagonalMm: number; widthMm: number; heightMm: number; areaMm2: number } | undefined {
  const denom = parseOpticalFormat(format);
  if (!denom) return undefined;
  const diagonalMm = ONE_INCH_DIAGONAL_MM / denom;
  const widthMm = diagonalMm * 0.8;
  const heightMm = diagonalMm * 0.6;
  return { diagonalMm, widthMm, heightMm, areaMm2: widthMm * heightMm };
}

/* ---------- Value calculator ---------- */

/** Benchmark points per $100 of launch price. Returns undefined if either input is unusable. */
export function pointsPer100Usd(score: number | undefined, priceUsd: number | undefined): number | undefined {
  if (!score || !priceUsd || score <= 0 || priceUsd <= 0) return undefined;
  return (score / priceUsd) * 100;
}
