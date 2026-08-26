import { apiFetch } from "./client";
import type { Admin } from "../../store/authStore";

export interface LoginResponse {
  token: string;
  admin: Admin;
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logout(): Promise<{ ok: boolean }> {
  return apiFetch("/auth/logout", { method: "POST" });
}
