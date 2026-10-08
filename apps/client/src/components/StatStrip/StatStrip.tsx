import { ArrowDropDown, ArrowDropUp } from "@mui/icons-material";
import clsx from "clsx";
import { ReactNode } from "react";

import s from "./index.module.css";

export interface Stat {
  label: string;
  value: ReactNode;
  // Change against the previous period in percent; null hides it
  delta?: number | null;
  note?: ReactNode;
}

// Without listens in the previous period there is nothing to compare with
export function formatDelta(old: number | undefined, now: number) {
  if (!old) {
    return null;
  }
  return Math.round(((now - old) / old) * 1000) / 10;
}

function Delta({ value }: { value: number }) {
  if (value === 0) {
    return <span className={s.flat}>±0%</span>;
  }
  const up = value > 0;
  return (
    <span className={clsx(s.delta, up ? s.up : s.down)}>
      {up ? (
        <ArrowDropUp fontSize="small" aria-label="up" />
      ) : (
        <ArrowDropDown fontSize="small" aria-label="down" />
      )}
      {Math.abs(value)}%
    </span>
  );
}

interface StatStripProps {
  stats: Stat[];
}

export default function StatStrip({ stats }: StatStripProps) {
  return (
    <div className={s.root}>
      {stats.map((stat) => (
        <div key={stat.label} className={s.stat}>
          <div className="label">{stat.label}</div>
          <div className={clsx("num", s.value)}>{stat.value}</div>
          {(typeof stat.delta === "number" || stat.note) && (
            <div className={clsx("num", s.sub)}>
              {typeof stat.delta === "number" && <Delta value={stat.delta} />}
              {stat.note && <span className={s.note}>{stat.note}</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
