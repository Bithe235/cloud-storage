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

            if (!(options.body instanceof FormData)) {
                headers["Content-Type"] = headers["Content-Type"] || "application/json";
            }

            const fetchUrl = url.startsWith("/api") ? `http://localhost:8080${url}` : url;

            const res = await fetch(fetchUrl, { ...options, headers });

            if (res.status === 204) return null;

            const text = await res.text().catch(() => "");
            let data: any = null;

            try {
                if (text) data = JSON.parse(text);
            } catch (err) { }

            if (!res.ok) {
                throw new Error((data && data.error) || text || `HTTP Error ${res.status}`);
            }

            return data !== null ? data : text;
        },
        [token]
    );

    return { apiFetch };
}
