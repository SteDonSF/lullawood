"use client";
import { useEffect } from "react";
import { captureAttribution } from "@/lib/attribution";

// Mounted once in the root layout, so first-touch capture runs on EVERY entry
// point — /, /try, /pricing, a deep link from an ad, anywhere. Renders nothing.
// captureAttribution() is a no-op unless the URL carries a ?utm_source and no
// live record already exists, so re-running it is always safe.
export function AttributionTracker() {
  useEffect(() => {
    captureAttribution();
  }, []);
  return null;
}
