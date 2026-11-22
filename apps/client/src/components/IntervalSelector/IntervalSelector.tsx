import {
  CalendarMonthOutlined,
  ChevronLeft,
  ChevronRight,
} from "@mui/icons-material";
import {
  Button,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import clsx from "clsx";
import { endOfDay, startOfDay } from "date-fns";
import { useState } from "react";
import { useSelector } from "react-redux";

import {
  DateFormatter,
  dayRange,
  getAppropriateTimesplitFromRange,
} from "../../services/date";
import {
  allIntervals,
  getAllIndexFromIntervalDetail,
  getRawIntervalDetail,
  IntervalDetail,
  presetAt,
  presetWithOffset,
} from "../../services/intervals";
import { selectUser } from "../../services/redux/modules/user/selector";
import Dialog from "../Dialog";
import RangePicker from "./RangePicker";
import { PeriodCalendar, Range } from "./RangePicker/RangePicker";

import seg from "../Segmented/index.module.css";
import s from "./index.module.css";

// Short names for the segmented control
const LABELS: Record<string, string> = {
  Today: "Day",
  "This week": "Week",
  "This month": "Month",
  "This year": "Year",
  All: "All time",
};

// Recent days and weeks by name, older ones by date
function periodLabel(
  value: IntervalDetail,
  { start, end }: { start: Date; end: Date },
  firstListen: Date | undefined,
) {
  if (value.type === "userbased") {
    return firstListen
      ? `Listening since ${DateFormatter.toDayMonthYear(firstListen)}`
      : "All time";
  }
  if (value.type === "custom") {
    return dayRange(start, end);
  }
  const offset = value.offset ?? 0;
  if (offset === 0) {
    return value.name;
  }
  switch (value.unit) {
    case "day":
      if (offset === -1) return "Yesterday";
      return DateFormatter.toWeekdayDayMonthYear(start);
    case "week":
      if (offset === -1) return "Last week";
      return dayRange(start, end);
    case "month":
      return start.getFullYear() === new Date().getFullYear()
        ? DateFormatter.toMonthString(start)
        : DateFormatter.toMonthStringYear(start);
    default:
      return String(start.getFullYear());
  }
}

interface IntervalSelectorProps {
  value: IntervalDetail;
  onChange: (newDetails: IntervalDetail) => void;
}

export function IntervalSelector({ value, onChange }: IntervalSelectorProps) {
  const user = useSelector(selectUser);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"period" | "range">("period");
  const [customIntervalDate, setCustomIntervalDate] = useState<Range>([
    undefined,
    undefined,
  ]);

  const existingInterval = getAllIndexFromIntervalDetail(value);
  const { interval } = getRawIntervalDetail(value, user ?? undefined);
  const firstListen = user ? new Date(user.firstListenedAt) : undefined;
  const label = periodLabel(value, interval, firstListen);

  const preset = value.type === "preset" ? value : undefined;
  const presetIndex = preset ? existingInterval : -1;
  const offset = preset?.offset ?? 0;
  const previous = preset && presetWithOffset(presetIndex, offset - 1);
  const canGoBack = Boolean(
    previous && !(firstListen && previous.interval.end < firstListen),
  );

  const openDialog = () => {
    setTab(preset ? "period" : "range");
    setCustomIntervalDate([
      startOfDay(interval.start),
      startOfDay(interval.end),
    ]);
    setOpen(true);
  };

  const internOnChange = (index: number) => {
    const picked = allIntervals[index];
    if (!picked) {
      return;
    }
    // The chosen one again goes back to now
    if (index === existingInterval) {
      onChange(picked);
      return;
    }
    // Keeps your place: last week becomes the month it ended in
    if (picked.type === "preset" && value.type !== "userbased") {
      const now = new Date();
      onChange(presetAt(index, interval.end < now ? interval.end : now));
      return;
    }
    onChange(picked);
  };

  const step = (amount: number) => {
    if (preset) {
      onChange(presetWithOffset(presetIndex, offset + amount));
    }
  };

  const setCustom = () => {
    const [start, end] = customIntervalDate;
    if (!start || !end) {
      return;
    }
    onChange({
      type: "custom",
      name: "custom",
      interval: {
        start: startOfDay(start),
        end: endOfDay(end),
        timesplit: getAppropriateTimesplitFromRange(start, end),
      },
    });
    setOpen(false);
  };

  return (
    <>
      <div className={s.root}>
        <ToggleButtonGroup
          exclusive
          size="small"
          className={clsx(seg.segmented, s.kinds)}
          value={existingInterval}
          // null when the chosen one is clicked again
          onChange={(_, index: number | null) =>
            internOnChange(index ?? existingInterval)
          }
          aria-label="Period">
          {allIntervals.map((inter, index) => (
            <ToggleButton key={inter.name} value={index}>
              {LABELS[inter.name] ?? inter.name}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <div className={s.bar}>
          {preset && (
            <button
              type="button"
              className={clsx("no-button", s.arrow)}
              aria-label={`Previous ${preset.unit}`}
              disabled={!canGoBack}
              onClick={() => step(-1)}>
              <ChevronLeft />
            </button>
          )}
          <button
            type="button"
            className={clsx("no-button", s.range)}
            title="Choose dates"
            onClick={openDialog}>
            <CalendarMonthOutlined className={s.icon} />
            {label}
          </button>
          {preset && (
            <button
              type="button"
              className={clsx("no-button", s.arrow)}
              aria-label={`Next ${preset.unit}`}
              disabled={offset >= 0}
              onClick={() => step(1)}>
              <ChevronRight />
            </button>
          )}
        </div>
      </div>
      <Dialog title="Choose dates" open={open} onClose={() => setOpen(false)}>
        <div className={s.dialogcontent}>
          {preset && (
            <Tabs value={tab} onChange={(_, t) => setTab(t)}>
              <Tab value="period" label={`Pick a ${preset.unit}`} />
              <Tab value="range" label="Custom range" />
            </Tabs>
          )}
          {preset && tab === "period" ? (
            <PeriodCalendar
              unit={preset.unit as "day" | "week" | "month" | "year"}
              value={interval.start}
              minDate={firstListen}
              onPick={(date) => {
                onChange(presetAt(presetIndex, date));
                setOpen(false);
              }}
            />
          ) : (
            <>
              <RangePicker
                value={customIntervalDate}
                onChange={setCustomIntervalDate}
              />
              <Button
                variant="contained"
                onClick={setCustom}
                disabled={!customIntervalDate[0] || !customIntervalDate[1]}>
                Apply
              </Button>
            </>
          )}
        </div>
      </Dialog>
    </>
  );
}
