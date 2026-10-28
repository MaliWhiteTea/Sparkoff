import { usePage } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_PREFIX = 'sparkoff.admin.draft';
const DRAFT_VERSION = 1;
const WRITE_DELAY_MS = 450;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

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

type Controls<T> = {
    draft: SafeDraft<T> | null;
    clearDraft: () => void;
};

export function draftStorageKey(scope: string, key: string): string {
    return `${STORAGE_PREFIX}.${scope}.${key}`;
}

export function useSafeDraft<T extends object, K extends keyof T>({ key, source, fields, enabled }: Options<T, K>): Controls<Partial<Pick<T, K>>> {
    const page = usePage<{ auth: { user: { draftScope?: string } | null } }>();
    const scope = page.props.auth.user?.draftScope;
    const storageKey = scope ? draftStorageKey(scope, key) : null;
    const wasEnabled = useRef(false);
    const [draft, setDraft] = useState<SafeDraft<Partial<Pick<T, K>>> | null>(null);
    const fieldsKey = fields.map(String).join('\u0000');
    const serializedValue = useMemo(() => JSON.stringify(Object.fromEntries(
        fields.map((field) => [field, source[field]]),
    )), [fieldsKey, source]);

    const clearDraft = useCallback(() => {
        if (storageKey) {
            try {
                window.localStorage.removeItem(storageKey);
            } catch {
                // Depolama kapalıysa form çalışmaya devam eder.
            }
        }
        setDraft(null);
    }, [storageKey]);

    useEffect(() => {
        if (!storageKey) {
            setDraft(null);
            return;
        }

        try {
            const stored = window.localStorage.getItem(storageKey);
            if (!stored) {
                setDraft(null);
                return;
            }

            const parsed = JSON.parse(stored) as SafeDraft<Record<string, unknown>>;
            const updatedAt = Date.parse(parsed.updatedAt);
            if (parsed.version !== DRAFT_VERSION || !Number.isFinite(updatedAt) || Date.now() - updatedAt > MAX_AGE_MS || !parsed.value || typeof parsed.value !== 'object') {
                clearDraft();
                return;
            }

            const value = Object.fromEntries(fields
                .filter((field) => Object.prototype.hasOwnProperty.call(parsed.value, field))
                .map((field) => [field, parsed.value[String(field)]])) as Partial<Pick<T, K>>;
            setDraft({ version: parsed.version, updatedAt: parsed.updatedAt, value });
        } catch {
            clearDraft();
        }
    }, [clearDraft, fieldsKey, storageKey]);

    useEffect(() => {
        if (!storageKey) return;

        if (!enabled) {
            if (wasEnabled.current) {
                clearDraft();
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
    }, [clearDraft, enabled, serializedValue, storageKey]);

    return { draft, clearDraft };
}
