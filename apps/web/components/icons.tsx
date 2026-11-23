import type { ReactNode } from 'react';

// Stroke icons on a 24x24 grid. Decorative by default: pair them with visible text or an aria-label on the control.
const P: Record<string, ReactNode> = {
  dashboard: (<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>),
  today: (<><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 10h18" /><path d="M8 15l2.5 2.5L16 13" /></>),
  tasks: (<><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>),
  send: (<><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></>),
  plus: <path d="M12 5v14M5 12h14" />,
  info: (<><circle cx="12" cy="12" r="9.5" /><path d="M12 11v5.5M12 7.6h.01" /></>),
  sun: (<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  bell: (<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>),
  users: (<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.9" /><path d="M16 3.1a4 4 0 0 1 0 7.8" /></>),
  building: (<><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" /></>),
  sliders: <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />,
  history: (<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></>),
  clock: (<><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>),
  alert: (<><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>),
  inbox: (<><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5.1L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1z" /></>),
  paperclip: <path d="M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />,
  download: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />,
  logout: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  menu: <path d="M3 12h18M3 6h18M3 18h18" />,
  close: <path d="M18 6L6 18M6 6l12 12" />,
  key: (<><circle cx="7.5" cy="15.5" r="5.5" /><path d="M21 2l-9.6 9.6M15.5 7.5l3 3L22 7l-3-3" /></>),
  check: <path d="M20 6L9 17l-5-5" />,
  back: <path d="M19 12H5M12 19l-7-7 7-7" />,
  search: (<><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" /></>),
  flag: (<><path d="M4 22V4" /><path d="M4 4h13l-2 4 2 4H4" /></>),
  calendar: (<><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 10h18" /></>),
  user: (<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>),
  chevron: <path d="M9 18l6-6-6-6" />,
  share: (<><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></>),
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}>
      {P[name]}
    </svg>
  );
}

/** Small state glyph (like a to-do circle) so status reads at a glance without a coloured pill. */
export function StatusGlyph({ status, size = 16 }: { status: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true, focusable: false } as const;
  const ring = { stroke: 'currentColor', strokeWidth: 1.6 } as const;
  switch (status) {
    case 'PENDING_ACCEPTANCE':
      return <svg {...common}><circle cx="8" cy="8" r="6" {...ring} strokeDasharray="2.6 2.4" /></svg>;
    case 'ACCEPTED':
      return <svg {...common}><circle cx="8" cy="8" r="6" {...ring} /></svg>;
    case 'IN_PROGRESS':
      return <svg {...common}><circle cx="8" cy="8" r="6" {...ring} /><path d="M8 3.6a4.4 4.4 0 0 1 0 8.8z" fill="currentColor" /></svg>;
    case 'BLOCKED':
      return <svg {...common}><circle cx="8" cy="8" r="6" {...ring} /><path d="M5.3 8h5.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
    case 'SUBMITTED':
      return <svg {...common}><circle cx="8" cy="8" r="6" {...ring} /><path d="M8 4.8V8l2.1 1.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
    case 'APPROVED':
      return <svg {...common}><circle cx="8" cy="8" r="6.8" fill="currentColor" /><path d="M5 8.2l2 2 4-4.2" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    default:
      return <svg {...common}><circle cx="8" cy="8" r="6" {...ring} /><path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
  }
}
