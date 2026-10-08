import { ToggleButton, ToggleButtonGroup } from "@mui/material";

import s from "./index.module.css";

interface SegmentedProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  // What is chosen, for screen readers
  label: string;
}

// A short choice of two or three options, quiet until chosen like the
// period selector. Longer lists use a Select.
export default function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: SegmentedProps<T>) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      className={s.segmented}
      value={value}
      onChange={(_, next: T | null) => next !== null && onChange(next)}
      aria-label={label}>
      {options.map((option) => (
        <ToggleButton key={option.value} value={option.value}>
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
