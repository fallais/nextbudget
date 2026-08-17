import "reflect-metadata";
import {
  DataSource,
  type EntitySchema,
  type ObjectLiteral,
  type Repository,
} from "typeorm";
import { ALL_ENTITIES } from "@infrastructure/db/schemas";

// Lazy, process-global DataSource. Initialized on first use (never at import
// time) so `next build` does not require a live database. Cached on globalThis
// so Next.js HMR / multiple module instances share one pool.
declare global {
  var __banquejsDataSource: Promise<DataSource> | undefined;
}

function buildDataSource(): DataSource {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Point it at your Postgres, e.g. " +
        "postgres://banquejs:banquejs@localhost:5432/banquejs",
    );
  }
  return new DataSource({
    type: "postgres",
    url,
    entities: ALL_ENTITIES,
    // No migrations (per project decision): the schema is synced from entities.
    synchronize: true,
    logging: false,
  });
}

export function getDataSource(): Promise<DataSource> {
  if (!global.__banquejsDataSource) {
    global.__banquejsDataSource = buildDataSource()
      .initialize()
      .catch((err) => {
        // Reset so a later call can retry after a transient connection failure.
        global.__banquejsDataSource = undefined;
        throw err;
      });
  }
  return global.__banquejsDataSource;
}

/** Convenience: resolve a repository for an entity, initializing the DS. */
export async function repo<T extends ObjectLiteral>(
  entity: EntitySchema<T>,
): Promise<Repository<T>> {
  return (await getDataSource()).getRepository(entity);
}
