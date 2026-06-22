import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useListTemplates, useDeleteTemplate, getListTemplatesQueryKey } from "@workspace/api-client-react";
import { Loader2, FileText, Trash2, ChevronRight, PlusCircle } from "lucide-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Templates() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: templates, isLoading } = useListTemplates();
  const deleteTemplate = useDeleteTemplate();

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
            <Button onClick={() => setLocation("/")} className="font-medium">
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
                onClick={() => setLocation(`/?templateId=${template.id}`)}
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
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mr-2"
                      onClick={(e) => handleDelete(template.id, e)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
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
    </Layout>
  );
}
