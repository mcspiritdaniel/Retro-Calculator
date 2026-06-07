"use client";

import { useEffect, useRef } from "react";
import { formatLogStackValue, type ActivityLogEntry } from "@/lib/activity-log";

type ActivityLogProps = {
  entries: ActivityLogEntry[];
  decimalPlaces: number;
  onClear: () => void;
};

export default function ActivityLog({
  entries,
  decimalPlaces,
  onClear,
}: ActivityLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [entries.length]);

  return (
    <section
      aria-label="Activity log"
      className="flex h-full min-h-0 w-full flex-col rounded-sm border border-[#d8d6d0] bg-white shadow-sm"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#eceae4] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-[#222]">
            Activity log
          </h2>
          <p className="mt-0.5 text-xs text-[#666]">
            Keystrokes, display, and stack after each press.
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={entries.length === 0}
          className="rounded border border-[#ccc] px-3 py-1.5 text-xs font-medium text-[#333] transition hover:border-[#88949a] hover:bg-[#f4f7f8] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#ccc] disabled:hover:bg-transparent"
        >
          Clear
        </button>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-3 font-mono text-xs leading-relaxed text-[#222]"
      >
        {entries.length === 0 ? (
          <div className="space-y-2 text-[#888]">
            <p>
              Press keys to build a tape. Notes appear when a function has a
              documented description.
            </p>
            <p className="text-[11px] text-[#aaa]">
              Try:{" "}
              <span className="font-mono text-[#777]">5 ENTER 3 +</span>
            </p>
          </div>
        ) : (
          <ol className="space-y-3">
            {entries.map((entry, index) => {
              const isLatest = index === entries.length - 1;

              return (
                <li
                  key={entry.id}
                  className={`border-b border-[#f0eeea] pb-3 last:border-0${
                    isLatest
                      ? " border-l-2 border-l-[#88949a] pl-3"
                      : ""
                  }`}
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-[#999]">{entry.step}.</span>
                    <span className="font-semibold text-[#111]">
                      {entry.keyLabel}
                    </span>
                    <span className="text-[#555]">X={entry.display}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-[#666]">
                    T={formatLogStackValue(entry.stack.t, decimalPlaces)}{" "}
                    Z={formatLogStackValue(entry.stack.z, decimalPlaces)}{" "}
                    Y={formatLogStackValue(entry.stack.y, decimalPlaces)}{" "}
                    X={formatLogStackValue(entry.stack.x, decimalPlaces)}
                  </div>
                  {entry.note ? (
                    <p className="mt-1.5 text-[11px] font-sans text-[#444]">
                      {entry.note}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
