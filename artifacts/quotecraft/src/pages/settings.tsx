import { useState, useEffect } from "react";
import { useUser, useClerk } from "@clerk/react";
import { Loader2, UserCog } from "lucide-react";
import { Layout } from "@/components/layout";
import { BusinessProfileForm } from "@/components/business-profile-form";
import { SubscriptionSection } from "@/components/billing/subscription-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  useGetBusinessProfile,
  useGetEmailTemplate,
  useUpsertEmailTemplate,
  getGetEmailTemplateQueryKey,
  getGetBusinessProfileQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DEFAULT_EMAIL_SUBJECT,
  DEFAULT_EMAIL_BODY,
} from "@/lib/email-template";

function EmailTemplateSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useGetEmailTemplate({
    query: { retry: false, queryKey: getGetEmailTemplateQueryKey() },
  });
  const upsert = useUpsertEmailTemplate();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    setSubject(data?.subject ?? DEFAULT_EMAIL_SUBJECT);
    setBody(data?.body ?? DEFAULT_EMAIL_BODY);
  }, [data]);

  const save = () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Subject and body are required");
      return;
    }
    upsert.mutate(
      { data: { subject: subject.trim(), body } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetEmailTemplateQueryKey() });
          toast.success("Email template saved");
        },
        onError: () => toast.error("Couldn't save the template"),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-primary/50" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Default message for client emails. Use{" "}
        <code className="font-mono text-[11px]">{"{{clientName}}"}</code>,{" "}
        <code className="font-mono text-[11px]">{"{{businessName}}"}</code> and{" "}
        <code className="font-mono text-[11px]">{"{{quoteTotal}}"}</code>.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="emailSubject">Subject</Label>
        <Input
          id="emailSubject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="emailBody">Body</Label>
        <Textarea
          id="emailBody"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={9}
        />
      </div>
      <Button
        onClick={save}
        disabled={upsert.isPending}
        className="w-full h-11 font-semibold"
      >
        {upsert.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        Save email template
      </Button>
    </div>
  );
}

export default function Settings() {
  const { user } = useUser();
  const { openUserProfile } = useClerk();
  const { data: profile, isLoading } = useGetBusinessProfile({
    query: { retry: false, queryKey: getGetBusinessProfileQueryKey() },
  });

  return (
    <Layout title="Settings" backTo="/dashboard">
      <div className="p-4 space-y-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm">
              <p className="font-medium text-card-foreground">
                {user?.fullName || "Your account"}
              </p>
              <p className="text-muted-foreground">
                {user?.primaryEmailAddress?.emailAddress}
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => openUserProfile()}
            >
              <UserCog className="w-4 h-4" />
              Manage name, email & password
            </Button>
          </CardContent>
        </Card>

        {/* CP7/CP8/CP9 — subscription & credits */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Subscription & credits</CardTitle>
          </CardHeader>
          <CardContent>
            <SubscriptionSection />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Business profile</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-primary/50" />
              </div>
            ) : (
              <BusinessProfileForm initial={profile} submitLabel="Save changes" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Client email template</CardTitle>
          </CardHeader>
          <CardContent>
            <EmailTemplateSection />
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
