/**
 * Device ontology. Every field is optional on purpose: the catalog is
 * incomplete by nature, and the UI renders missing values as an em dash
 * instead of guessing. Units are encoded in field names.
 */

export interface CameraSpec {
  mp?: number;
  aperture?: string;          // e.g. "f/1.78"
  focal_mm?: number;          // 35mm-equivalent focal length
  sensor_model?: string;      // e.g. "ISOCELL HP2"
  sensor_format?: string;     // optical format, e.g. "1/1.4in"
  ois?: string;               // "sensor-shift" | "lens-shift" | "gimbal" | "none"
  zoom_x?: number;            // optical zoom factor for telephoto lenses
}

export interface Device {
  id: string;
  brand: string;
  model: string;
  year: number;
  price_usd?: number;          // launch price, base storage
  status: 'released' | 'announced' | 'discontinued';

  body: {
    weight_g?: number;
    dimensions_mm?: [number, number, number];
    ip_rating?: string;
    stylus?: boolean;
  };

  display: {
    type?: string;             // "LTPO OLED", "Dynamic AMOLED 2X"
    size_in?: number;
    resolution?: [number, number];
    ppi?: number;
    refresh_hz_max?: number;
    peak_nits?: number;        // HDR / peak full-screen
    outdoor_nits?: number;     // HBM / sunlight peak where published
    glass?: string;
    panel_tech?: 'OLED' | 'LCD';
  };

  soc: {
    brand?: string;            // Snapdragon, Dimensity, Apple, Exynos, Tensor, ...
    chipset?: string;
    process_nm?: number;
    cpu?: string;
    gpu?: string;
    ram_gb?: number;
    storage_gb?: number[];
  };

  camera: {
    main?: CameraSpec;
    ultrawide?: CameraSpec;
    telephoto?: CameraSpec;
    front?: CameraSpec;
  };

  memory?: {
    expandable?: boolean;      // microSD slot
  };

  audio: {
    stereo_speakers?: boolean;
    headphone_jack?: boolean;
    haptics?: string;
  };

  connectivity: {
    wifi?: string;
    bluetooth?: string;
    codecs?: string[];
    nfc?: boolean;
    uwb?: boolean;
    ir_blaster?: boolean;
    five_g?: boolean;
  };

  battery: {
    capacity_mah?: number;
    chemistry?: string;
    wired_w?: number;
    wireless_w?: number;
    reverse_w?: number;
    video_playback_h?: number;
  };

  software: {
    launch_os?: string;
    os_family?: 'Android' | 'iOS';
    os_updates_years?: number;
    security_updates_years?: number;
    bootloader_unlockable?: boolean;
  };

  repair: {
    sar_head_eu_wkg?: number;
    sar_body_eu_wkg?: number;
    sar_head_us_wkg?: number;
    sar_body_us_wkg?: number;
  };

  /** Where the record came from (set by the archiver). */
  source_url?: string;
  /** Main product photo, relative to the catalog folder (e.g. img/123.webp). */
  image?: string;
  /** Free-form provenance note, shown in the device header. */
  source_note?: string;
  /** Full spec sheet as saved from a page: category -> label -> value. Shown on the detail page. */
  raw_specs?: Record<string, Record<string, string>>;
}

export type Category =
  | 'Display'
  | 'SoC & Memory'
  | 'Cameras'
  | 'Audio & Haptics'
  | 'Connectivity'
  | 'Battery & Charging'
  | 'Software'
  | 'Body & SAR';

export interface SpecField {
  path: string;                // dot path into Device, e.g. "camera.main.mp"
  label: string;
  category: Category;
  unit?: string;
  /** Which direction wins in comparisons. Omit for non-comparable fields. */
  better?: 'higher' | 'lower';
  format?: (value: unknown) => string;
}
