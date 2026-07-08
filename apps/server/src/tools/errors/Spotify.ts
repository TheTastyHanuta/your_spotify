import { YourSpotifyError } from "./error";

export class SpotifyReauthRequiredError extends YourSpotifyError {
  public type = "UNAUTHORIZED" as const;

  constructor(username: string) {
    super(
      `Spotify refresh token for ${username} is expired or revoked, the user has to re-log to Spotify`,
    );
  }
}
