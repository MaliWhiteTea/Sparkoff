import { router } from '@inertiajs/react';
import type { Method } from '@inertiajs/core';
import { createContext, ReactNode, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';

type GuardContextValue = {
    setDirty: (id: string, dirty: boolean) => void;
};

const GuardContext = createContext<GuardContextValue | null>(null);

export function hasFormChanged(initial: unknown, current: unknown): boolean {
    return JSON.stringify(initial) !== JSON.stringify(current);
}

export function useUnsavedChanges(dirty: boolean): void {
    const context = useContext(GuardContext);
    const id = useId();

    useEffect(() => {
        if (!context) return;

        context.setDirty(id, dirty);

        return () => context.setDirty(id, false);
    }, [context, dirty, id]);
}

export default function UnsavedChangesProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
    const [dirtyIds, setDirtyIds] = useState<Set<string>>(() => new Set());
    const [pendingVisit, setPendingVisit] = useState<{ url: string; method: Method } | null>(null);
    const allowNextVisit = useRef(false);
    const hasDirtyChanges = enabled && dirtyIds.size > 0;
    const hasDirtyChangesRef = useRef(hasDirtyChanges);

    hasDirtyChangesRef.current = hasDirtyChanges;

    const setDirty = useCallback((id: string, dirty: boolean) => {
        setDirtyIds((current) => {
            const alreadyDirty = current.has(id);
            if (alreadyDirty === dirty) return current;

            const next = new Set(current);
            if (dirty) next.add(id);
            else next.delete(id);

            return next;
        });
    }, []);

    const context = useMemo(() => ({ setDirty }), [setDirty]);

    useEffect(() => {
        if (enabled) return;
        setDirtyIds(new Set());
        setPendingVisit(null);
    }, [enabled]);

    useEffect(() => {
        if (hasDirtyChanges) return;
        setPendingVisit(null);
    }, [hasDirtyChanges]);

    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (!hasDirtyChangesRef.current) return;

            event.preventDefault();
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    useEffect(() => router.on('before', (event) => {
        if (allowNextVisit.current) {
            allowNextVisit.current = false;
            return;
        }

        const visit = event.detail.visit;
        const isLogout = visit.method === 'post' && visit.url.pathname === '/yonetim/cikis';
        if (!hasDirtyChangesRef.current || visit.prefetch || (visit.method !== 'get' && !isLogout)) return;

        setPendingVisit({ url: visit.url.href, method: visit.method });
        return false;
    }), []);

    const leavePage = () => {
        if (!pendingVisit) return;

        const visit = pendingVisit;
        allowNextVisit.current = true;
        setPendingVisit(null);
        router.visit(visit.url, { method: visit.method });
    };

    return <GuardContext.Provider value={context}>
        {children}
        <ConfirmDialog
            open={pendingVisit !== null}
            eyebrow="KAYDEDİLMEMİŞ DEĞİŞİKLİK"
            title="Bu sayfadan ayrılmak istiyor musunuz?"
            description="Kaydetmediğiniz değişiklikler var. Ayrılırsanız bu değişiklikler kaybolacak."
            confirmLabel="Değişiklikleri bırak ve ayrıl"
            cancelLabel="Sayfada kal"
            tone="danger"
            onConfirm={leavePage}
            onClose={() => setPendingVisit(null)}
        />
    </GuardContext.Provider>;
}
