import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import {
  FileText,
  Home,
  LayoutDashboard,
  Settings,
  LogOut,
  LogIn,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LayoutProps {
  children: ReactNode;
  title: string;
  backTo?: string;
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function Layout({ children, title, backTo }: LayoutProps) {
  const [location, setLocation] = useLocation();
  const { isSignedIn, user } = useUser();
  const { signOut } = useClerk();

  const initials =
    ((user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "")).trim() || "U";

  const navItems = [
    { href: "/quote", label: "New Quote", icon: Home },
    { href: "/templates", label: "Templates", icon: FileText },
    ...(isSignedIn
      ? [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }]
      : []),
  ];

  return (
    <div className="min-h-[100dvh] w-full bg-background flex justify-center">
      <div className="w-full max-w-[430px] bg-background shadow-2xl flex flex-col relative overflow-hidden ring-1 ring-border">
        {/* Header */}
        <header className="h-16 border-b border-border flex items-center justify-between px-4 bg-primary text-primary-foreground shrink-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            {backTo ? (
              <button
                onClick={() => setLocation(backTo)}
                className="p-1 -ml-1 rounded-md hover:bg-white/10 transition-colors"
                aria-label="Back"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            ) : (
              <div className="bg-accent text-accent-foreground p-2 rounded-md">
                <FileText className="w-5 h-5" />
              </div>
            )}
            <h1 className="font-bold text-lg tracking-tight truncate">{title}</h1>
          </div>

          {isSignedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="w-9 h-9 rounded-full bg-accent text-accent-foreground font-semibold text-sm flex items-center justify-center shrink-0"
                  aria-label="Account menu"
                >
                  {initials.toUpperCase()}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => setLocation("/dashboard")}>
                  <LayoutDashboard className="w-4 h-4" /> Dashboard
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation("/settings")}>
                  <Settings className="w-4 h-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut({ redirectUrl: basePath || "/" })}
                >
                  <LogOut className="w-4 h-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              href="/sign-in"
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
            >
              <LogIn className="w-4 h-4" /> Sign in
            </Link>
          )}
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-background">{children}</main>

        {/* Bottom Nav */}
        <nav className="h-16 border-t border-border bg-card flex items-center justify-around px-6 shrink-0 z-10 pb-safe">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 text-xs font-medium transition-colors",
                location === item.href
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
