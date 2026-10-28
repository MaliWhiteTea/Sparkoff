import { usePage } from '@inertiajs/react';
import { useEffect, useMemo, useRef } from 'react';

const STORAGE_PREFIX = 'sparkoff.admin.draft';
const DRAFT_VERSION = 1;
const WRITE_DELAY_MS = 450;

export type SafeDraft<T> = {
    version: number;
    updatedAt: string;
    value: T;
};

type Options<T extends object, K extends keyof T> = {
    key: string;
    source: T;
    fields: readonly K[];
    enabled: boolean;
};

export function draftStorageKey(scope: string, key: string): string {
    return `${STORAGE_PREFIX}.${scope}.${key}`;
}

export function useSafeDraft<T extends object, K extends keyof T>({ key, source, fields, enabled }: Options<T, K>): void {
    const page = usePage<{ auth: { user: { draftScope?: string } | null } }>();
    const scope = page.props.auth.user?.draftScope;
    const storageKey = scope ? draftStorageKey(scope, key) : null;
    const wasEnabled = useRef(false);
    const serializedValue = useMemo(() => JSON.stringify(Object.fromEntries(
        fields.map((field) => [field, source[field]]),
    )), [fields, source]);

    useEffect(() => {
        if (!storageKey) return;

        if (!enabled) {
            if (wasEnabled.current) {
                try {
                    window.localStorage.removeItem(storageKey);
                } catch {
                    // Depolama kapalıysa form çalışmaya devam eder.
                }
            }
            wasEnabled.current = false;
            return;
        }

        wasEnabled.current = true;
        const timer = window.setTimeout(() => {
            try {
                const draft: SafeDraft<unknown> = {
                    version: DRAFT_VERSION,
                    updatedAt: new Date().toISOString(),
                    value: JSON.parse(serializedValue),
                };
                window.localStorage.setItem(storageKey, JSON.stringify(draft));
            } catch {
                // Depolama kapalı veya doluysa form çalışmaya devam eder.
            }
        }, WRITE_DELAY_MS);

        return () => window.clearTimeout(timer);
    }, [enabled, serializedValue, storageKey]);
}
