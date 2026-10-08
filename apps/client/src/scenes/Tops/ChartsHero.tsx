import { Tab, Tabs } from "@mui/material";
import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import PageHero from "../../components/PageHero";
import { SpotifyImage } from "../../services/types";

import s from "./index.module.css";

const TABS = [
  { to: "/top/songs", label: "Songs" },
  { to: "/top/artists", label: "Artists" },
  { to: "/top/albums", label: "Albums" },
];

interface ChartsHeroProps {
  title: string;
  // The period's number one
  lead?: {
    images: SpotifyImage[];
    round?: boolean;
    name: ReactNode;
    nameText: string;
    meta: ReactNode;
  };
  // True once the first page of the list has loaded
  loaded: boolean;
  right?: ReactNode;
}

// Hero and Songs / Artists / Albums tabs, shared by the three chart pages
export default function ChartsHero({
  title,
  lead,
  loaded,
  right,
}: ChartsHeroProps) {
  const { pathname, search } = useLocation();

  return (
    <>
      <PageHero
        title={title}
        images={lead?.images}
        round={lead?.round}
        name={lead?.name}
        nameText={lead?.nameText}
        meta={lead?.meta}
        empty={loaded ? "Nothing played in this period" : undefined}
      />
      <div className={s.tabs}>
        <Tabs value={pathname} aria-label="Charts">
          {TABS.map((tab) => (
            <Tab
              key={tab.to}
              value={tab.to}
              label={tab.label}
              component={Link}
              to={{ pathname: tab.to, search }}
            />
          ))}
        </Tabs>
        {right && <div className={s.right}>{right}</div>}
      </div>
    </>
  );
}
