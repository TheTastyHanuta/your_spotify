import { GridRowWrapper } from "../../../../components/Grid";
import Text from "../../../../components/Text";
import { useMobile } from "../../../../services/hooks/hooks";
import { useArtistGrid } from "./ArtistGrid";

import s from "./index.module.css";

export default function ArtistHeader() {
  const [isMobile, isTablet] = useMobile();
  const artistGrid = useArtistGrid();

  const columns = [
    { ...artistGrid.rank, node: <div /> },
    { ...artistGrid.cover, node: <div /> },
    { ...artistGrid.title, node: <Text size="normal">Artist name</Text> },
    {
      ...artistGrid.genres,
      node: !isTablet && <Text size="normal">Genres</Text>,
    },
    { ...artistGrid.count, node: <Text size="normal">Plays ↓</Text> },
    { ...artistGrid.total, node: !isMobile && <Text size="normal">Time</Text> },
  ];

  return <GridRowWrapper columns={columns} className={s.header} />;
}
