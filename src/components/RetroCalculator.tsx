"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import ActivityLog from "@/components/ActivityLog";
import CalculatorFootnotes from "@/components/CalculatorFootnotes";
import HelpPanel from "@/components/HelpPanel";
import MobileReferenceTabs, {
  type MobileReferenceTab,
} from "@/components/MobileReferenceTabs";
import RegistersPanel from "@/components/RegistersPanel";
import { useLargeScreenLayout } from "@/hooks/use-large-screen-layout";
import {
  buildKeyLabel,
  createActivityLogEntry,
  type ActivityLogEntry,
} from "@/lib/activity-log";
import { formatLcdDisplay, getLcdScientificEntryParts, type LcdScientificEntryParts } from "@/lib/lcd-format";
import { createRpnEngine, type RpnEngine, type RpnEngineSnapshot } from "@/lib/rpn-engine";

const COLORS = {
  chassis: "#111111",
  chassisEdge: "#0a0a0a",
  metalFaceLight: "#d4dade",
  metalFaceMid: "#b0bac0",
  metalFaceDark: "#88949a",
  metalGold: "#b89428",
  metalGoldLight: "#ccb838",
  metalGoldDark: "#857820",
  gold: "#d4ae18",
  goldLight: "#e6c830",
  lcdPanelLight: "#d8d6d0",
  lcdPanelMid: "#c9c7c1",
  lcdPanelDark: "#bab8b2",
  lcdBg: "#c9c7c1",
  lcdText: "#000000",
  keyBg: "#121212",
  keyBorder: "#0a0a0a",
  white: "#f2f2f2",
  fKey: "#d4ae18",
  gKey: "#5bb0d0",
  blueLabel: "#3db4e0",
};

/** DSEG maps backtick to a 3-segment 7 without the left vertical stem. */
function formatLcdGlyphs(text: string): string {
  return text.replace(/7/g, "`");
}

const LCD_LETTER_SPACING = 0.21;

function lcdPunctuationMetrics(digitSize: number) {
  const body = digitSize * 0.142;
  const gapCenter = digitSize * (LCD_LETTER_SPACING / 2);

  return {
    body,
    radius: body * 0.16,
    bodyTailGap: digitSize * 0.028,
    tailHeight: body * 1.38,
    tailOffset: body * 0.54,
    gapCenter,
  };
}

function LcdDecimalMark({
  color,
  digitSize,
}: {
  color: string;
  digitSize: number;
}) {
  const { body, radius, gapCenter } = lcdPunctuationMetrics(digitSize);

  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        left: -(gapCenter + body * 0.08),
        bottom: 0,
        width: body,
        height: body,
        transform: "translateX(-50%)",
        borderRadius: radius,
        backgroundColor: color,
        pointerEvents: "none",
        zIndex: 2,
      }}
    />
  );
}

function LcdCommaSlot({
  color,
  digitSize,
}: {
  color: string;
  digitSize: number;
}) {
  const { body, radius, bodyTailGap, tailHeight, tailOffset, gapCenter } =
    lcdPunctuationMetrics(digitSize);
  const tailReserve = tailHeight + bodyTailGap;

  return (
    <span
      aria-hidden="true"
      className="lcd-comma-slot"
      style={{
        display: "inline-block",
        width: 0,
        verticalAlign: "baseline",
        position: "relative",
        overflow: "visible",
      }}
    >
      <span
        style={{
          position: "absolute",
          left: -gapCenter,
          bottom: -tailReserve,
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          pointerEvents: "none",
          zIndex: 2,
        }}
      >
        <span
          style={{
            display: "block",
            width: body,
            height: body,
            borderRadius: radius,
            backgroundColor: color,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            display: "block",
            width: body,
            height: tailHeight,
            marginTop: bodyTailGap,
            marginLeft: -tailOffset,
            flexShrink: 0,
          }}
        >
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 16 32"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              fill={color}
              d="
                M 4 0.5
                H 12
                Q 15.5 0.5 15.5 4
                C 14.5 11 11 18.5 7.5 23.5
                C 5.2 26.5 2.8 29 1.2 30.5
                C 0.5 31.2 0.1 31.5 0 30.5
                C -0.08 29 -0.12 27 0.08 25.2
                C 0.4 21.5 0.85 15.5 1.35 10
                C 1.9 6 1.1 5 -0.2 4.5
                Q 0.5 0.5 4 0.5
                Z
              "
            />
          </svg>
        </span>
      </span>
    </span>
  );
}

function renderLcdCharSequence(
  text: string,
  color: string,
  digitSize: number,
  keyPrefix: string,
) {
  const chars = [...formatLcdGlyphs(text)];

  return chars.map((char, index) => {
    if (char === ",") {
      return (
        <LcdCommaSlot
          key={`${keyPrefix}-${index}`}
          color={color}
          digitSize={digitSize}
        />
      );
    }

    if (char === ".") return null;

    const followsDecimal = index > 0 && chars[index - 1] === ".";
    const showTrailingDecimal =
      chars[index + 1] === "." && index + 1 === chars.length - 1;

    return (
      <span key={`${keyPrefix}-${index}`} className="lcd-digit">
        {followsDecimal ? (
          <LcdDecimalMark color={color} digitSize={digitSize} />
        ) : null}
        {char}
        {showTrailingDecimal ? (
          <span
            aria-hidden="true"
            className="relative inline-block w-0 overflow-visible"
          >
            <LcdDecimalMark color={color} digitSize={digitSize} />
          </span>
        ) : null}
      </span>
    );
  });
}

function splitLcdSignedText(text: string) {
  if (text.trim() === "Error") {
    return { negative: false, body: text };
  }

  const negative = text.startsWith("-");
  return { negative, body: negative ? text.slice(1) : text };
}

function renderLcdExponentParts(
  exponentSign: " " | "-",
  exponent: string,
  color: string,
  digitSize: number,
) {
  return (
    <>
      {exponentSign === "-" ? (
        <span className="lcd-digit">-</span>
      ) : (
        <span className="lcd-digit lcd-digit--blank" aria-hidden="true">
          0
        </span>
      )}
      {renderLcdCharSequence(exponent, color, digitSize, "exponent")}
    </>
  );
}

