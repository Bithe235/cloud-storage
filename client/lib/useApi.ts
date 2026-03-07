"use client";

import { useAuth } from "@/app/context/AuthContext";
import { useCallback } from "react";

export function useApi() {
    const { token } = useAuth();

    const apiFetch = useCallback(
        async (url: string, options: RequestInit = {}) => {
            const headers: Record<string, string> = {
                ...(options.headers as Record<string, string>),
            };

            if (token) {
                headers["Authorization"] = `Bearer ${token}`;
            }

            // Don't set Content-Type for FormData
            if (!(options.body instanceof FormData)) {
                headers["Content-Type"] = headers["Content-Type"] || "application/json";
            }

            const res = await fetch(url, { ...options, headers });

            if (res.status === 204) return null;

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Something went wrong");
            return data;
        },
        [token]
    );

    return { apiFetch };
}
