import React, { useState } from "react";
import "./_group.css";
import { 
  Mic, 
  Sparkles, 
  ChevronLeft, 
  Wrench, 
  Download, 
  Save, 
  MoreVertical,
  Plus,
  PenLine
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export function QuoteScreen() {
  const [description, setDescription] = useState("Replace hot water system, 4 hours labour, supply 250L unit...");
  
  return (
    <div className="min-h-screen bg-background font-['Inter'] text-foreground flex justify-center">
      <div className="w-full max-w-[400px] bg-secondary/30 relative flex flex-col shadow-xl overflow-hidden border-x border-border/50">
        
        {/* Top App Bar */}
        <header className="sticky top-0 z-10 bg-primary text-primary-foreground p-4 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <button className="p-1 -ml-1 rounded-full hover:bg-white/10 transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="font-semibold text-lg tracking-tight">QuoteCraft</h1>
          </div>
          <button className="p-1 rounded-full hover:bg-white/10 transition-colors">
            <MoreVertical className="w-5 h-5" />
          </button>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pb-24 p-4 space-y-6">
          
          {/* Section 1: Describe the Job + Mic 1 */}
          <section className="space-y-2">
            <div className="flex justify-between items-end">
              <label className="text-sm font-medium text-foreground/80">Job Description</label>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Speak the job — we'll build the quote
              </span>
            </div>
            <div className="relative">
              <Textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="resize-none pr-14 min-h-[100px] bg-card border-border shadow-sm text-sm"
                placeholder="Describe the job here..."
              />
              {/* MIC 1: Generate Quote */}
              <Button 
                size="icon" 
                className="absolute bottom-2 right-2 rounded-full w-10 h-10 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
              >
                <Mic className="w-5 h-5" />
              </Button>
            </div>
          </section>

          {/* Section 2: Generated Quote */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground/90 uppercase tracking-wider">Generated Quote</h2>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Draft</Badge>
            </div>

            <Card className="shadow-sm border-border overflow-hidden">
              {/* Business Header */}
              <div className="bg-card p-5 border-b border-border/50 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
                      <Wrench className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <h3 className="font-bold text-base">Dave's Plumbing</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">ABN: 42 123 456 789</p>
                  <p className="text-xs text-muted-foreground">0412 345 678</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-primary">QUOTE</p>
                  <p className="text-xs text-muted-foreground font-mono mt-1">#QT-2024-089</p>
                </div>
              </div>

              {/* Client Info */}
              <div className="p-4 bg-secondary/20 text-sm border-b border-border/50">
                <p className="font-medium">Sarah Jenkins</p>
                <p className="text-muted-foreground">14 Smith Street, Richmond VIC 3121</p>
                <p className="text-muted-foreground mt-1">Date: 24 Oct 2024</p>
              </div>

              {/* Line Items */}
              <div className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/30 text-xs text-muted-foreground border-b border-border/50">
                    <tr>
                      <th className="text-left font-medium p-3">Description</th>
                      <th className="text-right font-medium p-3">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    <tr>
                      <td className="p-3">
                        <p className="font-medium text-foreground">Labour (Plumbing)</p>
                        <p className="text-xs text-muted-foreground">4 hrs @ $110.00/hr</p>
                      </td>
                      <td className="p-3 text-right font-medium">$440.00</td>
                    </tr>
                    <tr>
                      <td className="p-3">
                        <p className="font-medium text-foreground">Rheem 250L Hot Water Unit</p>
                        <p className="text-xs text-muted-foreground">1 unit @ $1,250.00</p>
                      </td>
                      <td className="p-3 text-right font-medium">$1,250.00</td>
                    </tr>
                    <tr>
                      <td className="p-3">
                        <p className="font-medium text-foreground">Copper Pipe & Fittings</p>
                        <p className="text-xs text-muted-foreground">Misc materials</p>
                      </td>
                      <td className="p-3 text-right font-medium">$85.00</td>
                    </tr>
                    <tr className="bg-destructive/5">
                      <td className="p-3">
                        <p className="font-medium text-destructive">Loyalty Discount (10%)</p>
                        <p className="text-xs text-destructive/70">Applied to labour & materials</p>
                      </td>
                      <td className="p-3 text-right font-medium text-destructive">-$177.50</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="p-4 bg-secondary/10 border-t border-border/50 space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>$1,597.50</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Call-out fee</span>
                  <span>$80.00</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Public holiday surcharge</span>
                  <span>$0.00</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>GST (10%)</span>
                  <span>$167.75</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between items-center">
                  <span className="font-bold text-base">Grand Total</span>
                  <span className="font-bold text-xl text-primary">$1,845.25</span>
                </div>
              </div>
            </Card>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button variant="outline" className="w-full bg-card hover:bg-secondary/50 text-foreground font-medium">
                <Save className="w-4 h-4 mr-2 text-muted-foreground" />
                Save Template
              </Button>
              <Button variant="outline" className="w-full bg-card hover:bg-secondary/50 text-foreground font-medium">
                <Download className="w-4 h-4 mr-2 text-muted-foreground" />
                Export PDF
              </Button>
            </div>
          </section>

        </div>

        {/* MIC 2: Voice Edit FAB */}
        <div className="absolute bottom-6 right-6 flex flex-col items-end gap-2 animate-in slide-in-from-bottom-4 fade-in duration-500">
          <div className="bg-foreground text-background text-xs px-3 py-1.5 rounded-lg shadow-lg font-medium flex items-center gap-1.5 relative">
            Voice edit this quote
            <div className="absolute -bottom-1.5 right-6 w-3 h-3 bg-foreground transform rotate-45"></div>
          </div>
          <button 
            className="w-14 h-14 bg-accent text-accent-foreground rounded-full flex items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:scale-105 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
            aria-label="Voice edit quote"
          >
            <div className="relative">
              <Mic className="w-6 h-6" />
              <div className="absolute -top-1 -right-2 bg-background text-foreground rounded-full p-0.5 border border-border shadow-sm">
                <PenLine className="w-3 h-3" />
              </div>
            </div>
          </button>
        </div>

      </div>
    </div>
  );
}