function LcdDisplay({
  text,
  color,
  hidden = false,
  scientificEntry = null,
}: {
  text: string;
  color: string;
  hidden?: boolean;
  scientificEntry?: LcdScientificEntryParts | null;
}) {
  const clipRef = useRef<HTMLSpanElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);
  const exponentRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState<number | null>(null);
  const [digitSize, setDigitSize] = useState(34);

  useLayoutEffect(() => {
    const clip = clipRef.current;
    const line = lineRef.current;
    if (!clip || !line) return;

    const updateScale = () => {
      line.style.fontSize = "";
      exponentRef.current && (exponentRef.current.style.fontSize = "");
      const baseSize = parseFloat(getComputedStyle(clip).fontSize);
      setDigitSize(baseSize);

      const available = clip.clientWidth;
      const mantissaNeeded = line.scrollWidth;
      const exponentNeeded = exponentRef.current?.scrollWidth ?? 0;
      const needed = scientificEntry
        ? mantissaNeeded + exponentNeeded
        : mantissaNeeded;

      if (available > 0 && needed > available && baseSize > 0) {
        const scaled = baseSize * (available / needed) * 0.98;
        setFontSize(scaled);
      } else {
        setFontSize(null);
      }
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(clip);
    return () => observer.disconnect();
  }, [text, scientificEntry]);

  useLayoutEffect(() => {
    const line = lineRef.current;
    if (!line) return;
    setDigitSize(parseFloat(getComputedStyle(line).fontSize));
  }, [fontSize, text, scientificEntry]);

  const tailPadding =
    lcdPunctuationMetrics(digitSize).tailHeight +
    lcdPunctuationMetrics(digitSize).bodyTailGap;

  const lineStyle: CSSProperties = {
    ...(fontSize ? { fontSize } : undefined),
    paddingBottom: tailPadding,
  };

  const exponentLineStyle: CSSProperties = {
    ...(fontSize ? { fontSize } : undefined),
    paddingBottom: tailPadding,
  };

  const signedText = scientificEntry ? scientificEntry.mantissa : text;
  const { negative, body } = splitLcdSignedText(signedText);

  return (
    <span
      ref={clipRef}
      className={`lcd-display-clip${scientificEntry ? " lcd-display-clip--scientific-entry" : ""}`}
      style={{ visibility: hidden ? "hidden" : "visible" }}
      aria-hidden={hidden}
    >
      {scientificEntry ? (
        <>
          <span
            ref={lineRef}
            className="lcd-display-line lcd-display-line--signed"
            style={lineStyle}
          >
            {negative ? (
              <span className="lcd-sign-overlay" aria-hidden="true">
                -
              </span>
            ) : null}
            {renderLcdCharSequence(body, color, digitSize, "mantissa")}
          </span>
          <span
            ref={exponentRef}
            className="lcd-display-line lcd-scientific-exponent-overlay"
            style={exponentLineStyle}
          >
            {renderLcdExponentParts(
              scientificEntry.exponentSign,
              scientificEntry.exponent,
              color,
              digitSize,
            )}
          </span>
        </>
      ) : (
        <span
          ref={lineRef}
          className="lcd-display-line lcd-display-line--signed"
          style={lineStyle}
        >
          {negative ? (
            <span className="lcd-sign-overlay" aria-hidden="true">
              -
            </span>
          ) : null}
          {renderLcdCharSequence(body, color, digitSize, "main")}
        </span>
      )}
    </span>
  );
}

type KeyVariant = "standard" | "f" | "g" | "enter";

const ENTER_LETTERS = ["E", "N", "T", "E", "R"] as const;

/** HTML entity strings for faceplate and key labels (copy-paste safe in source). */
const HTML = {
  divide: "&divide;",
  times: "&times;",
  deltaPct: "&Delta;%",
  deltaDYS: "&Delta;DYS",
  sigma: "&Sigma;",
  sigmaPlus: "&Sigma;+",
  sigmaMinus: "&Sigma;-",
  twelveTimes: "12&times;",
  twelveDivide: "12&divide;",
  sqrtX: "&radic;x",
  ePowX: "e<sup>x</sup>",
  yPowX: "y<sup>x</sup>",
  xBarW: "x&#772;w",
  xBarR: "x&#772;r",
  xBar: "x&#772;",
  rDown: "R&darr;",
  xSwapY: "x&harr;y",
  xLeY: "x&le;y",
} as const;

type CalcKeyProps = {
  labelHtml: string;
  ariaLabel?: string;
  goldLabelHtml?: string;
  onPress?: () => void;
  variant?: KeyVariant;
  className?: string;
  disabled?: boolean;
  /** Keep keycap label at full brightness when disabled (matches n, i, PV). */
  brightLabel?: boolean;
};

const GOLD_SHIFT_LABEL_CLASS =
  "text-xs font-bold leading-none tracking-wide";
const BLUE_SHIFT_LABEL_CLASS =
  "text-[16px] font-bold leading-none tracking-wide whitespace-nowrap [&_sup]:text-[13px] [&_sup]:font-bold [&_sup]:leading-none";
const KEYCAP_LABEL_CLASS =
  "text-[21px] font-semibold leading-none tracking-tight";
const DECIMAL_KEY_MARK_CLASS =
  "block rounded-full bg-[#f2f2f2]";
const DECIMAL_KEY_MARK_SIZE = 8;
const KEY_FONT: CSSProperties = {
  fontFamily: "var(--font-geist-sans), sans-serif",
  fontStretch: "semi-condensed",
};
const LCD_DISPLAY_CLASS =
  "text-left text-[34px] font-normal italic leading-none sm:text-[38px]";
const LCD_FONT: CSSProperties = {
  fontFamily: '"DSEG7 Classic Mini", monospace',
  fontStyle: "italic",
  fontWeight: 400,
  fontFeatureSettings: '"tnum" 1',
  WebkitFontSmoothing: "antialiased",
};

