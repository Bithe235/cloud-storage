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

            // Prepend Go Backend URI if request is an API call
            const envUrl = process.env.NEXT_PUBLIC_API_URL;
            const baseUrl = envUrl || 'https://server.fahadakash.com/penta';

            const fetchUrl = url.startsWith("/api") ? `${baseUrl}${url}` : url;

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

    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    const baseUrl = envUrl || 'https://server.fahadakash.com/penta';

    return { apiFetch, baseUrl };
}
