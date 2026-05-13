export interface PercentageSlidersProps {
  groups: string[]
  values: number[]
  onChange: (values: number[]) => void
}

export function PercentageSliders({ groups, values, onChange }: PercentageSlidersProps) {
  const total = values.reduce((sum, value) => sum + value, 0)

  const updateValue = (index: number, value: number): void => {
    const nextValues = values.map((currentValue, currentIndex) =>
      currentIndex === index ? value : currentValue,
    )
    onChange(nextValues)
  }

  return (
    <div className="grid gap-3">
      {groups.map((group, index) => {
        const value = values[index] ?? 0
        const label = `${group}: ${String(value)}%`
        return (
          <label className="grid gap-1" key={group}>
            <span className="text-sm font-medium">{label}</span>
            <input
              aria-label={label}
              max={100}
              min={0}
              onChange={(event): void => {
                updateValue(index, Number(event.target.value))
              }}
              type="range"
              value={value}
            />
          </label>
        )
      })}
      <p className={total === 100 ? 'text-sm text-slate-700' : 'text-sm text-red-700'}>
        Total: {total}%
      </p>
    </div>
  )
}
