import { useEffect, useState } from 'react';

const prefix = 'sparkoff.return.';

export function useRememberListUrl(key: string, url: string) {
    useEffect(() => {
        sessionStorage.setItem(`${prefix}${key}`, url);
    }, [key, url]);
}

export function useListReturnUrl(key: string, fallback: string) {
    const [url, setUrl] = useState(fallback);

    useEffect(() => {
        const remembered = sessionStorage.getItem(`${prefix}${key}`);
        if (remembered?.startsWith('/')) setUrl(remembered);
    }, [fallback, key]);

    return url;
}
