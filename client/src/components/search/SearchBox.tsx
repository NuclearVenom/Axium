import { FormEvent, useEffect, useRef, useState } from "react";
import { searchConcepts, SearchSuggestion } from "../../lib/api";

const EXAMPLE_TOPICS = [
  "Machine Learning",
  "Astronomy",
  "Neuroscience",
  "Robotics",
  "Psychology",
  "Mathematics",
  "Economics",
  "Evolution",
  "Quantum Computing",
  "Operating Systems",
];

export function SearchBox({ onSearch }: { onSearch: (topic: string) => void }) {
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const results = await searchConcepts(value);
      setSuggestions(results);
    }, 200);
    return () => clearTimeout(debounceRef.current);
  }, [value]);

  const submit = (topic: string) => {
    if (!topic.trim()) return;
    onSearch(topic.trim());
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(value);
  };

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-8">
      <form onSubmit={handleSubmit} className="relative w-full">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="What would you like to understand?"
          className="w-full rounded-2xl border border-border bg-surface/70 px-6 py-4 text-base text-ink placeholder:text-ink-muted shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur-xl transition-all focus:border-accent/40 focus:outline-none focus:ring-4 focus:ring-accent/10"
        />
        {suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-10 mt-2 overflow-hidden rounded-xl border border-border bg-surface/95 backdrop-blur-xl shadow-xl">
            {suggestions.map((s) => (
              <button
                key={s.conceptId}
                type="button"
                onClick={() => submit(s.title)}
                className="flex w-full items-center justify-between px-5 py-3 text-left text-sm text-ink transition-colors hover:bg-white/5"
              >
                <span>{s.title}</span>
                <span className="text-xs text-ink-muted">{s.category}</span>
              </button>
            ))}
          </div>
        )}
      </form>

      <div className="flex flex-wrap justify-center gap-2">
        {EXAMPLE_TOPICS.map((topic) => (
          <button
            key={topic}
            onClick={() => submit(topic)}
            className="rounded-full border border-border bg-surface/50 px-3.5 py-1.5 text-xs text-ink-muted transition-colors hover:border-accent/40 hover:text-ink"
          >
            {topic}
          </button>
        ))}
      </div>
    </div>
  );
}
