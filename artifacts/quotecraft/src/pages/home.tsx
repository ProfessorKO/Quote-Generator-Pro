import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useUser } from "@clerk/react";
import { Layout } from "@/components/layout";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, Loader2, Save, Trash2, Plus, FileText, CheckCircle2, Download, Mail } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/use-speech";
import { useParseQuoteDescription, useApplyVoiceCommand, useCreateTemplate, getListTemplatesQueryKey, getListQuotesQueryKey, useCreateQuote, useGetTemplate, QuoteLineItem, QuoteSettings } from "@workspace/api-client-react";
import { toast } from "sonner";
import { ExportPdfDialog } from "@/components/export-pdf-dialog";
import { EmailQuoteDialog } from "@/components/email-quote-dialog";
import { buildQuoteRecord } from "@/lib/quote-record";
import {
  setPendingAction,
  peekPendingAction,
  clearPendingAction,
  type PendingAction,
} from "@/lib/auth-actions";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MicPermissionDialog } from "@/components/mic-permission-dialog";
import { checkMicPermission } from "@/lib/mic-permission";
import { NumericInput } from "@/components/numeric-input";
import { VoiceOverlay } from "@/components/voice-overlay";
import { LimitDialog } from "@/components/billing/limit-dialog";
import {
  limitReachedAction,
  useInvalidateBilling,
  type LimitAction,
} from "@/lib/billing";

