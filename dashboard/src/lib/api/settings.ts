import { apiFetch } from "./client";

export interface SettingsResponse {
  domain: string;
  smtp: {
    host: string | null;
    port: number | null;
    user: string | null;
    from: string | null;
    verifiedAt: string | null;
    active: boolean;
  };
}

export interface DomainStatusResponse {
  domain: string;
  active: boolean;
}

export interface SmtpInput {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
}

export function getSettings(): Promise<SettingsResponse> {
  return apiFetch("/settings");
}

export function updateDomain(
  domain: string,
): Promise<{ domain: string; caddyWarning?: string }> {
  return apiFetch("/settings/domain", {
    method: "PUT",
    body: JSON.stringify({ domain }),
  });
}

export function getDomainStatus(): Promise<DomainStatusResponse> {
  return apiFetch("/settings/domain-status");
}

export function saveSmtp(input: SmtpInput): Promise<{ ok: true; verifiedAt: string }> {
  return apiFetch("/settings/smtp", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}
