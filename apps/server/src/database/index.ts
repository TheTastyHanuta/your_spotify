import { connect as connectToDb, Mongoose } from "mongoose";

import { getWithDefault } from "../tools/env";
import { logger } from "../tools/logger";
import { wait } from "../tools/misc";

export * from "./queries/stats";
export * from "./queries/user";
export * from "./queries/global";
export * from "./queries/artist";
export * from "./queries/track";

const TRIES = 10;
const WAIT_MS = 30_000;

export const connect = async () => {
  const fallbackConnection = "mongodb://mongo:27017/your_spotify";
  const endpoint = getWithDefault("MONGO_ENDPOINT", fallbackConnection);
  // The endpoint can hold passwords, in the credentials and in its options
  const shownEndpoint = endpoint
    .replace(/\/\/[^@/]*@/, "//***@")
    .replace(/\?.*$/, "");
  // Driver errors quote a malformed endpoint as is
  const shownError = (e: unknown) =>
    String(e instanceof Error ? e.message : e).replaceAll(
      endpoint,
      shownEndpoint,
    );
  logger.info(`Trying to connect to database at ${shownEndpoint}`);
  let client: Mongoose | undefined;
  let lastError: Error | undefined;
  for (let i = 0; i < TRIES; i += 1) {
    try {
      client = await connectToDb(endpoint, { connectTimeoutMS: 3000 });
      break;
    } catch (e) {
      lastError = e;
      logger.error(
        `Failed to connect to database, try ${i + 1}/${TRIES}: ${shownError(e)}`,
      );
      await wait(WAIT_MS);
    }
  }
  if (!client) {
    throw new Error(shownError(lastError));
  }
  logger.info("Connected to database !");
  return client;
};
