type Props = {
  size?: number;
  stroke?: string;
};

export function IconDots({ size = 14 }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="3" r="1.35" fill="currentColor" />
      <circle cx="7" cy="7" r="1.35" fill="currentColor" />
      <circle cx="7" cy="11" r="1.35" fill="currentColor" />
    </svg>
  );
}

export function IconBars({ size = 14 }: Props) {
  return (
    <svg width={4} height={size} viewBox="0 0 4 14" fill="none">
      <rect x="1" y="1" width="2" height="12" rx="1" fill="currentColor" />
    </svg>
  );
}

export function IconBolt({ size = 15 }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13l0-8Z" fill="#fff" />
    </svg>
  );
}

export function IconSend({ size = 15 }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M21.5 2.5 11 13M21.5 2.5 14.8 21.6 11 13 2.4 9.2 21.5 2.5Z" fill="#fff" />
    </svg>
  );
}

export function IconPencil({ size = 14, stroke = "#fff" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function IconChevron({ stroke = "#8C8880" }: Props) {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function IconRefresh({ size = 16 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#6F6C64"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-3.2-6.9" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

export function IconShuffle({ stroke = "#fff" }: Props) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 3h5v5" />
      <path d="M4 20 21 3" />
      <path d="M21 16v5h-5" />
      <path d="m15 15 6 6" />
      <path d="m4 4 5 5" />
    </svg>
  );
}

export function IconDownload({ size = 13 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fff"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

export function IconPersonAdd() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#6F6C64"
      strokeWidth="1.6"
      strokeLinecap="round"
    >
      <circle cx="9" cy="7" r="3.2" />
      <path d="M3.2 20v-1.4A4.9 4.9 0 0 1 8 13.7h2" />
      <path d="M18 9v6M15 12h6" />
    </svg>
  );
}

export function IconBag() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fff"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

export function IconPlus({ size = 14 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fff"
      strokeWidth="2.4"
      strokeLinecap="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
