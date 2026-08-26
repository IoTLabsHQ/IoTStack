import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shell } from "../components/Shell";
import { ApiError } from "../lib/api/client";
import {
  getSettings,
  updateDomain,
  getDomainStatus,
  saveSmtp,
  type SmtpInput,
} from "../lib/api/settings";

const CHECKING_DOMAIN_KEY = "iotstack.checkingDomain";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["settings"], queryFn: getSettings });

  const [domainInput, setDomainInput] = useState("");
  const [domainSynced, setDomainSynced] = useState(false);
  const [checkingDomain, setCheckingDomain] = useState<string | null>(() =>
    localStorage.getItem(CHECKING_DOMAIN_KEY),
  );
  const [domainError, setDomainError] = useState<string | null>(null);
  const [domainWarning, setDomainWarning] = useState<string | null>(null);

  const [smtp, setSmtp] = useState<SmtpInput>({ host: "", port: 587, user: "", password: "", from: "" });
  const [smtpError, setSmtpError] = useState<string | null>(null);
  const [smtpSuccess, setSmtpSuccess] = useState(false);

  // Sync the domain input from the loaded settings, once.
  useEffect(() => {
    if (data && !domainSynced) {
      setDomainInput(data.domain);
      setDomainSynced(true);
    }
  }, [data, domainSynced]);

  const domainMutation = useMutation({
    mutationFn: (domain: string) => updateDomain(domain),
    onSuccess: (result) => {
      setDomainError(null);
      setDomainWarning(result.caddyWarning ?? null);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      if (result.domain) {
        localStorage.setItem(CHECKING_DOMAIN_KEY, result.domain);
        setCheckingDomain(result.domain);
      } else {
        localStorage.removeItem(CHECKING_DOMAIN_KEY);
        setCheckingDomain(null);
      }
    },
    onError: (err: unknown) => {
      setDomainError(err instanceof ApiError ? err.message : "Failed to save domain");
    },
  });

  const domainStatusQuery = useQuery({
    queryKey: ["domain-status", checkingDomain],
    queryFn: getDomainStatus,
    enabled: !!checkingDomain,
    refetchInterval: (query) => (query.state.data?.active ? false : 3000),
  });

  useEffect(() => {
    if (domainStatusQuery.data?.active) {
      localStorage.removeItem(CHECKING_DOMAIN_KEY);
      setCheckingDomain(null);
    }
  }, [domainStatusQuery.data?.active]);

  const smtpMutation = useMutation({
    mutationFn: (input: SmtpInput) => saveSmtp(input),
    onSuccess: () => {
      setSmtpError(null);
      setSmtpSuccess(true);
      setSmtp((s) => ({ ...s, password: "" }));
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (err: unknown) => {
      setSmtpSuccess(false);
      setSmtpError(err instanceof ApiError ? err.message : "SMTP verification failed");
    },
  });

  return (
    <Shell>
      <h1 className="mb-6 text-lg font-semibold text-slate-900">Settings</h1>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="flex flex-col gap-8">
          <section className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="mb-1 text-base font-semibold text-slate-900">Domain</h2>
            <p className="mb-4 text-sm text-slate-500">
              Optional. IP access always keeps working over HTTP regardless of domain status.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                domainMutation.mutate(domainInput.trim().toLowerCase());
              }}
              className="flex gap-2"
            >
              <input
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                placeholder="e.g. iot.example.com — leave empty for IP-only"
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={domainMutation.isPending}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {domainMutation.isPending ? "Saving…" : "Save"}
              </button>
            </form>

            {domainError && <p className="mt-3 text-sm text-red-600">{domainError}</p>}

            {domainWarning && (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
                <p className="text-sm text-amber-900">{domainWarning}</p>
              </div>
            )}

            {checkingDomain && (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
                <p className="text-sm text-amber-900">
                  Checking HTTPS for <span className="font-mono">{checkingDomain}</span>… this can
                  take a minute while DNS and certificate issuance complete.
                </p>
              </div>
            )}

            {!checkingDomain && data?.domain && (
              <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4">
                <p className="text-sm text-emerald-800">
                  HTTPS is active for <span className="font-mono">{data.domain}</span>.
                </p>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="mb-1 text-base font-semibold text-slate-900">Email (SMTP)</h2>
            <p className="mb-4 text-sm text-slate-500">
              Optional. Only used once the connection below verifies successfully.
            </p>
            <p className="mb-4 text-sm font-medium text-slate-700">
              Status:{" "}
              {data?.smtp.active ? (
                <span className="text-emerald-700">
                  Active since {new Date(data.smtp.verifiedAt + "Z").toLocaleString()}
                </span>
              ) : (
                <span className="text-slate-500">Not configured</span>
              )}
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                smtpMutation.mutate(smtp);
              }}
              className="grid grid-cols-2 gap-3"
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Host</label>
                <input
                  value={smtp.host}
                  onChange={(e) => setSmtp((s) => ({ ...s, host: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Port</label>
                <input
                  type="number"
                  value={smtp.port}
                  onChange={(e) => setSmtp((s) => ({ ...s, port: Number(e.target.value) }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Username</label>
                <input
                  value={smtp.user}
                  onChange={(e) => setSmtp((s) => ({ ...s, user: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
                <input
                  type="password"
                  value={smtp.password}
                  onChange={(e) => setSmtp((s) => ({ ...s, password: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">From address</label>
                <input
                  value={smtp.from}
                  onChange={(e) => setSmtp((s) => ({ ...s, from: e.target.value }))}
                  placeholder="iotstack@your-domain.com"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>
              <div className="col-span-2">
                <button
                  type="submit"
                  disabled={smtpMutation.isPending}
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {smtpMutation.isPending ? "Testing…" : "Test & Save"}
                </button>
              </div>
            </form>

            {smtpError && (
              <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-4">
                <p className="text-sm text-red-700">{smtpError}</p>
              </div>
            )}
            {smtpSuccess && (
              <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4">
                <p className="text-sm text-emerald-800">SMTP connection verified and saved.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </Shell>
  );
}
