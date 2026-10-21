export type IconName = "chevron" | "close" | "restore" | "trash" | "mail" | "check" | "info" | "download" | "folder" | "feedback" | "refresh" | "arrow";
const paths: Record<IconName, React.ReactNode> = {
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
  folder: <path d="M3 7V5h7l2 3h9v12H3V7Z" />,
  feedback: <><path d="M4 4h16v12H9l-5 4V4Z" /><path d="M8 8h8M8 12h5" /></>,
  refresh: <><path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5" /></>,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  chevron: <path d="m8 10 4 4 4-4" />,
  close: <path d="m7 7 10 10M17 7 7 17" />,
  restore: <><path d="M4 10a8 8 0 1 1 1 7" /><path d="M4 4v6h6M12 8v5l3 2" /></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></>,
  check: <path d="m5 12 4 4 10-10" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
};
export function Icon({ name }: { name: IconName }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
