import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  Plus,
  Home,
  Layers,
  User,
  ChevronRight,
  Wrench,
  Droplet,
  Zap,
  TrendingUp,
  Clock
} from "lucide-react";
import "./_group.css";

// Sample Data
const stats = [
  { label: "This Month", value: "12", icon: FileText },
  { label: "Pending", value: "3", icon: Clock },
  { label: "Accepted", value: "$18,450", icon: TrendingUp },
];

const templates = [
  { id: 1, name: "Hot Water Service", icon: Zap, time: "Est. 5m" },
  { id: 2, name: "Bathroom Reno", icon: Droplet, time: "Est. 15m" },
  { id: 3, name: "Emergency Call-out", icon: Wrench, time: "Est. 2m" },
];

const recentQuotes = [
  { id: "QT-1042", client: "Smith Residence", suburb: "Richmond", amount: 450.00, date: "Today", status: "Sent" },
  { id: "QT-1041", client: "John's Cafe", suburb: "Fitzroy", amount: 1250.00, date: "Yesterday", status: "Accepted" },
  { id: "QT-1040", client: "Sarah Jenkins", suburb: "Brunswick", amount: 3200.00, date: "12 Oct", status: "Draft" },
  { id: "QT-1039", client: "ABC Logistics", suburb: "Dandenong", amount: 850.00, date: "10 Oct", status: "Declined" },
  { id: "QT-1038", client: "Tom Weston", suburb: "St Kilda", amount: 150.00, date: "08 Oct", status: "Accepted" },
];

function getStatusBadge(status: string) {
  switch (status) {
    case 'Accepted':
      return <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 border-emerald-500/20 shadow-none font-medium">Accepted</Badge>;
    case 'Sent':
      return <Badge className="bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 border-blue-500/20 shadow-none font-medium">Sent</Badge>;
    case 'Draft':
      return <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30 shadow-none font-medium">Draft</Badge>;
    case 'Declined':
      return <Badge className="bg-red-500/10 text-red-700 hover:bg-red-500/20 border-red-500/20 shadow-none font-medium">Declined</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function Dashboard() {
  return (
    <div className="flex justify-center bg-zinc-100 min-h-screen p-4 sm:p-8 font-sans">
      {/* Mobile Frame */}
      <div className="w-full max-w-[400px] bg-background text-foreground rounded-[2.5rem] overflow-hidden shadow-2xl relative border-[8px] border-zinc-800 flex flex-col h-[850px] max-h-[90vh]">
        
        {/* Status bar spacer */}
        <div className="h-6 w-full bg-primary flex justify-center items-end pb-1">
            <div className="w-1/3 h-1 bg-primary-foreground/20 rounded-full" />
        </div>

        {/* Top bar */}
        <header className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-primary text-primary-foreground shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shadow-sm">
              <FileText className="w-5 h-5 text-accent-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">QuoteCraft</span>
          </div>
          <Avatar className="w-9 h-9 border-2 border-primary-foreground/20 shadow-sm">
            <AvatarFallback className="bg-primary-foreground/10 text-primary-foreground font-medium">DW</AvatarFallback>
          </Avatar>
        </header>

        {/* Scrollable Content */}
        <ScrollArea className="flex-1 bg-zinc-50/50">
          <div className="p-5 pb-24 flex flex-col gap-7">
            
            {/* Greeting */}
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">G'day, Dave 👋</h1>
              <p className="text-muted-foreground text-sm mt-1">Ready to win some work today?</p>
            </div>

            {/* Main Actions */}
            <div className="flex gap-3">
              <Button size="lg" className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm h-14 text-base font-semibold rounded-xl">
                <Plus className="w-5 h-5 mr-2" />
                New Quote
              </Button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-3">
              {stats.map((stat, i) => (
                <Card key={i} className="border-border/50 shadow-sm bg-card rounded-xl">
                  <CardContent className="p-3 flex flex-col items-center text-center justify-center h-full gap-1.5">
                    <stat.icon className="w-4 h-4 text-muted-foreground mb-1" />
                    <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{stat.label}</span>
                    <span className="font-bold text-foreground text-sm truncate w-full">{stat.value}</span>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Templates */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-base text-foreground tracking-tight">Saved Templates</h2>
                <Button variant="link" size="sm" className="h-auto p-0 text-primary font-medium">View all</Button>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 snap-x scrollbar-none">
                {templates.map((tpl) => (
                  <Card key={tpl.id} className="min-w-[140px] flex-shrink-0 snap-start border-border/50 shadow-sm cursor-pointer hover:border-primary/30 transition-colors bg-card rounded-xl">
                    <CardContent className="p-4 flex flex-col gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/5 flex items-center justify-center text-primary">
                        <tpl.icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm leading-tight text-foreground">{tpl.name}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{tpl.time}</p>
                      </div>
                      <Button size="sm" variant="secondary" className="w-full text-xs h-8 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 mt-1 font-medium">Use Template</Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Recent Quotes */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-base text-foreground tracking-tight">Recent Quotes</h2>
                <Button variant="link" size="sm" className="h-auto p-0 text-primary font-medium">See history</Button>
              </div>
              <div className="flex flex-col gap-2">
                {recentQuotes.map((quote) => (
                  <Card key={quote.id} className="border-border/50 shadow-sm overflow-hidden bg-card rounded-xl">
                    <div className="flex items-center p-3 hover:bg-zinc-50 transition-colors cursor-pointer">
                      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-sm truncate text-foreground">{quote.client}</span>
                          <span className="font-bold text-sm text-foreground shrink-0">${quote.amount.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center text-[13px] text-muted-foreground truncate">
                            <span className="font-medium text-zinc-600">{quote.id}</span>
                            <span className="mx-1.5">•</span>
                            <span className="truncate">{quote.suburb}</span>
                          </div>
                          <div className="flex items-center gap-2.5 shrink-0">
                            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{quote.date}</span>
                            {getStatusBadge(quote.status)}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/50 ml-2 shrink-0" />
                    </div>
                  </Card>
                ))}
              </div>
            </div>

          </div>
        </ScrollArea>

        {/* Bottom Navigation */}
        <nav className="absolute bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border flex justify-around items-center px-2 pb-6 pt-3 shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.05)] z-20">
          <button className="flex flex-col items-center gap-1 p-2 text-primary">
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-medium">Home</span>
          </button>
          <button className="flex flex-col items-center gap-1 p-2 text-muted-foreground hover:text-foreground transition-colors">
            <FileText className="w-5 h-5" />
            <span className="text-[10px] font-medium">Quotes</span>
          </button>
          <button className="flex flex-col items-center gap-1 p-2 text-muted-foreground hover:text-foreground transition-colors">
            <Layers className="w-5 h-5" />
            <span className="text-[10px] font-medium">Templates</span>
          </button>
          <button className="flex flex-col items-center gap-1 p-2 text-muted-foreground hover:text-foreground transition-colors">
            <User className="w-5 h-5" />
            <span className="text-[10px] font-medium">Profile</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
