import { useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

type SummaryBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "heading"; level: number; text: string }
  | { kind: "list"; ordered: boolean; items: string[] };

function splitLongParagraph(text: string): string[] {
  if (text.length < 320) return [text];

  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z0-9“"'‘(])/);
  if (sentences.length < 3) return [text];

  const groups: string[] = [];
  for (let index = 0; index < sentences.length; index += 2) {
    groups.push(sentences.slice(index, index + 2).join(" "));
  }
  return groups;
}

function parseSummary(content: string): SummaryBlock[] {
  const blocks: SummaryBlock[] = [];
  let list: Extract<SummaryBlock, { kind: "list" }> | null = null;

  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (const rawLine of content.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushList();
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] });
      continue;
    }

    const unorderedItem = line.match(/^(?:[-*•])\s+(.+)$/);
    const orderedItem = line.match(/^\d+[.)]\s+(.+)$/);
    if (unorderedItem || orderedItem) {
      const ordered = Boolean(orderedItem);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { kind: "list", ordered, items: [] };
      }
      list.items.push((orderedItem || unorderedItem)![1]);
      continue;
    }

    flushList();
    // Preserve editor line breaks, while gently grouping very long single-line
    // narratives into shorter sentence groups for easier mobile reading.
    for (const text of splitLongParagraph(line)) {
      blocks.push({ kind: "paragraph", text });
    }
  }

  flushList();
  return blocks;
}

function renderInline(text: string): ReactNode[] {
  const pieces = text.split(
    /(\*\*|__|\[[^\]]+\]\([^)]+\)|`[^`]+`|\*[^*]+\*|_[^_]+_)/g,
  );
  let strong = false;

  return pieces.map((piece, index) => {
    if (piece === "**" || piece === "__") {
      strong = !strong;
      return null;
    }

    const link = piece.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)$/i);
    if (link) {
      const anchor = (
        <a
          href={link[2]}
          className="font-semibold text-white underline decoration-white/50 underline-offset-4 transition-colors hover:decoration-white"
        >
          {link[1]}
        </a>
      );
      return strong
        ? <strong key={index} className="font-semibold text-white">{anchor}</strong>
        : <span key={index}>{anchor}</span>;
    }

    if (piece.startsWith("`") && piece.endsWith("`")) {
      const code = <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.9em] text-white">{piece.slice(1, -1)}</code>;
      return strong ? <strong key={index} className="font-semibold text-white">{code}</strong> : <span key={index}>{code}</span>;
    }
    if ((piece.startsWith("*") && piece.endsWith("*")) || (piece.startsWith("_") && piece.endsWith("_"))) {
      const emphasis = <em>{piece.slice(1, -1)}</em>;
      return strong ? <strong key={index} className="font-semibold text-white">{emphasis}</strong> : <span key={index}>{emphasis}</span>;
    }
    return piece
      ? strong
        ? <strong key={index} className="font-semibold text-white">{piece}</strong>
        : <span key={index}>{piece}</span>
      : null;
  });
}

export default function CompetitionSummaryText({
  content,
  accentColor,
  className = "",
  testId,
  collapsible = false,
}: {
  collapsible?: boolean;
  content: string;
  accentColor: string;
  className?: string;
  testId?: string;
}) {
  const blocks = parseSummary(content);
  const [expanded, setExpanded] = useState(false);
  const canCollapse = collapsible && content.length > 260;
  const collapsed = canCollapse && !expanded;
  const summaryStyle: CSSProperties = {
    color: "rgba(255, 255, 255, 0.84)",
    fontFamily: "Poppins, sans-serif",
    fontSize: "1rem",
    fontWeight: 400,
    lineHeight: 1.55,
    overflowWrap: "anywhere",
    ...(collapsed ? {
      maxHeight: "8.5rem",
      overflow: "hidden",
      WebkitMaskImage: "linear-gradient(to bottom, #000 55%, transparent)",
      maskImage: "linear-gradient(to bottom, #000 55%, transparent)",
    } : {}),
  };

  return (
    <div className={className}>
    <div className="competition-summary-copy" style={summaryStyle} data-testid={testId}>
      {blocks.map((block, index) => {
        if (block.kind === "paragraph") {
          return <p key={index} className="mb-2.5 last:mb-0">{renderInline(block.text)}</p>;
        }
        if (block.kind === "heading") {
          const Heading = block.level === 1 ? "h3" : block.level === 2 ? "h4" : "h5";
          return (
            <Heading key={index} className="mb-1.5 mt-3 text-base font-semibold leading-snug text-white first:mt-0">
              {renderInline(block.text)}
            </Heading>
          );
        }

        const List = block.ordered ? "ol" : "ul";
        return (
          <List key={index} className="mb-3 space-y-1.5 last:mb-0">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex} className="flex gap-3">
                <span className="shrink-0 font-semibold" style={{ color: accentColor }} aria-hidden="true">
                  {block.ordered ? `${itemIndex + 1}.` : "•"}
                </span>
                <span>{renderInline(item)}</span>
              </li>
            ))}
          </List>
        );
      })}
    </div>
    {canCollapse && (
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        style={{ color: accentColor }}
        data-testid="button-toggle-description"
      >
        {expanded ? "Show less" : "Show more"}
        <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
    )}
    </div>
  );
}
