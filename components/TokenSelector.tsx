"use client";

export type TokenSelectorSymbol = "SOL" | "USDC";

export function TokenSelector(props: {
  selected: TokenSelectorSymbol;
  onChange: (token: TokenSelectorSymbol) => void;
}) {
  const { selected, onChange } = props;

  const base =
    "cursor-pointer rounded-[7px] px-4 py-[6px] text-[13px] font-medium transition-all duration-150";

  const selectedCls = "bg-[color:var(--color-accent)] text-white";
  const unselectedCls = "text-[color:var(--color-text-secondary)]";

  return (
    <div className="inline-flex rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-[3px]">
      <button
        type="button"
        onClick={() => onChange("SOL")}
        className={`${base} ${selected === "SOL" ? selectedCls : unselectedCls}`}
        aria-pressed={selected === "SOL"}
      >
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[color:var(--color-amber)]" />
          SOL
        </span>
      </button>
      <button
        type="button"
        onClick={() => onChange("USDC")}
        className={`${base} ${selected === "USDC" ? selectedCls : unselectedCls}`}
        aria-pressed={selected === "USDC"}
      >
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[color:var(--color-emerald)]" />
          USDC
        </span>
      </button>
    </div>
  );
}
