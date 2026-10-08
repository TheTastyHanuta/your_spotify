import { GridRowWrapper } from "../../../../components/Grid";
import Text from "../../../../components/Text";
import { useMobile } from "../../../../services/hooks/hooks";
import { useTrackGrid } from "./TrackGrid";

import s from "./index.module.css";

export default function TrackHeader() {
  const [isMobile, isTablet] = useMobile();

  const trackGrid = useTrackGrid();

  const columns = [
    { ...trackGrid.rank, node: <div /> },
    { ...trackGrid.cover, node: <div aria-label="cover" /> },
    {
      ...trackGrid.title,
      node: (
        <Text element="div" size="normal">
          Title
        </Text>
      ),
    },
    {
      ...trackGrid.album,
      node: !isTablet && (
        <Text element="div" size="normal">
          Album name
        </Text>
      ),
    },
    {
      ...trackGrid.duration,
      node: !isMobile && (
        <Text element="div" size="normal">
          Length
        </Text>
      ),
    },
    {
      ...trackGrid.count,
      node: (
        <div className={s.count}>
          <Text element="div" size="normal">
            Plays ↓
          </Text>
        </div>
      ),
    },
    {
      ...trackGrid.total,
      node: !isMobile && (
        <div className={s.total}>
          <Text element="div" size="normal">
            Time
          </Text>
        </div>
      ),
    },
    {
      ...trackGrid.options,
      node: !isMobile && <div aria-label="option-menu" />,
    },
  ];

  return <GridRowWrapper columns={columns} className={s.header} />;
}
