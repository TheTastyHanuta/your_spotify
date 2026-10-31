import { Skeleton } from "@mui/material";
import clsx from "clsx";
import { useState } from "react";
import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import Section from "../../../components/Section";
import StatStrip, { formatDelta } from "../../../components/StatStrip";
import Text from "../../../components/Text";
import ChartTooltip from "../../../components/Tooltip";
import {
  api,
  SpotifyUsageResponse,
  UsageSource,
} from "../../../services/apis/api";
import { DateFormatter } from "../../../services/date";
import { useAPI } from "../../../services/hooks/hooks";
import { ShareRow } from "../../Taste/rows";

import s from "./index.module.css";

type Range = "hours" | "days" | "weeks";
const RANGES: { value: Range; label: string }[] = [
  { value: "hours", label: "48 hours" },
  { value: "days", label: "30 days" },
  { value: "weeks", label: "12 weeks" },
];

const SOURCES: { source: UsageSource; label: string; title: string }[] = [
  {
    source: "polling",
    label: "Polling",
    title: "Recently played, fetched for every user every 2 minutes",
  },
  { source: "import", label: "Imports", title: "Spotify data-export imports" },
  {
    source: "isrc",
    label: "ISRC lookups",
    title: "Lookups for merging duplicate songs (Settings, Admin)",
  },
  {
    source: "auth",
    label: "Logins, tokens",
    title: "Logins and access-token refreshes",
  },
  { source: "other", label: "Other", title: "Playlists, player and the rest" },
];

const num = (value: number) => (
  <span className="num">{value.toLocaleString()}</span>
);

interface Point {
  // Unique per bar: hour labels repeat over 48 hours, and recharts matches
  // the tooltip to the first bar with the same axis value
  key: string;
  x: string;
  label: string;
  y: number;
  limited: number;
}

// Days arrive as local dates ("2026-10-29"), read them as such
const dayDate = (day: string) => new Date(`${day}T12:00:00Z`);
const dayLabel = (day: string) =>
  new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(dayDate(day));

function points(usage: SpotifyUsageResponse, range: Range): Point[] {
  if (range === "hours") {
    const hour = new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: usage.timeZone,
    });
    const long = new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: usage.timeZone,
    });
    return usage.hourly.map((h) => ({
      key: String(h.hour),
      x: hour.format(h.hour),
      label: long.format(h.hour),
      y: h.total,
      limited: h.limited,
    }));
  }
  if (range === "days") {
    return usage.daily.map((d) => ({
      key: d.day,
      x: dayLabel(d.day),
      label: DateFormatter.toWeekdayDayMonthYear(dayDate(d.day)),
      y: d.total,
      limited: d.limited,
    }));
  }
  return usage.weekly.map((w) => ({
    key: w.from,
    x: dayLabel(w.to),
    label: `${dayLabel(w.from)} – ${dayLabel(w.to)}`,
    y: w.total,
    limited: w.limited,
  }));
}

// A dot above the bars of periods with a rate limit
function LimitMark(props: {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  value?: unknown;
}) {
  if (!props.value) {
    return null;
  }
  const x = Number(props.x) + Number(props.width) / 2;
  return <circle cx={x} cy={Number(props.y) - 7} r={3} className={s.mark} />;
}

function Verdict({ usage }: { usage: SpotifyUsageResponse }) {
  const reasons: string[] = [];
  if (usage.bans7d > 0) {
    reasons.push(
      "Spotify blocked all requests for a while in the last 7 days.",
    );
  }
  if (usage.retried24h > 0) {
    reasons.push(
      `Spotify asked the server to slow down ${usage.retried24h.toLocaleString()} ${usage.retried24h === 1 ? "time" : "times"} in the last 24 hours, the requests were retried.`,
    );
  }
  if (usage.errors24h >= 10) {
    reasons.push(
      `${usage.errors24h.toLocaleString()} requests failed with a Spotify server error or a timeout in the last 24 hours.`,
    );
  }

  let title = "All fine";
  let text: string;
  if (usage.verdict === "blocked" && usage.block) {
    title = "Blocked";
    const until = DateFormatter.toDateTime(new Date(usage.block.until));
    text = `${
      usage.block.kind === "quota"
        ? `The request quota of the Spotify app is used up, Spotify is blocking requests until ${until}.`
        : `Spotify is blocking requests until ${until}.`
    } Polling, imports and lookups continue on their own afterwards.`;
  } else if (usage.verdict === "watch") {
    title = "Watch";
    text = reasons.join(" ");
  } else if (!usage.counted) {
    text = "No requests to Spotify counted yet.";
  } else {
    text =
      usage.limited7d === 0
        ? "No rate limits in the last 7 days."
        : "No rate limits in the last 24 hours.";
  }

  return (
    <div className={s.verdict} role="status">
      <h2 className={clsx(s.verdictTitle, usage.verdict !== "fine" && s.warn)}>
        {title}
      </h2>
      <Text size="normal" greyed>
        {text}
      </Text>
    </div>
  );
}

