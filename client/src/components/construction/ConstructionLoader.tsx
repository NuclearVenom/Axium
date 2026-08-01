import { motion, AnimatePresence } from "framer-motion";

export function ConstructionLoader({ topic, currentStage }: { topic: string; currentStage: string | null }) {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-border border-t-accent" />
        <div
          className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-t-accent/40"
          style={{ animationDirection: "reverse", animationDuration: "1.8s" }}
        />
      </div>

      <div className="text-center">
        <p className="text-sm text-ink-muted">Constructing the knowledge landscape for</p>
        <p className="mt-1 text-lg font-medium text-ink">{topic}</p>
      </div>

      <div className="h-6">
        <AnimatePresence mode="wait">
          {currentStage && (
            <motion.p
              key={currentStage}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35 }}
              className="text-xs uppercase tracking-wide text-ink-muted"
            >
              {currentStage}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
