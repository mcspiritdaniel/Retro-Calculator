import { CALCULATOR_OMISSIONS } from "@/lib/calculator-omissions";

export default function CalculatorFootnotes() {
  return (
    <section
      aria-label="About this web calculator"
      className="flex h-full min-h-0 w-full flex-col rounded-sm border border-[#d8d6d0] bg-white shadow-sm"
    >
      <div className="shrink-0 border-b border-[#eceae4] px-4 py-3">
        <h2 className="text-sm font-semibold tracking-wide text-[#222]">
          About this web calculator
        </h2>
        <p className="mt-0.5 text-xs text-[#666]">
          Disclaimer, behavior notes, and known omissions.
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-xs leading-relaxed text-[#555]">
        <div className="space-y-4">
          {CALCULATOR_OMISSIONS.map((section) => (
            <div key={section.heading}>
              <h3 className="text-xs font-semibold text-[#444]">
                {section.heading}
              </h3>
              <ul className="mt-2 space-y-2">
                {section.items.map((item) => (
                  <li key={item.title}>
                    <span className="font-medium text-[#333]">{item.title}.</span>{" "}
                    {item.detail}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
