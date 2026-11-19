"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

export function Logo({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <Image
      src={tone === "dark" ? "/brand/aquagrid-dark.png" : "/brand/aquagrid-light.png"}
      alt="AquaGrid"
      width={1329}
      height={338}
      className="h-8 w-[126px] sm:h-9 sm:w-[142px]"
    />
  );
}

const LINKS = [
  { href: "/#system", label: "The system" },
  { href: "/#incident", label: "Incident" },
  { href: "/#desalination", label: "Desalination" },
  { href: "/#storage", label: "Storage" },
];

export function SiteHeader() {
  const path = usePathname();
  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-black/10 bg-[var(--color-blue)] text-[var(--color-navy)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:rounded focus:bg-[var(--color-yellow)] focus:px-3 focus:py-2">Skip to content</a>
      <div className="mx-auto grid h-full max-w-[1400px] grid-cols-[1fr_auto] items-center gap-4 px-5 sm:grid-cols-[auto_1fr_auto] sm:px-10">
        <Link href="/" aria-label="AquaGrid home"><Logo tone="dark" /></Link>
        <nav aria-label="Main" className="hidden h-full items-center justify-center lg:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="group relative flex h-full items-center border-r border-[var(--color-navy)]/15 px-4 text-[10px] font-[640] uppercase tracking-[0.13em] first:border-l">
              <span>{l.label}</span>
              <span className="absolute inset-x-3 bottom-0 h-[3px] origin-left scale-x-0 bg-[var(--color-yellow)] transition-transform duration-200 group-hover:scale-x-100" aria-hidden="true" />
            </a>
          ))}
        </nav>
        <div className="flex justify-end">
          <Link href={path === "/control" ? "/" : "/control"} className="flex items-center gap-2 border-l border-[var(--color-navy)]/20 pl-3 font-mono text-[10px] font-[680] uppercase tracking-[0.12em] sm:gap-3 sm:pl-5">
            <span className="whitespace-nowrap">{path === "/control" ? "Story" : "Control room"}</span>
            <span className="grid h-6 w-6 place-items-center bg-[var(--color-yellow)] text-[14px] leading-none text-[var(--color-navy)] sm:h-7 sm:w-7" aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
      <span className="absolute bottom-0 left-0 h-[3px] w-[22%] bg-[var(--color-yellow)]" aria-hidden="true" />
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="on-navy bg-[var(--color-navy)] text-white">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-5 py-16 sm:px-10 md:grid-cols-[1.1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-white/80">
            AquaGrid is a demonstration digital twin for the Water, Energy &amp; Climate Resilience challenge. It shows how a coastal
            city can weigh energy cost against water security, and keep people in charge of what changes on the network.
          </p>
          <Link href="/control" className="btn btn-primary mt-6">Open the control room</Link>
        </div>
        <div className="text-[14px] leading-relaxed text-white/80">
          <h2 className="text-[15px] font-[680] text-white">What’s real and what isn’t</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>All telemetry is synthetic and deterministic. Every operational value on these pages is computed by the Python simulation engine; the browser only draws it.</li>
            <li>Storage follows next volume = volume + production − demand − modelled loss, hourly, over 10,000 m³ with an illustrative 35% floor.</li>
            <li>Energy uses a plant curve calibrated to 3.5 kWh/m³ at 600 m³/h, with illustrative tariffs of $0.32 (14:00–20:00) and $0.12/kWh.</li>
            <li>Valve control is simulated. Proposals and valve states are signed by the backend; nothing connects to a real actuator, PLC or SCADA system.</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
