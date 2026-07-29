import { getWithDefault } from "../env";
import { QueuedHttpClientFactory } from "./queueHttpClient";

export const spotifyHttpClientFactory = new QueuedHttpClientFactory({
  baseURL: "https://api.spotify.com/v1",
  headers: { "Content-Type": "application/json" },
  minDelayMs: getWithDefault("SPOTIFY_API_DELAY_MS", 2000),
});

export const githubHttpClientFactory = new QueuedHttpClientFactory({
  baseURL: "https://api.github.com",
  headers: { "Content-Type": "application/json" },
});
