import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { refreshLifetimeUsage, useUsageStats } from "../../lib/usageStore";

/**
 * A small "!" badge in the corner that expands into the usage summary on
 * hover or click/tap, rather than showing the full pill all the time.
 * Hover and click are independent triggers — hovering shows it while the
 * cursor stays there; clicking pins it open (mainly for touch devices,
 * which have no hover) until clicked again.
 */
export function UsageWidget() {
  const { session, lifetime } = useUsageStats();
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    refreshLifetimeUsage();
  }, []);

  const sessionTotal = session.graphRequests + session.aiRequests;
  const isExpanded = isHovered || isPinned;

  return (
    <motion.button
      type="button"
      layout
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => setIsPinned((v) => !v)}
      aria-label={isExpanded ? "Hide usage stats" : "Show usage stats"}
      aria-expanded={isExpanded}
      transition={{ type: "spring", stiffness: 500, damping: 34 }}
      className={`fixed bottom-4 right-4 z-50 flex select-none items-center justify-center overflow-hidden rounded-full border border-border bg-canvas/70 text-ink-muted backdrop-blur-md ${
        isExpanded ? "h-auto px-3 py-1.5" : "h-8 w-8"
      }`}
    >
      {isExpanded ? (
        lifetime ? (
          <span className="whitespace-nowrap text-[11px]">
            {lifetime.graphRequests} graphs · {lifetime.aiRequests} tutor calls · {lifetime.totalCalls} total
            {sessionTotal > 0 && <span className="text-ink-muted/60"> (this session: {sessionTotal})</span>}
          </span>
        ) : (
          <span className="whitespace-nowrap text-[11px] opacity-60">Axium</span>
        )
      ) : (
        <span className="text-xs font-semibold italic">!</span>
      )}
    </motion.button>
  );
}
