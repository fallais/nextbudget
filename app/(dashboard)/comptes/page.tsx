import { redirect } from "next/navigation";

/**
 * Accounts moved into Paramètres — creating and naming a bank account is
 * configuration, not something you visit while looking at your money.
 *
 * This route stays as a redirect rather than being deleted: `/comptes` is a
 * year-old bookmark for existing installs, and a 404 is a worse answer than
 * the page it moved to.
 */
export default function ComptesPage() {
  redirect("/parametres");
}
