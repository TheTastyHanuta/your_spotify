import { spotifyHttpClientFactory } from "../apis/queuedHttpClient.providers";
import { QueuedHttpClient } from "../apis/queueHttpClient";
import { generateRandomString } from "../crypto";
import { credentials } from "./credentials";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

// A refresh can answer with a new refresh token, the old one then stops
// working; without one the stored token stays
export const tokensFrom = (data: TokenResponse, now = Date.now()) => ({
  accessToken: data.access_token,
  ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
  expiresIn: now + data.expires_in * 1000,
});

export interface Provider {
  getRedirect(): Promise<{ url: string; state: string }>;
  exchangeCode(
    code: string,
    state: string,
  ): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }>;
  refresh(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }>;
  getHttpClient(accessToken: string): QueuedHttpClient;
}

export class Spotify implements Provider {
  private readonly client = spotifyHttpClientFactory.createClient({});

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly scopes: string,
    private readonly redirectUri: string,
  ) {}

  async getRedirect() {
    const authorizeUrl = new URL("https://accounts.spotify.com/authorize");
    const state = generateRandomString(32);

    authorizeUrl.searchParams.append("client_id", this.clientId);
    authorizeUrl.searchParams.append("response_type", "code");
    authorizeUrl.searchParams.append("redirect_uri", this.redirectUri);
    authorizeUrl.searchParams.append("state", state);
    authorizeUrl.searchParams.append("scope", this.scopes);

    return { url: authorizeUrl.toString(), state };
  }

  async exchangeCode(code: string, state: string) {
    const { data } = await this.client.post<TokenResponse>(
      "https://accounts.spotify.com/api/token",
      {
        params: {
          grant_type: "authorization_code",
          code,
          redirect_uri: this.redirectUri,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          state,
        },
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
    );

    return tokensFrom(data);
  }

  async refresh(refresh: string) {
    const { data } = await this.client.post<TokenResponse>(
      "https://accounts.spotify.com/api/token",
      {
        params: { grant_type: "refresh_token", refresh_token: refresh },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(
            `${this.clientId}:${this.clientSecret}`,
          ).toString("base64")}`,
        },
      },
    );

    return tokensFrom(data);
  }

  getHttpClient(accessToken: string) {
    return spotifyHttpClientFactory.createClient({
      Authorization: `Bearer ${accessToken}`,
    });
  }
}

export const spotifyProvider = new Spotify(
  credentials.spotify.public,
  credentials.spotify.secret,
  credentials.spotify.scopes,
  credentials.spotify.redirectUri,
);
