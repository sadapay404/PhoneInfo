import type { Category, SpecField } from './types';

const yesNo = (v: unknown) => (v === true ? 'Yes' : v === false ? 'No' : '—');
const num = (suffix = '') => (v: unknown) => (typeof v === 'number' ? `${v}${suffix}` : '—');

/**
 * Single source of truth for every displayable/comparable spec.
 * Detail cards, the compare matrix, and winner logic all read from here.
 */
export const SPEC_FIELDS: SpecField[] = [
  // Display
  { path: 'display.type', label: 'Panel', category: 'Display' },
  { path: 'display.size_in', label: 'Size', category: 'Display', unit: 'in', format: num('"') },
  { path: 'display.resolution', label: 'Resolution', category: 'Display', format: (v) => (Array.isArray(v) ? `${v[0]}×${v[1]}` : '—') },
  { path: 'display.ppi', label: 'Pixel density', category: 'Display', unit: 'ppi', better: 'higher', format: num(' ppi') },
  { path: 'display.refresh_hz_max', label: 'Max refresh', category: 'Display', unit: 'Hz', better: 'higher', format: num(' Hz') },
  { path: 'display.peak_nits', label: 'Peak brightness', category: 'Display', unit: 'nits', better: 'higher', format: num(' nits') },
  { path: 'display.outdoor_nits', label: 'Outdoor brightness', category: 'Display', unit: 'nits', better: 'higher', format: num(' nits') },
  { path: 'display.glass', label: 'Cover glass', category: 'Display' },
  { path: 'display.panel_tech', label: 'Panel technology', category: 'Display' },

  // SoC & Memory
  { path: 'soc.chipset', label: 'Chipset', category: 'SoC & Memory' },
  { path: 'soc.brand', label: 'SoC brand', category: 'SoC & Memory' },
  { path: 'soc.process_nm', label: 'Process node', category: 'SoC & Memory', unit: 'nm', better: 'lower', format: num(' nm') },
  { path: 'soc.cpu', label: 'CPU layout', category: 'SoC & Memory' },
  { path: 'soc.gpu', label: 'GPU', category: 'SoC & Memory' },
  { path: 'soc.ram_gb', label: 'RAM', category: 'SoC & Memory', unit: 'GB', better: 'higher', format: num(' GB') },
  { path: 'soc.storage_gb', label: 'Storage options', category: 'SoC & Memory', format: (v) => (Array.isArray(v) ? v.map((s) => `${s}GB`).join(' · ') : '—') },
  { path: 'memory.expandable', label: 'microSD slot', category: 'SoC & Memory', format: yesNo },

  // Cameras
  { path: 'camera.main.mp', label: 'Main', category: 'Cameras', unit: 'MP', better: 'higher', format: num(' MP') },
  { path: 'camera.main.aperture', label: 'Main aperture', category: 'Cameras' },
  { path: 'camera.main.sensor_model', label: 'Main sensor', category: 'Cameras' },
  { path: 'camera.main.sensor_format', label: 'Main sensor format', category: 'Cameras' },
  { path: 'camera.main.ois', label: 'Main stabilization', category: 'Cameras' },
  { path: 'camera.ultrawide.mp', label: 'Ultrawide', category: 'Cameras', unit: 'MP', better: 'higher', format: num(' MP') },
  { path: 'camera.telephoto.mp', label: 'Telephoto', category: 'Cameras', unit: 'MP', better: 'higher', format: num(' MP') },
  { path: 'camera.telephoto.zoom_x', label: 'Telephoto zoom', category: 'Cameras', unit: 'x', better: 'higher', format: num('x') },
  { path: 'camera.front.mp', label: 'Front', category: 'Cameras', unit: 'MP', better: 'higher', format: num(' MP') },

  // Audio & Haptics
  { path: 'audio.stereo_speakers', label: 'Stereo speakers', category: 'Audio & Haptics', format: yesNo },
  { path: 'audio.headphone_jack', label: '3.5 mm jack', category: 'Audio & Haptics', format: yesNo },
  { path: 'audio.haptics', label: 'Haptic motor', category: 'Audio & Haptics' },

  // Connectivity
  { path: 'connectivity.wifi', label: 'Wi-Fi', category: 'Connectivity' },
  { path: 'connectivity.bluetooth', label: 'Bluetooth', category: 'Connectivity' },
  { path: 'connectivity.codecs', label: 'Bluetooth codecs', category: 'Connectivity', format: (v) => (Array.isArray(v) ? v.join(', ') : '—') },
  { path: 'connectivity.five_g', label: '5G', category: 'Connectivity', format: yesNo },
  { path: 'connectivity.nfc', label: 'NFC', category: 'Connectivity', format: yesNo },
  { path: 'connectivity.uwb', label: 'UWB', category: 'Connectivity', format: yesNo },
  { path: 'connectivity.ir_blaster', label: 'IR blaster', category: 'Connectivity', format: yesNo },

  // Battery & Charging
  { path: 'battery.capacity_mah', label: 'Capacity', category: 'Battery & Charging', unit: 'mAh', better: 'higher', format: num(' mAh') },
  { path: 'battery.chemistry', label: 'Chemistry', category: 'Battery & Charging' },
  { path: 'battery.wired_w', label: 'Wired charging', category: 'Battery & Charging', unit: 'W', better: 'higher', format: num(' W') },
  { path: 'battery.wireless_w', label: 'Wireless charging', category: 'Battery & Charging', unit: 'W', better: 'higher', format: num(' W') },
  { path: 'battery.reverse_w', label: 'Reverse wireless', category: 'Battery & Charging', unit: 'W', format: num(' W') },
  { path: 'battery.video_playback_h', label: 'Video playback (vendor claim)', category: 'Battery & Charging', unit: 'h', better: 'higher', format: num(' h') },

  // Software
  { path: 'software.launch_os', label: 'Launch OS', category: 'Software' },
  { path: 'software.os_family', label: 'OS family', category: 'Software' },
  { path: 'software.os_updates_years', label: 'OS updates', category: 'Software', unit: 'years', better: 'higher', format: num(' years') },
  { path: 'software.security_updates_years', label: 'Security updates', category: 'Software', unit: 'years', better: 'higher', format: num(' years') },
  { path: 'software.bootloader_unlockable', label: 'Bootloader unlockable', category: 'Software', format: yesNo },

  // Body & SAR
  { path: 'year', label: 'Launch year', category: 'Body & SAR', better: 'higher' },
  { path: 'body.weight_g', label: 'Weight', category: 'Body & SAR', unit: 'g', better: 'lower', format: num(' g') },
  { path: 'body.dimensions_mm', label: 'Dimensions', category: 'Body & SAR', format: (v) => (Array.isArray(v) ? v.join(' × ') + ' mm' : '—') },
  { path: 'body.ip_rating', label: 'Ingress rating', category: 'Body & SAR' },
  { path: 'body.stylus', label: 'Stylus', category: 'Body & SAR', format: yesNo },
  { path: 'repair.sar_head_eu_wkg', label: 'SAR head (EU)', category: 'Body & SAR', unit: 'W/kg', better: 'lower', format: num(' W/kg') },
  { path: 'repair.sar_body_eu_wkg', label: 'SAR body (EU)', category: 'Body & SAR', unit: 'W/kg', better: 'lower', format: num(' W/kg') },
];

export const CATEGORIES: Category[] = [
  'Display',
  'SoC & Memory',
  'Cameras',
  'Audio & Haptics',
  'Connectivity',
  'Battery & Charging',
  'Software',
  'Body & SAR',
];

/** Read a dot-path value off a device, returning undefined if any segment is missing. */
export function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function formatValue(field: SpecField, value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  if (field.format) return field.format(value);
  return String(value);
}
