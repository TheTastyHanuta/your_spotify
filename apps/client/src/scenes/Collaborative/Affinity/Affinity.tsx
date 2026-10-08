import { Button, Checkbox, FormControlLabel } from "@mui/material";
import { useState } from "react";
import { useSelector } from "react-redux";

import { ITooltip } from "../../../components/iTooltip/iTooltip";
import PageHero from "../../../components/PageHero";
import Section from "../../../components/Section";
import Segmented from "../../../components/Segmented";
import Text from "../../../components/Text";
import { useNavigateAndSearch } from "../../../services/hooks/hooks";
import { detailIntervalToQuery } from "../../../services/intervals";
import { selectAccounts } from "../../../services/redux/modules/admin/selector";
import {
  selectIntervalDetail,
  selectUser,
} from "../../../services/redux/modules/user/selector";
import { CollaborativeMode } from "../../../services/types";
import { AFFINITY_PREFIX } from "./types";

import s from "./index.module.css";

const TYPES = [
  { value: "songs", label: "Songs" },
  { value: "albums", label: "Albums" },
  { value: "artists", label: "Artists" },
];
const MODES = [
  { value: CollaborativeMode.MINIMA, label: "Minima" },
  { value: CollaborativeMode.AVERAGE, label: "Average" },
];

const MODE_INFO = (
  <div>
    <p>
      The affinity is how likely the users are to like the same songs. It comes
      in two modes:
    </p>
    <ul>
      <li>
        <strong>Average</strong> ranks by the average share of each user&apos;s
        listening. If A spends 50% of their time on a song, B 25% and C 0%, the
        average is 25%, which ranks higher than 12% for each of them.
      </li>
      <li>
        <strong>Minima</strong> ranks by the smallest share. With 50%, 25% and
        0% the minima is 0%, which ranks lower than 100%, 5% and 1%.
      </li>
    </ul>
    <p>
      Average can put first what some love a lot; minima puts first what
      everyone knows, even if not everyone loves it as much.
    </p>
  </div>
);

export default function Affinity() {
  const navigate = useNavigateAndSearch();
  const user = useSelector(selectUser);
  const accounts = useSelector(selectAccounts);
  const intervalDetail = useSelector(selectIntervalDetail);
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState(CollaborativeMode.MINIMA);
  const [statType, setStatType] = useState("songs");

  const toggle = (id: string) => {
    const next = new Set(ids);
    if (!next.delete(id)) {
      next.add(id);
    }
    setIds(next);
  };

  const compute = () => {
    navigate(`/collaborative/top/${statType}/${mode}`, {
      ids: Array.from(ids).join(","),
      ...detailIntervalToQuery(intervalDetail, AFFINITY_PREFIX),
    });
  };

  return (
    <div>
      <PageHero
        title="Affinity"
        empty="What you and the people you pick listen to in common, in the period chosen here."
      />
      <div className={s.form}>
        <Section title="Who">
          <div className={s.accounts}>
            {accounts.map((account) => (
              <FormControlLabel
                key={account.id}
                className={s.account}
                control={
                  <Checkbox
                    checked={ids.has(account.id) || account.id === user?._id}
                    disabled={account.id === user?._id}
                    onChange={() => toggle(account.id)}
                  />
                }
                label={
                  account.id === user?._id
                    ? `${account.username} (you)`
                    : account.username
                }
              />
            ))}
          </div>
        </Section>
        <Section title="Compare">
          <div className={s.controls}>
            <Segmented
              label="Compare by"
              value={statType}
              options={TYPES}
              onChange={setStatType}
            />
            <Segmented
              label="Mode"
              value={mode}
              options={MODES}
              onChange={setMode}
            />
            <ITooltip content={MODE_INFO} />
          </div>
          <Button
            onClick={compute}
            variant="contained"
            disableElevation
            className={s.submit}
            disabled={ids.size === 0}>
            Compare
          </Button>
          {ids.size === 0 && (
            <Text element="div" size="normal" greyed className={s.hint}>
              Pick at least one other person.
            </Text>
          )}
        </Section>
      </div>
    </div>
  );
}
