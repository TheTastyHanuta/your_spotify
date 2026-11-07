import { GridRowWrapper } from "../../../../components/Grid";
import Text from "../../../../components/Text";
import { useMobile } from "../../../../services/hooks/hooks";
import { sortHeaders, TopSort } from "../../measure";
import { useAlbumGrid } from "./AlbumGrid";

import s from "./index.module.css";

interface AlbumHeaderProps {
  sort: TopSort;
  setSort: (sort: TopSort) => void;
}

export default function AlbumHeader({ sort, setSort }: AlbumHeaderProps) {
  const [isMobile] = useMobile();
  const sorts = sortHeaders(sort, setSort, isMobile);
  const albumGrid = useAlbumGrid();

  const columns = [
    { ...albumGrid.rank, node: <div /> },
    { ...albumGrid.cover, node: <div /> },
    { ...albumGrid.title, node: <Text size="normal">Album name</Text> },
    { ...albumGrid.count, node: sorts.count },
    { ...albumGrid.total, node: sorts.total },
  ];

  return <GridRowWrapper columns={columns} className={s.header} />;
}
