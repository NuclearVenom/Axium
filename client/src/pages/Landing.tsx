import { useState } from "react";
import { motion } from "framer-motion";
import { SearchBox } from "../components/search/SearchBox";
import { MeshBackground } from "../components/landing/MeshBackground";
import { AxiumWordmark } from "../components/landing/AxiumWordmark";
import { AxiumLogoMark } from "../components/common/AxiumLogoMark";
import { GithubRepoBadge } from "../components/landing/GithubRepoBadge";

const TAGLINES = [
  "a knowledge mapping system",
  "build your Interactive Knowledge Graph",
  "Beyond Search. Beyond Chat",
  "Explore Concepts from First Principles",
  "Think Visually",
  "watch concept from a higher dimension",
  "get the bigger picture",
  "drop a topic, get the syllabus",
  "generate the Whole System",
  "see the map before you drive",
  "follow the threads",
  "reach the fundamentals",
  "find the foundation",
];

function pickTagline(): string {
  return TAGLINES[Math.floor(Math.random() * TAGLINES.length)];
}

export function Landing({ onSearch }: { onSearch: (topic: string) => void }) {
  // Lazy initializer — picked once per mount, so every visit to the
  // homepage (a hard reload, or navigating back via the home button) gets
  // a fresh random line.
  const [tagline] = useState(pickTagline);

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-y-auto overflow-x-hidden bg-black">
      <AmbientBackground />

      <AxiumLogoMark className="pointer-events-none absolute left-4 top-[max(1rem,env(safe-area-inset-top))] z-10 h-9 w-auto sm:left-6 sm:top-6 sm:h-10" />

      <GithubRepoBadge />

      {/* A bounded strip of animated mesh sitting behind the title/search
          column only — not the whole page. Faded at the edges with a mask
          so it reads as atmosphere rather than a hard-edged box. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 z-0 h-[260px] -translate-y-1/2 sm:h-[420px]"
        style={{
          maskImage: "radial-gradient(ellipse 60% 65% at center, black 35%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 60% 65% at center, black 35%, transparent 100%)",
        }}
      >
        <MeshBackground />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center gap-10 px-6"
      >
        <div className="flex flex-col items-center gap-4">
          <AxiumWordmark className="h-auto w-[min(84vw,980px)] sm:w-[min(92vw,980px)]" />
          <p className="max-w-[85vw] text-center text-sm uppercase tracking-[0.08em] text-ink-muted sm:max-w-md">{tagline}</p>
        </div>

        <SearchBox onSearch={onSearch} />
      </motion.div>

      <p className="pointer-events-none absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 z-10 w-full -translate-x-1/2 px-6 text-center text-[11px] tracking-wide text-ink-muted/60">
        Created and developed by Ranasurya Ghosh
      </p>
    </div>
  );
}

function AmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-1/4 -top-1/4 h-[70vh] w-[70vh] animate-drift rounded-full bg-accent/[0.05] blur-[120px]" />
      <div
        className="absolute -bottom-1/4 -right-1/4 h-[60vh] w-[60vh] animate-drift rounded-full bg-accent/[0.04] blur-[120px]"
        style={{ animationDelay: "-20s" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
    </div>
  );
}
