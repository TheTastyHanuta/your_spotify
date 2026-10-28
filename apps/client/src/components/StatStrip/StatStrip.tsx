import { ArrowDropDown, ArrowDropUp } from "@mui/icons-material";
import clsx from "clsx";
import { ReactNode } from "react";

import s from "./index.module.css";

export interface Stat {
  label: string;
  value: ReactNode;
  // A smaller second value next to it, like "598 new"
  extra?: ReactNode;
  // Change against the previous period in percent; null hides it
  delta?: number | null;
  note?: ReactNode;
}

// The part of a total heard for the first time, like "598 new". Nothing when
// all of it is new, as over the whole history.
export function newOf(n: number | undefined, total: number | undefined) {
  if (n === undefined || !total || n >= total) {
    return undefined;
  }
  return (
    <>
      <span className="num">{n.toLocaleString()}</span> new
    </>
  );
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
  // Values are short answers in words, like "Night owl", with any number
  // inside them set in .num by the caller
  words?: boolean;
}

export default function StatStrip({ stats, words }: StatStripProps) {
  return (
    <div className={s.root}>
      {stats.map((stat) => (
        <div key={stat.label} className={s.stat}>
          <div className="label">{stat.label}</div>
          <div className={clsx(words ? s.word : "num", s.value)}>
            {stat.value}
            {stat.extra && <span className={s.extra}>{stat.extra}</span>}
          </div>
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
