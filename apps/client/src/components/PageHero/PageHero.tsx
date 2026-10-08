import clsx from "clsx";
import { ReactNode } from "react";
import { useSelector } from "react-redux";

import {
  useApplyTint,
  useCoverColor,
} from "../../services/hooks/useCoverColor";
import { IntervalDetail } from "../../services/intervals";
import { setDataInterval } from "../../services/redux/modules/user/reducer";
import { selectIntervalDetail } from "../../services/redux/modules/user/selector";
import { intervalDetailToRedux } from "../../services/redux/modules/user/utils";
import { useAppDispatch } from "../../services/redux/tools";
import { SpotifyImage } from "../../services/types";
import IdealImage from "../IdealImage";
import { IntervalSelector } from "../IntervalSelector";
import StatusStrip from "../StatusStrip";

import s from "./index.module.css";

interface PageHeroProps {
  // Page name in the title row; empty on detail pages
  title: string;
  hideInterval?: boolean;
  // Left of the title, e.g. a link back to the list on detail pages
  crumb?: ReactNode;
  // The lead item's images: its cover is shown and tints the page
  images?: SpotifyImage[] | null;
  round?: boolean;
  name?: ReactNode;
  // Plain name for the tooltip when the name is cut off
  nameText?: string;
  // One line under the name: what the item is, then its numbers
  meta?: ReactNode;
  aside?: ReactNode;
  // Buttons at the right of the title row, e.g. an item's menu
  actions?: ReactNode;
  // Shown instead of the lead item when there is none
  empty?: ReactNode;
}

export default function PageHero({
  title,
  hideInterval,
  crumb,
  images,
  round,
  name,
  nameText,
  meta,
  aside,
  actions,
  empty,
}: PageHeroProps) {
  const dispatch = useAppDispatch();
  const intervalDetail = useSelector(selectIntervalDetail);

  // Spotify lists images largest first; the smallest is enough for a colour
  const smallest = images?.length ? images[images.length - 1]?.url : undefined;
  useApplyTint(useCoverColor(name === undefined ? undefined : smallest));

  const changeInterval = (newInterval: IntervalDetail) => {
    dispatch(setDataInterval(intervalDetailToRedux(newInterval)));
  };

  return (
    <>
      <header className={clsx(s.root, "page-hero")}>
        <div className={s.titlerow}>
          {crumb && <div className={s.crumb}>{crumb}</div>}
          {title && <h1 className={s.title}>{title}</h1>}
          {actions && <div className={s.interval}>{actions}</div>}
          {!hideInterval && (
            <div className={s.interval}>
              <IntervalSelector
                value={intervalDetail}
                onChange={changeInterval}
              />
            </div>
          )}
        </div>
        {name === undefined ? (
          empty && <p className={s.empty}>{empty}</p>
        ) : (
          <div className={s.lead}>
            {images?.length ? (
              <IdealImage
                images={images}
                size={round ? 150 : 112}
                className={clsx(s.cover, round && s.round)}
                alt=""
              />
            ) : (
              // The name's initial, like the account avatar
              <div
                className={clsx(s.cover, s.nocover, round && s.round)}
                aria-hidden>
                {nameText?.[0]?.toUpperCase()}
              </div>
            )}
            <div className={s.texts}>
              <div className={s.name} title={nameText}>
                {name}
              </div>
              {meta && <div className={s.meta}>{meta}</div>}
            </div>
            {aside && <div className={s.aside}>{aside}</div>}
          </div>
        )}
      </header>
      <StatusStrip />
    </>
  );
}
