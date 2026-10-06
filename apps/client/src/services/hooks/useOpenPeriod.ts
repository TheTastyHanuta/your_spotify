import { getAppropriateTimesplitFromRange } from "../date";
import { setDataInterval } from "../redux/modules/user/reducer";
import { intervalDetailToRedux } from "../redux/modules/user/utils";
import { useAppDispatch } from "../redux/tools";
import { useNavigate } from "./useNavigate";

// Sets a custom period, like the period picker does, and opens a page with it
export function useOpenPeriod() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  return (start: Date, end: Date, path: string) => {
    const interval = {
      start,
      end,
      timesplit: getAppropriateTimesplitFromRange(start, end),
    };
    dispatch(
      setDataInterval(
        intervalDetailToRedux({ type: "custom", name: "custom", interval }),
      ),
    );
    navigate(path);
  };
}
