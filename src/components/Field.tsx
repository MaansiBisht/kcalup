/** The three form primitives shared by login, onboarding and account. */

export function Field({
  label,
  value,
  onChange,
  ...input
}: {
  label: string
  value: string
  onChange: (v: string) => void
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      <input
        {...input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-tile border border-hairline bg-paper px-4 py-3 text-[0.9375rem] text-ink focus:border-forest focus:outline-none"
      />
    </label>
  )
}

export function MacroInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[0.6875rem] font-medium text-muted">{label} (g)</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-tile border border-hairline bg-paper px-3 py-2.5 text-sm text-ink tabular-nums focus:border-forest focus:outline-none"
      />
    </label>
  )
}

/** Blank, negative and unparsable all mean "no goal set", not zero. */
export function optionalInt(raw: string): number | null {
  const n = Number(raw)
  return raw.trim() === '' || !Number.isFinite(n) || n < 0 ? null : Math.round(n)
}
