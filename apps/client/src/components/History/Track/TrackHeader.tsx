import { useMobile } from "../../../services/hooks/hooks";
import { GridRowWrapper } from "../../Grid";
import Text from "../../Text";
import { trackGrid } from "./TrackGrid";

import s from "./index.module.css";

export default function TrackHeader() {
  const [isMobile, isTablet] = useMobile();

  const columns = [
    { ...trackGrid.cover, node: <div /> },
    { ...trackGrid.title, node: <Text size="normal">Title</Text> },
    {
      ...trackGrid.album,
      node: !isTablet && <Text size="normal">Album name</Text>,
    },
    {
      ...trackGrid.duration,
      node: !isMobile && <Text size="normal">Duration</Text>,
    },
    {
      ...trackGrid.listened,
      node: !isMobile && <Text size="normal">Listened at</Text>,
    },
    { ...trackGrid.option, node: !isMobile && <div className="center" /> },
  ];

  return <GridRowWrapper className={s.header} columns={columns} />;
}
