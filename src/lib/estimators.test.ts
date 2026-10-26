import { describe, expect, it } from 'vitest';
import { estimateEndurance, parseOpticalFormat, pointsPer100Usd, sensorGeometry } from './estimators';
import { compareDevices, winnersFor } from './compare';
import { SPEC_FIELDS } from '../data/specs';
import { DEVICES } from '../data/devices';
import { createDeviceSearch } from './search';

const base = { screenOnHours: 5, brightness: 0.5, refreshHz: 120, load: 0.4 };

describe('estimateEndurance', () => {
  it('gives more endurance for bigger batteries', () => {
    const small = estimateEndurance(3000, base);
    const big = estimateEndurance(5000, base);
    expect(big.screenOnHoursPerCharge).toBeGreaterThan(small.screenOnHoursPerCharge);
  });
  it('drains faster at higher brightness and load', () => {
    const dim = estimateEndurance(5000, { ...base, brightness: 0.2 });
    const bright = estimateEndurance(5000, { ...base, brightness: 0.9 });
    expect(bright.screenOnHoursPerCharge).toBeLessThan(dim.screenOnHoursPerCharge);
    const idle = estimateEndurance(5000, { ...base, load: 0 });
    const gaming = estimateEndurance(5000, { ...base, load: 1 });
    expect(gaming.screenOnHoursPerCharge).toBeLessThan(idle.screenOnHoursPerCharge);
  });
  it('clamps invalid inputs and never returns NaN', () => {
    const r = estimateEndurance(-100, { screenOnHours: 99, brightness: 5, refreshHz: 120, load: -2 });
    expect(Number.isFinite(r.daysPerCharge)).toBe(true);
    expect(r.usableWh).toBe(0);
  });
  it('days per charge is consistent with a 24h duty cycle', () => {
    const r = estimateEndurance(5000, { ...base, screenOnHours: 24 });
    expect(r.daysPerCharge).toBeCloseTo(r.screenOnHoursPerCharge / 24, 6);
  });
});

describe('sensor geometry', () => {
  it('parses optical formats', () => {
    expect(parseOpticalFormat('1/1.28in')).toBe(1.28);
    expect(parseOpticalFormat(undefined)).toBeUndefined();
    expect(parseOpticalFormat('bogus')).toBeUndefined();
  });
  it('bigger formats produce bigger area', () => {
    const big = sensorGeometry('1/1.28in')!;
    const small = sensorGeometry('1/2.5in')!;
    expect(big.areaMm2).toBeGreaterThan(small.areaMm2);
  });
});

describe('pointsPer100Usd', () => {
  it('computes ratio and rejects bad inputs', () => {
    expect(pointsPer100Usd(3000, 1000)).toBe(300);
    expect(pointsPer100Usd(undefined, 1000)).toBeUndefined();
    expect(pointsPer100Usd(3000, 0)).toBeUndefined();
  });
});

describe('compareDevices', () => {
  const [iphone, s24, pixel, op12] = DEVICES;

  it('picks the higher-is-better winner for numeric rows', () => {
    const field = SPEC_FIELDS.find((f) => f.path === 'display.peak_nits')!;
    expect(winnersFor(field, [2000, 2600, undefined])).toEqual([1]);
  });
  it('lower-is-better rows favor the smaller value', () => {
    const field = SPEC_FIELDS.find((f) => f.path === 'battery.wired_w')!;
    expect(winnersFor({ ...field, better: 'lower' }, [27, 45])).toEqual([0]);
  });
  it('returns no winner when all values tie', () => {
    const field = SPEC_FIELDS.find((f) => f.path === 'soc.ram_gb')!;
    expect(winnersFor(field, [12, 12])).toEqual([]);
  });
  it('produces an overall score for every device', () => {
    const r = compareDevices([iphone, s24, pixel, op12]);
    expect(r.overall).toHaveLength(4);
    r.overall.forEach((s) => {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    });
  });
  it('custom weights can change the overall winner', () => {
    const equal = compareDevices([iphone, s24]);
    const batteryOnly = compareDevices([iphone, s24], {
      'Battery & Charging': 1,
      Display: 0,
      'SoC & Memory': 0,
      Cameras: 0,
      'Audio & Haptics': 0,
      Connectivity: 0,
      Software: 0,
      'Body & SAR': 0,
    });
    expect(batteryOnly.overallWinners).toEqual([1]); // S24 Ultra has the bigger battery
    expect(equal.overall).toHaveLength(2);
  });
});

describe('search', () => {
  const search = createDeviceSearch(DEVICES);
  it('returns everything for an empty query', () => {
    expect(search('')).toHaveLength(DEVICES.length);
  });
  it('tolerates typos in model names', () => {
    expect(search('gallxy s24')[0]?.id).toBe('samsung-galaxy-s24-ultra');
  });
  it('matches by chipset', () => {
    expect(search('tensor')[0]?.id).toBe('google-pixel-8-pro');
  });
});
