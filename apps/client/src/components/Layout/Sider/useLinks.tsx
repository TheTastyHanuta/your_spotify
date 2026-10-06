import {
  AutoStories,
  AutoStoriesOutlined,
  Home,
  HomeOutlined,
  MusicNote,
  MusicNoteOutlined,
  Album,
  AlbumOutlined,
  Person,
  PersonOutlined,
  Settings,
  SettingsOutlined,
  ExitToApp,
  Share,
  ShareOutlined,
  Speed,
  SpeedOutlined,
  Palette,
  PaletteOutlined,
  CalendarMonth,
  CalendarMonthOutlined,
  Explore,
  ExploreOutlined,
  Summarize,
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
      label: "General",
      items: [
        { label: "Home", link: "/", icon: <HomeOutlined />, iconOn: <Home /> },
        {
          label: "Longest sessions",
          link: "/sessions",
          icon: <SpeedOutlined />,
          iconOn: <Speed />,
        },
      ],
    },
    {
      label: "Insights",
      items: [
        {
          label: "Taste",
          link: "/taste",
          icon: <PaletteOutlined />,
          iconOn: <Palette />,
        },
        {
          label: "Habits",
          link: "/habits",
          icon: <CalendarMonthOutlined />,
          iconOn: <CalendarMonth />,
        },
        {
          label: "Discoveries",
          link: "/discoveries",
          icon: <ExploreOutlined />,
          iconOn: <Explore />,
        },
        {
          label: "Your story",
          link: "/story",
          icon: <AutoStoriesOutlined />,
          iconOn: <AutoStories />,
        },
        {
          label: "Recap",
          link: "/recap",
          icon: <SummarizeOutlined />,
          iconOn: <Summarize />,
        },
      ],
    },
    {
      label: "Tops",
      items: [
        {
          label: "Top songs",
          link: "/top/songs",
          icon: <MusicNoteOutlined />,
          iconOn: <MusicNote />,
        },
        {
          label: "Top artists",
          link: "/top/artists",
          icon: <PersonOutlined />,
          iconOn: <Person />,
        },
        {
          label: "Top albums",
          link: "/top/albums",
          icon: <AlbumOutlined />,
          iconOn: <Album />,
        },
      ],
    },
    affinityEnabled
      ? {
          label: "With people",
          items: [
            {
              label: "Affinity",
              link: "/collaborative/affinity",
              icon: <MusicNoteOutlined />,
              iconOn: <MusicNote />,
              restrict: "guest",
            },
          ],
        }
      : undefined,
    {
      label: "Settings",
      items: [
        {
          label: "Share this page",
          link: "/share",
          icon: <ShareOutlined />,
          iconOn: <Share />,
        },
        {
          label: "Settings",
          link: "/settings/account",
          icon: <SettingsOutlined />,
          iconOn: <Settings />,
        },
        {
          label: "Logout",
          link: "/logout",
          icon: <ExitToApp />,
          iconOn: <ExitToApp />,
        },
      ],
    },
  ]);
  return result;
}