function EntityText({
  html,
  className = "",
  style,
}: {
  html: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function ShiftLabel({
  html,
  color,
}: {
  html: string;
  color: "gold" | "blue";
}) {
  const isBlue = color === "blue";
  return (
    <EntityText
      html={html}
      className={`${isBlue ? BLUE_SHIFT_LABEL_CLASS : GOLD_SHIFT_LABEL_CLASS} text-center`}
      style={{
        color: isBlue ? COLORS.blueLabel : COLORS.gold,
        ...(isBlue ? { fontSize: "16px" } : {}),
      }}
    />
  );
}

function CalcKey({
  labelHtml,
  ariaLabel,
  goldLabelHtml,
  onPress,
  variant = "standard",
  className = "",
  disabled = false,
  brightLabel = false,
}: CalcKeyProps) {
  const interactive = onPress && !disabled;

  const faceClass =
    variant === "f"
      ? "text-[#1a1408]"
      : variant === "g"
        ? "bg-[#5bb0d0] text-[#0a1a22]"
        : variant === "enter"
          ? "bg-[#161616] text-white"
          : "bg-[#121212] text-[#f2f2f2]";

  const faceStyle: CSSProperties = {
    borderColor: COLORS.keyBorder,
    ...(variant === "f" ? { backgroundColor: COLORS.fKey } : {}),
  };

  const idleClass =
    interactive || brightLabel ? "" : "opacity-80";

  return (
    <div
      className={`relative w-full ${variant === "enter" ? "flex min-h-0 flex-1 flex-col" : ""} ${className}`}
    >
      <button
        type="button"
        onClick={onPress}
        disabled={!interactive}
        aria-label={ariaLabel ?? (variant === "enter" ? "ENTER" : undefined)}
        className={`relative flex w-full flex-col items-center justify-center rounded-[2px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_1px_2px_rgba(0,0,0,0.85)] transition-all duration-75 select-none ${faceClass} ${
          variant === "enter" ? "min-h-[40px] flex-1" : "h-[40px]"
        } ${interactive ? "cursor-pointer hover:brightness-110 active:translate-y-px active:shadow-[inset_0_2px_5px_rgba(0,0,0,0.7)]" : `cursor-default ${idleClass}`}`}
        style={faceStyle}
      >
        {variant === "enter" ? (
          <span
            className="flex flex-col items-center gap-[3px]"
            aria-hidden="true"
          >
            {ENTER_LETTERS.map((letter, index) => (
              <span
                key={`enter-letter-${index}`}
                className={KEYCAP_LABEL_CLASS}
                style={KEY_FONT}
              >
                {letter}
              </span>
            ))}
          </span>
        ) : labelHtml === "." ? (
          <span
            className="flex h-full w-full items-center justify-center"
            aria-hidden="true"
          >
            <span
              className={DECIMAL_KEY_MARK_CLASS}
              style={{
                width: DECIMAL_KEY_MARK_SIZE,
                height: DECIMAL_KEY_MARK_SIZE,
              }}
            />
          </span>
        ) : (
          <EntityText
            html={labelHtml}
            className={KEYCAP_LABEL_CLASS}
            style={KEY_FONT}
          />
        )}
        {goldLabelHtml ? (
          <EntityText
            html={goldLabelHtml}
            className="mt-[2px] text-[6.5px] font-semibold leading-none tracking-wide"
            style={{ color: COLORS.goldLight }}
          />
        ) : null}
      </button>
    </div>
  );
}

function FaceBracket({
  title,
  leftLabel,
  rightLabel,
  subLabels,
  sublabelColumns,
}: {
  title: string;
  leftLabel?: string;
  rightLabel?: string;
  subLabels?: string[];
  sublabelColumns?: number;
}) {
  const sublabelColCount =
    sublabelColumns ?? subLabels?.length ?? 0;
  return (
    <div className="pointer-events-none flex w-full flex-col">
      <span
        className={`${GOLD_SHIFT_LABEL_CLASS} mb-[2px] text-center uppercase tracking-[0.05em]`}
        style={{ color: COLORS.gold }}
      >
        {title}
      </span>
      <div className="relative mx-px h-[7px] w-full">
        <div
          className="absolute top-0 right-0 left-0 h-px"
          style={{ backgroundColor: COLORS.gold }}
        />
        <div
          className="absolute top-0 left-0 h-[3px] w-px"
          style={{ backgroundColor: COLORS.gold }}
        />
        <div
          className="absolute top-0 right-0 h-[3px] w-px"
          style={{ backgroundColor: COLORS.gold }}
        />
      </div>
      {subLabels ? (
        <div
          className={`mt-[2px] grid w-full ${GOLD_SHIFT_LABEL_CLASS}`}
          style={{
            color: COLORS.gold,
            gridTemplateColumns: `repeat(${sublabelColCount}, 1fr)`,
          }}
        >
          {subLabels.map((label, index) => (
            <EntityText
              key={`sublabel-${index}`}
              html={label}
              className="text-center"
            />
          ))}
        </div>
      ) : (
        <div
          className={`mt-[2px] flex w-full justify-between ${GOLD_SHIFT_LABEL_CLASS}`}
          style={{ color: COLORS.gold }}
        >
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      )}
    </div>
  );
}

const GRID_COLUMN_GAP_CLASS = "gap-x-[10px]";
const GRID_COLUMN_GAP_PX = 10;
/** Half-column inset on left edge to column 2 midpoint (LCD spans columns 2–7). */
const LCD_COLUMN_INSET = `calc((100% - ${5 * GRID_COLUMN_GAP_PX}px) / 12)`;
/** From panel left (column 2 midpoint) to first digit at column 2/3 boundary. */
const LCD_DIGIT_START_OFFSET = `calc((100% - ${5 * GRID_COLUMN_GAP_PX}px) / 12 + ${GRID_COLUMN_GAP_PX}px)`;
/** Column 4 center on the 10-column keypad grid (full grid width). */
const GRID_COL4_CENTER = `calc((100% - ${9 * GRID_COLUMN_GAP_PX}px) / 10 * 3.5 + ${3 * GRID_COLUMN_GAP_PX}px)`;
/** f annunciator between columns 3 and 4. */
const LCD_F_LEFT = `calc((100% - ${9 * GRID_COLUMN_GAP_PX}px) / 10 * 3 + ${2.5 * GRID_COLUMN_GAP_PX}px)`;
/** g annunciator just left of column 4 center. */
const LCD_G_LEFT = `calc(${GRID_COL4_CENTER} - (100% - ${9 * GRID_COLUMN_GAP_PX}px) / 10 * 0.08)`;
/** BEGIN annunciator: just right of column 4 center on the faceplate. */
const LCD_BEGIN_LEFT = `calc(${GRID_COL4_CENTER} + (100% - ${9 * GRID_COLUMN_GAP_PX}px) / 10 * 0.12)`;
/** D.MY annunciator between columns 5 and 6. */
const LCD_DMY_LEFT = `calc((100% - ${9 * GRID_COLUMN_GAP_PX}px) / 10 * 5 + ${4.5 * GRID_COLUMN_GAP_PX}px)`;
/** Half-column inset on right edge to column 7 midpoint (LCD spans columns 3–7). */
const LCD_RIGHT_INSET = `calc((100% - ${4 * GRID_COLUMN_GAP_PX}px) / 10)`;
const GRID_10 = `grid grid-cols-10 ${GRID_COLUMN_GAP_CLASS}`;
const KEY_STACK_CLASS =
  "flex h-[88px] flex-col items-center justify-between";
const LABEL_SLOT_CLASS = "flex h-6 w-full shrink-0 items-center justify-center";

type KeyStackProps = {
  goldTop?: string;
  blueBottom?: string;
  tall?: boolean;
  className?: string;
  children: ReactNode;
};

function KeyStack({
  goldTop,
  blueBottom,
  tall = false,
  className = "",
  children,
}: KeyStackProps) {
  return (
    <div
      className={`${tall ? "flex h-full flex-col items-center justify-between" : KEY_STACK_CLASS} ${className}`}
    >
      <div className={`${LABEL_SLOT_CLASS} items-end pb-0.5`}>
        {goldTop ? (
          <ShiftLabel color="gold" html={goldTop} />
        ) : (
          <span className="invisible text-xs">&nbsp;</span>
        )}
      </div>
      <div
        className={`w-full ${tall ? "flex flex-1 flex-col justify-center" : "shrink-0"}`}
      >
        {children}
      </div>
      <div className={`${LABEL_SLOT_CLASS} items-start pt-0.5`}>
        {blueBottom ? (
          <ShiftLabel color="blue" html={blueBottom} />
        ) : (
          <span className="invisible text-xs">&nbsp;</span>
        )}
      </div>
    </div>
  );
}

type BracketKeyConfig = CalcKeyProps & { blueBottom?: string };

function BracketGroup({
  col,
  colSpan,
  row,
  bracket,
  keys,
  gridColumns = keys.length,
  trailingGoldTop,
}: {
  col: number;
  colSpan: number;
  row?: number;
  bracket: ReactNode;
  keys: BracketKeyConfig[];
  gridColumns?: number;
  trailingGoldTop?: string;
}) {
  const columnCount = Math.max(gridColumns, keys.length);

  return (
    <div
      className={KEY_STACK_CLASS}
      style={gridPlacement(col, colSpan, row)}
    >
      <div className={`${LABEL_SLOT_CLASS} items-end px-0.5 pb-0.5`}>
        {trailingGoldTop ? (
          <div
            className={`grid w-full ${GRID_COLUMN_GAP_CLASS}`}
            style={{ gridTemplateColumns: `repeat(${columnCount}, 1fr)` }}
          >
            <div
              className="flex items-end"
              style={{ gridColumn: `1 / span ${keys.length}` }}
            >
              {bracket}
            </div>
            <div className="flex items-end justify-center">
              <ShiftLabel color="gold" html={trailingGoldTop} />
            </div>
          </div>
        ) : (
          bracket
        )}
      </div>
      <div
        className={`grid w-full shrink-0 ${GRID_COLUMN_GAP_CLASS}`}
        style={{ gridTemplateColumns: `repeat(${columnCount}, 1fr)` }}
      >
        {keys.map((key, index) => {
          const { blueBottom: _omit, ...calcProps } = key;
          return (
            <CalcKey
              key={calcProps.ariaLabel ?? calcProps.labelHtml ?? `key-${index}`}
              {...calcProps}
            />
          );
        })}
        {columnCount > keys.length &&
          Array.from({ length: columnCount - keys.length }).map((_, index) => (
            <div key={`spacer-${index}`} aria-hidden="true" />
          ))}
      </div>
      <div
        className={`grid w-full shrink-0 ${GRID_COLUMN_GAP_CLASS}`}
        style={{ gridTemplateColumns: `repeat(${columnCount}, 1fr)` }}
      >
        {keys.map((key, index) => (
          <div
            key={`blue-${key.ariaLabel ?? key.labelHtml ?? index}`}
            className={`${LABEL_SLOT_CLASS} items-start pt-0.5`}
          >
            {key.blueBottom ? (
              <ShiftLabel color="blue" html={key.blueBottom} />
            ) : (
              <span className="invisible text-xs">&nbsp;</span>
            )}
          </div>
        ))}
        {columnCount > keys.length &&
          Array.from({ length: columnCount - keys.length }).map((_, index) => (
            <div key={`blue-spacer-${index}`} aria-hidden="true" />
          ))}
      </div>
    </div>
  );
}

function gridPlacement(col?: number, colSpan = 1, row?: number, rowSpan?: number) {
  const style: CSSProperties = {};
  if (col !== undefined && colSpan > 1) {
    style.gridColumn = `${col} / span ${colSpan}`;
  } else if (col !== undefined) {
    style.gridColumn = col;
  } else if (colSpan > 1) {
    style.gridColumn = `span ${colSpan}`;
  }
  if (row !== undefined && rowSpan && rowSpan > 1) {
    style.gridRow = `${row} / span ${rowSpan}`;
  } else if (row !== undefined) {
    style.gridRow = row;
  }
  return style;
}

function KeyCol({
  col,
  colSpan = 1,
  row,
  rowSpan,
  className = "",
  children,
}: {
  col?: number;
  colSpan?: number;
  row?: number;
  rowSpan?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`min-h-0 ${rowSpan ? "flex h-full flex-col" : ""} ${className}`}
      style={gridPlacement(col, colSpan, row, rowSpan)}
    >
      {children}
    </div>
  );
}

function readLcdView(engine: RpnEngine) {
  const isEnteringExponent = engine.getIsEnteringExponent();
  const calendarText = engine.getCalendarDisplayText();
  const prefixMantissaText = engine.getPrefixMantissaDisplayText();

  return {
    text:
      calendarText ??
      prefixMantissaText ??
      formatLcdDisplay({
        value: engine.display,
        isEntering: engine.getIsEntering(),
        inputBuffer: engine.getInputBuffer(),
        decimalPlaces: engine.decimalPlaces,
        isEnteringExponent,
        exponentBuffer: engine.getExponentBuffer(),
        exponentNegative: engine.getExponentNegative(),
      }),
    scientificEntry: isEnteringExponent
      ? getLcdScientificEntryParts(
          engine.getInputBuffer(),
          engine.getExponentBuffer(),
          engine.getExponentNegative(),
        )
      : null,
    showBegin: engine.paymentMode === "beg",
    showDmy: engine.getShowDmyAnnunciator(),
    showF: engine.fShift,
    showG: engine.gShift,
  };
}

const CALC_DESIGN_WIDTH = 1020;
const MAX_CALC_SCALE = 1.08;

function ScaledCalculatorShell({
  children,
  intrinsicWidth = false,
}: {
  children: ReactNode;
  intrinsicWidth?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState({ scale: 0, height: 0 });

  useLayoutEffect(() => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;

    const update = () => {
      const availableWidth = container.clientWidth;
      const availableHeight = container.clientHeight;
      const naturalHeight = inner.offsetHeight;
      const widthScale =
        availableWidth > 0 ? availableWidth / CALC_DESIGN_WIDTH : 0;
      const heightScale =
        availableHeight > 0 && naturalHeight > 0
          ? availableHeight / naturalHeight
          : widthScale;
      const scale = intrinsicWidth
        ? Math.min(MAX_CALC_SCALE, heightScale)
        : Math.min(MAX_CALC_SCALE, widthScale, heightScale);
      setMetrics({
        scale,
        height: naturalHeight * scale,
      });
    };

    update();
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(container);
    resizeObserver.observe(inner);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      resizeObserver.disconnect();
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, [intrinsicWidth]);

  const { scale, height } = metrics;

  return (
    <div
      ref={containerRef}
      className={
        intrinsicWidth
          ? "h-full w-fit max-w-full min-w-0"
          : "flex h-full min-h-0 w-full items-start justify-center"
      }
    >
      <div
        className="overflow-hidden"
        style={{
          width: scale > 0 ? CALC_DESIGN_WIDTH * scale : undefined,
          height: height > 0 ? height : undefined,
          visibility: scale > 0 ? "visible" : "hidden",
        }}
      >
        <div
          ref={innerRef}
          style={{
            width: CALC_DESIGN_WIDTH,
            transform: scale > 0 ? `scale(${scale})` : undefined,
            transformOrigin: "top left",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default function RetroCalculator() {
  const [engine] = useState(() => createRpnEngine());
  const [lcdView, setLcdView] = useState(() => readLcdView(engine));
  const [isPowered, setIsPowered] = useState(true);
  const [logEntries, setLogEntries] = useState<ActivityLogEntry[]>([]);
  const [engineSnapshot, setEngineSnapshot] = useState<RpnEngineSnapshot>(() =>
    engine.getSnapshot(),
  );
  const logIdRef = useRef(0);
  const isLargeScreen = useLargeScreenLayout();
  const [mobileTab, setMobileTab] = useState<MobileReferenceTab>("log");

  const syncUi = useCallback(() => {
    setLcdView(readLcdView(engine));
    setEngineSnapshot(engine.getSnapshot());
  }, [engine]);

  const clearLog = useCallback(() => {
    setLogEntries([]);
    logIdRef.current = 0;
  }, []);

  const press = useCallback(
    (baseKey: string, action: (engine: RpnEngine) => void) => {
      if (!isPowered) {
        return;
      }

      const keyLabel = buildKeyLabel(engine, baseKey);
      action(engine);

      logIdRef.current += 1;
      const lcd = readLcdView(engine);
      const entry = createActivityLogEntry(
        logIdRef.current,
        logIdRef.current,
        keyLabel,
        lcd.text,
        engine.getSnapshot(),
      );

      setLogEntries((prev) => [...prev, entry]);
      syncUi();
    },
    [engine, isPowered, syncUi],
  );

  const togglePower = useCallback(() => {
    setIsPowered((prev) => {
      if (prev) {
        engine.fShift = false;
        engine.gShift = false;
      }
      return !prev;
    });
    syncUi();
  }, [engine, syncUi]);

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden supports-[height:100dvh]:h-dvh">
      <header className="shrink-0 border-b border-[#d0d8da] bg-white px-3 py-2 lg:px-5 lg:py-2.5 xl:px-8">
        <h1 className="text-sm font-semibold tracking-wide text-[#222]">
          RPN Financial Calculator
        </h1>
        <p className="mt-0.5 text-xs text-[#888]">Dan McSpirit</p>
      </header>
      <div
        className={`grid min-h-0 flex-1 ${
          isLargeScreen
            ? "grid-rows-[11fr_9fr]"
            : "grid-rows-[minmax(0,13fr)_auto_minmax(0,7fr)]"
        }`}
      >
        <div
          className={`flex min-h-0 h-full overflow-hidden ${
            isLargeScreen
              ? "gap-5 px-5 py-4 xl:gap-6 xl:px-8"
              : "flex-col px-2 py-2"
          } border-b border-[#d0d8da] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)]`}
        >
        <div
          className={`flex min-h-0 w-full overflow-hidden ${
            isLargeScreen
              ? "h-full shrink-0 items-center"
              : "h-full flex-1 items-start justify-center"
          }`}
        >
          <ScaledCalculatorShell intrinsicWidth={isLargeScreen}>
            <div
              className="relative w-full rounded-sm px-4 pt-px pb-px shadow-[0_8px_24px_rgba(0,0,0,0.22),0_2px_6px_rgba(0,0,0,0.1)] sm:px-5"
              style={{
                background: COLORS.chassis,
                borderTop: "none",
                borderRight: `2px solid ${COLORS.chassisEdge}`,
                borderBottom: "none",
                borderLeft: `2px solid ${COLORS.chassisEdge}`,
              }}
            >
        <span className="sr-only" aria-live="polite">
          {lcdView.text}
        </span>

        <div
          className="relative mb-3 overflow-visible rounded-sm px-4 py-3 sm:px-5 sm:py-3.5"
          style={{
            background: `linear-gradient(180deg, ${COLORS.metalFaceLight} 0%, ${COLORS.metalFaceMid} 50%, ${COLORS.metalFaceDark} 100%)`,
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(0,0,0,0.2), 0 1px 3px rgba(0,0,0,0.35)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, rgba(255,255,255,0.14) 0px, rgba(255,255,255,0.14) 1px, transparent 1px, transparent 3px)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 45%, rgba(0,0,0,0.12) 100%)",
            }}
          />

          <div className={`relative z-10 min-w-0 ${GRID_10}`}>
            <div
              className="relative min-w-0 overflow-visible rounded-[1px] py-[24px] pr-3 pl-0 sm:py-[26px] sm:pr-4 sm:pl-0"
              style={{
                gridColumn: "2 / 8",
                marginLeft: LCD_COLUMN_INSET,
                marginRight: LCD_RIGHT_INSET,
                paddingLeft: LCD_DIGIT_START_OFFSET,
                background: `linear-gradient(180deg, ${COLORS.lcdPanelLight} 0%, ${COLORS.lcdPanelMid} 45%, ${COLORS.lcdPanelDark} 100%)`,
                boxShadow: "inset 0 2px 6px rgba(0,0,0,0.38)",
              }}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-45"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(0deg, rgba(0,0,0,0.05) 0px, rgba(0,0,0,0.05) 1px, transparent 1px, transparent 2px)",
                }}
              />
              <p
                className={`relative z-[1] min-h-[1em] w-full min-w-0 overflow-visible ${LCD_DISPLAY_CLASS}`}
                style={{
                  color: COLORS.lcdText,
                  ...LCD_FONT,
                }}
              >
                <LcdDisplay
                  text={lcdView.text}
                  color={COLORS.lcdText}
                  hidden={!isPowered}
                  scientificEntry={lcdView.scientificEntry}
                />
              </p>
            </div>
            {isPowered &&
            (lcdView.showF ||
              lcdView.showG ||
              lcdView.showBegin ||
              lcdView.showDmy) ? (
              <>
                {lcdView.showF ? (
                  <span
                    className="lcd-status-annunciator lcd-status-annunciator--shift pointer-events-none absolute z-[2]"
                    style={{
                      left: LCD_F_LEFT,
                      bottom: "4px",
                      color: COLORS.lcdText,
                      textTransform: "lowercase",
                      fontWeight: 600,
                    }}
                    aria-hidden="true"
                  >
                    f
                  </span>
                ) : null}
                {lcdView.showG ? (
                  <span
                    className="lcd-status-annunciator lcd-status-annunciator--shift pointer-events-none absolute z-[2]"
                    style={{
                      left: LCD_G_LEFT,
                      bottom: "4px",
                      color: COLORS.lcdText,
                      textTransform: "lowercase",
                      fontWeight: 600,
                    }}
                    aria-hidden="true"
                  >
                    g
                  </span>
                ) : null}
                {lcdView.showBegin ? (
                  <span
                    className="lcd-status-annunciator lcd-status-annunciator--begin pointer-events-none absolute z-[2]"
                    style={{
                      left: LCD_BEGIN_LEFT,
                      bottom: "4px",
                      color: COLORS.lcdText,
                    }}
                    aria-hidden="true"
                  >
                    BEGIN
                  </span>
                ) : null}
                {lcdView.showDmy ? (
                  <span
                    className="lcd-status-annunciator lcd-status-annunciator--begin pointer-events-none absolute z-[2]"
                    style={{
                      left: LCD_DMY_LEFT,
                      bottom: "4px",
                      color: COLORS.lcdText,
                    }}
                    aria-hidden="true"
                  >
                    D.MY
                  </span>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        <div
          className="relative rounded-sm px-4 pb-0 pt-3 sm:px-5 sm:pt-4"
          style={{
            background: "#222222",
            borderTop: `4px solid ${COLORS.metalFaceLight}`,
            borderRight: `3.5px solid ${COLORS.metalFaceMid}`,
            borderLeft: `3.5px solid ${COLORS.metalFaceMid}`,
            borderBottom: `18px solid ${COLORS.metalFaceMid}`,
            boxShadow: `inset 0 0 0 1px ${COLORS.metalFaceDark}, inset 0 2px 8px rgba(0,0,0,0.5)`,
          }}
        >
          <div className="flex flex-col gap-y-3 pb-2">
            {/* Row 1 */}
            <div className={GRID_10}>
              <KeyCol col={1}>
                <KeyStack goldTop="AMORT" blueBottom={HTML.twelveTimes}>
                  <CalcKey
                    labelHtml="n"
                    ariaLabel="n"
                    onPress={() => press("n", (e) => e.pressTvmN())}
                  />
                </KeyStack>
              </KeyCol>
              <KeyCol col={2}>
                <KeyStack goldTop="INT" blueBottom={HTML.twelveDivide}>
                  <CalcKey
                    labelHtml="i"
                    ariaLabel="i"
                    onPress={() => press("i", (e) => e.pressTvmI())}
                  />
                </KeyStack>
              </KeyCol>
              <KeyCol col={3}>
                <KeyStack goldTop="NPV" blueBottom="CFo">
                  <CalcKey
                    labelHtml="PV"
                    ariaLabel="PV"
                    onPress={() => press("PV", (e) => e.pressTvmPv())}
                  />
                </KeyStack>
              </KeyCol>
              <KeyCol col={4}>
                <KeyStack goldTop="RND" blueBottom="CFj">
                  <CalcKey
                    labelHtml="PMT"
                    ariaLabel="PMT"
                    onPress={() => press("PMT", (e) => e.pressTvmPmt())}
                  />
                </KeyStack>
              </KeyCol>
              <KeyCol col={5}>
                <KeyStack goldTop="IRR" blueBottom="Nj">
                  <CalcKey
                    labelHtml="FV"
                    ariaLabel="FV"
                    onPress={() => press("FV", (e) => e.pressTvmFv())}
                  />
                </KeyStack>
              </KeyCol>
              <KeyCol col={6}>
                <KeyStack blueBottom="DATE">
                  <CalcKey
                    labelHtml="CHS"
                    ariaLabel="CHS"
                    onPress={() => press("CHS", (e) => e.chs())}
                  />
                </KeyStack>
              </KeyCol>
              <KeyCol col={7}>
                <KeyStack blueBottom="BEG">
                  <CalcKey
                    labelHtml="7"
                    ariaLabel="7"
                    onPress={() => press("7", (e) => e.pressDigit("7"))}
                  />
                </KeyStack>
              </KeyCol>
              <KeyCol col={8}>
                <KeyStack blueBottom="END">
                  <CalcKey
                    labelHtml="8"
                    ariaLabel="8"
                    onPress={() => press("8", (e) => e.pressDigit("8"))}
                  />
                </KeyStack>
              </KeyCol>
              <KeyCol col={9}>
                <KeyStack blueBottom="MEM">
                  <CalcKey
                    labelHtml="9"
                    ariaLabel="9"
                    onPress={() => press("9", (e) => e.pressDigit("9"))}
                  />
                </KeyStack>
              </KeyCol>
              <KeyCol col={10}>
                <KeyStack>
                  <CalcKey
                    labelHtml={HTML.divide}
                    ariaLabel="divide"
                    onPress={() => press("÷", (e) => e.divide())}
                  />
                </KeyStack>
              </KeyCol>
            </div>

            {/* Row 2 */}
            <div className={GRID_10}>
              <BracketGroup
                col={1}
                colSpan={2}
                bracket={
                  <FaceBracket
                    title="BOND"
                    subLabels={["PRICE", "YTM"]}
                  />
                }
                keys={[
                  {
                    labelHtml: HTML.yPowX,
                    ariaLabel: "y^x",
                    blueBottom: HTML.sqrtX,
                    brightLabel: true,
                    onPress: () => press("y^x", (e) => e.pressYPowXKey()),
                  },
                  {
                    labelHtml: "1/x",
                    ariaLabel: "1/x",
                    blueBottom: HTML.ePowX,
                    brightLabel: true,
                    onPress: () => press("1/x", (e) => e.pressReciprocalKey()),
                  },
                ]}
              />
              <BracketGroup
                col={3}
                colSpan={3}
                bracket={
                  <FaceBracket
                    title="DEPRECIATION"
                    subLabels={["SL", "SOYD", "DB"]}
                  />
                }
                keys={[
                  {
                    labelHtml: "%T",
                    ariaLabel: "%T",
                    blueBottom: "LN",
                    brightLabel: true,
                    onPress: () => press("%T", (e) => e.pressPercentOfTotalKey()),
                  },
                  {
                    labelHtml: HTML.deltaPct,
                    ariaLabel: "delta percent",
                    blueBottom: "FRAC",
                    brightLabel: true,
                    onPress: () => press("Δ%", (e) => e.pressDeltaPercentKey()),
                  },
                  {
                    labelHtml: "%",
                    ariaLabel: "%",
                    blueBottom: "INTG",
                    brightLabel: true,
                    onPress: () => press("%", (e) => e.pressPercentKey()),
                  },
                ]}
              />
              <KeyCol col={6}>
                <KeyStack blueBottom={HTML.deltaDYS}>
                  <CalcKey
                    labelHtml="EEX"
                    ariaLabel="EEX"
                    brightLabel
                    onPress={() => press("EEX", (e) => e.pressEex())}
                  />
                </KeyStack>
              </KeyCol>
              <KeyCol col={7}>
                <KeyStack blueBottom="D.MY">
                  <CalcKey
                    labelHtml="4"
                    ariaLabel="4"
                    onPress={() => press("4", (e) => e.pressDigit("4"))}
                  />
                </KeyStack>
              </KeyCol>
              <KeyCol col={8}>
                <KeyStack blueBottom="M.DY">
                  <CalcKey
                    labelHtml="5"
                    ariaLabel="5"
                    onPress={() => press("5", (e) => e.pressDigit("5"))}
                  />
                </KeyStack>
              </KeyCol>
              <KeyCol col={9}>
                <KeyStack blueBottom={HTML.xBarW}>
                  <CalcKey
                    labelHtml="6"
                    ariaLabel="6"
                    onPress={() => press("6", (e) => e.pressDigit("6"))}
                  />
                </KeyStack>
              </KeyCol>
              <KeyCol col={10}>
                <KeyStack>
                  <CalcKey
                    labelHtml={HTML.times}
                    ariaLabel="multiply"
                    onPress={() => press("×", (e) => e.pressMultiplyKey())}
                  />
                </KeyStack>
              </KeyCol>
            </div>

            {/* Rows 3-4 */}
            <div className={`${GRID_10} grid-rows-2 gap-y-3 items-stretch`}>
              <KeyCol col={1} row={1}>
                <KeyStack goldTop="P/R" blueBottom="PSE">
                  <CalcKey labelHtml="R/S" ariaLabel="R/S" disabled brightLabel />
                </KeyStack>
              </KeyCol>
              <BracketGroup
                col={2}
                colSpan={5}
                row={1}
                gridColumns={5}
                bracket={
                  <FaceBracket
                    title="CLEAR"
                    subLabels={[
                      HTML.sigma,
                      "PRGM",
                      "FIN",
                      "REG",
                    ]}
                    sublabelColumns={5}
                  />
                }
                keys={[
                  {
                    labelHtml: "SST",
                    ariaLabel: "SST",
                    blueBottom: "BST",
                    brightLabel: true,
                    onPress: () => press("SST", (e) => e.pressSst()),
                  },
                  {
                    labelHtml: HTML.rDown,
                    ariaLabel: "R down",
                    blueBottom: "GTO",
                    onPress: () => press("R↓", (e) => e.rollDown()),
                  },
                  {
                    labelHtml: HTML.xSwapY,
                    ariaLabel: "x swap y",
                    blueBottom: HTML.xLeY,
                    onPress: () => press("x↔y", (e) => e.swapXy()),
                  },
                  {
                    labelHtml: "CLx",
                    ariaLabel: "CLx",
                    blueBottom: "x=0",
                    onPress: () => press("CLx", (e) => e.clx()),
                  },
                ]}
              />
              <KeyCol col={7} row={1}>
                <KeyStack blueBottom={HTML.xBarR}>
                  <CalcKey
                    labelHtml="1"
                    ariaLabel="1"
                    onPress={() => press("1", (e) => e.pressDigit("1"))}
                  />
                </KeyStack>
              </KeyCol>
              <KeyCol col={8} row={1}>
                <KeyStack blueBottom="yr">
                  <CalcKey
                    labelHtml="2"
                    ariaLabel="2"
                    onPress={() => press("2", (e) => e.pressDigit("2"))}
                  />
                </KeyStack>
              </KeyCol>
              <KeyCol col={9} row={1}>
                <KeyStack blueBottom="n!">
                  <CalcKey
                    labelHtml="3"
                    ariaLabel="3"
                    onPress={() => press("3", (e) => e.pressDigit("3"))}
                  />
                </KeyStack>
              </KeyCol>
              <KeyCol col={10} row={1}>
                <KeyStack>
                  <CalcKey
                    labelHtml="-"
                    ariaLabel="subtract"
                    onPress={() => press("−", (e) => e.pressSubtractKey())}
                  />
                </KeyStack>
              </KeyCol>

              <KeyCol col={1} row={2}>
                <KeyStack>
                  <CalcKey labelHtml="ON" ariaLabel="ON" onPress={togglePower} />
                </KeyStack>
              </KeyCol>
              <KeyCol col={2} row={2}>
                <KeyStack>
                  <CalcKey
                    labelHtml="f"
                    ariaLabel="f"
                    variant="f"
                    onPress={() =>
                      press("f", (e) => {
                        e.fShift = !e.fShift;
                        if (e.fShift) e.gShift = false;
                      })
                    }
                  />
                </KeyStack>
              </KeyCol>
              <KeyCol col={3} row={2}>
                <KeyStack>
                  <CalcKey
                    labelHtml="g"
                    ariaLabel="g"
                    variant="g"
                    onPress={() =>
                      press("g", (e) => {
                        e.gShift = !e.gShift;
                        if (e.gShift) e.fShift = false;
                      })
                    }
                  />
                </KeyStack>
              </KeyCol>
              <KeyCol col={4} row={2}>
                <KeyStack>
                  <CalcKey
                    labelHtml="STO"
                    ariaLabel="STO"
                    onPress={() => press("STO", (e) => e.pressSto())}
                  />
                </KeyStack>
              </KeyCol>
              <KeyCol col={5} row={2}>
                <KeyStack>
                  <CalcKey
                    labelHtml="RCL"
                    ariaLabel="RCL"
                    onPress={() => press("RCL", (e) => e.pressRcl())}
                  />
                </KeyStack>
              </KeyCol>
              <KeyCol col={7} row={2}>
                <KeyStack blueBottom={HTML.xBar}>
                  <CalcKey
                    labelHtml="0"
                    ariaLabel="0"
                    onPress={() => press("0", (e) => e.pressDigit("0"))}
                  />
                </KeyStack>
              </KeyCol>
              <KeyCol col={8} row={2}>
                <KeyStack blueBottom="s">
                  <CalcKey
                    labelHtml="."
                    ariaLabel="."
                    onPress={() => press(".", (e) => e.pressDecimal())}
                  />
                </KeyStack>
              </KeyCol>
              <KeyCol col={9} row={2}>
                <KeyStack blueBottom={HTML.sigmaMinus}>
                  <CalcKey
                    labelHtml={HTML.sigmaPlus}
                    ariaLabel="sigma plus"
                    onPress={() => press("Σ+", (e) => e.pressSigmaKey())}
                  />
                </KeyStack>
              </KeyCol>
              <KeyCol col={10} row={2}>
                <KeyStack>
                  <CalcKey
                    labelHtml="+"
                    ariaLabel="add"
                    onPress={() => press("+", (e) => e.add())}
                  />
                </KeyStack>
              </KeyCol>

              <KeyCol col={6} row={1} rowSpan={2} className="flex h-full flex-col">
                <KeyStack goldTop="PREFIX" blueBottom="LSTx" tall className="h-full">
                  <CalcKey
                    labelHtml=""
                    variant="enter"
                    className="h-full min-h-0 flex-1"
                    onPress={() => press("ENTER", (e) => e.pressEnter())}
                  />
                </KeyStack>
              </KeyCol>
            </div>
          </div>
        </div>
            </div>
          </ScaledCalculatorShell>
        </div>
        {isLargeScreen ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <ActivityLog
              entries={logEntries}
              decimalPlaces={engine.decimalPlaces}
              onClear={clearLog}
            />
          </div>
        ) : null}
      </div>
      {!isLargeScreen ? (
        <MobileReferenceTabs active={mobileTab} onChange={setMobileTab} />
      ) : null}
      <div
        className={
          isLargeScreen
            ? "grid min-h-0 grid-cols-[minmax(300px,540px)_minmax(220px,280px)_minmax(300px,1fr)] gap-5 px-5 py-4 xl:gap-6 xl:px-8"
            : "flex min-h-0 flex-col overflow-hidden px-2 py-2"
        }
        style={{ background: "#ECF1F2" }}
      >
        {isLargeScreen ? (
          <>
            <div className="flex min-h-0 min-w-0 flex-col">
              <HelpPanel />
            </div>
            <div className="flex min-h-0 min-w-0 flex-col">
              <RegistersPanel snapshot={engineSnapshot} />
            </div>
            <div className="flex min-h-0 min-w-0 flex-col">
              <CalculatorFootnotes />
            </div>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {mobileTab === "log" ? (
              <ActivityLog
                entries={logEntries}
                decimalPlaces={engine.decimalPlaces}
                onClear={clearLog}
              />
            ) : null}
            {mobileTab === "registers" ? (
              <RegistersPanel snapshot={engineSnapshot} />
            ) : null}
            {mobileTab === "help" ? <HelpPanel /> : null}
            {mobileTab === "about" ? <CalculatorFootnotes /> : null}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
