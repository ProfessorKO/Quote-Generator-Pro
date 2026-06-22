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
import { useParseQuoteDescription, useCreateTemplate, getListTemplatesQueryKey, useGetTemplate, QuoteLineItem, QuoteSettings } from "@workspace/api-client-react";
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

  const queryClient = useQueryClient();
  const parseQuote = useParseQuoteDescription();
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

  const { isListening: descListening, toggleListening: toggleDescListening } = useSpeechRecognition({
    onResult: (transcript, isFinal) => {
      if (isFinal) {
        setDescription((prev) => (prev ? prev + " " + transcript : transcript));
      }
    }
  });

  const { isListening: formListening, toggleListening: toggleFormListening } = useSpeechRecognition({
    onResult: (transcript, isFinal) => {
      if (!isFinal) return;
      
      const lowerTranscript = transcript.toLowerCase();
      
      // Match save command
      if (lowerTranscript.includes("save template")) {
        setTemplateName(businessName || "New Template");
        setSaveDialogOpen(true);
        toast("Command recognized: Save template");
        return;
      }

      // Match GST toggles
      if (lowerTranscript.includes("add gst") || lowerTranscript.includes("include gst")) {
        setSettings(s => ({ ...s, includeGst: true }));
        toast("Command recognized: Add GST");
        return;
      }
      if (lowerTranscript.includes("remove gst") || lowerTranscript.includes("no gst")) {
        setSettings(s => ({ ...s, includeGst: false }));
        toast("Command recognized: Remove GST");
        return;
      }

      // Match line item quantities by voice key
      let matched = false;
      const updatedItems = lineItems.map(item => {
        if (item.voiceKey && lowerTranscript.includes(item.voiceKey.toLowerCase())) {
          // Extract number after voice key
          const words = lowerTranscript.split(" ");
          const keyIndex = words.findIndex(w => item.voiceKey.toLowerCase().includes(w));
          if (keyIndex !== -1) {
            // look ahead for numbers
            for (let i = keyIndex + 1; i < words.length && i < keyIndex + 3; i++) {
              const num = parseFloat(words[i]);
              if (!isNaN(num)) {
                matched = true;
                toast(`Command recognized: Set ${item.label} to ${num}`);
                return { ...item, quantity: num };
              }
            }
          }
        }
        return item;
      });

      if (matched) {
        setLineItems(updatedItems);
      }
    }
  });

  const handleParse = () => {
    if (!description.trim()) {
      toast.error("Please describe your quote first");
      return;
    }
    parseQuote.mutate({ data: { description } }, {
      onSuccess: (data) => {
        setLineItems(data.lineItems);
        setSettings(data.settings);
        if (data.businessName) {
          setBusinessName(data.businessName);
        }
        setHasParsed(true);
      },
      onError: (err) => {
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
      onError: () => {
        toast.error("Failed to save template");
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
            <Button 
              size="icon" 
              variant={descListening ? "default" : "secondary"}
              className={cn("absolute bottom-3 right-3 rounded-full transition-all", descListening && "bg-destructive hover:bg-destructive/90 animate-pulse")}
              onClick={toggleDescListening}
              disabled={parseQuote.isPending}
            >
              <Mic className="w-4 h-4" />
            </Button>
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
                          <Input 
                            type="number" 
                            value={item.quantity} 
                            onChange={(e) => handleUpdateItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                            className="font-mono text-sm h-9"
                          />
                        </div>
                        <div className="space-y-1.5 flex-1">
                          <Label className="text-xs text-muted-foreground">Unit Price ($)</Label>
                          <Input 
                            type="number" 
                            value={item.unitPrice} 
                            onChange={(e) => handleUpdateItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)}
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
                        <Input 
                          type="number" 
                          placeholder="Amount ($)" 
                          value={settings.callOutFee}
                          onChange={(e) => setSettings({...settings, callOutFee: parseFloat(e.target.value) || 0})}
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
                           <Input 
                            type="number" 
                            placeholder="Surcharge %" 
                            value={settings.publicHolidaySurchargePercent}
                            onChange={(e) => setSettings({...settings, publicHolidaySurchargePercent: parseFloat(e.target.value) || 0})}
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
          {formListening && (
            <span className="bg-primary text-primary-foreground text-[10px] px-2 py-1 rounded-full font-medium shadow-md animate-pulse">
              Listening...
            </span>
          )}
          <Button
            size="icon"
            className={cn(
              "h-14 w-14 rounded-full shadow-2xl transition-all",
              formListening ? "bg-destructive hover:bg-destructive shadow-destructive/40" : "bg-primary hover:bg-primary/90 shadow-primary/40"
            )}
            onClick={toggleFormListening}
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