export default function Home() {
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const templateId = searchParams.get("templateId");
  // Enhancement #36 — "New Quote" / "Try it now" navigate here with ?new=1 to
  // start from a blank slate (no restored draft, empty description).
  const isNewQuote = searchParams.get("new") === "1";

  const RESTORE_KEY = "quotecraft:unsaved-quote";

  // Bug #8 — restore an in-progress quote when returning to this page (e.g. after
  // visiting Templates). Skipped when a templateId is present, since that flow
  // loads its own data, or when starting a fresh quote (#36). Runs once on mount.
  const restored = useMemo(() => {
    if (templateId || isNewQuote) return null;
    try {
      const raw = localStorage.getItem(RESTORE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      const hasContent =
        (typeof data?.description === "string" && data.description.trim()) ||
        (Array.isArray(data?.lineItems) && data.lineItems.length > 0);
      return hasContent ? data : null;
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enhancement #36 — a fresh-start entry (?new=1) clears any saved draft so the
  // description box is empty, then strips the flag so the normal draft-restore
  // (Bug #8) resumes for later in-page navigation.
  useEffect(() => {
    if (!isNewQuote) return;
    try { localStorage.removeItem(RESTORE_KEY); } catch { /* ignore */ }
    setLocation("/quote", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const DEFAULT_SETTINGS: QuoteSettings = {
    includeGst: true,
    gstRate: 0.10,
    callOutFee: 0,
    publicHolidaySurchargePercent: 0,
    isPublicHoliday: false,
    hasCallOut: false,
  };

  const [description, setDescription] = useState<string>(restored?.description ?? "");
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>(restored?.lineItems ?? []);
  const [settings, setSettings] = useState<QuoteSettings>(restored?.settings ?? DEFAULT_SETTINGS);
  const [businessName, setBusinessName] = useState<string>(restored?.businessName ?? "");
  const [hasParsed, setHasParsed] = useState<boolean>(restored?.hasParsed ?? false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [retryingPermission, setRetryingPermission] = useState(false);
  const [templateName, setTemplateName] = useState("");
  // CP1/CP2/CP5 — which free-tier limit dialog to show (402 responses).
  const [limitAction, setLimitAction] = useState<LimitAction | null>(null);
  const invalidateBilling = useInvalidateBilling();

  const LISTEN_WINDOW_SECONDS = 30;

  const [liveTranscript, setLiveTranscript] = useState("");
  const [listeningMic, setListeningMic] = useState<"describe" | "edit" | null>(null);
  const [processing, setProcessing] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(LISTEN_WINDOW_SECONDS);

  const listenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const processTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalsRef = useRef("");
  const liveTranscriptRef = useRef("");
  const cancelledRef = useRef(false);
  const wakeLockRef = useRef<any>(null);
  const wakeLockWantedRef = useRef(false);
  const activeMicRef = useRef<"describe" | "edit" | null>(null);
  const interruptedRef = useRef(false);
  // True between a mic tap and the browser confirming the session (onStart). The
  // overlay isn't open yet during this gap, so this lock stops a second mic tap
  // from launching a concurrent recogniser (Bug #11).
  const startingRef = useRef(false);
  // Indirection so the recognition hooks can call the latest error handler
  // without forcing it to be declared before them (avoids use-before-declare).
  const speechErrorRef = useRef<(error: string) => void>(() => {});

  const overlayOpen = listeningMic !== null || processing;

  const clearListenTimers = () => {
    if (listenTimerRef.current) { clearTimeout(listenTimerRef.current); listenTimerRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  };

  // Bug #9 — keep the screen awake while a voice overlay is up. Best-effort: a
  // silent no-op where the Wake Lock API is unavailable or the request is denied.
  const requestWakeLock = async () => {
    wakeLockWantedRef.current = true;
    try {
      if ("wakeLock" in navigator) {
        const lock = await (navigator as any).wakeLock.request("screen");
        // The overlay may have closed while request() was in flight — if the
        // lock is no longer wanted, release the late-resolving one immediately
        // so we never re-lock the screen after teardown.
        if (!wakeLockWantedRef.current) {
          try { lock.release(); } catch { /* ignore */ }
          return;
        }
        wakeLockRef.current = lock;
      }
    } catch {
      /* fail silently */
    }
  };

  const releaseWakeLock = () => {
    wakeLockWantedRef.current = false;
    const lock = wakeLockRef.current;
    wakeLockRef.current = null;
    if (lock) {
      try { lock.release(); } catch { /* ignore */ }
    }
  };

  useEffect(() => {
    document.body.style.overflow = overlayOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [overlayOpen]);

  useEffect(() => () => {
    clearListenTimers();
    if (processTimerRef.current) clearTimeout(processTimerRef.current);
    if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
  }, []);

  // On mic tap: prepare capture state, but do NOT show the overlay yet. The
  // overlay is only opened once the browser confirms recognition is running
  // (handleListeningStarted, fired from the hook's onStart) — Bug #11.
  const prepareListening = (mic: "describe" | "edit") => {
    finalsRef.current = "";
    cancelledRef.current = false;
    activeMicRef.current = mic;
    liveTranscriptRef.current = "";
    setLiveTranscript("");
  };

  // Fired from the hook's onStart once recognition.start() is confirmed running.
  // Opens the centred "Listening…" overlay and starts the 30s capture window with
  // a live countdown (Bug #3/#5 + Bug #11).
  const handleListeningStarted = (mic: "describe" | "edit") => {
    startingRef.current = false; // session confirmed running
    setSecondsLeft(LISTEN_WINDOW_SECONDS);
    setListeningMic(mic);
    clearListenTimers();
    countdownRef.current = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    listenTimerRef.current = setTimeout(() => stopActiveListening(), LISTEN_WINDOW_SECONDS * 1000);
  };

  // Accumulate finalized chunks; show finals + the current interim live.
  // liveTranscriptRef mirrors exactly what's shown in the overlay (finals +
  // current interim) so that on Stop we capture the COMPLETE transcript, not just
  // the finalized chunks — interim words spoken right before Stop are otherwise
  // lost (Bug #13).
  const updateTranscript = (transcript: string, isFinal: boolean) => {
    if (isFinal) {
      finalsRef.current = (finalsRef.current ? finalsRef.current + " " : "") + transcript;
      liveTranscriptRef.current = finalsRef.current;
    } else {
      liveTranscriptRef.current = (finalsRef.current ? finalsRef.current + " " : "") + transcript;
    }
    setLiveTranscript(liveTranscriptRef.current);
  };

  // AI processing step (generation / voice-command apply) shows a spinner
  // overlay with its own 30s safety timeout so it can never hang.
  const startProcessing = () => {
    setProcessing(true);
    if (processTimerRef.current) clearTimeout(processTimerRef.current);
    processTimerRef.current = setTimeout(() => {
      setProcessing(false);
      toast.error("Voice processing timed out. Please try again.");
    }, 30000);
  };

  const stopProcessing = () => {
    if (processTimerRef.current) { clearTimeout(processTimerRef.current); processTimerRef.current = null; }
    setProcessing(false);
  };

  // Debounced spoken confirmation. The trailing window resets on every
  // successful edit, so a burst of rapid voice edits collapses into a single
  // "Quote updated" once the user pauses for ~1.5s. (Toasts still fire per edit.)
  const speakQuoteUpdated = () => speakPhrase("Quote updated");

  // Debounced spoken confirmation for an arbitrary phrase (e.g. a rename). The
  // trailing window collapses a burst of rapid edits into a single utterance.
  const speakPhrase = (phrase: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
    speakTimerRef.current = setTimeout(() => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(phrase);
      utterance.lang = "en-AU";
      window.speechSynthesis.speak(utterance);
    }, 1500);
  };

  const queryClient = useQueryClient();
  const { isSignedIn, user } = useUser();
  const parseQuote = useParseQuoteDescription();
  const applyVoiceCommand = useApplyVoiceCommand();
  const createTemplate = useCreateTemplate();
  const createQuote = useCreateQuote();

  const [exportOpen, setExportOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  // Entitlement = signed in with a verified email (Iteration 3 §3.2). A
  // logged-in-but-unverified user is treated as not entitled.
  const isEntitled =
    !!isSignedIn &&
    user?.primaryEmailAddress?.verification?.status === "verified";

  // Open the right flow for a gated action once the user is entitled.
  const runEntitledAction = (action: PendingAction) => {
    if (action === "save") {
      setTemplateName(businessName || "New Template");
      setSaveDialogOpen(true);
    } else if (action === "download") {
      setExportOpen(true);
    } else if (action === "email") {
      setEmailOpen(true);
    }
  };

  // Gate Save / Download / Email. Anonymous (or unverified) users have their
  // in-progress quote preserved (RESTORE_KEY effect) and the intended action
  // stashed, then are sent to sign-in; PostAuthGate resumes them at /quote.
  const handleGatedAction = (action: PendingAction) => {
    if (lineItems.length === 0) {
      toast.error("Generate a quote first");
      return;
    }
    if (!isEntitled) {
      setPendingAction(action);
      toast("Create a free account to continue");
      setLocation("/sign-in");
      return;
    }
    runEntitledAction(action);
  };
  const { data: loadedTemplate, isSuccess: templateLoaded } = useGetTemplate(Number(templateId), {
    query: { enabled: !!templateId, queryKey: ["template", templateId] }
  });

  useEffect(() => {
    if (templateLoaded && loadedTemplate && !hasParsed) {
      setLineItems(loadedTemplate.lineItems);
      setSettings(loadedTemplate.settings);
      setBusinessName(loadedTemplate.businessDescription);
      setDescription(loadedTemplate.businessDescription);
      setHasParsed(true);
    }
  }, [templateLoaded, loadedTemplate, hasParsed]);

  // Auto-resume a gated action after the auth round-trip (Iteration 3 §3.3).
  // PostAuthGate lands an entitled user with a pending action back here; once the
  // restored quote is on screen, open the matching flow and clear the marker.
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current) return;
    if (!isEntitled) return;
    const pending = peekPendingAction();
    if (!pending) return;
    if (lineItems.length === 0) return; // wait for the restored quote
    resumedRef.current = true;
    clearPendingAction();
    runEntitledAction(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEntitled, lineItems.length]);

  const {
    isListening: descListening,
    startListening: startDescRecognition,
    stopListening: stopDescListening,
    forceClean: forceCleanDesc,
    supported: speechSupported,
  } = useSpeechRecognition({
    continuous: true,
    onResult: updateTranscript,
    onStart: () => handleListeningStarted("describe"),
    onEnd: () => finishDescribe(),
    onError: (e) => speechErrorRef.current(e),
  });

  // Mic 1 — dictation is captured into the description box; generation is a
  // separate explicit step (the "Generate" button).
  const finishDescribe = () => {
    clearListenTimers();
    startingRef.current = false;
    setListeningMic(null);
    const text = liveTranscriptRef.current.trim();
    finalsRef.current = "";
    liveTranscriptRef.current = "";
    setLiveTranscript("");
    if (cancelledRef.current || !text) {
      cancelledRef.current = false;
      return;
    }
    setDescription((prev) => (prev ? prev + " " + text : text));
  };

  const runVoiceCommand = (command: string) => {
    // "Save template" is a UI action, handle it locally without an AI call.
    if (command.toLowerCase().includes("save template")) {
      setTemplateName(businessName || "New Template");
      setSaveDialogOpen(true);
      toast("Opening save template");
      return;
    }

    // Prevent overlapping commands from racing and overwriting newer state.
    if (applyVoiceCommand.isPending) {
      toast("Still applying the previous command, please wait...");
      return;
    }

    const loadingToast = toast.loading(`Applying: "${command}"`);
    startProcessing();
    applyVoiceCommand.mutate(
      { data: { command, lineItems, settings } },
      {
        onSuccess: (data) => {
          toast.dismiss(loadingToast);
          stopProcessing();
          invalidateBilling();
          if (data.understood) {
            // Bug #12 — detect a rename deterministically by diffing labels BY ID
            // (the item name shown to the user) so we confirm "Item renamed to X".
            // ID-based so it's robust to reordering and to add/remove happening in
            // the same command.
            const prevLabels = new Map(lineItems.map((it) => [it.id, it.label]));
            const renamed = data.lineItems.filter(
              (it) => prevLabels.has(it.id) && prevLabels.get(it.id) !== it.label,
            );
            setLineItems(data.lineItems);
            setSettings(data.settings);
            toast.success(data.message);
            if (renamed.length === 1) {
              speakPhrase(`Item renamed to ${renamed[0].label}`);
            } else if (renamed.length > 1) {
              speakPhrase("Items renamed");
            } else {
              speakQuoteUpdated();
            }
          } else {
            toast.error(data.message || "Couldn't understand that command");
          }
        },
        onError: (err) => {
          toast.dismiss(loadingToast);
          stopProcessing();
          // CP2 — free voice-edit limit reached.
          if (limitReachedAction(err)) {
            setLimitAction("voiceEdits");
            return;
          }
          toast.error("Failed to apply command. Please try again.");
        },
      }
    );
  };

  const {
    isListening: formListening,
    startListening: startEditRecognition,
    stopListening: stopFormListening,
    forceClean: forceCleanForm,
  } = useSpeechRecognition({
    continuous: true,
    onResult: updateTranscript,
    onStart: () => handleListeningStarted("edit"),
    onEnd: () => finishEdit(),
    onError: (e) => speechErrorRef.current(e),
  });

  // Mic 2 — once capture ends, apply the spoken command to the quote.
  const finishEdit = () => {
    clearListenTimers();
    startingRef.current = false;
    setListeningMic(null);
    const command = liveTranscriptRef.current.trim();
    finalsRef.current = "";
    liveTranscriptRef.current = "";
    setLiveTranscript("");
    if (cancelledRef.current || !command) {
      cancelledRef.current = false;
      return;
    }
    runVoiceCommand(command);
  };

  // Bug #7 — every mic tap re-checks permission via getUserMedia() (never cached).
  // If granted we start a FRESH recogniser; if denied we show device-specific
  // written instructions. The overlay only opens from onStart (Bug #11), and the
  // start-lock + cleaning the other mic guarantee a single active recogniser.
  const beginMic = async (mic: "describe" | "edit") => {
    if (!speechSupported) {
      toast.error("Speech recognition is not supported in your browser.");
      return;
    }
    if (overlayOpen || startingRef.current) return;
    startingRef.current = true;
    activeMicRef.current = mic; // so Retry knows which mic to resume
    setRetryingPermission(true);
    let granted = false;
    try {
      granted = await checkMicPermission();
    } finally {
      setRetryingPermission(false);
    }
    if (!granted) {
      startingRef.current = false;
      setPermissionDialogOpen(true);
      return;
    }
    setPermissionDialogOpen(false);
    if (mic === "describe") {
      forceCleanForm();
      prepareListening("describe");
      startDescRecognition();
    } else {
      forceCleanDesc();
      prepareListening("edit");
      startEditRecognition();
    }
  };

  const startDescribeListening = () => { void beginMic("describe"); };
  const startEditListening = () => { void beginMic("edit"); };

  // Stop whichever mic is currently active (used by the 30s window expiry).
  const stopActiveListening = () => {
    if (activeMicRef.current === "describe") stopDescListening();
    else if (activeMicRef.current === "edit") stopFormListening();
  };

  const handleVoiceStop = () => {
    if (listeningMic === "describe") stopDescListening();
    else if (listeningMic === "edit") stopFormListening();
  };

  const handleVoiceCancel = () => {
    cancelledRef.current = true;
    if (listeningMic === "describe") stopDescListening();
    else if (listeningMic === "edit") stopFormListening();
  };

  // Centralised teardown shared by error handling (Bug #7) and visibility
  // interruption (Bug #9). Discards capture and closes any open overlay.
  const resetVoiceSession = () => {
    clearListenTimers();
    releaseWakeLock();
    startingRef.current = false;
    // Hard teardown: discard any stale/dead recogniser so the next mic tap builds
    // a fresh one (Bug #11). stop() alone can leave a dead instance behind.
    forceCleanDesc();
    forceCleanForm();
    setListeningMic(null);
    setLiveTranscript("");
    finalsRef.current = "";
    liveTranscriptRef.current = "";
  };

  // Bug #7 — Retry from the permission dialog. Re-checks permission via
  // getUserMedia() (inside beginMic) and resumes the mic the user last tapped;
  // the dialog stays open if access is still blocked.
  const retryListening = () => {
    const mic = activeMicRef.current;
    if (mic === "describe") void beginMic("describe");
    else if (mic === "edit") void beginMic("edit");
  };

  // Bug #7 — recognition error handler. A denied mic leaves the overlay stuck,
  // so we force teardown. Permission denials show the device-specific instructions
  // dialog; other start failures show a transient toast. Re-assigned each render
  // so it always closes over the latest state; called via speechErrorRef.
  speechErrorRef.current = (error: string) => {
    const denied =
      error === "not-allowed" ||
      error === "service-not-allowed" ||
      error === "permission-denied";
    cancelledRef.current = true; // discard any partial capture
    resetVoiceSession();
    if (denied) {
      setPermissionDialogOpen(true);
    } else if (error === "start-failed") {
      // Bug #11 — recognition.start() threw; the overlay was never shown.
      toast.error("Couldn't start the microphone. Please try again.", {
        action: { label: "Retry", onClick: () => retryListening() },
      });
    }
  };

  const handleParse = () => {
    if (!description.trim()) {
      toast.error("Please describe your quote first");
      return;
    }
    // Generation is the processing step for Mic 1 (dictation fills this textarea,
    // then generation runs), so we lock the screen here regardless of whether the
    // description was typed or spoken — it is the same heavy AI step (Bug #3/#5).
    startProcessing();
    parseQuote.mutate({ data: { description } }, {
      onSuccess: (data) => {
        stopProcessing();
        invalidateBilling();
        setLineItems(data.lineItems);
        setSettings(data.settings);
        if (data.businessName) {
          setBusinessName(data.businessName);
        }
        setHasParsed(true);
      },
      onError: (err) => {
        stopProcessing();
        // CP1 — free new-quote limit reached (logged-in users only).
        if (limitReachedAction(err)) {
          setLimitAction("newQuotes");
          return;
        }
        // Log the full error so failures are diagnosable in the console.
        const e = err as { status?: number; data?: { error?: string }; message?: string };
        console.error("Quote generation failed:", {
          status: e?.status,
          data: e?.data,
          message: e?.message,
          error: err,
        });
        const serverMessage =
          typeof e?.data?.error === "string" && e.data.error.length < 200
            ? ` (${e.data.error})`
            : "";
        toast.error(`Failed to generate quote. Please try again.${serverMessage}`);
      }
    });
  };

  const handleUpdateItem = (id: string, field: keyof QuoteLineItem, value: number) => {
    // Overtime is a percentage and must never go negative (matches server clamp).
    const v = field === "overtimePercent" ? Math.max(0, value) : value;
    setLineItems(items => items.map(item => item.id === id ? { ...item, [field]: v } : item));
  };

  // Bug #10 — overtime is a percentage markup on the BASE unitPrice. The charged
  // rate per unit = unitPrice + (unitPrice * overtimePercent / 100).
  const effectiveRate = (item: QuoteLineItem) =>
    item.unitPrice * (1 + (item.overtimePercent ?? 0) / 100);

  const totals = useMemo(() => {
    let subtotal = 0;
    lineItems.forEach(item => {
      subtotal += effectiveRate(item) * item.quantity;
    });

    const callOut = settings.hasCallOut ? settings.callOutFee : 0;
    const surcharge = settings.isPublicHoliday ? (subtotal * (settings.publicHolidaySurchargePercent / 100)) : 0;
    
    const taxableAmount = subtotal + callOut + surcharge;
    const gst = settings.includeGst ? (taxableAmount * settings.gstRate) : 0;
    
    const total = taxableAmount + gst;

    return {
      subtotal,
      callOut,
      surcharge,
      gst,
      total
    };
  }, [lineItems, settings]);

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      toast.error("Template name required");
      return;
    }
    createTemplate.mutate({
      data: {
        name: templateName,
        businessDescription: description,
        lineItems,
        settings,
      }
    }, {
      onSuccess: () => {
        toast.success("Template saved successfully");
        setSaveDialogOpen(false);
        // Bug #8 — the quote is now persisted server-side; drop the local draft.
        try { localStorage.removeItem(RESTORE_KEY); } catch { /* ignore */ }
        queryClient.invalidateQueries({ queryKey: getListTemplatesQueryKey() });
        // Save is a gated action → also record the quote to history (§11).
        createQuote.mutate(
          {
            data: buildQuoteRecord({
              label: templateName || businessName,
              lineItems,
              settings,
              source: "save",
            }),
          },
          {
            onSuccess: () =>
              queryClient.invalidateQueries({ queryKey: getListQuotesQueryKey() }),
            onError: () =>
              toast.error("Saved as template, but couldn't add it to your history"),
          },
        );
      },
      onError: (err) => {
        // CP5 — free template-slot limit reached.
        if (limitReachedAction(err)) {
          setSaveDialogOpen(false);
          setLimitAction("templates");
          return;
        }
        if ((err as { status?: number })?.status === 409) {
          toast.error("That template name is already taken. Please choose a different name.");
        } else {
          toast.error("Failed to save template");
        }
      }
    });
  };

  // Bug #8 — persist the working quote on every change; clear once it's empty.
  useEffect(() => {
    if (templateId) return; // template-loaded quotes manage their own state
    const hasContent = description.trim() || lineItems.length > 0;
    try {
      if (hasContent) {
        localStorage.setItem(
          RESTORE_KEY,
          JSON.stringify({ description, lineItems, settings, businessName, hasParsed })
        );
      } else {
        localStorage.removeItem(RESTORE_KEY);
      }
    } catch {
      /* storage unavailable */
    }
  }, [templateId, description, lineItems, settings, businessName, hasParsed]);

  // Bug #8 — tell the user a previous in-progress quote was brought back.
  useEffect(() => {
    if (restored) toast.info("Draft restored");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bug #9 — hold a wake lock whenever a voice overlay is visible.
  useEffect(() => {
    if (overlayOpen) requestWakeLock();
    else releaseWakeLock();
  }, [overlayOpen]);

  // Bug #9 — a screen lock / tab switch silently kills speech recognition. If we
  // were listening when the page was hidden, treat it as interrupted on return;
  // otherwise just re-acquire the wake lock the browser auto-released.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (listeningMic !== null) {
          interruptedRef.current = true;
          cancelledRef.current = true; // discard any half-captured command
        }
      } else if (interruptedRef.current) {
        // Bug #11 — force-clean the stale recogniser, reset listening state, and
        // tell the user to start again. We never auto-restart listening.
        interruptedRef.current = false;
        resetVoiceSession();
        toast("Voice session interrupted. Tap the microphone to start again.");
      } else if (overlayOpen) {
        requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [listeningMic, overlayOpen]);

  return (
    <Layout title={hasParsed ? "Quote Builder" : "New Quote"}>
      <div className="p-4 flex flex-col gap-6 pb-24">
        
        {/* Description Section */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-primary">Describe your pricing</Label>
          <div className="relative">
            <Textarea 
              placeholder="e.g. I'm a plumber. I charge $85/hour for labour and $12.50/m of pipe."
              className="min-h-[120px] resize-none pr-12 text-base"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={parseQuote.isPending}
            />
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    size="icon" 
                    variant={descListening ? "default" : "secondary"}
                    aria-label="Describe your job out loud to generate a quote"
                    className={cn("absolute bottom-3 right-3 rounded-full transition-all", descListening && "bg-destructive hover:bg-destructive/90 animate-pulse")}
                    onClick={startDescribeListening}
                    disabled={parseQuote.isPending}
                  >
                    <Mic className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Describe your job out loud to generate a quote.</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Button 
            className="w-full h-12 text-base font-semibold" 
            onClick={handleParse}
            disabled={parseQuote.isPending || !description.trim()}
          >
            {parseQuote.isPending ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Generating...</>
            ) : (
              "Generate Quote Form"
            )}
          </Button>
        </div>

        <AnimatePresence>
          {hasParsed && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-primary tracking-tight">Line Items</h3>
                  <Button variant="ghost" size="sm" onClick={() => {
                    const id = Math.random().toString(36).substr(2, 9);
                    setLineItems([...lineItems, { id, label: "New Item", unit: "ea", unitPrice: 0, quantity: 1, voiceKey: "new item", overtimePercent: 0 }]);
                  }}>
                    <Plus className="w-4 h-4 mr-1" /> Add
                  </Button>
                </div>
                
                {lineItems.map((item) => (
                  <Card key={item.id} className="overflow-hidden border-border/50 shadow-sm">
                    <CardContent className="p-4 space-y-4">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="font-semibold text-sm">{item.label}</p>
                          <p className="text-xs text-muted-foreground">Voice cue: <span className="font-mono bg-muted px-1 py-0.5 rounded">{item.voiceKey}</span></p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary">${(effectiveRate(item) * item.quantity).toFixed(2)}</p>
                          {(item.overtimePercent ?? 0) > 0 && (
                            <p className="text-[10px] text-muted-foreground line-through">${(item.unitPrice * item.quantity).toFixed(2)}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-3">
                        <div className="space-y-1.5 flex-1">
                          <Label className="text-xs text-muted-foreground">Qty ({item.unit})</Label>
                          <NumericInput
                            value={item.quantity}
                            onValueChange={(v) => handleUpdateItem(item.id, "quantity", v)}
                            className="font-mono text-sm h-9"
                          />
                        </div>
                        <div className="space-y-1.5 flex-1">
                          <Label className="text-xs text-muted-foreground">Unit Price ($)</Label>
                          <NumericInput
                            value={item.unitPrice}
                            onValueChange={(v) => handleUpdateItem(item.id, "unitPrice", v)}
                            className="font-mono text-sm h-9"
                          />
                        </div>
                        <div className="space-y-1.5 flex-1">
                          <Label className="text-xs text-muted-foreground">Overtime (%)</Label>
                          <NumericInput
                            value={item.overtimePercent ?? 0}
                            onValueChange={(v) => handleUpdateItem(item.id, "overtimePercent", v)}
                            className="font-mono text-sm h-9"
                          />
                        </div>
                      </div>

                      {(item.overtimePercent ?? 0) > 0 && (
                        <div className="flex items-center justify-between rounded-md bg-accent/10 px-3 py-2 text-xs">
                          <span className="text-muted-foreground">Base ${item.unitPrice.toFixed(2)} + {item.overtimePercent}% overtime</span>
                          <span className="font-mono font-semibold text-primary">${effectiveRate(item).toFixed(2)}/{item.unit}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-lg text-primary tracking-tight">Settings</h3>
                <Card className="border-border/50 shadow-sm">
                  <CardContent className="p-4 space-y-5">
                    <div className="flex items-center justify-between">
                      <Label className="flex flex-col gap-1">
                        <span className="font-medium text-sm">Include GST</span>
                        <span className="text-xs text-muted-foreground">10% tax added to total</span>
                      </Label>
                      <Switch 
                        checked={settings.includeGst} 
                        onCheckedChange={(c) => setSettings({...settings, includeGst: c})} 
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Label className="flex flex-col gap-1">
                        <span className="font-medium text-sm">Call-out Fee</span>
                        <span className="text-xs text-muted-foreground">Added to subtotal</span>
                      </Label>
                      <Switch 
                        checked={settings.hasCallOut} 
                        onCheckedChange={(c) => setSettings({...settings, hasCallOut: c})} 
                      />
                    </div>
                    
                    {settings.hasCallOut && (
                      <div className="pl-0 animate-in slide-in-from-top-2">
                        <NumericInput
                          placeholder="Amount ($)"
                          value={settings.callOutFee}
                          onValueChange={(v) => setSettings({...settings, callOutFee: v})}
                          className="font-mono h-9"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <Label className="flex flex-col gap-1">
                        <span className="font-medium text-sm">Public Holiday</span>
                        <span className="text-xs text-muted-foreground">Applies % surcharge</span>
                      </Label>
                      <Switch 
                        checked={settings.isPublicHoliday} 
                        onCheckedChange={(c) => setSettings({...settings, isPublicHoliday: c})} 
                      />
                    </div>

                    {settings.isPublicHoliday && (
                      <div className="pl-0 animate-in slide-in-from-top-2">
                        <div className="flex items-center gap-2">
                           <NumericInput
                            placeholder="Surcharge %"
                            value={settings.publicHolidaySurchargePercent}
                            onValueChange={(v) => setSettings({...settings, publicHolidaySurchargePercent: v})}
                            className="font-mono h-9 w-24"
                          />
                          <span className="text-sm text-muted-foreground">%</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="bg-primary text-primary-foreground rounded-xl p-5 shadow-lg space-y-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full -mr-10 -mt-10" />
                
                <h3 className="font-semibold text-sm text-primary-foreground/80 uppercase tracking-wider">Summary</h3>
                
                <div className="space-y-1.5 text-sm font-mono">
                  <div className="flex justify-between">
                    <span className="text-primary-foreground/80">Subtotal</span>
                    <span>${totals.subtotal.toFixed(2)}</span>
                  </div>
                  {settings.hasCallOut && (
                    <div className="flex justify-between">
                      <span className="text-primary-foreground/80">Call-out Fee</span>
                      <span>${totals.callOut.toFixed(2)}</span>
                    </div>
                  )}
                  {settings.isPublicHoliday && (
                    <div className="flex justify-between text-accent">
                      <span>Surcharge ({settings.publicHolidaySurchargePercent}%)</span>
                      <span>${totals.surcharge.toFixed(2)}</span>
                    </div>
                  )}
                  {settings.includeGst && (
                    <div className="flex justify-between">
                      <span className="text-primary-foreground/80">GST (10%)</span>
                      <span>${totals.gst.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                
                <div className="pt-3 mt-3 border-t border-primary-foreground/20 flex justify-between items-end">
                  <span className="font-semibold text-base">Grand Total</span>
                  <span className="font-bold text-3xl tracking-tight text-accent">${totals.total.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    className="h-12 text-base font-semibold"
                    onClick={() => handleGatedAction("download")}
                  >
                    <Download className="w-5 h-5 mr-2" /> Generate PDF
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-12 text-base font-semibold"
                    onClick={() => handleGatedAction("email")}
                  >
                    <Mail className="w-5 h-5 mr-2" /> Email
                  </Button>
                </div>
                <Button
                  variant="outline"
                  className="w-full h-12 text-base font-semibold"
                  onClick={() => handleGatedAction("save")}
                >
                  <Save className="w-5 h-5 mr-2" /> Save as Template
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {hasParsed && (
        <div className="fixed bottom-20 right-4 z-50">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label="Edit your quote by voice"
                  className={cn(
                    "relative h-14 rounded-full px-5 shadow-2xl transition-all flex items-center gap-2",
                    formListening
                      ? "bg-destructive hover:bg-destructive shadow-destructive/40"
                      : "bg-primary hover:bg-primary/90 shadow-primary/40"
                  )}
                  onClick={startEditListening}
                >
                  {formListening && (
                    <span className="absolute inset-0 rounded-full border-2 border-destructive animate-ping" />
                  )}
                  <Mic className={cn("w-6 h-6 text-white", formListening && "animate-pulse")} />
                  <span className="text-sm font-semibold text-white whitespace-nowrap">
                    {formListening ? "Listening..." : "Edit Quote"}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Speak to make changes to quantity, unit price or even the quote structure.</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      <VoiceOverlay
        open={listeningMic !== null}
        title={listeningMic === "describe" ? "Describe your job to generate a quote" : "Speak your change to the quote"}
        transcript={liveTranscript}
        secondsLeft={secondsLeft}
        onStop={handleVoiceStop}
        onCancel={handleVoiceCancel}
      />

      {processing && (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background/85 backdrop-blur-sm"
          role="alertdialog"
          aria-busy="true"
          aria-live="assertive"
        >
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-foreground">Processing voice…</p>
        </div>
      )}

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md w-[90vw] rounded-xl">
          <DialogHeader>
            <DialogTitle>Save Template</DialogTitle>
            <DialogDescription>
              Save this setup to quickly generate future quotes.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="templateName">Template Name</Label>
            <Input 
              id="templateName" 
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="mt-2"
              placeholder="e.g. Standard Plumbing Job"
            />
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={handleSaveTemplate} disabled={createTemplate.isPending} className="w-full sm:w-auto">
              {createTemplate.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MicPermissionDialog
        open={permissionDialogOpen}
        onOpenChange={setPermissionDialogOpen}
        onRetry={retryListening}
        retrying={retryingPermission}
      />

      <ExportPdfDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        label={businessName || "Quote"}
        lineItems={lineItems}
        settings={settings}
      />

      <EmailQuoteDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        label={businessName || "Quote"}
        lineItems={lineItems}
        settings={settings}
      />

      {/* CP1/CP2/CP5 — free-tier limit reached */}
      <LimitDialog
        action={limitAction}
        onOpenChange={(o) => !o && setLimitAction(null)}
      />

    </Layout>
  );
}
