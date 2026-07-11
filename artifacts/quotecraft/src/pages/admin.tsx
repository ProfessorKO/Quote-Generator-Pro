import { useMemo, useState } from "react";
import { Loader2, ShieldAlert, Users } from "lucide-react";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useListAdminUsers,
  getListAdminUsersQueryKey,
} from "@workspace/api-client-react";

const AEST_FORMAT = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Sydney",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

function formatAest(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return AEST_FORMAT.format(date);
}

function signupLabel(method: string | null): string {
  if (!method) return "—";
  return method === "google" ? "Google" : "Email";
}

export default function Admin() {
  const [search, setSearch] = useState("");
  const { data, isLoading, error } = useListAdminUsers({
    query: {
      retry: false,
      queryKey: getListAdminUsersQueryKey(),
    },
  });

  const rows = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.signupMethod ?? "").toLowerCase().includes(q) ||
        u.businesses.some((b) => b.toLowerCase().includes(q)),
    );
  }, [data, search]);

  const forbidden =
    error && typeof error === "object" && "status" in error
      ? (error as { status?: number }).status === 403
      : false;

  return (
    <Layout title="Admin" backTo="/dashboard">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold">Registered users</h1>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary/50" />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-12 flex flex-col items-center gap-2 text-center">
              <ShieldAlert className="w-8 h-8 text-muted-foreground" />
              <p className="font-medium">
                {forbidden
                  ? "You don't have access to this page"
                  : "Couldn't load users"}
              </p>
              <p className="text-sm text-muted-foreground">
                {forbidden
                  ? "This page is restricted to the site owner."
                  : "Please try again later."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="space-y-3">
              <CardTitle className="text-base">
                {rows.length} of {data?.length ?? 0} user
                {(data?.length ?? 0) === 1 ? "" : "s"}
              </CardTitle>
              <Input
                placeholder="Search by email, sign-up method or business…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm"
              />
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Sign-up</TableHead>
                    <TableHead>Registered (AEST)</TableHead>
                    <TableHead>Business name(s)</TableHead>
                    <TableHead>Marketing consent</TableHead>
                    <TableHead>Closed (AEST)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground py-8"
                      >
                        No users match your search
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((u) => (
                      <TableRow key={u.userId}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {u.email || "—"}
                        </TableCell>
                        <TableCell>{signupLabel(u.signupMethod)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatAest(u.registeredAt)}
                        </TableCell>
                        <TableCell>
                          {u.businesses.length > 0
                            ? u.businesses.join(", ")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={u.marketingConsent ? "default" : "secondary"}
                          >
                            {u.marketingConsent ? "Yes" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatAest(u.closedAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
