import {
  AlbumOutlined,
  AutoStoriesOutlined,
  EqualizerOutlined,
  EventRepeatOutlined,
  ExploreOutlined,
  HistoryOutlined,
  HomeOutlined,
  MusicNoteOutlined,
  PeopleOutlined,
  PersonOutlined,
  ScheduleOutlined,
  SummarizeOutlined,
} from "@mui/icons-material";
import { useSelector } from "react-redux";

import { selectAffinityEnabled } from "../../../services/redux/modules/settings/selector";
import { compact } from "../../../services/tools";
import { SiderCategory } from "./types";

export function useLinks() {
  const affinityEnabled = useSelector(selectAffinityEnabled);

  const result: Array<SiderCategory> = compact([
    {
      label: "",
      items: [
        { label: "Overview", link: "/", icon: <HomeOutlined /> },
        { label: "History", link: "/history", icon: <HistoryOutlined /> },
        {
          label: "On this day",
          link: "/on-this-day",
          icon: <EventRepeatOutlined />,
        },
      ],
    },
    {
      label: "Charts",
      items: [
        { label: "Songs", link: "/top/songs", icon: <MusicNoteOutlined /> },
        { label: "Artists", link: "/top/artists", icon: <PersonOutlined /> },
        { label: "Albums", link: "/top/albums", icon: <AlbumOutlined /> },
      ],
    },
    {
      label: "Insights",
      items: [
        { label: "Habits", link: "/habits", icon: <ScheduleOutlined /> },
        { label: "Taste", link: "/taste", icon: <EqualizerOutlined /> },
        {
          label: "Discoveries",
          link: "/discoveries",
          icon: <ExploreOutlined />,
        },
        { label: "Your story", link: "/story", icon: <AutoStoriesOutlined /> },
        { label: "Recap", link: "/recap", icon: <SummarizeOutlined /> },
      ],
    },
    affinityEnabled
      ? {
          label: "Together",
          items: [
            {
              label: "Affinity",
              link: "/collaborative/affinity",
              icon: <PeopleOutlined />,
              restrict: "guest",
            },
          ],
        }
      : undefined,
  ]);

  return result;
}
