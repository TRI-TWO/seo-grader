import Link from "next/link";

const links = [
  { href: "/arch/overview", label: "Overview" },
  { href: "/arch/progress", label: "Progress" },
  { href: "/arch/activity", label: "Activity" },
  { href: "/arch/account", label: "Account" },
];

export function ArchTopNav() {
  return (
    <nav className="flex items-center gap-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="px-3 py-2 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-sm"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

