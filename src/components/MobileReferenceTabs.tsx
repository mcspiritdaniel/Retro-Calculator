export type MobileReferenceTab = "log" | "registers" | "help" | "about";

const TABS: { id: MobileReferenceTab; label: string }[] = [
  { id: "log", label: "Log" },
  { id: "registers", label: "Registers" },
  { id: "help", label: "Help" },
  { id: "about", label: "About" },
];

type MobileReferenceTabsProps = {
  active: MobileReferenceTab;
  onChange: (tab: MobileReferenceTab) => void;
};

export default function MobileReferenceTabs({
  active,
  onChange,
}: MobileReferenceTabsProps) {
  return (
    <nav
      aria-label="Reference panels"
      className="flex shrink-0 gap-1 border-b border-[#d0d8da] bg-white px-2 py-2"
    >
      {TABS.map((tab) => {
        const isActive = active === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            aria-current={isActive ? "page" : undefined}
            onClick={() => onChange(tab.id)}
            className={`min-h-10 flex-1 rounded px-2 py-2 text-xs font-medium transition ${
              isActive
                ? "bg-[#eef2f3] text-[#222] ring-1 ring-[#88949a]"
                : "text-[#555] hover:bg-[#f4f7f8]"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
