export type ShellSection = "home" | "library" | "course" | "study" | "chat";

export const NAV_ITEMS: ReadonlyArray<{ key: ShellSection; href: string; label: string }> = [
  { key: "home", href: "/", label: "Home" },
  { key: "library", href: "/library", label: "Library" },
  { key: "course", href: "/busuu", label: "Course" },
  { key: "study", href: "/study", label: "Study" },
  { key: "chat", href: "/voicechat", label: "Chat" },
];
