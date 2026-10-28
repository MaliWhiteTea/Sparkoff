import AdminLayout from '@/components/AdminLayout';
import { FieldError, FormErrors, FormErrorSummary as ErrorSummary } from '@/components/FormErrorSummary';
import SettingsTabs from '@/components/SettingsTabs';
import TableColumns, { ColumnDefinition, initialTableColumns } from '@/components/TableColumns';
import usePermissions from '@/hooks/usePermissions';
import { Head, router, usePage } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

type Permission = { key: string; label: string; isSensitive: boolean };
type Role = { id: number; name: string; slug: string; description: string | null; isSystem: boolean; isProtected: boolean; userCount: number; permissions: string[] };
type User = { id: number; name: string; email: string; isActive: boolean; roles: { id: number; name: string }[] };
type Props = { roles: Role[]; permissionGroups: Record<string, Permission[]>; users: User[] };
function PermissionPicker({ groups, selected, disabled, onChange }: { groups: Record<string, Permission[]>; selected: string[]; disabled?: boolean; onChange: (keys: string[]) => void }) {
    const toggle = (key: string) => onChange(selected.includes(key) ? selected.filter((item) => item !== key) : [...selected, key]);
    return <div className="permission-groups">{Object.entries(groups).map(([module, permissions]) => <section key={module}><header><strong>{module}</strong><button type="button" disabled={disabled} onClick={() => onChange([...new Set([...selected, ...permissions.map((item) => item.key)])])}>Tümünü seç</button></header>{permissions.map((permission) => <label key={permission.key}><input type="checkbox" disabled={disabled} checked={selected.includes(permission.key)} onChange={() => toggle(permission.key)} /><span>{permission.label}{permission.isSensitive && <small>Hassas yetki</small>}</span></label>)}</section>)}</div>;
}

function RoleCard({ role, groups, canUpdate, canDelete }: { role: Role; groups: Record<string, Permission[]>; canUpdate: boolean; canDelete: boolean }) {
    const [data, setData] = useState({ name: role.name, description: role.description ?? '', permissions: role.permissions });
    const [errors, setErrors] = useState<FormErrors>({});
    const [processing, setProcessing] = useState(false);
    const readOnly = role.isProtected || !canUpdate;
    const visitOptions = { preserveScroll: true, errorBag: `role-${role.id}`, onStart: () => setProcessing(true), onError: (nextErrors: FormErrors) => setErrors(nextErrors), onSuccess: () => setErrors({}), onFinish: () => setProcessing(false) };
    const submit = (event: FormEvent) => { event.preventDefault(); if (canUpdate) router.put(`/yonetim/roller/${role.id}`, data, visitOptions); };
    const remove = () => { if (window.confirm('Bu rol kaldırılsın mı?')) router.delete(`/yonetim/roller/${role.id}`, visitOptions); };
    return <form className="admin-panel access-role-card" onSubmit={submit}><ErrorSummary errors={errors} /><header><div><span>{role.isSystem ? 'KORUNAN ROL' : `${role.userCount} KULLANICI`}</span><input aria-invalid={Boolean(errors.name)} value={data.name} disabled={readOnly} onChange={(event) => setData({ ...data, name: event.target.value })} /><FieldError errors={errors} name="name" /></div>{readOnly && <strong>Salt okunur</strong>}</header><textarea aria-invalid={Boolean(errors.description)} rows={2} disabled={readOnly} value={data.description} onChange={(event) => setData({ ...data, description: event.target.value })} placeholder="Rol açıklaması" /><FieldError errors={errors} name="description" /><PermissionPicker groups={groups} selected={data.permissions} disabled={readOnly} onChange={(permissions) => setData({ ...data, permissions })} /><FieldError errors={errors} name="permissions" />{!role.isProtected && (canUpdate || canDelete) && <div className="access-actions">{canUpdate && <button type="submit" disabled={processing}>Rolü kaydet</button>}{canDelete && <button type="button" className="danger" disabled={processing || role.userCount > 0} onClick={remove}>Rolü kaldır</button>}</div>}</form>;
}

