import type { SVGProps } from "react";

/** Stroke icons (24px grid) shared by the dock, tab bar and menus. They inherit colour from the parent. */
function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={22}
      height={22}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const HomeIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M4 10.5 12 4l8 6.5V20H4z" /><path d="M10 20v-5h4v5" /></Icon>
);
export const LibraryIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M10 9.5l4.5 2.5-4.5 2.5z" /></Icon>
);
export const CourseIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M5 19.5V5a2 2 0 0 1 2-2h12v15H7a2 2 0 0 0-2 2 2 2 0 0 0 2 2h12" /></Icon>
);
export const StudyIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><rect x="7.5" y="3" width="12.5" height="15" rx="2.5" /><path d="M4 7v11.5A2.5 2.5 0 0 0 6.5 21H16" /></Icon>
);
export const ChatIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M20.5 12a8.5 8.5 0 0 1-12.4 7.5L3.5 20.5l1.1-4.3A8.5 8.5 0 1 1 20.5 12z" /></Icon>
);
export const PaletteIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M12 3a9 9 0 0 0 0 18c1.4 0 2-1 1.5-2.2-.6-1.4.3-2.8 1.8-2.8H18a3 3 0 0 0 3-3c0-5.5-4-10-9-10z" />
    <circle cx="7.5" cy="11" r="1.2" /><circle cx="10.5" cy="7.5" r="1.2" /><circle cx="15" cy="7.8" r="1.2" />
  </Icon>
);
export const ChevronDownIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M6 9l6 6 6-6" /></Icon>
);
export const CheckIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon strokeWidth={2.6} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Icon>
);
export const PersonIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><circle cx="12" cy="8.5" r="4" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></Icon>
);
export const PlusIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>
);
export const CloseIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M6 6l12 12M18 6L6 18" /></Icon>
);
export const InfoIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></Icon>
);
