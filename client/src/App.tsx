import { useCallback, useState, lazy, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Landing } from "./pages/Landing";
import { ConstructionLoader } from "./components/construction/ConstructionLoader";
import { UsageWidget } from "./components/usage/UsageWidget";
import { constructGraphStream } from "./lib/api";
import { recordSessionGraphRequest } from "./lib/usageStore";
import { KnowledgeGraph } from "./types/graph";

// Code-split the explorer (graph canvas + d3 + side panel + AI tutor chain)
// out of the initial landing bundle. It's prefetched the moment a search
// starts (see handleSearch), so by the time construction finishes the
// chunk is normally already warm and Suspense never has to show a fallback.
const GraphExplorer = lazy(() => import("./pages/GraphExplorer"));
const preloadGraphExplorer = () => import("./pages/GraphExplorer");

type Phase = "landing" | "constructing" | "exploring" | "error";

export default function App() {
  const [phase, setPhase] = useState<Phase>("landing");
  const [topic, setTopic] = useState("");
  const [stage, setStage] = useState<string | null>(null);
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSearch = useCallback(async (searchTopic: string) => {
    setTopic(searchTopic);
    setPhase("constructing");
    setStage(null);
    setErrorMessage(null);
    recordSessionGraphRequest();
    void preloadGraphExplorer();

    await constructGraphStream(searchTopic, {
      onStage: (s) => setStage(s),
      onDone: (g) => {
        setGraph(g);
        setPhase("exploring");
      },
      onError: (message) => {
        setErrorMessage(message);
        setPhase("error");
      },
    });
  }, []);

  const handleGoHome = useCallback(() => {
    setPhase("landing");
    setErrorMessage(null);
  }, []);

  return (
    <div className="h-dvh w-full overflow-hidden bg-canvas">
      <UsageWidget />
      <AnimatePresence mode="wait">
        {phase === "landing" && (
          <motion.div key="landing" className="h-full w-full" exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
            <Landing onSearch={handleSearch} />
          </motion.div>
        )}

        {phase === "constructing" && (
          <motion.div
            key="constructing"
            className="flex h-full w-full items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <ConstructionLoader topic={topic} currentStage={stage} />
          </motion.div>
        )}

        {phase === "exploring" && graph && (
          <motion.div key="exploring" className="h-full w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            <Suspense fallback={<ConstructionLoader topic={topic} currentStage={null} />}>
              <GraphExplorer graph={graph} onSearchAgain={handleSearch} onGraphUpdated={setGraph} onGoHome={handleGoHome} />
            </Suspense>
          </motion.div>
        )}

        {phase === "error" && (
          <motion.div
            key="error"
            className="flex h-full w-full flex-col items-center justify-center gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-ink">{errorMessage ?? "Something went wrong constructing this graph."}</p>
            <button
              onClick={() => setPhase("landing")}
              className="rounded-lg border border-border px-4 py-2 text-sm text-ink-muted hover:text-ink"
            >
              Back to search
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