function UserCard({ user, roles, canUpdate, canDisable, canResetPassword, canAssignRoles, columns }: { user: User; roles: Role[]; canUpdate: boolean; canDisable: boolean; canResetPassword: boolean; canAssignRoles: boolean; columns: string[] }) {
    const [data, setData] = useState({ name: user.name, email: user.email, password: '', is_active: user.isActive, role_ids: user.roles.map((role) => role.id) });
    const [errors, setErrors] = useState<FormErrors>({});
    const [processing, setProcessing] = useState(false);
    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (canUpdate || canDisable || canResetPassword || canAssignRoles) router.put(`/yonetim/kullanicilar/${user.id}`, data, {
            preserveScroll: true,
            errorBag: `user-${user.id}`,
            onStart: () => setProcessing(true),
            onError: (nextErrors) => setErrors(nextErrors),
            onSuccess: () => { setErrors({}); setData((current) => ({ ...current, password: '' })); },
            onFinish: () => setProcessing(false),
        });
    };
    const toggleRole = (id: number) => setData({ ...data, role_ids: data.role_ids.includes(id) ? data.role_ids.filter((item) => item !== id) : [...data.role_ids, id] });
    return <form className="admin-panel access-user-card" onSubmit={submit}><ErrorSummary errors={errors} /><div className="field-grid">{columns.includes('name') && <label className="field"><span>Ad soyad</span><input aria-invalid={Boolean(errors.name)} disabled={!canUpdate} value={data.name} onChange={(event) => setData({ ...data, name: event.target.value })} /><FieldError errors={errors} name="name" /></label>}{columns.includes('email') && <label className="field"><span>E-posta</span><input aria-invalid={Boolean(errors.email)} disabled={!canUpdate} type="email" value={data.email} onChange={(event) => setData({ ...data, email: event.target.value })} /><FieldError errors={errors} name="email" /></label>}{canResetPassword && <label className="field full"><span>Yeni parola <em>Değişmeyecekse boş bırakın</em></span><input aria-invalid={Boolean(errors.password)} type="password" minLength={12} value={data.password} onChange={(event) => setData({ ...data, password: event.target.value })} /><FieldError errors={errors} name="password" /></label>}</div>{columns.includes('roles') && <><div className="role-choice-list">{roles.map((role) => <label key={role.id}><input disabled={!canAssignRoles} type="checkbox" checked={data.role_ids.includes(role.id)} onChange={() => toggleRole(role.id)} /><span>{role.name}</span></label>)}</div><FieldError errors={errors} name="role_ids" /></>}<footer>{columns.includes('status') && <label><input disabled={!canDisable} type="checkbox" checked={data.is_active} onChange={(event) => setData({ ...data, is_active: event.target.checked })} /> Aktif hesap</label>}{(canUpdate || canDisable || canResetPassword || canAssignRoles) && <button disabled={processing}>{processing ? 'Kaydediliyor…' : 'Kullanıcıyı kaydet'}</button>}</footer></form>;
}

