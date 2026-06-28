import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";

// @ts-ignore
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export function useSpeechRecognition({
  onResult,
  onEnd,
  onError,
  onStart,
  continuous = false,
}: {
  onResult?: (transcript: string, isFinal: boolean) => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  onStart?: () => void;
  continuous?: boolean;
}) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const onResultRef = useRef(onResult);
  const onEndRef = useRef(onEnd);
  const onErrorRef = useRef(onError);
  const onStartRef = useRef(onStart);

  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { onStartRef.current = onStart; }, [onStart]);

  // Detach handlers and abort the current instance WITHOUT firing onend (handlers
  // are nulled first). Used to discard a stale/dead instance — e.g. after a screen
  // lock or tab switch kills recognition silently (Bug #11).
  const cleanup = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.onstart = null;
      try { recognition.abort(); } catch { /* already stopped */ }
    }
  }, []);

  // ALWAYS build a brand-new recognition instance per start. Reusing an instance
  // that was interrupted leaves a "dead" recogniser that opens but never captures
  // (Bug #11). The overlay must only be shown by the caller from onStart, once the
  // browser confirms the session is actually running.
  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      toast.error("Speech recognition not supported in your browser.");
      if (onErrorRef.current) onErrorRef.current("not-supported");
      return;
    }

    cleanup(); // drop any stale instance before creating a fresh one

    const recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = "en-AU";

    recognition.onstart = () => {
      setIsListening(true);
      if (onStartRef.current) onStartRef.current();
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      if (onResultRef.current) {
        onResultRef.current(finalTranscript || interimTranscript, !!finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
      if (onErrorRef.current) onErrorRef.current(event.error);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (onEndRef.current) onEndRef.current();
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (e: any) {
      // start() can throw synchronously (permission denied, invalid state). No
      // onstart/onend will fire, so signal the caller to surface the error and
      // never show the overlay for a session that never began.
      console.error("Could not start recognition:", e);
      cleanup();
      setIsListening(false);
      const name = e?.name || "";
      const code =
        name === "NotAllowedError" || name === "SecurityError"
          ? "not-allowed"
          : "start-failed";
      if (onErrorRef.current) onErrorRef.current(code);
    }
  }, [continuous, cleanup]);

  const stopListening = useCallback(() => {
    // Graceful stop: lets the final results + onend fire so the caller can process
    // the captured command. Safe to call even if nothing is running.
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* already stopped */ }
      setIsListening(false);
    }
  }, []);

  // Hard teardown with no onend — discard a stale session entirely (Bug #11).
  const forceClean = useCallback(() => {
    cleanup();
    setIsListening(false);
  }, [cleanup]);

  useEffect(() => () => cleanup(), [cleanup]);

  return {
    isListening,
    startListening,
    stopListening,
    forceClean,
    supported: !!SpeechRecognition,
  };
}
