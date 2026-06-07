"use client";

import { useLayoutEffect, useState } from "react";

const LARGE_SCREEN_QUERY = "(min-width: 1024px)";

/** True at Tailwind `lg` and above — desktop dashboard layout. */
export function useLargeScreenLayout(): boolean {
  const [isLargeScreen, setIsLargeScreen] = useState(true);

  useLayoutEffect(() => {
    const mediaQuery = window.matchMedia(LARGE_SCREEN_QUERY);
    const update = () => setIsLargeScreen(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return isLargeScreen;
}