export default function AccessIndex({ roles, permissionGroups, users }: Props) {
    const can = usePermissions();
    const page = usePage<{ auth: { user: { tablePreferences: Record<string, string[]> } } }>();
    const userColumnDefinitions: ColumnDefinition[] = [{ key: 'name', label: 'Ad soyad' }, { key: 'email', label: 'E-posta' }, { key: 'roles', label: 'Roller' }, { key: 'status', label: 'Hesap durumu' }];
    const [userColumns, setUserColumns] = useState(() => initialTableColumns(page.props.auth.user.tablePreferences.users, userColumnDefinitions));
    const [tab, setTab] = useState<'users' | 'roles'>(can('users.view') ? 'users' : 'roles');
    const [newRole, setNewRole] = useState({ name: '', description: '', permissions: [] as string[] });
    const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role_ids: [] as number[] });
    const [newRoleErrors, setNewRoleErrors] = useState<FormErrors>({});
    const [newUserErrors, setNewUserErrors] = useState<FormErrors>({});
    const [creatingRole, setCreatingRole] = useState(false);
    const [creatingUser, setCreatingUser] = useState(false);
    const createRole = (event: FormEvent) => { event.preventDefault(); router.post('/yonetim/roller', newRole, { preserveScroll: true, errorBag: 'createRole', onStart: () => setCreatingRole(true), onError: (errors) => setNewRoleErrors(errors), onSuccess: () => { setNewRoleErrors({}); setNewRole({ name: '', description: '', permissions: [] }); }, onFinish: () => setCreatingRole(false) }); };
    const createUser = (event: FormEvent) => { event.preventDefault(); router.post('/yonetim/kullanicilar', newUser, { preserveScroll: true, errorBag: 'createUser', onStart: () => setCreatingUser(true), onError: (errors) => setNewUserErrors(errors), onSuccess: () => { setNewUserErrors({}); setNewUser({ name: '', email: '', password: '', role_ids: [] }); }, onFinish: () => setCreatingUser(false) }); };

    return <AdminLayout><Head title="Kullanıcılar ve Roller" /><header className="admin-title"><div><span className="booking-kicker">SİSTEM AYARLARI</span><h1>Kullanıcılar ve roller</h1><p>Panel erişimini roller ve işlem bazlı yetkilerle yönetin.</p></div></header><SettingsTabs /><nav className="settings-tabs access-subtabs" aria-label="Erişim yönetimi bölümleri">{can('users.view') && <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>Kullanıcılar ({users.length})</button>}{can('roles.view') && <button className={tab === 'roles' ? 'active' : ''} onClick={() => setTab('roles')}>Roller ({roles.length})</button>}</nav>
        {tab === 'users' ? <>{can('users.create') && can('roles.assign') && <form className="admin-panel rules-panel access-create" onSubmit={createUser}><div className="settings-heading"><div><h2>Yeni yetkili kullanıcı</h2><p>En az bir rol atayın. Parola en az 12 karakter olmalıdır.</p></div></div><ErrorSummary errors={newUserErrors} /><div className="field-grid"><label className="field"><span>Ad soyad</span><input aria-invalid={Boolean(newUserErrors.name)} required value={newUser.name} onChange={(event) => setNewUser({ ...newUser, name: event.target.value })} /><FieldError errors={newUserErrors} name="name" /></label><label className="field"><span>E-posta</span><input aria-invalid={Boolean(newUserErrors.email)} required type="email" value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} /><FieldError errors={newUserErrors} name="email" /></label><label className="field full"><span>Geçici parola</span><input aria-invalid={Boolean(newUserErrors.password)} required type="password" minLength={12} value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} /><FieldError errors={newUserErrors} name="password" /></label></div><div className="role-choice-list">{roles.map((role) => <label key={role.id}><input type="checkbox" checked={newUser.role_ids.includes(role.id)} onChange={() => setNewUser({ ...newUser, role_ids: newUser.role_ids.includes(role.id) ? newUser.role_ids.filter((id) => id !== role.id) : [...newUser.role_ids, role.id] })} /><span>{role.name}</span></label>)}</div><FieldError errors={newUserErrors} name="role_ids" /><button className="settings-submit" disabled={creatingUser}>{creatingUser ? 'Oluşturuluyor…' : 'Kullanıcı oluştur'}</button></form>}<TableColumns table="users" definitions={userColumnDefinitions} active={userColumns} setActive={setUserColumns} reorderable={false} /><div className="access-user-grid">{users.map((user) => <UserCard key={user.id} user={user} roles={roles} canUpdate={can('users.update')} canDisable={can('users.disable')} canResetPassword={can('users.reset_password')} canAssignRoles={can('roles.assign')} columns={userColumns} />)}</div></>
            : <>{can('roles.create') && <form className="admin-panel rules-panel access-create" onSubmit={createRole}><div className="settings-heading"><div><h2>Yeni rol</h2><p>Rolün yapabileceği işlemleri modüllere göre seçin.</p></div></div><ErrorSummary errors={newRoleErrors} /><div className="field-grid"><label className="field"><span>Rol adı</span><input aria-invalid={Boolean(newRoleErrors.name)} required value={newRole.name} onChange={(event) => setNewRole({ ...newRole, name: event.target.value })} /><FieldError errors={newRoleErrors} name="name" /></label><label className="field full"><span>Açıklama</span><textarea aria-invalid={Boolean(newRoleErrors.description)} rows={2} value={newRole.description} onChange={(event) => setNewRole({ ...newRole, description: event.target.value })} /><FieldError errors={newRoleErrors} name="description" /></label></div><PermissionPicker groups={permissionGroups} selected={newRole.permissions} onChange={(permissions) => setNewRole({ ...newRole, permissions })} /><FieldError errors={newRoleErrors} name="permissions" /><button className="settings-submit" disabled={creatingRole}>{creatingRole ? 'Oluşturuluyor…' : 'Rol oluştur'}</button></form>}<div className="access-role-grid">{roles.map((role) => <RoleCard key={role.id} role={role} groups={permissionGroups} canUpdate={can('roles.update')} canDelete={can('roles.delete')} />)}</div></>}
    </AdminLayout>;
}
