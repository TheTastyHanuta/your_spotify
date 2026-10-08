import clsx from "clsx";

import { enterClicks } from "../../../../services/html";
import { SpotifyImage } from "../../../../services/types";
import IdealImage from "../../../IdealImage";
import Text from "../../../Text";

import s from "./index.module.css";

interface SectionProps<T extends { id: string }> {
  title: string;
  items: Array<T> | undefined;
  onClick: (item: T) => void;
  getContent: (item: T) => [title: string, subtitle?: string];
  getImages: (item: T) => Array<SpotifyImage>;
  // Round covers, for artists
  round?: boolean;
}

export function Section<T extends { id: string }>({
  title,
  items,
  onClick,
  getImages,
  getContent,
  round,
}: SectionProps<T>) {
  const shouldDisplay = items && items.length > 0;

  if (!shouldDisplay) {
    return null;
  }

  return (
    <div className={s.section}>
      <div className={`label ${s.heading}`}>{title}</div>
      <div className={s.results}>
        {items?.map((item) => {
          const [itemTitle, subtitle] = getContent(item);

          return (
            <div
              key={item.id}
              tabIndex={1}
              className={s.result}
              role="button"
              onClick={() => onClick(item)}
              onKeyDown={enterClicks(() => onClick(item))}>
              <IdealImage
                className={clsx(s.cover, { [s.round]: round })}
                images={getImages(item)}
                size={40}
              />
              <div className={s.texts}>
                <Text size="normal" className={s.name}>
                  {itemTitle}
                </Text>
                {subtitle && (
                  <Text size="normal" className={s.subtitle}>
                    {subtitle}
                  </Text>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
