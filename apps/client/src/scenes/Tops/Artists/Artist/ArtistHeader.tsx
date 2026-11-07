import { GridRowWrapper } from "../../../../components/Grid";
import Text from "../../../../components/Text";
import { useMobile } from "../../../../services/hooks/hooks";
import { sortHeaders, TopSort } from "../../measure";
import { useArtistGrid } from "./ArtistGrid";

import s from "./index.module.css";

interface ArtistHeaderProps {
  sort: TopSort;
  setSort: (sort: TopSort) => void;
}

export default function ArtistHeader({ sort, setSort }: ArtistHeaderProps) {
  const [isMobile, isTablet] = useMobile();
  const sorts = sortHeaders(sort, setSort, isMobile);
  const artistGrid = useArtistGrid();

  const columns = [
    { ...artistGrid.rank, node: <div /> },
    { ...artistGrid.cover, node: <div /> },
    { ...artistGrid.title, node: <Text size="normal">Artist name</Text> },
    {
      ...artistGrid.genres,
      node: !isTablet && <Text size="normal">Genres</Text>,
    },
    { ...artistGrid.count, node: sorts.count },
    { ...artistGrid.total, node: sorts.total },
  ];

  return <GridRowWrapper columns={columns} className={s.header} />;
}
