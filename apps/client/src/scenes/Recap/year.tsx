import { MenuItem, Select } from "@mui/material";
import { subYears } from "date-fns";
import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";

import { selectUser } from "../../services/redux/modules/user/selector";

// The recap's year, from ?year=, shared by the page and its full lists
export function useRecapYear() {
  const user = useSelector(selectUser);
  const [params, setParams] = useSearchParams();

  const currentYear = new Date().getFullYear();
  // Not set before the first listen
  const firstYear =
    new Date(user?.firstListenedAt ?? NaN).getFullYear() || currentYear;
  // In January and February, the year that just ended is more interesting
  const defaultYear =
    new Date().getMonth() < 2 && currentYear > firstYear
      ? currentYear - 1
      : currentYear;
  const asked = Number(params.get("year"));
  const year =
    Number.isInteger(asked) && asked >= firstYear && asked <= currentYear
      ? asked
      : defaultYear;

  // The current year is compared with the same days of the previous year
  const range = useMemo(() => {
    const now = new Date();
    const soFar = year === now.getFullYear();
    return {
      soFar,
      start: new Date(year, 0, 1),
      end: soFar ? now : new Date(year + 1, 0, 1),
      previousStart: new Date(year - 1, 0, 1),
      previousEnd: soFar ? subYears(now, 1) : new Date(year, 0, 1),
    };
  }, [year]);

  const setYear = (value: number) =>
    setParams((query) => {
      query.set("year", String(value));
      return query;
    });

  return { year, firstYear, currentYear, range, setYear };
}

export function YearSelect({
  year,
  firstYear,
  currentYear,
  setYear,
}: Pick<
  ReturnType<typeof useRecapYear>,
  "year" | "firstYear" | "currentYear" | "setYear"
>) {
  return (
    <Select
      variant="standard"
      value={year}
      aria-label="Year"
      sx={{ color: "inherit" }}
      onChange={(event) => setYear(Number(event.target.value))}>
      {Array.from(Array(currentYear - firstYear + 1).keys()).map((index) => (
        <MenuItem key={index} value={currentYear - index}>
          {currentYear - index}
        </MenuItem>
      ))}
    </Select>
  );
}
