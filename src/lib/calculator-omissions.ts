export type OmissionItem = {
  title: string;
  detail: string;
};

export type OmissionSection = {
  heading: string;
  items: OmissionItem[];
};

/** About-panel copy: omissions, behavior notes, and project disclaimer. */
export const CALCULATOR_OMISSIONS: OmissionSection[] = [
  {
    heading: "Independent project",
    items: [
      {
        title: "Disclaimer",
        detail:
          "Educational reproduction of a classic RPN financial calculator layout and behavior. Not affiliated with, endorsed by, or sponsored by any calculator manufacturer. Provided as-is for learning — not intended for commercial or professional financial use.",
      },
    ],
  },
  {
    heading: "Not implemented",
    items: [
      {
        title: "Programming mode",
        detail:
          "R/S, P/R, PRGM, GTO, and step programming are unavailable. g MEM always shows 0.",
      },
      {
        title: "Population standard deviation",
        detail:
          "Sample sx and sy (g .) are supported. Population σ is not available.",
      },
    ],
  },
  {
    heading: "Display notes",
    items: [
      {
        title: "FIX and SCI",
        detail:
          "f + 0–9 sets fixed decimal places (FIX). f + . selects scientific notation (SCI) for committed values on the LCD.",
      },
      {
        title: "Auto-scientific",
        detail:
          "In FIX mode, very large or very small values still switch to scientific notation when they cannot fit the display.",
      },
    ],
  },
  {
    heading: "Cash-flow notes",
    items: [
      {
        title: "Registers R0–R9",
        detail:
          "After cash flows are entered, R0–R9 hold CF₀–CFⱼ amounts. RCL 1–6 recalls Σ statistics only when no cash flows are loaded.",
      },
      {
        title: "Editing flows",
        detail:
          "STO j updates CFⱼ. Store j in n, then enter a count and press g Nj to change Nⱼ. Reset n to the total CFⱼ count before f NPV or f IRR.",
      },
      {
        title: "Sequential review",
        detail:
          "Repeated RCL g Nj and RCL g CFj walks from the current j down to CF₀; RCL g CFj decrements j. Restore n when finished.",
      },
    ],
  },
  {
    heading: "Faceplate remapping",
    items: [
      {
        title: "12× and 12÷",
        detail:
          "Blue labels under n and i are ŷ and x̂ (linear regression), not months-per-year factors.",
      },
      {
        title: "√x and e^x",
        detail:
          "Under y^x and 1/x with g shift — not the bond keys (bond PRICE/YTM use f shift on those keys).",
      },
    ],
  },
  {
    heading: "TVM notes",
    items: [
      {
        title: "Solving for n",
        detail:
          "When the exact period count is fractional, n is rounded up to the next whole number. That is the total number of payments — full periods plus one smaller final payment. PMT and the other registers are not adjusted automatically; use FV or AMORT to work out the last payment if needed.",
      },
      {
        title: "Odd-period loans",
        detail:
          "Non-integer n uses HP odd-period TVM (INT(n) full periods plus a fractional odd period). STO EEX toggles the C annunciator for compound vs. simple interest on that fraction.",
      },
    ],
  },
  {
    heading: "Web behavior (vs. original hardware)",
    items: [
      {
        title: "f and g shifts",
        detail: "Toggle on/off until used or cleared — not momentary prefix keys.",
      },
      {
        title: "PREFIX display",
        detail: "Full mantissa stays visible until the next operation (not hold-to-show).",
      },
      {
        title: "DATE display",
        detail: "Calendar result stays on the LCD until the next operation.",
      },
      {
        title: "Date format keys",
        detail: "g D.MY and g M.DY also set the display to 6 decimal places for date entry.",
      },
    ],
  },
];
