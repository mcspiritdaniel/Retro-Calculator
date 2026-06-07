"use client";

import { useLayoutEffect, useState } from "react";

export type AppLayoutMode = "desktop" | "mobile-portrait" | "mobile-landscape";

const DESKTOP_QUERY = "(min-width: 1024px)";

function resolveLayoutMode(): AppLayoutMode {
  if (window.matchMedia(DESKTOP_QUERY).matches) {
    return "desktop";
  }

  if (window.matchMedia("(orientation: landscape)").matches) {
    return "mobile-landscape";
  }

  return "mobile-portrait";
}

export function useAppLayoutMode(): AppLayoutMode {
  const [layoutMode, setLayoutMode] = useState<AppLayoutMode>("desktop");

  useLayoutEffect(() => {
    const update = () => setLayoutMode(resolveLayoutMode());

    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return layoutMode;
}
