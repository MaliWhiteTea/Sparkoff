#!/usr/bin/env python3
"""V1 SQLite rol bağlarını yalnız okuyarak V2 aktarım engellerini raporlar."""
import json
import re
import sqlite3
import sys
from pathlib import Path
from urllib.parse import quote


ROOT = Path(__file__).resolve().parents[2]
MAPPING = Path(__file__).with_name('v1-role-permission-map.json')
CONFIG = ROOT / 'config/permissions.php'
ACCESS = ROOT / 'v2/src/shared/access.ts'


def die(message):
    print(json.dumps({'error': message}, ensure_ascii=False), file=sys.stderr)
    raise SystemExit(2)


def main():
    if len(sys.argv) != 2:
        die('Kullanım: plan-v1-roles.py <salt okunur V1 SQLite kopyası>')
    source = Path(sys.argv[1]).resolve()
    if not source.is_file():
        die('V1 SQLite kopyası bulunamadı')
    mapping = json.loads(MAPPING.read_text())
    config_keys = set(re.findall(r"^\s*'([a-z_]+\.[a-z_]+)'\s*=>", CONFIG.read_text(), re.M))
    if len(config_keys) != 59 or set(mapping) != config_keys:
        die('V1 59 izin anahtarı ile aktarım eşlemesi uyuşmuyor')
    access_text = ACCESS.read_text()
    match = re.search(r'PERMISSIONS\s*=\s*\[(.*?)\]\s*as const', access_text, re.S)
    if not match:
        die('V2 izin listesi okunamadı')
    target_keys = set(re.findall(r"'([a-z_]+)'", match.group(1)))
    invalid_targets = sorted(set(mapping.values()) - {None} - target_keys)
    if invalid_targets:
        die('V2 izin listesinde olmayan hedefler: ' + ', '.join(invalid_targets))
    uri = 'file:' + quote(str(source)) + '?mode=ro'
    conn = sqlite3.connect(uri, uri=True)
    conn.row_factory = sqlite3.Row
    try:
        if conn.execute('PRAGMA quick_check').fetchone()[0] != 'ok':
            die('SQLite bütünlük kontrolü başarısız')
        source_keys = {row['key'] for row in conn.execute('SELECT key FROM permissions')}
        unknown = sorted(source_keys - config_keys)
        if unknown:
            die('Kaynakta bilinmeyen izin anahtarları: ' + ', '.join(unknown))
        roles = []
        blockers = []
        for role in conn.execute('SELECT id, name, slug, is_system, is_protected FROM roles ORDER BY id'):
            keys = [row['key'] for row in conn.execute('SELECT p.key FROM permission_role pr JOIN permissions p ON p.id=pr.permission_id WHERE pr.role_id=? ORDER BY p.key', (role['id'],))]
            missing = sorted(key for key in keys if mapping[key] is None)
            target = sorted({mapping[key] for key in keys if mapping[key] is not None})
            linked = conn.execute('SELECT COUNT(*) FROM role_user WHERE role_id=?', (role['id'],)).fetchone()[0]
            record = {'id': role['id'], 'name': role['name'], 'slug': role['slug'], 'isSystem': bool(role['is_system']), 'isProtected': bool(role['is_protected']), 'assignedUsers': linked, 'sourcePermissions': keys, 'mappedPermissions': target, 'blockedPermissions': missing}
            roles.append(record)
            if not role['is_system'] and missing:
                blockers.append({'role': role['slug'], 'permissions': missing})
        users_with_roles = conn.execute('SELECT COUNT(DISTINCT user_id) FROM role_user').fetchone()[0]
        multi_role_users = conn.execute('SELECT COUNT(*) FROM (SELECT user_id FROM role_user GROUP BY user_id HAVING COUNT(*) > 1)').fetchone()[0]
        total_users = conn.execute('SELECT COUNT(*) FROM users').fetchone()[0]
        report = {'source': str(source), 'roles': roles, 'users': total_users, 'usersWithRoles': users_with_roles, 'usersWithoutRoles': total_users - users_with_roles, 'multiRoleUsers': multi_role_users, 'blockers': blockers, 'readyForExactRoleImport': not blockers}
        print(json.dumps(report, ensure_ascii=False, indent=2))
        if blockers:
            raise SystemExit(3)
    finally:
        conn.close()


if __name__ == '__main__':
    main()
