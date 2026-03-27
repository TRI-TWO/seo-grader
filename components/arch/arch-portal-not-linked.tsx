import { ArchCard } from "@/components/arch/arch-card";

export function ArchPortalNotLinked({ email }: { email: string | null }) {
  return (
    <div className="max-w-xl space-y-4">
      <ArchCard title="Portal not linked yet">
        <p className="text-sm text-zinc-300 leading-relaxed">
          You are signed in{email ? ` as ${email}` : ""}, but this account is not connected to a
          client record in TRI-TWO&apos;s system. Ask your admin to add you to an organization in
          Supabase ({`org_members`}) with a matching {`clients`} row, or run the dev seed script{" "}
          <code className="text-zinc-400">prisma/scripts/link_user_org_client.sql</code> (see{" "}
          <code className="text-zinc-400">npm run db:link-arch-user</code> after editing your user
          UUID).
        </p>
      </ArchCard>
    </div>
  );
}
