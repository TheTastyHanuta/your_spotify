import { fromDay, toDay } from "../../../date";
import {
  getPresetIndexFromIntervalDetail,
  getUserBasedIndexFromIntervalDetail,
  IntervalDetail,
  presetAt,
  presetIntervals,
  userBasedIntervals,
} from "../../../intervals";
import { ReduxIntervalDetail } from "./types";

export function intervalDetailToRedux(
  intervalDetail: IntervalDetail,
): ReduxIntervalDetail {
  switch (intervalDetail.type) {
    case "preset": {
      return {
        type: "preset",
        index: getPresetIndexFromIntervalDetail(intervalDetail),
        start: intervalDetail.offset
          ? toDay(intervalDetail.interval.start)
          : undefined,
      };
    }
    case "userbased": {
      return {
        type: "userbased",
        index: getUserBasedIndexFromIntervalDetail(intervalDetail),
      };
    }
    case "custom": {
      return { type: "custom", interval: intervalDetail.interval };
    }
    default: {
      return { type: "custom", interval: presetIntervals[0].interval };
    }
  }
}

export function fromReduxIntervalDetail(
  intervalDetail: ReduxIntervalDetail,
): IntervalDetail {
  switch (intervalDetail.type) {
    case "preset": {
      const { index, start } = intervalDetail;
      return start ? presetAt(index, fromDay(start)) : presetIntervals[index]!;
    }
    case "userbased": {
      return userBasedIntervals[intervalDetail.index]!;
    }
    case "custom": {
      return {
        type: "custom",
        name: "custom",
        interval: intervalDetail.interval,
      };
    }
    default: {
      return presetIntervals[0];
    }
  }
}
