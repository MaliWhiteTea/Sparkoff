import { usePage } from '@inertiajs/react';

type AuthProps = { auth: { user: { permissions: string[] } } };

export default function usePermissions() {
    const permissions = usePage<AuthProps>().props.auth.user.permissions;

    return (permission: string) => permissions.includes(permission);
}
