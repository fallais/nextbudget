import "reflect-metadata";
import {
  DataSource,
  type EntitySchema,
  type ObjectLiteral,
  type Repository,
} from "typeorm";
import { ALL_ENTITIES } from "@infrastructure/persistence/schemas";

// Lazy, process-global DataSource. Initialized on first use (never at import
// time) so `next build` does not require a live database. Cached on globalThis
// so Next.js HMR / multiple module instances share one pool.
declare global {
  var __nextbudgetDataSource: Promise<DataSource> | undefined;
}

function buildDataSource(): DataSource {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Point it at your Postgres, e.g. " +
        "postgres://nextbudget:nextbudget@localhost:5432/nextbudget",
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
  if (!global.__nextbudgetDataSource) {
    global.__nextbudgetDataSource = buildDataSource()
      .initialize()
      .catch((err) => {
        // Reset so a later call can retry after a transient connection failure.
        global.__nextbudgetDataSource = undefined;
        throw err;
      });
  }
  return global.__nextbudgetDataSource;
}

/** Convenience: resolve a repository for an entity, initializing the DS. */
export async function repo<T extends ObjectLiteral>(
  entity: EntitySchema<T>,
): Promise<Repository<T>> {
  return (await getDataSource()).getRepository(entity);
}
