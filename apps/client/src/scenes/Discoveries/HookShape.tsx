import clsx from "clsx";

import { Hook } from "../../services/apis/api";
import { fromDay } from "../../services/date";

import s from "./index.module.css";

const BEFORE = 4;

// A hook's plays per week: the weeks before it faint, the hooked weeks in the
// tint, the weeks it stayed with you lighter. The row's text says the same.
export default function HookShape({ hook }: { hook: Hook }) {
  const max = Math.max(1, ...hook.shape);
  const stayedWeeks = hook.stayedUntil
    ? Math.round(
        (fromDay(hook.stayedUntil).getTime() - fromDay(hook.hook).getTime()) /
          (7 * 24 * 60 * 60 * 1000),
      )
    : hook.shape.length;
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
              week >= hook.weeks && week < stayedWeeks && s.stayed,
            )}
            style={{ height: `${Math.max(1, (plays / max) * 100)}%` }}
          />
        );
      })}
    </div>
  );
}
