import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { FileText, PlusCircle, Settings, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
  title: string;
  showBack?: boolean;
}

export function Layout({ children, title, showBack }: LayoutProps) {
  const [location] = useLocation();

  return (
    <div className="min-h-[100dvh] w-full bg-background flex justify-center">
      <div className="w-full max-w-[430px] bg-background shadow-2xl flex flex-col relative overflow-hidden ring-1 ring-border">
        {/* Header */}
        <header className="h-16 border-b border-border flex items-center justify-between px-4 bg-primary text-primary-foreground shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="bg-accent text-accent-foreground p-2 rounded-md">
              <FileText className="w-5 h-5" />
            </div>
            <h1 className="font-bold text-lg tracking-tight">{title}</h1>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>

        {/* Bottom Nav */}
        <nav className="h-16 border-t border-border bg-card flex items-center justify-around px-6 shrink-0 z-10 pb-safe">
          <Link href="/" className={cn("flex flex-col items-center gap-1 text-xs font-medium transition-colors", location === "/" ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
            <Home className="w-5 h-5" />
            <span>New Quote</span>
          </Link>
          <Link href="/templates" className={cn("flex flex-col items-center gap-1 text-xs font-medium transition-colors", location === "/templates" ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
            <FileText className="w-5 h-5" />
            <span>Templates</span>
          </Link>
        </nav>
      </div>
    </div>
  );
}
