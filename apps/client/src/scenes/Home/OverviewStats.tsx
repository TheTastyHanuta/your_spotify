import { useMemo } from "react";
import { useSelector } from "react-redux";

import StatStrip, { formatDelta } from "../../components/StatStrip";
import { api } from "../../services/apis/api";
import { useAPI } from "../../services/hooks/hooks";
import { selectRawIntervalDetail } from "../../services/redux/modules/user/selector";
import { formatHours, getLastPeriod } from "../../services/stats";

// The period's totals, each compared with the period just before it
export default function OverviewStats() {
  const { interval, unit } = useSelector(selectRawIntervalDetail);
  const now = useAPI(api.getOverview, interval.start, interval.end);
  // Stable dates, or the request below starts again on every render
  const last = useMemo(
    () => getLastPeriod(interval.start, interval.end, unit),
    [interval.start, interval.end, unit],
  );
  const old = useAPI(api.getOverview, last.start, last.end);

  const value = (
    n: number | undefined,
    format = (v: number) => v.toLocaleString(),
  ) => (n === undefined ? "—" : format(n));
  // An empty period has nothing to compare: no "▼ 100%"
  const delta = (pick: (o: NonNullable<typeof now>) => number) =>
    now && now.plays > 0
      ? formatDelta(old ? pick(old) : undefined, pick(now))
      : null;
  const note = (pick: (o: NonNullable<typeof now>) => number) =>
    delta(pick) === null ? undefined : `vs ${last.label}`;

  return (
    <StatStrip
      stats={[
        {
          label: "Plays",
          value: value(now?.plays),
          delta: delta((o) => o.plays),
          note: note((o) => o.plays),
        },
        {
          label: "Time listened",
          value: value(now?.durationMs, formatHours),
          delta: delta((o) => o.durationMs),
          note: note((o) => o.durationMs),
        },
        {
          label: "Artists",
          value: value(now?.artists),
          delta: delta((o) => o.artists),
          note: note((o) => o.artists),
        },
        {
          label: "New artists",
          value: value(now?.newArtists),
          delta: delta((o) => o.newArtists),
          note: note((o) => o.newArtists),
        },
      ]}
    />
  );
}
