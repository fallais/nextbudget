import "server-only";
import { User, type UserRow, type NewUser } from "@domain/entities";
import type { UserRepository } from "@domain/repositories";
import { getDataSource } from "@infrastructure/persistence/client";
import {
  AccountEntity,
  AssetEntity,
  BudgetEntity,
  ContributionEntity,
  FixedExpenseEntity,
  PersonEntity,
  RuleEntity,
  SessionEntity,
  UserEntity,
} from "@infrastructure/persistence/schemas";
import { TypeOrmRepository } from "./typeorm-repository";

export class TypeOrmUserRepository
  extends TypeOrmRepository<User, UserRow, NewUser>
  implements UserRepository
{
  async findActiveByIdentifier(identifier: string): Promise<User | null> {
    const row = await (await this.repo())
      .createQueryBuilder("u")
      .where("(u.email = :id OR u.name = :id)", { id: identifier })
      .andWhere("u.is_active = true")
      .getOne();
    return row ? User.reconstitute(row) : null;
  }

  async findOwner(): Promise<User | null> {
    const row = await (await this.repo()).findOne({ where: { role: "owner" } as never });
    return row ? User.reconstitute(row) : null;
  }

  async countActiveOwners(): Promise<number> {
    return (await this.repo()).count({ where: { role: "owner", isActive: true } as never });
  }

  async deleteWithReferences(userId: number): Promise<boolean> {
    const ds = await getDataSource();
    return ds.transaction(async (manager) => {
      const existing = await manager.getRepository(UserEntity).findOne({ where: { id: userId } });
      if (!existing) return false;

      await manager.getRepository(SessionEntity).delete({ userId });
      await manager.getRepository(PersonEntity).update({ userId }, { userId: null });

      // Everything ownable loses its stamp rather than its row.
      for (const schema of [
        AccountEntity,
        RuleEntity,
        ContributionEntity,
        FixedExpenseEntity,
        BudgetEntity,
        AssetEntity,
      ]) {
        await manager.getRepository(schema).update({ ownerId: userId }, { ownerId: null });
      }

      await manager.getRepository(UserEntity).delete(userId);
      return true;
    });
  }
}
