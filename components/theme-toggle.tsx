"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

const ORDER = ["system", "light", "dark"] as const;

type ThemeMode = (typeof ORDER)[number];

const LABELS: Record<ThemeMode, string> = {
  system: "Switch to light theme",
  light: "Switch to dark theme",
  dark: "Switch to system theme",
};

function resolveMode(theme: string | undefined): ThemeMode {
  return theme === "light" || theme === "dark" ? theme : "system";
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const mode = resolveMode(theme);
  const Icon = !mounted ? Monitor : mode === "dark" ? Moon : mode === "light" ? Sun : Monitor;

  function cycleTheme() {
    const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length] ?? "system";
    setTheme(next);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      aria-label={LABELS[mode]}
      title={LABELS[mode]}
      className="size-8 text-muted-foreground hover:text-foreground"
    >
      <Icon className="size-4" aria-hidden />
    </Button>
  );
}
