import { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useListTemplates, useDeleteTemplate, getListTemplatesQueryKey, QuoteTemplate } from "@workspace/api-client-react";
import { Loader2, FileText, Trash2, ChevronRight, PlusCircle, Crown, Pencil } from "lucide-react";
import { TemplateEditDialog } from "@/components/template-edit-dialog";
import { useBilling } from "@/lib/billing";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@clerk/react";

const TEMPLATES_CACHE_KEY = "quotecraft.templates.cache";

function readTemplatesCache(): QuoteTemplate[] | undefined {
  try {
    const raw = localStorage.getItem(TEMPLATES_CACHE_KEY);
    return raw ? (JSON.parse(raw) as QuoteTemplate[]) : undefined;
  } catch {
    return undefined;
  }
}

export default function Templates() {
  const [, setLocation] = useLocation();
  // Bug #40 — defensive guard: visitors must never see this page even if the
  // route-level <Protected> wrapper is bypassed.
  const { isLoaded, isSignedIn } = useAuth();
  useEffect(() => {
    if (isLoaded && !isSignedIn) setLocation("/sign-in");
  }, [isLoaded, isSignedIn, setLocation]);
  const queryClient = useQueryClient();
  const { data: templates, isLoading } = useListTemplates({
    query: {
      queryKey: getListTemplatesQueryKey(),
      // Render the cached list instantly, then refetch fresh data in the
      // background (initialDataUpdatedAt: 0 marks the cache as stale).
      initialData: readTemplatesCache(),
      initialDataUpdatedAt: 0,
    },
  });
  const deleteTemplate = useDeleteTemplate();
  const { data: billing } = useBilling();
  // Enhancement #46 — edit a template directly from this tab (same dialog as
  // the Dashboard's Templates tab).
  const [editingTemplate, setEditingTemplate] = useState<QuoteTemplate | null>(null);

  useEffect(() => {
    if (templates) {
      try {
        localStorage.setItem(TEMPLATES_CACHE_KEY, JSON.stringify(templates));
      } catch {
        // ignore quota / serialization errors
      }
    }
  }, [templates]);

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this template?")) return;
    
    deleteTemplate.mutate({ id }, {
      onSuccess: () => {
        toast.success("Template deleted");
        queryClient.invalidateQueries({ queryKey: getListTemplatesQueryKey() });
      },
      onError: () => {
        toast.error("Failed to delete template");
      }
    });
  };

  return (
    <Layout title="Saved Templates">
      <div className="p-4 flex flex-col gap-4 pb-24">

        {/* CP6 — free-tier template slot usage banner */}
        {billing && billing.plan === "free" && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
            <p className="min-w-0 flex-1 break-words text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                {Math.min(billing.templatesCount, billing.limits.templates)} of{" "}
                {billing.limits.templates}
              </span>{" "}
              free template slots used
              {billing.credits > 0
                ? ` · ${billing.credits} credit${billing.credits === 1 ? "" : "s"} available`
                : ""}
            </p>
            <button
              onClick={() => setLocation("/settings")}
              className="flex items-center gap-1 text-xs font-semibold text-primary shrink-0"
            >
              <Crown className="w-3.5 h-3.5" />
              Go Pro
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
          </div>
        ) : templates?.length === 0 ? (
          <div className="text-center py-16 px-4 bg-muted/30 rounded-xl border border-border border-dashed">
            <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">No templates yet</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-[250px] mx-auto">
              Create your first quote and save it as a template for quick access next time.
            </p>
            <Button onClick={() => setLocation("/quote")} className="font-medium">
              <PlusCircle className="w-4 h-4 mr-2" />
              Create New Quote
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {templates?.map((template) => (
              <Card 
                key={template.id} 
                className="overflow-hidden border-border shadow-sm hover:border-primary/50 transition-colors cursor-pointer group active:scale-[0.98]"
                onClick={() => setLocation(`/quote?templateId=${template.id}`)}
              >
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base text-foreground truncate mb-1">
                      {template.name}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2 leading-relaxed">
                      {template.businessDescription}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-medium">
                      <span className="bg-accent/10 text-accent-foreground px-2 py-0.5 rounded-full">
                        {template.lineItems?.length || 0} items
                      </span>
                      <span>{format(new Date(template.createdAt), "MMM d, yyyy")}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex items-center gap-1 -mr-2">
                      {/* Edit template (#46) */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                        aria-label={`Edit template ${template.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTemplate(template);
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => handleDelete(template.id, e)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="h-8 w-8 flex items-center justify-center text-primary/40 group-hover:text-primary transition-colors">
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Edit template dialog (#46) — list refreshes via query invalidation on save. */}
      <TemplateEditDialog
        template={editingTemplate}
        onOpenChange={(o) => !o && setEditingTemplate(null)}
      />
    </Layout>
  );
}
