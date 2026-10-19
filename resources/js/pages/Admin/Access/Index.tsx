import AdminLayout from '@/components/AdminLayout';
import { Head, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

type Permission = { key: string; label: string; isSensitive: boolean };
type Role = { id: number; name: string; slug: string; description: string | null; isSystem: boolean; isProtected: boolean; userCount: number; permissions: string[] };
type User = { id: number; name: string; email: string; isActive: boolean; roles: { id: number; name: string }[] };
type Props = { roles: Role[]; permissionGroups: Record<string, Permission[]>; users: User[] };

function PermissionPicker({ groups, selected, disabled, onChange }: { groups: Record<string, Permission[]>; selected: string[]; disabled?: boolean; onChange: (keys: string[]) => void }) {
    const toggle = (key: string) => onChange(selected.includes(key) ? selected.filter((item) => item !== key) : [...selected, key]);

    return <div className="permission-groups">{Object.entries(groups).map(([module, permissions]) => <section key={module}><header><strong>{module}</strong><button type="button" disabled={disabled} onClick={() => onChange([...new Set([...selected, ...permissions.map((item) => item.key)])])}>Tümünü seç</button></header>{permissions.map((permission) => <label key={permission.key}><input type="checkbox" disabled={disabled} checked={selected.includes(permission.key)} onChange={() => toggle(permission.key)} /><span>{permission.label}{permission.isSensitive && <small>Hassas yetki</small>}</span></label>)}</section>)}</div>;
}

function RoleCard({ role, groups }: { role: Role; groups: Record<string, Permission[]> }) {
    const [data, setData] = useState({ name: role.name, description: role.description ?? '', permissions: role.permissions });
    const submit = (event: FormEvent) => { event.preventDefault(); router.put(`/yonetim/roller/${role.id}`, data, { preserveScroll: true }); };

    return <form className="admin-panel access-role-card" onSubmit={submit}><header><div><span>{role.isSystem ? 'KORUNAN ROL' : `${role.userCount} KULLANICI`}</span><input value={data.name} disabled={role.isProtected} onChange={(event) => setData({ ...data, name: event.target.value })} /></div>{role.isProtected && <strong>Değiştirilemez</strong>}</header><textarea rows={2} disabled={role.isProtected} value={data.description} onChange={(event) => setData({ ...data, description: event.target.value })} placeholder="Rol açıklaması" /><PermissionPicker groups={groups} selected={data.permissions} disabled={role.isProtected} onChange={(permissions) => setData({ ...data, permissions })} />{!role.isProtected && <div className="access-actions"><button type="submit">Rolü kaydet</button><button type="button" className="danger" disabled={role.userCount > 0} onClick={() => window.confirm('Bu rol kaldırılsın mı?') && router.delete(`/yonetim/roller/${role.id}`, { preserveScroll: true })}>Rolü kaldır</button></div>}</form>;
}

function UserCard({ user, roles }: { user: User; roles: Role[] }) {
    const [data, setData] = useState({ name: user.name, email: user.email, password: '', is_active: user.isActive, role_ids: user.roles.map((role) => role.id) });
    const submit = (event: FormEvent) => { event.preventDefault(); router.put(`/yonetim/kullanicilar/${user.id}`, data, { preserveScroll: true }); };
    const toggleRole = (id: number) => setData({ ...data, role_ids: data.role_ids.includes(id) ? data.role_ids.filter((item) => item !== id) : [...data.role_ids, id] });

    return <form className="admin-panel access-user-card" onSubmit={submit}><div className="field-grid"><label className="field"><span>Ad soyad</span><input value={data.name} onChange={(event) => setData({ ...data, name: event.target.value })} /></label><label className="field"><span>E-posta</span><input type="email" value={data.email} onChange={(event) => setData({ ...data, email: event.target.value })} /></label><label className="field full"><span>Yeni parola <em>Değişmeyecekse boş bırakın</em></span><input type="password" minLength={12} value={data.password} onChange={(event) => setData({ ...data, password: event.target.value })} /></label></div><div className="role-choice-list">{roles.map((role) => <label key={role.id}><input type="checkbox" checked={data.role_ids.includes(role.id)} onChange={() => toggleRole(role.id)} /><span>{role.name}</span></label>)}</div><footer><label><input type="checkbox" checked={data.is_active} onChange={(event) => setData({ ...data, is_active: event.target.checked })} /> Aktif hesap</label><button>Kullanıcıyı kaydet</button></footer></form>;
}

export default function AccessIndex({ roles, permissionGroups, users }: Props) {
    const [tab, setTab] = useState<'users' | 'roles'>('users');
    const [newRole, setNewRole] = useState({ name: '', description: '', permissions: [] as string[] });
    const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role_ids: [] as number[] });

    const createRole = (event: FormEvent) => { event.preventDefault(); router.post('/yonetim/roller', newRole, { preserveScroll: true, onSuccess: () => setNewRole({ name: '', description: '', permissions: [] }) }); };
    const createUser = (event: FormEvent) => { event.preventDefault(); router.post('/yonetim/kullanicilar', newUser, { preserveScroll: true, onSuccess: () => setNewUser({ name: '', email: '', password: '', role_ids: [] }) }); };

    return <AdminLayout><Head title="Kullanıcılar ve Roller" /><header className="admin-title"><div><span className="booking-kicker">ERİŞİM YÖNETİMİ</span><h1>Kullanıcılar ve roller</h1><p>Panel erişimini roller ve işlem bazlı yetkilerle yönetin.</p></div></header><nav className="settings-tabs"><button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>Kullanıcılar ({users.length})</button><button className={tab === 'roles' ? 'active' : ''} onClick={() => setTab('roles')}>Roller ({roles.length})</button></nav>
        {tab === 'users' ? <><form className="admin-panel rules-panel access-create" onSubmit={createUser}><div className="settings-heading"><div><h2>Yeni yetkili kullanıcı</h2><p>En az bir rol atayın. Parola en az 12 karakter olmalıdır.</p></div></div><div className="field-grid"><label className="field"><span>Ad soyad</span><input required value={newUser.name} onChange={(event) => setNewUser({ ...newUser, name: event.target.value })} /></label><label className="field"><span>E-posta</span><input required type="email" value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} /></label><label className="field full"><span>Geçici parola</span><input required type="password" minLength={12} value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} /></label></div><div className="role-choice-list">{roles.map((role) => <label key={role.id}><input type="checkbox" checked={newUser.role_ids.includes(role.id)} onChange={() => setNewUser({ ...newUser, role_ids: newUser.role_ids.includes(role.id) ? newUser.role_ids.filter((id) => id !== role.id) : [...newUser.role_ids, role.id] })} /><span>{role.name}</span></label>)}</div><button className="settings-submit">Kullanıcı oluştur</button></form><div className="access-user-grid">{users.map((user) => <UserCard key={user.id} user={user} roles={roles} />)}</div></> : <><form className="admin-panel rules-panel access-create" onSubmit={createRole}><div className="settings-heading"><div><h2>Yeni rol</h2><p>Rolün yapabileceği işlemleri modüllere göre seçin.</p></div></div><div className="field-grid"><label className="field"><span>Rol adı</span><input required value={newRole.name} onChange={(event) => setNewRole({ ...newRole, name: event.target.value })} /></label><label className="field full"><span>Açıklama</span><textarea rows={2} value={newRole.description} onChange={(event) => setNewRole({ ...newRole, description: event.target.value })} /></label></div><PermissionPicker groups={permissionGroups} selected={newRole.permissions} onChange={(permissions) => setNewRole({ ...newRole, permissions })} /><button className="settings-submit">Rol oluştur</button></form><div className="access-role-grid">{roles.map((role) => <RoleCard key={role.id} role={role} groups={permissionGroups} />)}</div></>}
    </AdminLayout>;
}
