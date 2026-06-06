import { CALCULATOR_OMISSIONS } from "@/lib/calculator-omissions";

export default function CalculatorFootnotes() {
  return (
    <footer className="w-full px-1 pb-8 pt-2 text-sm text-[#555]">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[#888]">
        About this web calculator
      </h2>
      <div className="mt-3 space-y-4">
        {CALCULATOR_OMISSIONS.map((section) => (
          <div key={section.heading}>
            <h3 className="text-xs font-medium text-[#666]">{section.heading}</h3>
            <ul className="mt-1.5 space-y-2">
              {section.items.map((item) => (
                <li key={item.title} className="leading-snug">
                  <span className="font-medium text-[#444]">{item.title}.</span>{" "}
                  {item.detail}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}
