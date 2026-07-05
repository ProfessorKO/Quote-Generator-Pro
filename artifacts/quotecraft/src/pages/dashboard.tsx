import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Plus,
  FileText,
  Settings,
  Trash2,
  Pencil,
  Search,
  Mail,
  FileDown,
  Save as SaveIcon,
  ChevronRight,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetBusinessProfile,
  useListTemplates,
  useDeleteTemplate,
  useListQuotes,
  useListEmailRecords,
  getListTemplatesQueryKey,
  getGetBusinessProfileQueryKey,
  type QuoteRecord,
  type EmailRecord,
  type ListQuotesParams,
} from "@workspace/api-client-react";
import {
  QuoteDetailDialog,
  EmailDetailDialog,
} from "@/components/quote-detail-dialog";
import { TemplateEditDialog } from "@/components/template-edit-dialog";
import { formatCurrency } from "@/lib/format";
import type { QuoteTemplate } from "@workspace/api-client-react";

const sourceMeta: Record<
  string,
  { icon: typeof SaveIcon; label: string }
> = {
  save: { icon: SaveIcon, label: "Saved" },
  download: { icon: FileDown, label: "Downloaded" },
  email: { icon: Mail, label: "Emailed" },
};

interface Filters {
  clientName: string;
  clientEmail: string;
  clientSuburb: string;
  sentMonth: string;
}

const EMPTY_FILTERS: Filters = {
  clientName: "",
  clientEmail: "",
  clientSuburb: "",
  sentMonth: "",
};

function toParams(f: Filters): ListQuotesParams {
  const p: ListQuotesParams = {};
  if (f.clientName.trim()) p.clientName = f.clientName.trim();
  if (f.clientEmail.trim()) p.clientEmail = f.clientEmail.trim();
  if (f.clientSuburb.trim()) p.clientSuburb = f.clientSuburb.trim();
  if (f.sentMonth) p.sentMonth = f.sentMonth;
  return p;
}

