import { useEffect, useState } from "react";

const REPO_OWNER = "NuclearVenom";
const REPO_NAME = "Axium";
const REPO_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}`;

interface RepoStats {
  stars: number;
  forks: number;
  version: string | null;
}

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(n % 1000 >= 100 ? 1 : 0)}k`;
}

/**
 * A small live status card, not a static badge image — pulls star/fork
 * counts and the latest release tag straight from the public GitHub REST
 * API on mount. Fails soft: if the network call errors, is rate-limited,
 * or the repo has no releases yet, it still renders a working link to the
 * repo with whatever it does have rather than breaking or disappearing.
 */
export function GithubRepoBadge() {
  const [stats, setStats] = useState<RepoStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const repoRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`);
        if (!repoRes.ok) throw new Error("repo fetch failed");
        const repo = await repoRes.json();

        let version: string | null = null;
        try {
          const releaseRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`);
          if (releaseRes.ok) {
            const release = await releaseRes.json();
            version = release.tag_name ?? null;
          }
        } catch {
          // No releases yet, or the call failed — version stays null and is simply omitted below.
        }

        if (!cancelled) {
          setStats({ stars: repo.stargazers_count ?? 0, forks: repo.forks_count ?? 0, version });
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noreferrer"
      className="pointer-events-auto absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex items-center gap-2 rounded-xl border border-border bg-canvas/80 px-2.5 py-2 text-xs text-ink-muted backdrop-blur-xl transition-colors hover:border-accent/40 hover:text-ink sm:right-6 sm:top-6 sm:gap-2.5 sm:px-3.5 sm:py-2.5"
    >
      <GithubMark className="h-4 w-4 shrink-0 text-ink sm:h-5 sm:w-5" />
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5 font-medium text-ink">
          <span>
            <span className="hidden sm:inline">{REPO_OWNER}/</span>
            {REPO_NAME}
          </span>
          {stats?.version && (
            <span className="hidden rounded-full border border-border px-1.5 py-0.5 text-[10px] font-normal text-ink-muted sm:inline">
              {stats.version}
            </span>
          )}
        </div>
        {!failed && (
          <div className="flex items-center gap-3 text-[11px] text-ink-muted">
            <span className="flex items-center gap-1">
              <StarIcon className="h-3 w-3" />
              {stats ? formatCount(stats.stars) : "···"}
            </span>
            <span className="hidden items-center gap-1 sm:flex">
              <ForkIcon className="h-3 w-3" />
              {stats ? formatCount(stats.forks) : "···"}
            </span>
          </div>
        )}
      </div>
    </a>
  );
}

function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.79L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.193L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
    </svg>
  );
}

function ForkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <path d="M5 3.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm0 2.122a2.25 2.25 0 1 0-1.5 0v.878A2.25 2.25 0 0 0 5.75 8.5h1.5v2.128a2.251 2.251 0 1 0 1.5 0V8.5h1.5a2.25 2.25 0 0 0 2.25-2.25v-.878a2.25 2.25 0 1 0-1.5 0v.878a.75.75 0 0 1-.75.75h-4.5a.75.75 0 0 1-.75-.75v-.878ZM11 3.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM8.75 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
    </svg>
  );
}
