import { differenceInMonths } from "date-fns";
import { useSelector } from "react-redux";
import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import Section, { ChartSkeleton } from "../../components/Section";
import StatStrip from "../../components/StatStrip";
import Text from "../../components/Text";
import ChartTooltip from "../../components/Tooltip";
import { api, HookSummaryResponse } from "../../services/apis/api";
import { DateFormatter } from "../../services/date";
import { useAPI } from "../../services/hooks/hooks";
import { selectRawIntervalDetail } from "../../services/redux/modules/user/selector";
import { percent } from "../../services/tools";

import s from "./index.module.css";

const TITLE = "How you get hooked";
const SERIES = { newFinds: "New finds", clickedLate: "Clicked late" };

// Every month (or year) from the first hook to the last, with the steps
// without hooks at 0
const fillSteps = (steps: HookSummaryResponse["perStep"]) => {
  const first = steps[0]?._id;
  const last = steps.at(-1)?._id;
  if (!first || !last) {
    return [];
  }
  const byKey = new Map(steps.map((step) => [key(step._id), step]));
  const rows = [];
  let { year, month } = first;
  while (
    year < last.year ||
    (year === last.year && (month ?? 0) <= (last.month ?? 0))
  ) {
    const id = month === undefined ? { year } : { year, month };
    const step = byKey.get(key(id));
    rows.push({
      label:
        month === undefined
          ? String(year)
          : DateFormatter.toShortMonthYear(new Date(year, month - 1, 1)),
      newFinds: step?.newFinds ?? 0,
      clickedLate: step?.clickedLate ?? 0,
    });
    if (month === undefined) {
      year += 1;
    } else {
      month = month === 12 ? 1 : month + 1;
      year += month === 1 ? 1 : 0;
    }
  }
  return rows;
};
const key = (id: { year: number; month?: number }) => `${id.year}-${id.month}`;

// The period's hooks as numbers, and how many there were per month or year
export default function HowYouGetHooked() {
  const { interval } = useSelector(selectRawIntervalDetail);
  const step =
    differenceInMonths(interval.end, interval.start) > 24 ? "year" : "month";
  const summary = useAPI(
    api.getHookSummary,
    interval.start,
    interval.end,
    step,
  );

  if (!summary) {
    return <ChartSkeleton title={TITLE} />;
  }
  const data = fillSteps(summary.perStep);

  return (
    <Section
      title={TITLE}
      info="A song hooks you when it suddenly gets at least 6 plays in 7 days, four times your usual for it. Clicked late: you had known it for 2 months or more"
      link={
        summary.hooks > 0
          ? { to: "/discoveries/hooked", label: "See the songs" }
          : undefined
      }>
      {summary.hooks === 0 ? (
        <Text size="normal" greyed>
          No song hooked you in this period.
        </Text>
      ) : (
        <>
          <div className={s.hookStrip}>
            <StatStrip
              stats={[
                {
                  label: "Hooks",
                  value: summary.hooks.toLocaleString(),
                  note: "Songs that suddenly took over",
                },
                {
                  label: "Clicked late",
                  value: `${percent(summary.clickedLate, summary.hooks)}%`,
                  note: "Known 2 months or more before",
                },
                {
                  label: "Hooked for",
                  value: `${(summary.averageWeeks ?? 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} wk`,
                  note: "On average",
                },
                {
                  label: "Still there",
                  value:
                    summary.yearLater.counted > 0
                      ? `${percent(summary.yearLater.kept, summary.yearLater.counted)}%`
                      : "—",
                  note:
                    summary.yearLater.counted > 0
                      ? "Played again a year later"
                      : "Too early to tell",
                },
              ]}
            />
          </div>
          {data.length > 1 && (
            <div className={s.chart}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <XAxis dataKey="label" minTickGap={16} />
                  <YAxis width="auto" allowDecimals={false} />
                  <RTooltip
                    wrapperStyle={{ zIndex: 10 }}
                    content={
                      <ChartTooltip<typeof data>
                        title={(_, row) => row.label}
                        value={(_, value, root) =>
                          `${value.toLocaleString()} ${SERIES[root.dataKey as keyof typeof SERIES].toLowerCase()}`
                        }
                      />
                    }
                  />
                  <Legend
                    formatter={(value: string) => (
                      <span className={s.legendText}>{value}</span>
                    )}
                    itemSorter={null}
                  />
                  <Bar
                    dataKey="newFinds"
                    name={SERIES.newFinds}
                    stackId="hooks"
                    fill="var(--tint)"
                    maxBarSize={48}
                  />
                  <Bar
                    dataKey="clickedLate"
                    name={SERIES.clickedLate}
                    stackId="hooks"
                    fill="color-mix(in oklab, var(--tint) 45%, var(--bg))"
                    maxBarSize={48}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </Section>
  );
}
