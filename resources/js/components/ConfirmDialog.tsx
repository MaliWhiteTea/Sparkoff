import { ReactNode, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Props = {
    open: boolean;
    eyebrow?: string;
    title: string;
    description: ReactNode;
    confirmLabel: string;
    cancelLabel?: string;
    tone?: 'primary' | 'danger';
    processing?: boolean;
    confirmDisabled?: boolean;
    children?: ReactNode;
    onConfirm: () => void;
    onClose: () => void;
};

const focusableSelector = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

export default function ConfirmDialog({
    open,
    eyebrow = 'ONAY GEREKİYOR',
    title,
    description,
    confirmLabel,
    cancelLabel = 'Vazgeç',
    tone = 'primary',
    processing = false,
    confirmDisabled = false,
    children,
    onConfirm,
    onClose,
}: Props) {
    const titleId = useId();
    const descriptionId = useId();
    const dialogRef = useRef<HTMLElement>(null);
    const closeRef = useRef(onClose);
    const processingRef = useRef(processing);
    const submissionRef = useRef(false);
    const sawProcessingRef = useRef(false);
    const [submissionLocked, setSubmissionLocked] = useState(false);

    closeRef.current = onClose;
    processingRef.current = processing;

    useEffect(() => {
        if (processing) {
            sawProcessingRef.current = true;
        } else if (sawProcessingRef.current) {
            sawProcessingRef.current = false;
            submissionRef.current = false;
            setSubmissionLocked(false);
        }
    }, [processing]);

    useEffect(() => {
        if (!open) return;

        const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const appRoot = document.getElementById('app');
        const rootWasInert = appRoot?.hasAttribute('inert') ?? false;
        const previousAriaHidden = appRoot?.getAttribute('aria-hidden');
        const previousOverflow = document.body.style.overflow;

        appRoot?.setAttribute('inert', '');
        appRoot?.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = 'hidden';

        const focusInitialElement = window.requestAnimationFrame(() => {
            const dialog = dialogRef.current;
            const preferred = dialog?.querySelector<HTMLElement>('[data-dialog-initial-focus]');
            const fallback = dialog?.querySelector<HTMLElement>(focusableSelector);
            (preferred ?? fallback ?? dialog)?.focus();
        });

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (!processingRef.current) {
                    event.preventDefault();
                    closeRef.current();
                }
                return;
            }
            if (event.key !== 'Tab') return;

            const dialog = dialogRef.current;
            if (!dialog) return;
            const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
            if (focusable.length === 0) {
                event.preventDefault();
                dialog.focus();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown, true);

        return () => {
            window.cancelAnimationFrame(focusInitialElement);
            document.removeEventListener('keydown', handleKeyDown, true);
            document.body.style.overflow = previousOverflow;
            if (appRoot) {
                if (!rootWasInert) appRoot.removeAttribute('inert');
                if (previousAriaHidden == null) appRoot.removeAttribute('aria-hidden');
                else appRoot.setAttribute('aria-hidden', previousAriaHidden);
            }
            opener?.focus();
        };
    }, [open]);

    if (!open || typeof document === 'undefined') return null;

    const submit = () => {
        if (processing || confirmDisabled || submissionRef.current) return;
        submissionRef.current = true;
        setSubmissionLocked(true);
        onConfirm();
    };

    return createPortal(
        <div
            className="site-confirm-backdrop"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && !processing) onClose();
            }}
        >
            <section
                ref={dialogRef}
                className="site-confirm"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                tabIndex={-1}
            >
                <span>{eyebrow}</span>
                <h2 id={titleId}>{title}</h2>
                <div id={descriptionId} className="site-confirm-description">{description}</div>
                {children}
                <div className="site-confirm-actions">
                    <button type="button" className="secondary" disabled={processing} data-dialog-initial-focus onClick={onClose}>{cancelLabel}</button>
                    <button
                        type="button"
                        className={tone}
                        disabled={processing || confirmDisabled || submissionLocked}
                        onClick={submit}
                    >
                        {processing ? 'İşleniyor…' : confirmLabel}
                    </button>
                </div>
            </section>
        </div>,
        document.body,
    );
}
