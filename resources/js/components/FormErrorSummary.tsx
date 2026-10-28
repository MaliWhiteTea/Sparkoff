import { useEffect, useRef } from 'react';

export type FormErrors = Record<string, string>;

export function FormErrorSummary({ errors }: { errors: FormErrors }) {
    const ref = useRef<HTMLDivElement>(null);
    const messages = [...new Set(Object.values(errors))];
    useEffect(() => { if (messages.length) ref.current?.focus(); }, [messages.join('|')]);
    if (!messages.length) return null;

    return <div ref={ref} className="form-error access-error-summary" role="alert" tabIndex={-1}><strong>Bu form kaydedilemedi.</strong><ul>{messages.map((message) => <li key={message}>{message}</li>)}</ul></div>;
}

export function FieldError({ errors, name }: { errors: FormErrors; name: string }) {
    return errors[name] ? <small className="field-error">{errors[name]}</small> : null;
}
