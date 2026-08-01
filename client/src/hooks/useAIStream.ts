import { useCallback, useRef, useState } from "react";
import { streamTutorResponse, TutorStreamParams } from "../lib/api";
import { recordSessionAIRequest } from "../lib/usageStore";

export function useAIStream() {
  const [text, setText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRef = useRef(0);

  const ask = useCallback((params: TutorStreamParams) => {
    const requestId = ++activeRef.current;
    setText("");
    setError(null);
    setIsStreaming(true);
    recordSessionAIRequest();

    streamTutorResponse(
      params,
      (chunk) => {
        if (activeRef.current !== requestId) return;
        setText((prev) => prev + chunk);
      },
      () => {
        if (activeRef.current !== requestId) return;
        setIsStreaming(false);
      },
      (message) => {
        if (activeRef.current !== requestId) return;
        setError(message);
        setIsStreaming(false);
      }
    );
  }, []);

  const reset = useCallback(() => {
    activeRef.current++;
    setText("");
    setError(null);
    setIsStreaming(false);
  }, []);

  return { text, isStreaming, error, ask, reset };
}
