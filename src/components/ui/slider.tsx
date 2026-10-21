type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
};

export function Slider({ label, value, min, max, disabled, onChange }: SliderProps) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-2 text-sm text-muted">
      <span className="flex items-center justify-between gap-3">
        <span>{label}</span>
        <span className="font-mono text-base text-ink">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
