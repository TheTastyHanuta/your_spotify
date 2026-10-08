import { ReactNode, useMemo } from "react";
import { useSelector } from "react-redux";
import { Link, useParams, useSearchParams } from "react-router-dom";

import ItemRow, { RowsSkeleton } from "../../../components/ItemRow";
import PageHero from "../../../components/PageHero";
import Section from "../../../components/Section";
import { intervalToDisplay } from "../../../services/date";
import { useOldestListenedAtFromUsers } from "../../../services/intervals";
import { selectAccounts } from "../../../services/redux/modules/admin/selector";
import { selectUser } from "../../../services/redux/modules/user/selector";
import { CollaborativeMode, SpotifyImage } from "../../../services/types";
import { AFFINITY_PREFIX } from "./types";

import s from "./index.module.css";

// The compared users, period and mode, from the URL. Stable values, or
// useAPI would fetch again on every render.
export function useAffinity() {
  const user = useSelector(selectUser);
  const { mode } = useParams();
  const [query] = useSearchParams();
  const idsQuery = query.get("ids") ?? "";
  const ids = useMemo(() => (idsQuery ? idsQuery.split(",") : []), [idsQuery]);
  const { interval } = useOldestListenedAtFromUsers(ids, AFFINITY_PREFIX);
  const startTime = interval.start.getTime();
  const endTime = interval.end.getTime();
  const start = useMemo(() => new Date(startTime), [startTime]);
  const end = useMemo(() => new Date(endTime), [endTime]);
  return {
    ids,
    start,
    end,
    mode: mode as CollaborativeMode,
    // The user is always part of it
    userIds: user ? [user._id, ...ids] : ids,
  };
}

export interface AffinityRow {
  id: string;
  image: SpotifyImage[];
  round?: boolean;
  title: ReactNode;
  // Plain name and page, for the hero
  name: string;
  link: string;
  subtitle?: ReactNode;
  // Share of each user's listening, by user id
  shares: Record<string, number>;
  // Extra controls after the "most enjoyed by" note
  extra?: ReactNode;
  // A song's id: the cover plays it
  playId?: string;
}

interface ResultProps {
  kind: "song" | "album" | "artist";
  rows: AffinityRow[] | null;
  // Next to the list's title, like "Create playlist"
  right?: ReactNode;
}

export default function Result({ kind, rows, right }: ResultProps) {
  const accounts = useSelector(selectAccounts);
  const { start, end, mode, userIds } = useAffinity();
  const name = (id: string | undefined) =>
    accounts.find((account) => account.id === id)?.username ?? "someone";
  // The one of the users who listens to it the most
  const mostBy = (row: AffinityRow) =>
    userIds.reduce((best, id) =>
      (row.shares[id] ?? 0) > (row.shares[best] ?? 0) ? id : best,
    );

  const lead = rows?.[0];
  const who = [...new Set(userIds)].map(name).join(", ");

  return (
    <div>
      <PageHero
        title=""
        hideInterval
        crumb={<Link to="/collaborative/affinity">Affinity</Link>}
        images={lead?.image}
        round={lead?.round}
        name={lead && <Link to={lead.link}>{lead.name}</Link>}
        nameText={lead?.name}
        meta={
          lead && (
            <>
              The {kind} you share most · {who} · {mode} mode ·{" "}
              {intervalToDisplay(start, end)}
            </>
          )
        }
        empty={rows?.length === 0 ? `No ${kind} in common.` : undefined}
      />
      <Section title={`By ${kind}`} right={right}>
        {rows ? (
          rows.map((row, index) => (
            <ItemRow
              key={row.id}
              rank={index + 1}
              image={row.image}
              round={row.round}
              playId={row.playId}
              title={row.title}
              subtitle={row.subtitle}
              right={
                <span className={s.right}>
                  Most by {name(mostBy(row))}
                  {row.extra}
                </span>
              }
            />
          ))
        ) : (
          <RowsSkeleton />
        )}
      </Section>
    </div>
  );
}
