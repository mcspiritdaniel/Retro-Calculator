import type { ReactNode } from "react";
import { formatLogStackValue } from "@/lib/activity-log";
import type { RpnEngineSnapshot } from "@/lib/rpn-engine";

type RegistersPanelProps = {
  snapshot: RpnEngineSnapshot;
};

function RegisterRow({
  label,
  value,
  active,
}: {
  label: string;
  value: string;
  active?: boolean;
}) {
  return (
    <div className="grid grid-cols-[3.5rem_1fr] items-baseline gap-x-2">
      <span className="font-sans text-[11px] font-medium text-[#888]">
        {label}
      </span>
      <span
        className={`font-mono text-xs tabular-nums ${
          active ? "font-semibold text-[#222]" : "text-[#333]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function RegisterSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#999]">
        {title}
      </h3>
      <div className="mt-2 space-y-1">{children}</div>
    </div>
  );
}

function formatRegisterValue(value: number, decimalPlaces: number): string {
  return formatLogStackValue(value, decimalPlaces);
}

export default function RegistersPanel({ snapshot }: RegistersPanelProps) {
  const { stack, financial } = snapshot;
  const decimalPlaces = snapshot.decimalPlaces;
  const cashFlowCount = snapshot.cashFlows.length;
  const memoryPrefix = snapshot.memoryPrefix
    ? snapshot.memoryPrefix.toUpperCase()
    : "—";

  return (
    <section
      aria-label="Registers"
      className="flex h-full min-h-0 w-full flex-col rounded-sm border border-[#d8d6d0] bg-white shadow-sm"
    >
      <div className="shrink-0 border-b border-[#eceae4] px-4 py-3">
        <h2 className="text-sm font-semibold tracking-wide text-[#222]">
          Registers
        </h2>
        <p className="mt-0.5 text-xs text-[#666]">
          Stack, TVM, and mode — live from the calculator.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-4">
          <RegisterSection title="Stack">
            <RegisterRow
              label="T"
              value={formatRegisterValue(stack.t, decimalPlaces)}
            />
            <RegisterRow
              label="Z"
              value={formatRegisterValue(stack.z, decimalPlaces)}
            />
            <RegisterRow
              label="Y"
              value={formatRegisterValue(stack.y, decimalPlaces)}
            />
            <RegisterRow
              label="X"
              value={formatRegisterValue(stack.x, decimalPlaces)}
              active
            />
          </RegisterSection>

          <RegisterSection title="TVM">
            <RegisterRow
              label="n"
              value={formatRegisterValue(financial.n, decimalPlaces)}
            />
            <RegisterRow
              label="i"
              value={formatRegisterValue(financial.i, decimalPlaces)}
            />
            <RegisterRow
              label="PV"
              value={formatRegisterValue(financial.pv, decimalPlaces)}
            />
            <RegisterRow
              label="PMT"
              value={formatRegisterValue(financial.pmt, decimalPlaces)}
            />
            <RegisterRow
              label="FV"
              value={formatRegisterValue(financial.fv, decimalPlaces)}
            />
          </RegisterSection>

          <RegisterSection title="Mode">
            <RegisterRow
              label="Display"
              value={`FIX ${snapshot.decimalPlaces}`}
            />
            <RegisterRow
              label="Timing"
              value={snapshot.paymentMode === "beg" ? "BEG" : "END"}
            />
            <RegisterRow
              label="Dates"
              value={snapshot.dateFormat === "dmy" ? "D.MY" : "M.DY"}
            />
            <RegisterRow
              label="f"
              value={snapshot.fShift ? "ON" : "—"}
              active={snapshot.fShift}
            />
            <RegisterRow
              label="g"
              value={snapshot.gShift ? "ON" : "—"}
              active={snapshot.gShift}
            />
            <RegisterRow label="Prefix" value={memoryPrefix} />
            <RegisterRow label="CFs" value={String(cashFlowCount)} />
          </RegisterSection>
        </div>
      </div>
    </section>
  );
}
