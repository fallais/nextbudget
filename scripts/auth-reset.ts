import "reflect-metadata";
import { getDataSource } from "../lib/db/client";
import { SettingEntity, UserEntity } from "../lib/db/entities";
import { hashPassword } from "../lib/auth/password";

/**
 * Break-glass recovery, run from the server.
 *
 * Once auth is enforced, every configuration surface sits behind a login — so
 * a forgotten owner password would otherwise be an unrecoverable lockout. This
 * is the deliberate escape hatch, and it lives here rather than in the UI
 * because it is an ops action: whoever can run it already has the database.
 *
 *   npm run auth:reset                 # drop back to open mode (no login)
 *   npm run auth:reset -- <password>   # keep auth on, set a new owner password
 */
async function main() {
  const password = process.argv[2];
  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);
  const settingRepo = ds.getRepository(SettingEntity);

  const owner = await userRepo.findOne({ where: { role: "owner" } });
  if (!owner) {
    console.error("No owner user found. Run `npm run db:migrate` first.");
    process.exitCode = 1;
    await ds.destroy();
    return;
  }

  if (password) {
    if (password.length < 8) {
      console.error("Password must be at least 8 characters.");
      process.exitCode = 1;
      await ds.destroy();
      return;
    }
    await userRepo.update(owner.id, { passwordHash: await hashPassword(password) });
    console.log(`Password reset for owner "${owner.name}". Auth mode unchanged.`);
  } else {
    await settingRepo.save({ key: "authMode", value: "open" });
    console.log(
      `Auth mode set to "open" — the app no longer asks for a login and resolves to "${owner.name}".\n` +
        "Re-enable it from Paramètres → Confidentialité.",
    );
  }

  await ds.destroy();
}

void main();
