"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type TerminalTone = "default" | "stderr";

interface TerminalOutputProps {
  text: string;
  tone?: TerminalTone;
  className?: string;
  autoScroll?: boolean;
}

interface AnsiStyleState {
  fgClass?: string;
  bgClass?: string;
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
}

const DEFAULT_STYLE_STATE: AnsiStyleState = {
  bold: false,
  dim: false,
  italic: false,
  underline: false,
};

const ANSI_CSI_REGEX = /\x1b\[([0-9;?]*)([ -/]?)([@-~])/g;

const ANSI_FG_CLASSES: Record<number, string> = {
  30: "text-zinc-950",
  31: "text-red-400",
  32: "text-emerald-400",
  33: "text-amber-300",
  34: "text-sky-400",
  35: "text-fuchsia-400",
  36: "text-cyan-300",
  37: "text-zinc-100",
  90: "text-zinc-500",
  91: "text-red-300",
  92: "text-emerald-300",
  93: "text-yellow-200",
  94: "text-sky-300",
  95: "text-fuchsia-300",
  96: "text-cyan-200",
  97: "text-white",
};

const ANSI_BG_CLASSES: Record<number, string> = {
  40: "bg-zinc-950",
  41: "bg-red-950/80",
  42: "bg-emerald-950/80",
  43: "bg-amber-950/80",
  44: "bg-sky-950/80",
  45: "bg-fuchsia-950/80",
  46: "bg-cyan-950/80",
  47: "bg-zinc-200/20",
  100: "bg-zinc-700/70",
  101: "bg-red-800/70",
  102: "bg-emerald-800/70",
  103: "bg-amber-800/70",
  104: "bg-sky-800/70",
  105: "bg-fuchsia-800/70",
  106: "bg-cyan-800/70",
  107: "bg-zinc-100/20",
};

const AUTO_SCROLL_THRESHOLD_PX = 64;

function applyAnsiCodes(
  current: AnsiStyleState,
  codes: number[]
): AnsiStyleState {
  const next: AnsiStyleState = { ...current };
  const normalizedCodes = codes.length > 0 ? codes : [0];

  for (const code of normalizedCodes) {
    if (code === 0) {
      next.fgClass = undefined;
      next.bgClass = undefined;
      next.bold = false;
      next.dim = false;
      next.italic = false;
      next.underline = false;
      continue;
    }

    if (code === 1) {
      next.bold = true;
      continue;
    }
    if (code === 2) {
      next.dim = true;
      continue;
    }
    if (code === 22) {
      next.bold = false;
      next.dim = false;
      continue;
    }
    if (code === 3) {
      next.italic = true;
      continue;
    }
    if (code === 23) {
      next.italic = false;
      continue;
    }
    if (code === 4) {
      next.underline = true;
      continue;
    }
    if (code === 24) {
      next.underline = false;
      continue;
    }
    if (code === 39) {
      next.fgClass = undefined;
      continue;
    }
    if (code === 49) {
      next.bgClass = undefined;
      continue;
    }

    const fgClass = ANSI_FG_CLASSES[code];
    if (fgClass) {
      next.fgClass = fgClass;
      continue;
    }

    const bgClass = ANSI_BG_CLASSES[code];
    if (bgClass) {
      next.bgClass = bgClass;
    }
  }

  return next;
}

function renderAnsiText(text: string) {
  const normalizedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const segments: Array<{ text: string; style: AnsiStyleState }> = [];
  let currentStyle: AnsiStyleState = { ...DEFAULT_STYLE_STATE };
  let lastIndex = 0;

  for (const match of normalizedText.matchAll(ANSI_CSI_REGEX)) {
    const matchIndex = match.index ?? 0;
    if (matchIndex > lastIndex) {
      segments.push({
        text: normalizedText.slice(lastIndex, matchIndex),
        style: { ...currentStyle },
      });
    }

    const codeString = match[1] ?? "";
    const finalByte = match[3];

    if (finalByte === "m") {
      const codes = codeString
        .split(";")
        .filter((part) => part.length > 0)
        .map((part) => Number.parseInt(part, 10))
        .filter((value) => Number.isFinite(value));

      currentStyle = applyAnsiCodes(currentStyle, codes);
    }

    lastIndex = matchIndex + match[0].length;
  }

  if (lastIndex < normalizedText.length) {
    segments.push({
      text: normalizedText.slice(lastIndex),
      style: { ...currentStyle },
    });
  }

  return segments.map((segment, index) => (
    <span
      key={`${index}-${segment.text.length}`}
      className={cn(
        segment.style.fgClass,
        segment.style.bgClass,
        segment.style.bold && "font-semibold",
        segment.style.dim && "opacity-75",
        segment.style.italic && "italic",
        segment.style.underline && "underline"
      )}
    >
      {segment.text}
    </span>
  ));
}

export function TerminalOutput({
  text,
  tone = "default",
  className,
  autoScroll = true,
}: TerminalOutputProps) {
  const containerRef = useRef<HTMLPreElement>(null);
  const shouldStickToBottomRef = useRef(true);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || !autoScroll) {
      return;
    }

    const updateStickyState = () => {
      const distanceFromBottom =
        element.scrollHeight - element.scrollTop - element.clientHeight;
      shouldStickToBottomRef.current =
        distanceFromBottom <= AUTO_SCROLL_THRESHOLD_PX;
    };

    updateStickyState();
    element.addEventListener("scroll", updateStickyState);

    return () => {
      element.removeEventListener("scroll", updateStickyState);
    };
  }, [autoScroll]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || !autoScroll || !shouldStickToBottomRef.current) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      element.scrollTop = element.scrollHeight;
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [autoScroll, text]);

  return (
    <pre
      ref={containerRef}
      role="log"
      className={cn(
        "overflow-auto rounded border p-2 font-mono text-xs leading-5 whitespace-pre-wrap break-words",
        "bg-zinc-950 text-zinc-100 border-zinc-800",
        tone === "stderr" && "border-amber-700/60 text-amber-100",
        className
      )}
    >
      {renderAnsiText(text)}
    </pre>
  );
}
