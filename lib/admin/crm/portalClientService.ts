import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSupabaseClient } from "@/lib/supabase";
import { requireDatabaseUrlOrThrow } from "./crmEnv";
import type {
  CreatePortalClientResult,
  NewPortalClientInput,
  PortalClientListItem,
  SoftDeletePortalClientsResult,
} from "./types";
import {
  assertWelcomeEmailDispatchReady,
  sendArchClientWelcomeEmail,
} from "./welcomeEmail";

function randomBootstrapPassword(): string {
  return randomBytes(36).toString("base64url");
}

export async function listPortalClients(): Promise<PortalClientListItem[]> {
  requireDatabaseUrlOrThrow();
  const rows = await prisma.client_portal_registrations.findMany({
    where: { deleted_at: null },
    orderBy: { created_at: "desc" },
    take: 500,
  });
  return rows.map((r) => ({
    id: r.id,
    client_id: r.client_id,
    auth_user_id: r.auth_user_id,
    org_id: r.org_id,
    contact_name: r.contact_name,
    company_name: r.company_name,
    email: r.email,
    phone: r.phone,
    city: r.city,
    state: r.state,
    zip: r.zip,
    industry: r.industry,
    invite_status: r.invite_status,
    invited_at: r.invited_at.toISOString(),
    invite_email_sent_at: r.invite_email_sent_at?.toISOString() ?? null,
    invite_last_error: r.invite_last_error ?? null,
    questionnaire_status: r.questionnaire_status,
    created_at: r.created_at.toISOString(),
  }));
}

async function deleteProvisionedRecords(args: {
  authUserId: string;
  clientId: string;
  orgId: string;
}): Promise<void> {
  const supabase = getSupabaseClient();
  try {
    await prisma.client_portal_registrations.deleteMany({
      where: { client_id: args.clientId },
    });
  } catch {
    // ignore
  }
  try {
    await prisma.profiles.deleteMany({ where: { user_id: args.authUserId } });
  } catch {
    // ignore
  }
  try {
    await prisma.org_members.deleteMany({
      where: { org_id: args.orgId, user_id: args.authUserId },
    });
  } catch {
    // ignore
  }
  try {
    await prisma.clients.delete({ where: { id: args.clientId } });
  } catch {
    // ignore
  }
  try {
    await prisma.organizations.delete({ where: { id: args.orgId } });
  } catch {
    // ignore
  }
  try {
    await supabase.auth.admin.deleteUser(args.authUserId);
  } catch {
    // ignore
  }
}

export async function createPortalClientAndInvite(
  input: NewPortalClientInput
): Promise<CreatePortalClientResult> {
  requireDatabaseUrlOrThrow();
  assertWelcomeEmailDispatchReady();
  const email = input.email.trim().toLowerCase();
  const supabase = getSupabaseClient();

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: randomBootstrapPassword(),
    email_confirm: true,
    user_metadata: { role: "VISITOR" },
  });

  if (authError || !authData.user) {
    throw new Error(authError?.message || "Failed to create auth user (email may already exist)");
  }

  const authUserId = authData.user.id;
  let orgId: string | undefined;
  let clientId: string | undefined;

  try {
    const { org, client, reg } = await prisma.$transaction(async (tx) => {
      const o = await tx.organizations.create({
        data: { name: input.company_name.trim() },
      });
      const c = await tx.clients.create({
        data: {
          org_id: o.id,
          name: input.company_name.trim(),
          industry: input.industry.trim(),
          website_url: null,
          timezone: null,
        },
      });
      await tx.org_members.create({
        data: {
          org_id: o.id,
          user_id: authUserId,
          role: "owner",
        },
      });
      await tx.profiles.upsert({
        where: { user_id: authUserId },
        create: {
          user_id: authUserId,
          display_name: input.contact_name.trim(),
          is_platform_admin: false,
        },
        update: {
          display_name: input.contact_name.trim(),
        },
      });
      const r = await tx.client_portal_registrations.create({
        data: {
          client_id: c.id,
          auth_user_id: authUserId,
          org_id: o.id,
          contact_name: input.contact_name.trim(),
          company_name: input.company_name.trim(),
          email,
          phone: input.phone.trim(),
          address_line_1: input.address_line_1.trim(),
          address_line_2: input.address_line_2?.trim() || null,
          city: input.city.trim(),
          state: input.state.trim(),
          zip: input.zip.trim(),
          industry: input.industry.trim(),
          invite_status: "pending",
          questionnaire_status: "not_started",
        },
      });
      return { org: o, client: c, reg: r };
    });

    orgId = org.id;
    clientId = client.id;

    await prisma.client_portal_registrations.update({
      where: { id: reg.id },
      data: { invite_status: "sending", invite_last_error: null },
    });

    try {
      await sendArchClientWelcomeEmail({
        to: email,
        contact_name: input.contact_name.trim(),
        company_name: input.company_name.trim(),
      });
    } catch (emailErr) {
      const msg = emailErr instanceof Error ? emailErr.message : "Invite email failed";
      await prisma.client_portal_registrations.update({
        where: { id: reg.id },
        data: { invite_status: "failed", invite_last_error: msg },
      });
      return {
        registrationId: reg.id,
        clientId: client.id,
        authUserId,
        inviteEmailSent: false,
        inviteStatus: "failed",
        inviteError: msg,
      };
    }

    await prisma.client_portal_registrations.update({
      where: { id: reg.id },
      data: {
        invite_status: "sent",
        invite_email_sent_at: new Date(),
        invite_last_error: null,
      },
    });

    return {
      registrationId: reg.id,
      clientId: client.id,
      authUserId,
      inviteEmailSent: true,
      inviteStatus: "sent",
      inviteError: null,
    };
  } catch (e) {
    if (orgId && clientId) {
      await deleteProvisionedRecords({ authUserId, clientId, orgId });
    } else {
      try {
        await supabase.auth.admin.deleteUser(authUserId);
      } catch {
        // ignore
      }
    }
    throw e;
  }
}

export async function softDeletePortalClients(
  clientIds: string[]
): Promise<SoftDeletePortalClientsResult> {
  const unique = [...new Set(clientIds.map((id) => id.trim()).filter(Boolean))];
  const requested = unique.length;
  if (!requested) {
    return { requested: 0, removed: 0, notFoundOrInactive: 0, authBanFailures: [] };
  }

  requireDatabaseUrlOrThrow();
  const supabase = getSupabaseClient();

  const rows = await prisma.client_portal_registrations.findMany({
    where: { client_id: { in: unique }, deleted_at: null },
    select: { id: true, auth_user_id: true, email: true },
  });

  const now = new Date();
  await prisma.client_portal_registrations.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: {
      deleted_at: now,
      invite_status: "inactive",
    },
  });

  const authBanFailures: string[] = [];
  for (const r of rows) {
    try {
      await supabase.auth.admin.updateUserById(r.auth_user_id, {
        ban_duration: "876600h",
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      authBanFailures.push(`${r.email} (${r.auth_user_id}): ${detail}`);
    }
  }

  return {
    requested,
    removed: rows.length,
    notFoundOrInactive: requested - rows.length,
    authBanFailures,
  };
}

export async function updatePortalQuestionnaireStatus(
  clientId: string,
  status: "in_progress" | "completed"
): Promise<void> {
  await prisma.client_portal_registrations.updateMany({
    where: { client_id: clientId, deleted_at: null },
    data: { questionnaire_status: status },
  });
}
