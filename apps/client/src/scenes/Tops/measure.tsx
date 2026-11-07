import ArrowDownward from "@mui/icons-material/ArrowDownward";
import clsx from "clsx";
import { ReactNode } from "react";
import { useSelector } from "react-redux";

import { useParamTab } from "../../components/ListPage";
import Text from "../../components/Text";
import { selectStatMeasurement } from "../../services/redux/modules/user/selector";
import { User } from "../../services/redux/modules/user/types";
import { formatHours, msToDuration } from "../../services/stats";
import ShareCount from "./ShareCount";

import s from "./index.module.css";

export type TopSort = User["settings"]["metricUsed"];

const SORTS = ["number", "duration"] as const;
const LABELS = { number: "Plays", duration: "Time" };

// The charts' sort, kept in the URL (?sort=) once picked, and the stat
// measurement setting until then
export function useTopSort() {
  return useParamTab("sort", SORTS, useSelector(selectStatMeasurement));
}

interface SortButtonProps {
  sort: TopSort;
  current: TopSort;
  setSort: (sort: TopSort) => void;
  isMobile: boolean;
}

function SortButton({ sort, current, setSort, isMobile }: SortButtonProps) {
  const active = sort === current;
  const other = sort === "number" ? "duration" : "number";
  return (
    <button
      type="button"
      className={clsx(s.sort, active && s.sortActive)}
      // Phones show only the sorted column: its header switches to the other
      onClick={() => setSort(isMobile ? other : sort)}
      aria-pressed={isMobile ? undefined : active}
      aria-label={
        isMobile
          ? `${LABELS[sort]}, sort by ${LABELS[other].toLowerCase()}`
          : undefined
      }>
      {LABELS[sort]}
      {active && <ArrowDownward className={s.sortIcon} aria-hidden />}
    </button>
  );
}

// The Plays and Time header cells. Phones only have room for the sorted one.
export function sortHeaders(
  current: TopSort,
  setSort: (sort: TopSort) => void,
  isMobile: boolean,
) {
  const cell = (sort: TopSort) =>
    (!isMobile || sort === current) && (
      <div>
        <SortButton
          sort={sort}
          current={current}
          setSort={setSort}
          isMobile={isMobile}
        />
      </div>
    );
  return { count: cell("number"), total: cell("duration") };
}

interface MeasureValues {
  count: number;
  duration: number;
  totalCount: number;
  totalDuration: number;
  // The number one's value in the sorted measure
  max: number;
}

// The Plays and Time cells of a row: the sorted one gets the bar
export function measureCells(
  sort: TopSort,
  isMobile: boolean,
  { count, duration, totalCount, totalDuration, max }: MeasureValues,
) {
  const plain = (text: string) => (
    <Text element="div" size="normal" className="num">
      {text}
    </Text>
  );
  const plays = count.toLocaleString();
  const time = isMobile ? formatHours(duration) : msToDuration(duration);
  if (sort === "number") {
    return {
      count: (
        <ShareCount
          value={count}
          total={totalCount}
          max={max}
          label={plays}
          of="plays"
        />
      ),
      total: !isMobile && plain(time),
    };
  }
  return {
    count: !isMobile && plain(plays),
    total: (
      <ShareCount
        value={duration}
        total={totalDuration}
        max={max}
        label={time}
        of="listening time"
      />
    ),
  };
}

// The number one's value in the hero, in the sorted measure
export function heroMeasure(
  sort: TopSort,
  count: number,
  duration: number,
): ReactNode {
  return sort === "number" ? (
    <>
      <span className="num">{count.toLocaleString()}</span> plays
    </>
  ) : (
    <>
      <span className="num">{formatHours(duration)}</span> listened
    </>
  );
}
