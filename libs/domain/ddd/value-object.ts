/**
 * Something defined entirely by its values, with no identity: 12,50 € is
 * 12,50 €, and two of them are interchangeable.
 *
 * Value objects are immutable and validate on construction, so an invalid one
 * cannot exist. `Money`, `Share` and `Ownership` are the ones here.
 */
export abstract class ValueObject {
  abstract equals(other: this): boolean;
}
