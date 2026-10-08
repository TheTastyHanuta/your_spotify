import { ReactNode, useState } from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import { Link, useSearchParams } from "react-router-dom";

import { SpotifyImage } from "../../services/types";
import { RowsSkeleton } from "../ItemRow";
import PageHero from "../PageHero";
import Section from "../Section";
import Text from "../Text";

import s from "./index.module.css";

// Rows a page's section shows; it asks for one more to know if there are more
export const NB_SHOWN = 10;
// Rows a full list asks for, the server's maximum
export const NB_ALL = 500;
// Rows added each time the end of the list scrolls into view
const STEP = 50;

// The section's "See all" link, only when it got more rows than it shows
export const seeAll = (
  items: unknown[] | null | undefined,
  to: string,
  shown = NB_SHOWN,
) => (items && items.length > shown ? { to, label: "See all" } : undefined);

// A tab kept in the URL, so a shared link opens on it
export function useParamTab<V extends string>(
  name: string,
  values: readonly V[],
  fallback: V,
) {
  const [params, setParams] = useSearchParams();
  const asked = params.get(name) as V | null;
  const value = asked && values.includes(asked) ? asked : fallback;
  const set = (next: string) =>
    setParams(
      (old) => {
        old.set(name, next);
        return old;
      },
      { replace: true },
    );
  return [value, set] as const;
}

interface Lead {
  images?: SpotifyImage[] | null;
  round?: boolean;
  name: ReactNode;
  nameText: string;
  meta?: ReactNode;
}

interface ListPageProps<T> {
  title: string;
  // The page the list comes from
  back: { to: string; label: string };
  // null while loading
  items: T[] | null;
  // The first row, shown in the hero
  lead: (item: T) => Lead;
  row: (item: T, index: number) => ReactNode;
  // The list's heading, like "158 artists"
  count: (n: number) => string;
  empty: string;
  info?: string;
  // A line above the rows
  intro?: ReactNode;
  tabs?: { value: string; label: string }[];
  tab?: string;
  onTab?: (value: string) => void;
  right?: ReactNode;
  hideInterval?: boolean;
  // Controls in the hero's title row, like Recap's year picker
  actions?: ReactNode;
}

// The full list behind a section's "See all": all rows come in one request
// and are shown STEP at a time while scrolling.
export default function ListPage<T>({
  title,
  back,
  items,
  lead,
  row,
  count,
  empty,
  info,
  intro,
  tabs,
  tab,
  onTab,
  right,
  hideInterval,
  actions,
}: ListPageProps<T>) {
  const [shown, setShown] = useState(STEP);
  const first = items?.[0];
  const hero = first ? lead(first) : undefined;

  return (
    <div>
      <PageHero
        title={title}
        crumb={
          <>
            <Link to={back.to}>{back.label}</Link>
            <span className={s.separator} aria-hidden>
              /
            </span>
          </>
        }
        hideInterval={hideInterval}
        actions={actions}
        images={hero?.images}
        round={hero?.round}
        name={hero?.name}
        nameText={hero?.nameText}
        meta={hero?.meta}
      />
      <Section
        className={s.list}
        // The server stops at NB_ALL rows. No "0 songs" above the empty text.
        title={
          items?.length
            ? `${items.length >= NB_ALL ? "Top " : ""}${count(items.length)}`
            : title
        }
        info={info}
        tabs={tabs}
        tab={tab}
        onTab={(value) => {
          setShown(STEP);
          onTab?.(value);
        }}
        right={right}>
        {items ? (
          items.length > 0 ? (
            <>
              {intro}
              <InfiniteScroll
                next={() => setShown((old) => old + STEP)}
                hasMore={shown < items.length}
                dataLength={Math.min(shown, items.length)}
                loader={null}>
                {items.slice(0, shown).map(row)}
              </InfiniteScroll>
            </>
          ) : (
            <Text size="normal" greyed>
              {empty}
            </Text>
          )
        ) : (
          <RowsSkeleton />
        )}
      </Section>
    </div>
  );
}