function FilterBar({
  filters,
  setFilters,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
}) {
  const active = useMemo(
    () => Object.values(filters).some((v) => v.trim() !== ""),
    [filters],
  );
  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Search className="w-3.5 h-3.5" /> Filters
        </span>
        {active && (
          <button
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>
      {/* Bug #17: every filter carries an always-visible label. */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Client name
          </label>
          <Input
            placeholder="e.g. Sarah"
            value={filters.clientName}
            onChange={(e) =>
              setFilters({ ...filters, clientName: e.target.value })
            }
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Client email
          </label>
          <Input
            placeholder="e.g. sarah@mail.com"
            value={filters.clientEmail}
            onChange={(e) =>
              setFilters({ ...filters, clientEmail: e.target.value })
            }
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Suburb
          </label>
          <Input
            placeholder="e.g. Parramatta"
            value={filters.clientSuburb}
            onChange={(e) =>
              setFilters({ ...filters, clientSuburb: e.target.value })
            }
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Quote month
          </label>
          <Input
            type="month"
            value={filters.sentMonth}
            onChange={(e) =>
              setFilters({ ...filters, sentMonth: e.target.value })
            }
            className="h-9"
          />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 px-4 bg-muted/30 rounded-xl border border-dashed border-border">
      <div className="bg-primary/10 w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-3">
        <FileText className="w-5 h-5 text-primary" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const qc = useQueryClient();

  const { data: profile } = useGetBusinessProfile({
    query: { retry: false, queryKey: getGetBusinessProfileQueryKey() },
  });
  const { data: templates, isLoading: templatesLoading } = useListTemplates();
  const deleteTemplate = useDeleteTemplate();

  const [quoteFilters, setQuoteFilters] = useState<Filters>(EMPTY_FILTERS);
  const [emailFilters, setEmailFilters] = useState<Filters>(EMPTY_FILTERS);

  const { data: quotes, isLoading: quotesLoading } = useListQuotes(
    toParams(quoteFilters),
  );
  const { data: emails, isLoading: emailsLoading } = useListEmailRecords(
    toParams(emailFilters),
  );

  const [selectedQuote, setSelectedQuote] = useState<QuoteRecord | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<EmailRecord | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<QuoteTemplate | null>(
    null,
  );

  const handleDeleteTemplate = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this template?")) return;
    deleteTemplate.mutate(
      { id },
      {
        onSuccess: () => {
          toast.success("Template deleted");
          qc.invalidateQueries({ queryKey: getListTemplatesQueryKey() });
        },
        onError: () => toast.error("Failed to delete template"),
      },
    );
  };

  return (
    <Layout title="Dashboard">
      <div className="p-4 space-y-5 pb-8">
        {/* Welcome header */}
        <div className="bg-primary text-primary-foreground rounded-xl p-5 relative overflow-hidden">
          <div
            aria-hidden
            className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-accent/15 blur-2xl"
          />
          <div className="relative">
            <p className="text-primary-foreground/70 text-sm">
              Welcome back{user?.firstName ? `, ${user.firstName}` : ""}
            </p>
            <h2 className="text-xl font-bold tracking-tight mt-0.5">
              {profile?.businessName || "Your business"}
            </h2>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            className="h-auto flex-col gap-1.5 py-3"
            onClick={() => setLocation("/quote")}
          >
            <Plus className="w-5 h-5 text-primary" />
            <span className="text-xs font-medium">New quote</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto flex-col gap-1.5 py-3"
            onClick={() => setLocation("/templates")}
          >
            <FileText className="w-5 h-5 text-primary" />
            <span className="text-xs font-medium">Templates</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto flex-col gap-1.5 py-3"
            onClick={() => setLocation("/settings")}
          >
            <Settings className="w-5 h-5 text-primary" />
            <span className="text-xs font-medium">Settings</span>
          </Button>
        </div>

        <Tabs defaultValue="quotes" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="quotes">Quotes</TabsTrigger>
            <TabsTrigger value="emails">Emails</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          {/* Quote history */}
          <TabsContent value="quotes" className="space-y-3 mt-4">
            <FilterBar filters={quoteFilters} setFilters={setQuoteFilters} />
            {quotesLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary/50" />
              </div>
            ) : !quotes?.length ? (
              <EmptyState message="No quotes yet — create your first quote." />
            ) : (
              <div className="space-y-2">
                {quotes.map((q) => {
                  const meta = sourceMeta[q.source] ?? sourceMeta.save;
                  const Icon = meta.icon;
                  return (
                    <Card
                      key={q.id}
                      className="cursor-pointer hover:border-primary/50 transition-colors active:scale-[0.99]"
                      onClick={() => setSelectedQuote(q)}
                    >
                      <CardContent className="p-3.5 flex items-center gap-3">
                        <div className="bg-primary/10 text-primary p-2 rounded-lg shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">
                            {q.label}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {q.clientName ? `${q.clientName} · ` : ""}
                            {format(new Date(q.createdAt), "d MMM yyyy")}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-primary text-sm">
                            {formatCurrency(q.total)}
                          </p>
                          <Badge
                            variant="secondary"
                            className="font-normal text-[10px] mt-0.5"
                          >
                            {meta.label}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Email history */}
          <TabsContent value="emails" className="space-y-3 mt-4">
            <FilterBar filters={emailFilters} setFilters={setEmailFilters} />
            {emailsLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary/50" />
              </div>
            ) : !emails?.length ? (
              <EmptyState message="No emails sent yet." />
            ) : (
              <div className="space-y-2">
                {emails.map((rec) => (
                  <Card
                    key={rec.id}
                    className="cursor-pointer hover:border-primary/50 transition-colors active:scale-[0.99]"
                    onClick={() => setSelectedEmail(rec)}
                  >
                    <CardContent className="p-3.5 flex items-center gap-3">
                      <div className="bg-accent/15 text-accent-foreground p-2 rounded-lg shrink-0">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {rec.subject}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {rec.clientName} · {rec.clientEmail}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(rec.sentAt), "d MMM")}
                        </p>
                        <Badge
                          variant={
                            rec.status === "sent" ? "secondary" : "destructive"
                          }
                          className="font-normal text-[10px] mt-0.5 capitalize"
                        >
                          {rec.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Templates */}
          <TabsContent value="templates" className="space-y-3 mt-4">
            {templatesLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary/50" />
              </div>
            ) : !templates?.length ? (
              <EmptyState message="No templates yet — save a quote as a template." />
            ) : (
              <div className="space-y-2">
                {templates.map((t) => (
                  <Card
                    key={t.id}
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => setLocation(`/quote?templateId=${t.id}`)}
                  >
                    <CardContent className="p-3.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{t.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.lineItems?.length || 0} items ·{" "}
                          {format(new Date(t.createdAt), "d MMM yyyy")}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTemplate(t);
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={(e) => handleDeleteTemplate(t.id, e)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <ChevronRight className="w-4 h-4 text-primary/40 shrink-0" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <QuoteDetailDialog
        quote={selectedQuote}
        onOpenChange={(o) => !o && setSelectedQuote(null)}
      />
      <EmailDetailDialog
        record={selectedEmail}
        onOpenChange={(o) => !o && setSelectedEmail(null)}
      />
      <TemplateEditDialog
        template={editingTemplate}
        onOpenChange={(o) => !o && setEditingTemplate(null)}
      />
    </Layout>
  );
}
