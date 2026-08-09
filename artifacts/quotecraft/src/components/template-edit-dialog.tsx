import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { NumericInput } from "@/components/numeric-input";
import { Loader2, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useFormDraft } from "@/hooks/use-form-draft";
import { normalizeSettings } from "@/lib/quote-record";
import {
  useUpdateTemplate,
  getListTemplatesQueryKey,
  type QuoteTemplate,
  type QuoteLineItem,
  type QuoteSettings,
} from "@workspace/api-client-react";

export function TemplateEditDialog({
  template,
  onOpenChange,
}: {
  template: QuoteTemplate | null;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const update = useUpdateTemplate();

  const [name, setName] = useState("");
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [settings, setSettings] = useState<QuoteSettings | null>(null);

  useEffect(() => {
    if (!template) return;
    setName(template.name);
    setLineItems(template.lineItems.map((it) => ({ ...it })));
    setSettings(normalizeSettings({ ...template.settings }));
  }, [template]);

  // Draft autosave (Bug #22). Declared after the seeding effect so a saved
  // draft restores over the template-seeded values. Keyed per template.
  const { clearDraft } = useFormDraft(
    `quotecraft:draft:template-edit:${template?.id ?? "none"}`,
    {
      active: !!template,
      // Never restore a draft older than the template's last server update.
      ignoreBefore: template?.updatedAt ? Date.parse(template.updatedAt) : 0,
      data: { name, lineItems, settings },
      onRestore: (d) => {
        if (typeof d.name === "string") setName(d.name);
        if (Array.isArray(d.lineItems)) setLineItems(d.lineItems);
        if (d.settings) setSettings(normalizeSettings(d.settings));
      },
    },
  );

  if (!template || !settings) return null;

  const updateItem = (
    id: string,
    field: "label" | "quantity" | "unitPrice" | "overtimePercent",
    value: string | number,
  ) => {
    setLineItems((items) =>
      items.map((it) =>
        it.id === id
          ? {
              ...it,
              [field]:
                field === "overtimePercent"
                  ? Math.max(0, Number(value))
                  : value,
            }
          : it,
      ),
    );
  };

  const addItem = () => {
    setLineItems((items) => [
      ...items,
      {
        id: Math.random().toString(36).slice(2, 11),
        label: "New Item",
        unit: "ea",
        unitPrice: 0,
        quantity: 1,
        voiceKey: "new item",
        overtimePercent: 0,
        overtimeLabel: "Overtime",
      },
    ]);
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Template name is required");
      return;
    }
    if (lineItems.length === 0) {
      toast.error("Add at least one line item");
      return;
    }
    update.mutate(
      {
        id: template.id,
        data: {
          name: name.trim(),
          businessDescription: template.businessDescription,
          lineItems,
          settings,
        },
      },
      {
        onSuccess: () => {
          clearDraft();
          qc.invalidateQueries({ queryKey: getListTemplatesQueryKey() });
          toast.success("Template updated");
          onOpenChange(false);
        },
        onError: (err) => {
          if ((err as { status?: number })?.status === 409) {
            toast.error("That template name is already taken.");
          } else {
            toast.error("Failed to update template");
          }
        },
      },
    );
  };

  return (
    <Dialog open={!!template} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[92vw] rounded-xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit template</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">Name</Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Line items</Label>
              <Button variant="ghost" size="sm" onClick={addItem}>
                <Plus className="w-4 h-4" /> Add
              </Button>
            </div>
            {lineItems.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-border p-3 space-y-2.5"
              >
                <div className="flex items-center gap-2">
                  <Input
                    value={item.label}
                    maxLength={500}
                    onChange={(e) => updateItem(item.id, "label", e.target.value)}
                    className="h-9 flex-1"
                    placeholder="Item name"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() =>
                      setLineItems((items) =>
                        items.filter((i) => i.id !== item.id),
                      )
                    }
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-[11px] text-muted-foreground">
                      Qty
                    </Label>
                    <NumericInput
                      value={item.quantity}
                      onValueChange={(v) => updateItem(item.id, "quantity", v)}
                      className="h-9 font-mono text-sm"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-[11px] text-muted-foreground">
                      Price ($)
                    </Label>
                    <NumericInput
                      value={item.unitPrice}
                      onValueChange={(v) => updateItem(item.id, "unitPrice", v)}
                      className="h-9 font-mono text-sm"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-1">
                      <Input
                        value={item.overtimeLabel ?? "Overtime"}
                        onChange={(e) =>
                          setLineItems((items) =>
                            items.map((it) =>
                              it.id === item.id
                                ? { ...it, overtimeLabel: e.target.value }
                                : it,
                            ),
                          )
                        }
                        placeholder="Overtime"
                        aria-label="Overtime label"
                        className="h-6 px-1 text-[11px] text-muted-foreground border-dashed"
                      />
                      <span className="text-[11px] text-muted-foreground shrink-0">(%)</span>
                    </div>
                    <NumericInput
                      value={item.overtimePercent ?? 0}
                      onValueChange={(v) =>
                        updateItem(item.id, "overtimePercent", v)
                      }
                      className="h-9 font-mono text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Include GST</Label>
              <Switch
                checked={settings.includeGst}
                onCheckedChange={(c) =>
                  setSettings({ ...settings, includeGst: c })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Call-out fee</Label>
              <Switch
                checked={settings.hasCallOut}
                onCheckedChange={(c) =>
                  setSettings({ ...settings, hasCallOut: c })
                }
              />
            </div>
            {settings.hasCallOut && (
              <NumericInput
                value={settings.callOutFee}
                onValueChange={(v) =>
                  setSettings({ ...settings, callOutFee: v })
                }
                placeholder="Amount ($)"
                className="h-9 font-mono"
              />
            )}
            <div className="flex items-center justify-between gap-3">
              <Input
                value={settings.surchargeLabel ?? "Public Holiday"}
                onChange={(e) =>
                  setSettings({ ...settings, surchargeLabel: e.target.value })
                }
                placeholder="Public Holiday"
                aria-label="Surcharge label"
                className="h-9 text-sm flex-1 min-w-0"
              />
              <Switch
                checked={settings.isPublicHoliday}
                onCheckedChange={(c) =>
                  setSettings({
                    ...settings,
                    isPublicHoliday: c,
                    publicHolidaySurchargePercent:
                      c && !settings.publicHolidaySurchargePercent
                        ? 30
                        : settings.publicHolidaySurchargePercent,
                  })
                }
              />
            </div>
            {settings.isPublicHoliday && (
              <NumericInput
                value={settings.publicHolidaySurchargePercent}
                onValueChange={(v) =>
                  setSettings({
                    ...settings,
                    publicHolidaySurchargePercent: v,
                  })
                }
                placeholder="Surcharge %"
                className="h-9 font-mono w-28"
              />
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => {
              clearDraft();
              onOpenChange(false);
            }}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={update.isPending}
            className="w-full sm:w-auto"
          >
            {update.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
