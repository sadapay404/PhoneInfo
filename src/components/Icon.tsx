import type { SVGProps } from 'react';

const PATHS = {
  finder: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zm9.5 16-4.2-4.2',
  compare: 'M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3',
  tools: 'M14.5 5.5a4 4 0 0 0-5 5.2L4 16.2 7.8 20l5.5-5.5a4 4 0 0 0 5.2-5l-2.6 2.6-2.6-.6-.6-2.6z',
  search: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zm9.5 16-4.2-4.2',
  sliders: 'M4 6h10m4 0h2M4 12h4m4 0h8M4 18h12m4 0h0M14 4v4M8 10v4M16 16v4',
  x: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  plus: 'M12 5v14M5 12h14',
  back: 'M15 18l-6-6 6-6',
  chevron: 'M6 9l6 6 6-6',
  sun: 'M12 4V2m0 20v-2M4 12H2m20 0h-2M5.6 5.6 4.2 4.2m15.6 15.6-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  cloud: 'M7 18a5 5 0 0 1-.9-9.9A6 6 0 0 1 18 9.5a4 4 0 0 1 .5 8.5z',
  cloudOff: 'M3 3l18 18M7 18a5 5 0 0 1-.9-9.9M10 6.2A6 6 0 0 1 18 9.5a4 4 0 0 1 2.5 7.5',
  arrowRight: 'M5 12h14m-6-6 6 6-6 6',
  library: 'M4 5h4v14H4zM10 5h4v14h-4zM16.5 5.5l3.9 1-3.2 12.6-3.9-1z',
  upload: 'M12 15V4m0 0-4 4m4-4 4 4M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4',
  trash: 'M4 7h16M9 7V4.5h6V7M6.5 7l1 12.5h9l1-12.5',
  wifi: 'M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.8 16a5 5 0 0 1 6.4 0M12 19.5h.01',
  phone: 'M7.5 2.5h9a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2zM11 18.5h2',
  tag: 'M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9zM7.5 7.5h.01',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
