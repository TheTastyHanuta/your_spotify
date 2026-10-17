import { CircularProgress } from "@mui/material";
import { useParams } from "react-router-dom";

import FullscreenCentered from "../../components/FullscreenCentered";
import { NB_SHOWN } from "../../components/ListPage";
import Text from "../../components/Text";
import { api } from "../../services/apis/api";
import { useAPI } from "../../services/hooks/hooks";
import ArtistStats from "./ArtistStats";

export default function ArtistStatsWrapper() {
  const params = useParams();
  // One row more than the page shows, so it knows to link to the full lists
  const stats = useAPI(api.getArtistStats, params.id || "", NB_SHOWN + 1);

  if (stats === null) {
    return (
      <FullscreenCentered>
        <CircularProgress />
        <div>
          <Text element="h3" size="normal">
            Loading your stats
          </Text>
        </div>
      </FullscreenCentered>
    );
  }

  if ("code" in stats || !params.id) {
    return (
      <FullscreenCentered>
        <Text element="h3" size="normal">
          You never listened to this artist, might be someone else registered
        </Text>
      </FullscreenCentered>
    );
  }

  return <ArtistStats artistId={params.id} stats={stats} />;
}
