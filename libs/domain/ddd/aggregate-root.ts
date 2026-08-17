import { Entity } from "./entity";

/**
 * An entity that owns a consistency boundary: the thing you load, change and
 * save as one unit, and whose invariants span more than a single row.
 *
 * In this app that means Asset (its ownership shares must total 100%) and
 * Person (its contributions belong to it and are deleted with it). Everything
 * reached through a root is modified through that root, which is why
 * `replaceAssetOwners` is called inside the same transaction as the asset
 * write rather than from its own endpoint.
 *
 * Deliberately no domain-event machinery: nothing in the app publishes or
 * subscribes to events today, and an unused event bus is a liability, not
 * robustness. This class stays a marker of the boundary until something needs
 * more.
 */
export abstract class AggregateRoot<TRow extends { id: number }> extends Entity<TRow> {}
