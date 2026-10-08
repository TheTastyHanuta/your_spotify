import {
  SelectProps,
  Button,
  MenuItem,
  Select,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { endOfDay, startOfDay } from "date-fns";
import React, { useState } from "react";

import { getAppropriateTimesplitFromRange } from "../../services/date";
import { useMobile } from "../../services/hooks/hooks";
import {
  allIntervals,
  getAllIndexFromIntervalDetail,
  IntervalDetail,
} from "../../services/intervals";
import Dialog from "../Dialog";
import RangePicker from "./RangePicker";
import { Range } from "./RangePicker/RangePicker";

import seg from "../Segmented/index.module.css";
import s from "./index.module.css";

// Short names for the segmented control
const LABELS: Record<string, string> = {
  "This week": "Week",
  "This month": "Month",
  "This year": "Year",
  All: "All time",
};

interface IntervalSelectorProps {
  value: IntervalDetail;
  onChange: (newDetails: IntervalDetail) => void;
  selectType?: SelectProps["variant"];
  forceTiny?: boolean;
}

export function IntervalSelector({
  value,
  onChange,
  selectType,
  forceTiny,
}: IntervalSelectorProps) {
  const upmd = !useMobile()[1] && !forceTiny;
  const [open, setOpen] = useState(false);
  const [customIntervalDate, setCustomIntervalDate] = useState<Range>([
    undefined,
    undefined,
  ]);

  const existingInterval = getAllIndexFromIntervalDetail(value);

  const internOnChange = (index: number) => {
    if (index === -1) {
      setOpen(true);
    } else {
      const interval = allIntervals[index];
      if (!interval) {
        return;
      }
      onChange(interval);
    }
  };

  let content: React.ReactNode;

  if (!upmd) {
    content = (
      <Select
        size="small"
        variant={selectType}
        value={existingInterval}
        onChange={(ev) => internOnChange(ev.target.value as number)}>
        {allIntervals.map((inter, index) => (
          <MenuItem key={inter.name} value={index}>
            {inter.name}
          </MenuItem>
        ))}
        <MenuItem value={-1} onClick={() => setOpen(true)}>
          Custom
        </MenuItem>
      </Select>
    );
  } else {
    content = (
      <ToggleButtonGroup
        exclusive
        size="small"
        className={seg.segmented}
        value={existingInterval}
        onChange={(_, index: number | null) => {
          if (index !== null) {
            internOnChange(index);
          }
        }}
        aria-label="Period">
        {allIntervals.map((inter, index) => (
          <ToggleButton key={inter.name} value={index}>
            {LABELS[inter.name] ?? inter.name}
          </ToggleButton>
        ))}
        <ToggleButton value={-1} onClick={() => setOpen(true)}>
          Custom…
        </ToggleButton>
      </ToggleButtonGroup>
    );
  }

  const goodRange = Boolean(customIntervalDate[0] && customIntervalDate[1]);

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
      {content}
      <Dialog
        title="Custom date range"
        open={open}
        onClose={() => setOpen(false)}>
        <div className={s.dialogcontent}>
          <RangePicker
            value={customIntervalDate}
            onChange={setCustomIntervalDate}
          />
          <Button variant="contained" onClick={setCustom} disabled={!goodRange}>
            Apply
          </Button>
        </div>
      </Dialog>
    </>
  );
}
