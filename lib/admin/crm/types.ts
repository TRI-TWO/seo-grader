export type NewPortalClientInput = {
  contact_name: string;
  company_name: string;
  email: string;
  phone: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  zip: string;
  industry: string;
};

export type PortalClientListItem = {
  id: string;
  client_id: string;
  auth_user_id: string;
  org_id: string;
  contact_name: string;
  company_name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  zip: string;
  industry: string;
  invite_status: string;
  invited_at: string;
  invite_email_sent_at: string | null;
  invite_last_error: string | null;
  questionnaire_status: string;
  created_at: string;
};

export type CreatePortalClientResult = {
  registrationId: string;
  clientId: string;
  authUserId: string;
  inviteEmailSent: boolean;
  inviteStatus: "sent" | "failed";
  inviteError: string | null;
};

export type SoftDeletePortalClientsResult = {
  requested: number;
  removed: number;
  notFoundOrInactive: number;
  authBanFailures: string[];
};
