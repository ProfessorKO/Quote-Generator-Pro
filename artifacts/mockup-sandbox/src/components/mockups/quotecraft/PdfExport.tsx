import React, { useState } from "react";
import { ChevronLeft, Upload, Check, Download, Mail, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import "./_group.css";

const colors = [
  { name: "Amber", value: "#f59e0b", selected: true },
  { name: "Blue", value: "#3b82f6", selected: false },
  { name: "Green", value: "#10b981", selected: false },
  { name: "Purple", value: "#8b5cf6", selected: false },
  { name: "Red", value: "#ef4444", selected: false },
];

export function PdfExport() {
  const [selectedColor, setSelectedColor] = useState(colors[0].value);
  const [logoUploaded, setLogoUploaded] = useState(true);
  const [gstBreakdown, setGstBreakdown] = useState(true);
  const [showPaymentTerms, setShowPaymentTerms] = useState(true);
  const [attachTcs, setAttachTcs] = useState(false);
  const [validDays, setValidDays] = useState("30");

  const [businessDetails, setBusinessDetails] = useState({
    name: "Dave's Plumbing",
    abn: "12 345 678 901",
    address: "42 Wallaby Way, Sydney NSW 2000",
    phone: "0412 345 678",
    email: "dave@davesplumbing.com.au",
  });

  const handleDetailChange = (field: keyof typeof businessDetails, value: string) => {
    setBusinessDetails(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="flex justify-center bg-zinc-100 min-h-screen">
      {/* Mobile Frame */}
      <div className="w-full max-w-[400px] h-[100dvh] flex flex-col bg-background font-['Inter'] text-foreground shadow-xl overflow-hidden border-x border-border">
        {/* Top Bar */}
        <div className="flex-none flex items-center justify-between p-4 bg-primary text-primary-foreground">
          <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-white/10 -ml-2 rounded-full">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-base font-semibold">Export PDF</h1>
          <div className="w-9" /> {/* Spacer */}
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-6 pb-32">
            
            {/* Live Preview */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Live Preview</h2>
              <div className="flex justify-center p-4 bg-muted rounded-lg">
                {/* A4 Document Thumbnail (Aspect ratio ~ 1:1.414) */}
                <div className="w-[200px] h-[282px] bg-white shadow-sm border border-border flex flex-col relative text-[6px] leading-[1.2] text-foreground p-3">
                  
                  {/* Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 bg-muted flex items-center justify-center rounded-sm text-muted-foreground">
                      {logoUploaded ? <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-[10px]">DP</div> : <ImageIcon className="w-4 h-4 opacity-30" />}
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-[10px] text-primary">{businessDetails.name}</div>
                      <div className="text-muted-foreground">ABN: {businessDetails.abn}</div>
                      <div className="text-muted-foreground">{businessDetails.address}</div>
                      <div className="text-muted-foreground">{businessDetails.phone}</div>
                      <div className="text-muted-foreground">{businessDetails.email}</div>
                    </div>
                  </div>

                  <div className="h-px w-full mb-3" style={{ backgroundColor: selectedColor }}></div>

                  {/* Client Info & Meta */}
                  <div className="flex justify-between mb-4">
                    <div>
                      <div className="font-bold text-muted-foreground mb-1">Quote To:</div>
                      <div>Smith Constructions</div>
                      <div>100 Blue Street</div>
                      <div>North Sydney NSW 2060</div>
                    </div>
                    <div className="text-right space-y-0.5">
                      <div className="text-[10px] font-bold" style={{ color: selectedColor }}>QUOTE #1024</div>
                      <div>Date: 24 Oct 2023</div>
                      <div>Valid For: {validDays} days</div>
                    </div>
                  </div>

                  {/* Line Items */}
                  <div className="flex-1">
                    <div className="flex border-b border-border font-bold pb-1 mb-1 text-muted-foreground">
                      <div className="flex-1">Description</div>
                      <div className="w-8 text-right">Qty</div>
                      <div className="w-12 text-right">Price</div>
                      <div className="w-12 text-right">Total</div>
                    </div>
                    
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex py-1 border-b border-border/50">
                        <div className="flex-1">Plumbing Service Call {i}</div>
                        <div className="w-8 text-right">1</div>
                        <div className="w-12 text-right">$150.00</div>
                        <div className="w-12 text-right">$150.00</div>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="w-32 self-end mt-2 space-y-1">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span>$450.00</span>
                    </div>
                    {gstBreakdown && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>GST (10%)</span>
                        <span>$45.00</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-[8px] pt-1 border-t border-border" style={{ color: selectedColor }}>
                      <span>Total</span>
                      <span>$495.00</span>
                    </div>
                  </div>

                  {/* Footer */}
                  {showPaymentTerms && (
                    <div className="mt-4 pt-2 border-t border-border text-[5px] text-muted-foreground">
                      <div className="font-bold mb-0.5">Payment Terms</div>
                      <p>Please pay within {validDays} days. Direct deposit to BSB: 062-123 ACC: 10293847.</p>
                    </div>
                  )}

                </div>
              </div>
            </section>

            {/* Business Branding */}
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Business Branding</h2>
              <Card className="bg-card">
                <CardContent className="p-4 space-y-4">
                  {/* Logo Upload */}
                  <div className="space-y-2">
                    <Label>Business Logo</Label>
                    <div className="border-2 border-dashed border-border rounded-lg p-4 flex items-center justify-center bg-muted/50 transition-colors hover:bg-muted/80 cursor-pointer">
                      {logoUploaded ? (
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-lg shadow-sm">DP</div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">daves-logo.png</span>
                            <span className="text-xs text-muted-foreground">Click to replace</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 py-2">
                          <Upload className="w-6 h-6 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Tap to upload logo</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Brand Color */}
                  <div className="space-y-3">
                    <Label>Accent Colour</Label>
                    <div className="flex items-center gap-3">
                      {colors.map((c) => (
                        <button
                          key={c.name}
                          onClick={() => setSelectedColor(c.value)}
                          className="w-8 h-8 rounded-full border-2 border-background shadow-sm transition-transform active:scale-95 flex items-center justify-center"
                          style={{ backgroundColor: c.value, ringColor: selectedColor === c.value ? c.value : 'transparent', ringWidth: selectedColor === c.value ? '2px' : '0px', ringOffsetWidth: '2px' }}
                        >
                          {selectedColor === c.value && <Check className="w-4 h-4 text-white" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Business Details */}
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="biz-name">Business Name</Label>
                      <Input id="biz-name" value={businessDetails.name} onChange={(e) => handleDetailChange("name", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="biz-abn">ABN</Label>
                      <Input id="biz-abn" value={businessDetails.abn} onChange={(e) => handleDetailChange("abn", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="biz-address">Address</Label>
                      <Input id="biz-address" value={businessDetails.address} onChange={(e) => handleDetailChange("address", e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="biz-phone">Phone</Label>
                        <Input id="biz-phone" value={businessDetails.phone} onChange={(e) => handleDetailChange("phone", e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="biz-email">Email</Label>
                        <Input id="biz-email" type="email" value={businessDetails.email} onChange={(e) => handleDetailChange("email", e.target.value)} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Document Options */}
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Document Options</h2>
              <Card className="bg-card">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="space-y-0.5">
                      <Label className="text-base">Include GST breakdown</Label>
                      <div className="text-xs text-muted-foreground">Show subtotal, GST amount, and total</div>
                    </div>
                    <Switch checked={gstBreakdown} onCheckedChange={setGstBreakdown} />
                  </div>
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="space-y-0.5">
                      <Label className="text-base">Show payment terms</Label>
                      <div className="text-xs text-muted-foreground">Include bank details in footer</div>
                    </div>
                    <Switch checked={showPaymentTerms} onCheckedChange={setShowPaymentTerms} />
                  </div>
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="space-y-0.5">
                      <Label className="text-base">Attach T&Cs</Label>
                      <div className="text-xs text-muted-foreground">Append standard terms to PDF</div>
                    </div>
                    <Switch checked={attachTcs} onCheckedChange={setAttachTcs} />
                  </div>
                  <div className="flex items-center justify-between p-4">
                    <Label className="text-base">Valid for (days)</Label>
                    <Input 
                      type="number" 
                      className="w-20 text-center" 
                      value={validDays} 
                      onChange={(e) => setValidDays(e.target.value)} 
                    />
                  </div>
                </CardContent>
              </Card>
            </section>

          </div>
        </div>

        {/* Bottom Actions Fixed */}
        <div className="flex-none p-4 bg-background border-t border-border shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] pb-6">
          <div className="flex flex-col gap-3">
            <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold h-12" size="lg">
              <Download className="w-5 h-5 mr-2" />
              Download PDF
            </Button>
            <Button variant="outline" className="w-full h-12 text-primary border-primary/20 hover:bg-primary/5">
              <Mail className="w-5 h-5 mr-2" />
              Email to Client
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
