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

            // Prepend Go Backend URI if request is an API call
            // Priority: .env > Auto-detect (localhost vs server.fahadakash.com)
            const envUrl = process.env.NEXT_PUBLIC_API_URL;
            const baseUrl = envUrl || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:8040'
                : 'https://server.fahadakash.com/penta');

            const fetchUrl = url.startsWith("/api") ? `${baseUrl}${url}` : url;

            const res = await fetch(fetchUrl, { ...options, headers });

            if (res.status === 204) return null;

            const text = await res.text().catch(() => "");
            let data: any = null;

            try {
                if (text) data = JSON.parse(text);
            } catch (err) {
                // Response is not JSON
            }

            if (!res.ok) {
                if (res.status === 503 && data && data.reason) {
                    throw new Error(`MAINTENANCE: ${data.reason}`);
                }
                if (res.status === 403 && data && data.reason) {
                    throw new Error(`BANNED: ${data.reason}`);
                }
                throw new Error((data && data.error) || text || `HTTP Error ${res.status}`);
            }

            return data !== null ? data : text;
        },
        [token]
    );

    return { apiFetch };
}
