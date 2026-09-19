"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    PagefindUI?: new (options: { element: string; showSubResults?: boolean }) => unknown;
  }
}

const SEARCH_ELEMENT_ID = "pagefind-search";

let assetsPromise: Promise<void> | null = null;

function loadSearchAssets(): Promise<void> {
  if (assetsPromise) return assetsPromise;

  assetsPromise = new Promise<void>((resolve, reject) => {
    if (window.PagefindUI) {
      resolve();
      return;
    }

    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "/pagefind/pagefind-ui.css";
    document.head.appendChild(stylesheet);

    const script = document.createElement("script");
    script.src = "/pagefind/pagefind-ui.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      assetsPromise = null;
      reject(new Error("Pagefind assets could not be loaded"));
    };
    document.head.appendChild(script);
  });

  return assetsPromise;
}

export function SearchBox() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    loadSearchAssets()
      .then(() => {
        const container = containerRef.current;
        const PagefindUI = window.PagefindUI;
        if (cancelled || !container || !PagefindUI) return;

        container.replaceChildren();
        new PagefindUI({ element: `#${SEARCH_ELEMENT_ID}`, showSubResults: true });
      })
      .catch(() => {
        const container = containerRef.current;
        if (cancelled || !container) return;
        container.replaceChildren();
        const message = document.createElement("p");
        message.className = "text-sm text-muted-foreground";
        message.textContent =
          "Search index not found. The site must be built before search is available.";
        container.appendChild(message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return <div id={SEARCH_ELEMENT_ID} ref={containerRef} />;
}
