import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { Layout } from "@/components/layout";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, Loader2, Save, Trash2, Plus, FileText, CheckCircle2 } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/use-speech";
import { useParseQuoteDescription, useApplyVoiceCommand, useCreateTemplate, getListTemplatesQueryKey, useGetTemplate, QuoteLineItem, QuoteSettings } from "@workspace/api-client-react";
import { toast } from "sonner";
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
import { NumericInput } from "@/components/numeric-input";
import { VoiceOverlay } from "@/components/voice-overlay";

export default function Home() {
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const templateId = searchParams.get("templateId");

  const [description, setDescription] = useState("");
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [settings, setSettings] = useState<QuoteSettings>({
    includeGst: true,
    gstRate: 0.10,
    callOutFee: 0,
    publicHolidaySurchargePercent: 0,
    isPublicHoliday: false,
    hasCallOut: false,
  });
  const [businessName, setBusinessName] = useState("");
  const [hasParsed, setHasParsed] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");

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
  const cancelledRef = useRef(false);

  const overlayOpen = listeningMic !== null || processing;

  const clearListenTimers = () => {
    if (listenTimerRef.current) { clearTimeout(listenTimerRef.current); listenTimerRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
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

  // Open the centred "Listening…" overlay and start a 30s capture window with a
  // live countdown. Both mics use this so the screen is fully blocked while the
  // mic captures speech (Bug #3/#5 + dual-mic prototype).
  const beginListening = (mic: "describe" | "edit", onExpire: () => void) => {
    finalsRef.current = "";
    cancelledRef.current = false;
    setLiveTranscript("");
    setSecondsLeft(LISTEN_WINDOW_SECONDS);
    setListeningMic(mic);
    clearListenTimers();
    countdownRef.current = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    listenTimerRef.current = setTimeout(onExpire, LISTEN_WINDOW_SECONDS * 1000);
  };

  // Accumulate finalized chunks; show finals + the current interim live.
  const updateTranscript = (transcript: string, isFinal: boolean) => {
    if (isFinal) {
      finalsRef.current = (finalsRef.current ? finalsRef.current + " " : "") + transcript;
      setLiveTranscript(finalsRef.current);
    } else {
      setLiveTranscript((finalsRef.current ? finalsRef.current + " " : "") + transcript);
    }
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
  const speakQuoteUpdated = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
    speakTimerRef.current = setTimeout(() => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance("Quote updated");
      utterance.lang = "en-AU";
      window.speechSynthesis.speak(utterance);
    }, 1500);
  };

  const queryClient = useQueryClient();
  const parseQuote = useParseQuoteDescription();
  const applyVoiceCommand = useApplyVoiceCommand();
  const createTemplate = useCreateTemplate();
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

  const {
    isListening: descListening,
    toggleListening: toggleDescListening,
    stopListening: stopDescListening,
    supported: speechSupported,
  } = useSpeechRecognition({
    continuous: true,
    onResult: updateTranscript,
    onEnd: () => finishDescribe(),
  });

  // Mic 1 — dictation is captured into the description box; generation is a
  // separate explicit step (the "Generate" button).
  const finishDescribe = () => {
    clearListenTimers();
    setListeningMic(null);
    const text = finalsRef.current.trim();
    finalsRef.current = "";
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
          if (data.understood) {
            setLineItems(data.lineItems);
            setSettings(data.settings);
            toast.success(data.message);
            speakQuoteUpdated();
          } else {
            toast.error(data.message || "Couldn't understand that command");
          }
        },
        onError: () => {
          toast.dismiss(loadingToast);
          stopProcessing();
          toast.error("Failed to apply command. Please try again.");
        },
      }
    );
  };

  const {
    isListening: formListening,
    toggleListening: toggleFormListening,
    stopListening: stopFormListening,
  } = useSpeechRecognition({
    continuous: true,
    onResult: updateTranscript,
    onEnd: () => finishEdit(),
  });

  // Mic 2 — once capture ends, apply the spoken command to the quote.
  const finishEdit = () => {
    clearListenTimers();
    setListeningMic(null);
    const command = finalsRef.current.trim();
    finalsRef.current = "";
    setLiveTranscript("");
    if (cancelledRef.current || !command) {
      cancelledRef.current = false;
      return;
    }
    runVoiceCommand(command);
  };

  const startDescribeListening = () => {
    if (!speechSupported) {
      toast.error("Speech recognition is not supported in your browser.");
      return;
    }
    if (overlayOpen) return;
    beginListening("describe", () => stopDescListening());
    toggleDescListening();
  };

  const startEditListening = () => {
    if (!speechSupported) {
      toast.error("Speech recognition is not supported in your browser.");
      return;
    }
    if (overlayOpen) return;
    beginListening("edit", () => stopFormListening());
    toggleFormListening();
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
        setLineItems(data.lineItems);
        setSettings(data.settings);
        if (data.businessName) {
          setBusinessName(data.businessName);
        }
        setHasParsed(true);
      },
      onError: (err) => {
        stopProcessing();
        toast.error("Failed to generate quote. Please try again.");
      }
    });
  };

  const handleUpdateItem = (id: string, field: keyof QuoteLineItem, value: number) => {
    setLineItems(items => items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const totals = useMemo(() => {
    let subtotal = 0;
    lineItems.forEach(item => {
      subtotal += item.unitPrice * item.quantity;
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
        queryClient.invalidateQueries({ queryKey: getListTemplatesQueryKey() });
      },
      onError: (err) => {
        if ((err as { status?: number })?.status === 409) {
          toast.error("That template name is already taken. Please choose a different name.");
        } else {
          toast.error("Failed to save template");
        }
      }
    });
  };

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
                    setLineItems([...lineItems, { id, label: "New Item", unit: "ea", unitPrice: 0, quantity: 1, voiceKey: "new item" }]);
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
                          <p className="font-bold text-primary">${(item.quantity * item.unitPrice).toFixed(2)}</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-4">
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
                      </div>
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

              <Button 
                variant="outline" 
                className="w-full h-12 text-base font-semibold"
                onClick={() => {
                  setTemplateName(businessName || "New Template");
                  setSaveDialogOpen(true);
                }}
              >
                <Save className="w-5 h-5 mr-2" /> Save as Template
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {hasParsed && (
        <div className="fixed bottom-20 right-4 z-50 flex flex-col items-center gap-2">
          <span className={cn(
            "text-[10px] px-2 py-1 rounded-full font-medium shadow-md",
            formListening ? "bg-destructive text-white animate-pulse" : "bg-primary text-primary-foreground"
          )}>
            {formListening ? "Listening..." : "Edit quote"}
          </span>
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  aria-label="Edit your quote by voice"
                  className={cn(
                    "h-14 w-14 rounded-full shadow-2xl transition-all",
                    formListening ? "bg-destructive hover:bg-destructive shadow-destructive/40" : "bg-primary hover:bg-primary/90 shadow-primary/40"
                  )}
                  onClick={startEditListening}
                >
                  {formListening ? (
                    <>
                      <span className="absolute inset-0 rounded-full border-2 border-destructive animate-ping" />
                      <Mic className="w-6 h-6 animate-pulse text-white" />
                    </>
                  ) : (
                    <Mic className="w-6 h-6 text-white" />
                  )}
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

    </Layout>
  );
}
