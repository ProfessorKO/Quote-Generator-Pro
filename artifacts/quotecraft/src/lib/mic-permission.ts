// Bug #7 — device-specific microphone permission help.
//
// When the browser denies mic access there is no programmatic way to re-open the
// permission prompt, so we show the user written, device-specific steps. We never
// cache the denied state — callers re-run checkMicPermission() on every mic tap.

export type DeviceKind =
  | "ios-safari"
  | "ios-chrome"
  | "android-chrome"
  | "android-other"
  | "desktop";

export function detectDevice(): DeviceKind {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports as Mac but is touch-capable
    (/Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document);

  if (isIOS) {
    // Chrome on iOS identifies itself with "CriOS"; everything else uses WebKit
    // and is treated as Safari for instruction purposes.
    return /CriOS/.test(ua) ? "ios-chrome" : "ios-safari";
  }
  if (/Android/.test(ua)) {
    // Only treat as Chrome when it's genuinely Chrome — exclude the common
    // Android non-Chrome browsers, which have different permission UIs.
    const nonChrome = /(Firefox|FxiOS|SamsungBrowser|EdgA|OPR|OPT|UCBrowser|DuckDuckGo|Brave)/i.test(ua);
    return /Chrome\//.test(ua) && !nonChrome ? "android-chrome" : "android-other";
  }
  return "desktop";
}

export interface PermissionGuide {
  title: string;
  steps: string[];
}

export function getPermissionGuide(device: DeviceKind): PermissionGuide {
  switch (device) {
    case "ios-safari":
      return {
        title: "Enable the microphone on iPhone (Safari)",
        steps: [
          "Tap the “aA” icon on the left side of the address bar.",
          "Tap “Website Settings”.",
          "Set Microphone to “Allow”.",
          "Tap Done, then tap Retry below.",
          "If you don’t see it there: open the Settings app → Safari → Microphone, and allow this site.",
        ],
      };
    case "ios-chrome":
      return {
        title: "Enable the microphone on iPhone (Chrome)",
        steps: [
          "Open the Settings app on your iPhone.",
          "Scroll down and tap “Chrome”.",
          "Turn on “Microphone”.",
          "Return to Chrome and tap Retry below.",
        ],
      };
    case "android-chrome":
      return {
        title: "Enable the microphone on Android (Chrome)",
        steps: [
          "Tap the lock icon (or ⋮ menu) next to the address bar.",
          "Tap “Permissions” (or “Site settings”).",
          "Set Microphone to “Allow”.",
          "If it’s blocked at the system level: Settings app → Apps → Chrome → Permissions → Microphone → Allow.",
          "Return here and tap Retry below.",
        ],
      };
    case "android-other":
      return {
        title: "Enable the microphone on Android",
        steps: [
          "Open your browser’s menu and go to its Site settings (or tap the lock icon next to the address bar).",
          "Open Permissions and set Microphone to “Allow” for this site.",
          "If it’s blocked at the system level: Settings app → Apps → your browser → Permissions → Microphone → Allow.",
          "Return here and tap Retry below.",
        ],
      };
    case "desktop":
    default:
      return {
        title: "Enable the microphone",
        steps: [
          "Click the microphone or lock icon at the left end of the address bar.",
          "Find “Microphone” and set it to “Allow”.",
          "Reload the page if prompted, then click Retry below.",
        ],
      };
  }
}

// Re-checks permission by actually requesting the mic. Resolves true when access
// is granted (tracks are stopped immediately), false otherwise. Always called
// fresh on each tap/Retry so a previously denied state is never assumed.
export async function checkMicPermission(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    // No getUserMedia — let the SpeechRecognition flow surface any error instead.
    return true;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}
