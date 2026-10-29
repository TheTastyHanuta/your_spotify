import clsx from "clsx";

import { Hook } from "../../services/apis/api";

import s from "./index.module.css";

const BEFORE = 4;

// A hook's or comeback's plays per week: the weeks before it faint, its
// weeks in the tint
export default function HookShape({ hook }: { hook: Hook }) {
  const max = Math.max(1, ...hook.shape);
  return (
    <div className={s.shape} aria-hidden>
      {hook.shape.map((plays, i) => {
        const week = i - BEFORE;
        return (
          <i
            key={i}
            className={clsx(
              week < 0 && s.before,
              week >= 0 && week < hook.weeks && s.held,
            )}
            style={{ height: `${Math.max(1, (plays / max) * 100)}%` }}
          />
        );
      })}
    </div>
  );
}