const usualNote = (cell: SpotifyUsageResponse["lastHour"], what: string) => {
  const delta = formatDelta(cell.usual ?? undefined, cell.value);
  if (delta === null) {
    return undefined;
  }
  return (
    <>
      <span className="num">
        {delta > 0 ? "+" : delta < 0 ? "−" : "±"}
        {Math.abs(delta)}%
      </span>{" "}
      vs usual {what}
    </>
  );
};

export default function SpotifyUsage() {
  const usage = useAPI(api.spotifyUsage);
  const [range, setRange] = useState<Range>("hours");

  if (!usage) {
    return (
      <div className={s.loading}>
        <Skeleton height={56} />
        <Skeleton variant="rectangular" height={300} />
      </div>
    );
  }

  const data = points(usage, range);
  const ticks = new Map(data.map((p) => [p.key, p.x]));
  const busiest = data.reduce<Point | undefined>(
    (best, p) => (p.y > (best?.y ?? 0) ? p : best),
    undefined,
  );
  const sourcesTotal = Object.values(usage.sources7d).reduce(
    (a, b) => a + (b ?? 0),
    0,
  );
  const busiestName = { hours: "hour", days: "day", weeks: "week" }[range];

  return (
    <div>
      <Verdict usage={usage} />
      <StatStrip
        stats={[
          {
            label: "Last full hour",
            value: usage.lastHour.value.toLocaleString(),
            note: usualNote(usage.lastHour, "hour"),
          },
          {
            label: "Last 24 hours",
            value: usage.last24h.value.toLocaleString(),
            note: usualNote(usage.last24h, "day"),
          },
          {
            label: "Last 7 days",
            value: usage.last7d.value.toLocaleString(),
            note: usualNote(usage.last7d, "week"),
          },
          {
            label: "Rate limits, 7 days",
            value: usage.limited7d.toLocaleString(),
            note: usage.lastLimitedAt
              ? `last one ${DateFormatter.toDayMonthYear(new Date(usage.lastLimitedAt))}`
              : "none counted",
          },
        ]}
      />
      <div className={clsx("ruled-columns", s.work)}>
        <Section
          title="Requests"
          tabs={RANGES}
          tab={range}
          onTab={(value) => setRange(value as Range)}>
          <div className={s.chart}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 14, right: 24 }}>
                <XAxis
                  dataKey="key"
                  tickFormatter={(key: string) => ticks.get(key) ?? key}
                  tickMargin={8}
                  minTickGap={16}
                />
                <YAxis width="auto" tickMargin={6} allowDecimals={false} />
                <RTooltip
                  wrapperStyle={{ zIndex: 10 }}
                  cursor={{ fill: "var(--line)" }}
                  content={
                    <ChartTooltip<Point[]>
                      title={(_, payload) => payload.label}
                      value={(payload) => (
                        <>
                          {num(payload.y)} requests
                          {payload.limited > 0 && (
                            <>, {num(payload.limited)} rate limited</>
                          )}
                        </>
                      )}
                    />
                  }
                />
                <Bar dataKey="y" fill="var(--tint)" isAnimationActive={false}>
                  <LabelList dataKey="limited" content={LimitMark} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Text element="p" size="normal" greyed className={s.note}>
            {busiest && (
              <>
                Busiest {busiestName}: {busiest.label}, {num(busiest.y)}{" "}
                requests.{" "}
              </>
            )}
            A dot above a bar marks rate limits in it. Times are in{" "}
            {usage.timeZone}.
          </Text>
        </Section>
        <Section title="By source" info="The last 7 days">
          {sourcesTotal === 0 ? (
            <Text size="normal" greyed>
              No requests in the last 7 days.
            </Text>
          ) : (
            SOURCES.map(({ source, label, title }) => {
              const count = usage.sources7d[source] ?? 0;
              return (
                <ShareRow
                  key={source}
                  label={label}
                  title={title}
                  share={(count / sourcesTotal) * 100}
                  right={
                    <Text size="normal" greyed className={clsx("num", s.count)}>
                      {count.toLocaleString()}
                    </Text>
                  }
                />
              );
            })
          )}
          <Text element="p" size="normal" greyed className={s.note}>
            Spotify does not publish its limits. Its development-mode quota is
            shared by all apps of the same Spotify developer account, and their
            requests are not counted here.
          </Text>
        </Section>
      </div>
    </div>
  );
}
