import { useEffect } from "react";
import { useSelector } from "react-redux";
import { useLocation, useSearchParams } from "react-router-dom";

import {
  detailIntervalToQuery,
  getPresetDates,
  queryToIntervalDetail,
} from "../../services/intervals";
import { getAccounts } from "../../services/redux/modules/admin/thunk";
import { getSettings } from "../../services/redux/modules/settings/thunk";
import {
  setDataInterval,
  setPublicToken,
} from "../../services/redux/modules/user/reducer";
import {
  selectIntervalDetail,
  selectPublicToken,
  selectUser,
} from "../../services/redux/modules/user/selector";
import { checkLogged } from "../../services/redux/modules/user/thunk";
import { intervalDetailToRedux } from "../../services/redux/modules/user/utils";
import { useAppDispatch } from "../../services/redux/tools";

const GLOBAL_PREFIX = "g";
const INTERVAL_FIELDS = ["type", "start", "end", "name"].map(
  (field) => `${GLOBAL_PREFIX}${field}`,
);

export default function Wrapper() {
  const dispatch = useAppDispatch();
  const user = useSelector(selectUser);
  const publicToken = useSelector(selectPublicToken);
  const intervalDetail = useSelector(selectIntervalDetail);
  const [query, setQuery] = useSearchParams();
  const { pathname } = useLocation();

  const urlToken = query.get("token");

  useEffect(() => {
    dispatch(
      setDataInterval(
        intervalDetailToRedux(queryToIntervalDetail(query, GLOBAL_PREFIX)),
      ),
    );
    // Only set the interval on the first render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  // The period stays in the URL, so the address bar always shares the view.
  // Links and navigate() drop the query string, so this also runs on every
  // path change.
  useEffect(() => {
    setQuery(
      (prev) => {
        // Read once by the effects above on the first render
        prev.delete("token");
        INTERVAL_FIELDS.forEach((field) => prev.delete(field));
        Object.entries(
          detailIntervalToQuery(intervalDetail, GLOBAL_PREFIX),
        ).forEach(([key, value]) => prev.set(key, value));
        return prev;
      },
      { replace: true },
    );
  }, [intervalDetail, pathname, setQuery]);

  useEffect(() => {
    // A custom range does not move with the current time
    if (intervalDetail.type === "custom") {
      return undefined;
    }
    // Nothing asks for the preset dates while a tab sits in the background.
    // Setting the same interval again when it is shown makes the stats read
    // them, and fetch again if they were recomputed in the meantime.
    let seenPresetDates = getPresetDates();
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      const presetDates = getPresetDates();
      if (presetDates === seenPresetDates) {
        return;
      }
      seenPresetDates = presetDates;
      dispatch(setDataInterval(intervalDetailToRedux(intervalDetail)));
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [dispatch, intervalDetail]);

  useEffect(() => {
    async function init() {
      await dispatch(setPublicToken(urlToken));
      await dispatch(checkLogged());
      await dispatch(getSettings());
    }
    if (!publicToken) {
      init().catch(console.error);
    }
  }, [dispatch, publicToken, urlToken]);

  useEffect(() => {
    async function init() {
      await dispatch(getAccounts());
    }
    if (user) {
      init().catch(console.error);
    }
  }, [dispatch, user]);

  return null;
}
