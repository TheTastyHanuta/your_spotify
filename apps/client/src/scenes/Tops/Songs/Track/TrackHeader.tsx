import { GridRowWrapper } from "../../../../components/Grid";
import Text from "../../../../components/Text";
import { useMobile } from "../../../../services/hooks/hooks";
import { sortHeaders, TopSort } from "../../measure";
import { useTrackGrid } from "./TrackGrid";

import s from "./index.module.css";

interface TrackHeaderProps {
  sort: TopSort;
  setSort: (sort: TopSort) => void;
}

export default function TrackHeader({ sort, setSort }: TrackHeaderProps) {
  const [isMobile, isTablet] = useMobile();

  const trackGrid = useTrackGrid();
  const sorts = sortHeaders(sort, setSort, isMobile);

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
    { ...trackGrid.count, node: sorts.count },
    { ...trackGrid.total, node: sorts.total },
    {
      ...trackGrid.options,
      node: !isMobile && <div aria-label="option-menu" />,
    },
  ];

  return <GridRowWrapper columns={columns} className={s.header} />;
}
