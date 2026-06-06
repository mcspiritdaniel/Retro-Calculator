export type HelpRecipe = {
  id: string;
  title: string;
  keywords: string[];
  summary: string;
  steps: string[];
};

/** Curated keystroke workflows — keyword-matched, not LLM-generated. */
export const HELP_RECIPES: HelpRecipe[] = [
  {
    id: "npv",
    title: "Net present value (NPV)",
    keywords: [
      "npv",
      "net present value",
      "present value of cash flows",
      "discount cash flows",
    ],
    summary:
      "Enter cash flows, store the discount rate in i, then compute NPV.",
    steps: [
      "Enter the discount rate (percent), then press i.",
      "Enter CF₀, press g PV (CFo).",
      "Enter each later cash flow, press g PMT (CFj).",
      "Optional: enter a repeat count, press g FV (Nj) for grouped flows.",
      "Press f PV to compute NPV — result appears in X.",
    ],
  },
  {
    id: "irr",
    title: "Internal rate of return (IRR)",
    keywords: [
      "irr",
      "internal rate of return",
      "yield on cash flows",
      "rate of return",
    ],
    summary: "Enter cash flows, then compute IRR.",
    steps: [
      "Enter CF₀, press g PV (CFo).",
      "Enter each later cash flow, press g PMT (CFj).",
      "Optional: enter a repeat count, press g FV (Nj).",
      "Optional: enter a guess in i (helps convergence).",
      "Press f FV to compute IRR — result in X and i.",
    ],
  },
  {
    id: "cash-flows",
    title: "Enter cash flows",
    keywords: [
      "cash flow",
      "cash flows",
      "cf0",
      "cfj",
      "enter flows",
      "store cash flow",
    ],
    summary: "Load the cash-flow registers before NPV or IRR.",
    steps: [
      "Enter amount, press g PV — stores CF₀ (clears prior flows).",
      "Enter next amount, press g PMT — appends CFj.",
      "Repeat for each distinct amount.",
      "Optional: enter count, press g FV — sets Nj for the last flow.",
      "Press f x↔y (FIN) to clear financial and cash-flow registers.",
    ],
  },
  {
    id: "tvm-solve",
    title: "Time-value of money (solve for unknown)",
    keywords: [
      "tvm",
      "time value",
      "loan",
      "mortgage",
      "payment",
      "interest rate",
      "periods",
      "solve tvm",
      "pmt",
      "present value",
      "future value",
    ],
    summary:
      "Store known TVM values in their registers; leave the unknown at 0, then press its key.",
    steps: [
      "Enter each known value, then its register key: n, i, PV, PMT, or FV.",
      "Use CHS for negative cash flows (outflows).",
      "Leave the unknown register at 0.",
      "Press the unknown register key — solved value appears in X.",
      "Optional: g 7 (BEG) or g 8 (END) for payment timing.",
    ],
  },
  {
    id: "amort",
    title: "Amortize a loan payment",
    keywords: [
      "amort",
      "amortization",
      "amortize",
      "loan balance",
      "principal",
      "interest portion",
    ],
    summary:
      "After TVM values are set, amortize one period at a time with f n.",
    steps: [
      "Set up the loan in n, i, PV, PMT (and FV if needed).",
      "Enter the period number in X.",
      "Press f n (AMORT) — interest portion in X, principal in Y.",
      "Press x↔y to view principal; remaining balance updates in PV.",
    ],
  },
  {
    id: "bond-price",
    title: "Bond price from yield",
    keywords: [
      "bond price",
      "price bond",
      "bond",
      "clean price",
      "yield to price",
      "treasury price",
    ],
    summary:
      "Store yield, coupon, settlement, and maturity; compute clean price.",
    steps: [
      "Set date format: g 4 (D.MY) or g 5 (M.DY). Dates use one decimal only.",
      "Enter yield (%), press i.",
      "Enter annual coupon (%), press PMT.",
      "Enter settlement date, press ENTER, enter maturity date.",
      "Press f y^x (PRICE) — clean price in X, accrued in Y.",
      "Press x↔y to view accrued interest; dirty price ≈ X + Y.",
    ],
  },
  {
    id: "bond-ytm",
    title: "Bond yield (YTM) from price",
    keywords: [
      "bond ytm",
      "yield to maturity",
      "ytm",
      "bond yield",
      "price to yield",
    ],
    summary: "Store clean price, coupon, and dates; solve yield to maturity.",
    steps: [
      "Set date format: g 4 (D.MY) or g 5 (M.DY).",
      "Enter clean price, press PV.",
      "Enter annual coupon (%), press PMT.",
      "Enter settlement date, press ENTER, enter maturity date.",
      "Press f 1/x (YTM) — yield in X and i; accrued in Y.",
    ],
  },
  {
    id: "date",
    title: "Calendar date (DATE)",
    keywords: [
      "date",
      "calendar",
      "add days",
      "days from date",
      "what date",
    ],
    summary: "Add or subtract days from a calendar date.",
    steps: [
      "Set format: g 4 (D.MY) or g 5 (M.DY).",
      "Enter base date (e.g. 14.052004 for 14 May 2004 in D.MY).",
      "Press ENTER, enter day count (use CHS for subtract).",
      "Press g CHS (DATE) — result date in X; weekday in Y.",
    ],
  },
  {
    id: "delta-days",
    title: "Days between dates (ΔDYS)",
    keywords: [
      "delta days",
      "days between",
      "day count",
      "30/360",
      "actual days",
      "dys",
    ],
    summary: "Actual/actual day count; x↔y shows 30/360.",
    steps: [
      "Set format: g 4 (D.MY) or g 5 (M.DY).",
      "Enter earlier date, press ENTER, enter later date.",
      "Press g EEX (ΔDYS) — actual days in X, 30/360 in Y.",
      "Press x↔y to swap between day counts.",
    ],
  },
  {
    id: "depreciation-sl",
    title: "Straight-line depreciation (SL)",
    keywords: [
      "straight line",
      "straight-line",
      "sl depreciation",
      "depreciation sl",
    ],
    summary: "Depreciation for one year using straight-line method.",
    steps: [
      "Enter cost, press PV.",
      "Enter salvage, press FV.",
      "Enter life (years), press n.",
      "Enter year number, press X (via stack).",
      "Press f %T — depreciation in X; x↔y shows remaining value.",
    ],
  },
  {
    id: "depreciation-soyd",
    title: "Sum-of-years-digits depreciation (SOYD)",
    keywords: [
      "soyd",
      "sum of years",
      "sum-of-years",
      "synd",
      "depreciation soyd",
    ],
    summary: "Depreciation for one year using sum-of-years-digits.",
    steps: [
      "Enter cost, press PV.",
      "Enter salvage, press FV.",
      "Enter life (years), press n.",
      "Enter year number in X.",
      "Press f Δ% — depreciation in X; x↔y for remaining value.",
    ],
  },
  {
    id: "depreciation-db",
    title: "Declining-balance depreciation (DB)",
    keywords: [
      "declining balance",
      "db depreciation",
      "double declining",
      "depreciation db",
    ],
    summary: "Depreciation for one year using declining-balance.",
    steps: [
      "Enter cost, press PV.",
      "Enter salvage, press FV.",
      "Enter life (years), press n.",
      "Enter factor × 100 in i (e.g. 200 for double-declining).",
      "Enter year number in X.",
      "Press f % — depreciation in X; x↔y for remaining value.",
    ],
  },
  {
    id: "simple-interest",
    title: "Simple interest (360-day year)",
    keywords: ["simple interest", "interest amount", "360 day", "int"],
    summary: "Interest = |PV| × i × n / 360 with i as annual percent.",
    steps: [
      "Enter days, press n.",
      "Enter rate (%), press i.",
      "Enter principal, press PV (CHS if outflow).",
      "Press f i (INT) — 360-day interest in X; |PV| kept in Y.",
      "Press + for total amount (principal plus interest).",
      "Optional: press R↓, then x↔y for 365-day interest before +.",
    ],
  },
  {
    id: "linear-regression",
    title: "Linear regression (forecast ŷ or x̂)",
    keywords: [
      "regression",
      "linear regression",
      "forecast",
      "predict",
      "correlation",
      "least squares",
      "y hat",
      "x hat",
    ],
    summary: "Accumulate (y, x) pairs with Σ+, then forecast.",
    steps: [
      "Optional: f SST to clear statistics.",
      "Enter y, press ENTER, enter x, press Σ+ — repeat for each pair.",
      "Enter x value, press g × (ŷ) — forecast y in X; sample size in Y.",
      "Enter y value, press g − (x̂) — forecast x in X.",
      "After g ×, press x↔y for correlation r; g 0 / g 2 for means.",
    ],
  },
  {
    id: "statistics",
    title: "Statistics (mean and standard deviation)",
    keywords: [
      "statistics",
      "standard deviation",
      "mean",
      "average",
      "sx",
      "sy",
      "sigma",
    ],
    summary: "Summarize data entered with Σ+.",
    steps: [
      "Enter y, press ENTER, enter x, press Σ+ for each pair.",
      "Press g 0 for mean of x (x̄); g 2 for mean of y (ȳ).",
      "Press g . for sample sx; press g . again (or x↔y) for sy.",
      "Press g 1 for correlation r after a forecast.",
    ],
  },
  {
    id: "factorial",
    title: "Factorial (n!)",
    keywords: ["factorial", "n factorial", "n!", "factorial"],
    summary: "Integer factorial for 0–69.",
    steps: [
      "Enter a non-negative integer in X.",
      "Press g 3 — result in X (overflow at 70+).",
    ],
  },
  {
    id: "prefix",
    title: "Review entry (PREFIX)",
    keywords: [
      "prefix",
      "full precision",
      "mantissa",
      "all digits",
      "entry review",
    ],
    summary: "Show the full mantissa of X (web: stays until next operation).",
    steps: [
      "With the value in X, press f ENTER (PREFIX).",
      "LCD shows all significant digits until the next keystroke.",
    ],
  },
  {
    id: "clear-fin",
    title: "Clear financial registers (FIN)",
    keywords: [
      "clear fin",
      "clear financial",
      "reset tvm",
      "clear cash flows",
      "fin",
    ],
    summary: "Clear TVM registers and cash-flow data.",
    steps: ["Press f x↔y (FIN) — clears n, i, PV, PMT, FV, and cash flows."],
  },
];

/** Short RPN primer — always shown on the help home view. */
export const RPN_BASICS = {
  title: "RPN basics",
  summary:
    "This calculator uses reverse Polish notation: you enter numbers first, then the operation.",
  steps: [
    "X is the display register; Y, Z, and T sit above it on the stack.",
    "ENTER lifts the stack — it copies X into Y so you can enter another number.",
    "Example: 2 ENTER 3 + puts 5 in X (computes Y + X).",
    "Use CHS to make a number negative before storing it in a register.",
  ],
} as const;

/** Short list shown as quick links when the search box is empty. */
export const HELP_FEATURED_IDS = [
  "npv",
  "irr",
  "tvm-solve",
  "bond-price",
  "bond-ytm",
  "date",
  "delta-days",
  "linear-regression",
] as const;

export function getHelpRecipeById(id: string): HelpRecipe | undefined {
  return HELP_RECIPES.find((recipe) => recipe.id === id);
}
