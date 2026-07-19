import { lazy, Suspense, useEffect, useRef } from "react";
import {
  ClerkProvider,
  SignIn,
  SignUp,
  Show,
  useClerk,
} from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import {
  Switch,
  Route,
  Redirect,
  useLocation,
  Router as WouterRouter,
} from "wouter";
import {
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/queryClient";
import { useGetBusinessProfile, getGetBusinessProfileQueryKey } from "@workspace/api-client-react";
import { peekPendingAction } from "@/lib/auth-actions";
import NotFound from "@/pages/not-found";

const Landing = lazy(() => import("@/pages/landing"));
const Home = lazy(() => import("@/pages/home"));
const Templates = lazy(() => import("@/pages/templates"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Settings = lazy(() => import("@/pages/settings"));
const CompleteProfile = lazy(() => import("@/pages/complete-profile"));
const Admin = lazy(() => import("@/pages/admin"));

// REQUIRED — copy verbatim. Resolves the key from window.location.hostname.
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// REQUIRED — empty in dev, auto-set in prod. Do NOT gate on PROD/NODE_ENV.
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: "bottom" as const,
  },
  variables: {
    colorPrimary: "#1B2C4D",
    colorForeground: "#13203A",
    colorMutedForeground: "#626D84",
    colorDanger: "#DC2626",
    colorBackground: "#FFFFFF",
    colorInput: "#FFFFFF",
    colorInputForeground: "#13203A",
    colorNeutral: "#1B2C4D",
    fontFamily: "'Inter', sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[400px] max-w-full overflow-hidden shadow-xl ring-1 ring-[#D1D6E0]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#13203A] font-bold",
    headerSubtitle: "text-[#626D84]",
    socialButtonsBlockButtonText: "text-[#13203A]",
    formFieldLabel: "text-[#13203A] font-medium",
    footerActionLink: "text-[#1B2C4D] font-semibold hover:text-[#F2930D]",
    footerActionText: "text-[#626D84]",
    dividerText: "text-[#626D84]",
    identityPreviewEditButton: "text-[#1B2C4D]",
    formFieldSuccessText: "text-[#16A34A]",
    formFieldErrorText: "text-[#DC2626]",
    alertText: "text-[#13203A]",
    logoBox: "h-10 justify-center",
    logoImage: "h-10 w-auto",
    socialButtonsBlockButton: "border-[#D1D6E0] hover:bg-[#F4F6F9]",
    formButtonPrimary:
      "bg-[#1B2C4D] hover:bg-[#13203A] text-white font-semibold",
    formFieldInput: "bg-white border-[#D1D6E0] text-[#13203A]",
    footerAction: "",
    dividerLine: "bg-[#D1D6E0]",
    formResendCodeLink: "text-[#1B2C4D] font-semibold hover:text-[#F2930D]",
    otpCodeFieldInputs: "!gap-2 justify-center",
    otpCodeFieldInput:
      "!w-11 !h-12 !rounded-lg !border !border-[#D1D6E0] !bg-white !text-center !text-lg !font-semibold !text-[#13203A] focus:!border-[#1B2C4D] focus:!ring-2 focus:!ring-[#1B2C4D]/25 focus:!outline-none",
  },
};

function PageFallback() {
  return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
    </div>
  );
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        forceRedirectUrl={`${basePath}/post-auth`}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        forceRedirectUrl={`${basePath}/post-auth`}
      />
    </div>
  );
}

// After sign-in/sign-up: send new users to complete their business profile,
// otherwise resume a pending gated action (→ /quote) or land on the dashboard.
function PostAuthGate() {
  const { data, isLoading, isError, isSuccess, error } = useGetBusinessProfile({
    query: { retry: false, queryKey: getGetBusinessProfileQueryKey() },
  });

  const resumePath = peekPendingAction() ? "/quote" : "/dashboard";

  if (isLoading) return <PageFallback />;
  if (isError) {
    // Only a genuine "profile not found" (404) means the user must onboard.
    // Transient/auth/server errors must NOT force onboarding — fall back to the
    // intended destination, which will surface its own loading/error state.
    const status = (error as { status?: number } | null)?.status;
    return <Redirect to={status === 404 ? "/complete-profile" : resumePath} />;
  }
  if (isSuccess && data) {
    return <Redirect to={resumePath} />;
  }
  return <PageFallback />;
}

// Guard: render children only when signed in; otherwise route to sign-in.
function Protected({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Show when="signed-in">{children}</Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

// Invalidate the query cache when the signed-in user changes.
function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to your QuoteCraft account",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Save, download and email your quotes",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Suspense fallback={<PageFallback />}>
            <Switch>
              <Route path="/" component={Landing} />
              <Route path="/quote" component={Home} />
              <Route path="/templates" component={Templates} />
              <Route path="/sign-in/*?" component={SignInPage} />
              <Route path="/sign-up/*?" component={SignUpPage} />
              <Route path="/post-auth" component={PostAuthGate} />
              <Route path="/complete-profile">
                <Protected>
                  <CompleteProfile />
                </Protected>
              </Route>
              <Route path="/dashboard">
                <Protected>
                  <Dashboard />
                </Protected>
              </Route>
              <Route path="/settings">
                <Protected>
                  <Settings />
                </Protected>
              </Route>
              <Route path="/admin">
                <Protected>
                  <Admin />
                </Protected>
              </Route>
              <Route component={NotFound} />
            </Switch>
          </Suspense>
          <Toaster position="top-center" theme="light" />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
