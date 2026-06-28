import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";

// @ts-ignore
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export function useSpeechRecognition({
  onResult,
  onEnd,
  onError,
  continuous = false,
}: {
  onResult?: (transcript: string, isFinal: boolean) => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  continuous?: boolean;
}) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const onResultRef = useRef(onResult);
  const onEndRef = useRef(onEnd);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = "en-AU";

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
      // Surface the raw error code to the caller so it can react to permission
      // denial (not-allowed / service-not-allowed) by tearing down its overlay
      // and prompting the user. onend still fires afterwards for cleanup.
      if (onErrorRef.current) onErrorRef.current(event.error);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (onEndRef.current) onEndRef.current();
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) {
      toast.error("Speech recognition not supported in your browser.");
      return;
    }

    if (isListening) {
      try { recognitionRef.current.stop(); } catch (e) { /* already stopped */ }
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e: any) {
        // start() can throw synchronously (permission denied, invalid state).
        // No onend will fire, so we must signal the caller to tear down its
        // overlay/lock here — otherwise the UI stays stuck on "Listening…".
        console.error("Could not start recognition:", e);
        setIsListening(false);
        const name = e?.name || "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          // Permission denial on the synchronous path: route through onError so
          // the caller shows the denial UX + Retry (same as the async onerror).
          if (onErrorRef.current) onErrorRef.current("not-allowed");
          else if (onEndRef.current) onEndRef.current();
        } else {
          toast.error("Couldn't start the microphone. Please check permissions and try again.");
          if (onEndRef.current) onEndRef.current();
        }
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    // Not gated on isListening: stop() must always be attempted so a stuck or
    // never-started session can still be torn down by the caller.
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { /* already stopped */ }
      setIsListening(false);
    }
  }, []);

  return {
    isListening,
    toggleListening,
    stopListening,
    supported: !!SpeechRecognition,
  };
}
