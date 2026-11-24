#!/usr/bin/env python3
"""Read-only, PII-free blockers for a frozen V1 SQLite migration source."""

import argparse
import base64
import hashlib
import json
import re
import sqlite3
from collections import Counter, defaultdict
from decimal import Decimal, InvalidOperation
from pathlib import Path
from urllib.parse import quote

ENUMS = {
    ('inventory_items', 'item_type'): {'consumable', 'loanable', 'fixed_asset'},
    ('inventory_items', 'public_visibility'): {'exact', 'status', 'hidden'},
    ('stock_movements', 'movement_type'): {'initial', 'adjustment', 'delivery', 'return', 'reversal'},
    ('inventory_transactions', 'item_type'): {'consumable', 'loanable', 'fixed_asset'},
    ('inventory_transactions', 'status'): {'active', 'completed', 'damaged', 'lost', 'reversed'},
    ('inventory_media', 'type'): {'image', 'video', 'link'},
    ('printers', 'status'): {'active', 'maintenance', 'inactive'},
}
LENGTHS = {
    ('users', 'name'): 120, ('users', 'email'): 255,
    ('inventory_items', 'name'): 200, ('inventory_items', 'slug'): 200,
    ('inventory_items', 'sku'): 100, ('inventory_items', 'brand'): 120,
    ('inventory_items', 'model'): 160, ('inventory_items', 'unit'): 30,
    ('inventory_media', 'title'): 180, ('inventory_media', 'alt_text'): 180,
    ('printers', 'code'): 20, ('printers', 'name'): 255,
    ('filaments', 'material'): 120, ('filaments', 'color'): 80,
    ('filaments', 'brand'): 100,
    ('inventory_transactions', 'recipient_email'): 255,
}
DECIMALS = {
    ('inventory_items', 'quantity'), ('inventory_items', 'minimum_stock'),
    ('stock_movements', 'quantity_change'), ('stock_movements', 'balance_after'),
    ('inventory_transactions', 'quantity'), ('inventory_transactions', 'quantity_returned'),
}
REFERENCES = {
    ('inventory_items', 'category_id'): ('inventory_categories', 'id'),
    ('inventory_items', 'location_id'): ('inventory_locations', 'id'),
    ('stock_movements', 'inventory_item_id'): ('inventory_items', 'id'),
    ('stock_movements', 'user_id'): ('users', 'id'),
    ('stock_movements', 'reversed_movement_id'): ('stock_movements', 'id'),
    ('inventory_transactions', 'inventory_item_id'): ('inventory_items', 'id'),
    ('inventory_transactions', 'issued_by'): ('users', 'id'),
    ('inventory_transactions', 'closed_by'): ('users', 'id'),
    ('inventory_media', 'inventory_item_id'): ('inventory_items', 'id'),
    ('role_user', 'role_id'): ('roles', 'id'),
    ('role_user', 'user_id'): ('users', 'id'),
    ('permission_role', 'role_id'): ('roles', 'id'),
    ('permission_role', 'permission_id'): ('permissions', 'id'),
}
DATE_RE = re.compile(r'^\d{4}-\d\d-\d\d(?:[ T]\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)?)?$')
TIME_RE = re.compile(r'^\d\d:\d\d(?::\d\d)?$')


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('database', type=Path)
    args = parser.parse_args()
    source = args.database.resolve(strict=True)
    before = sha256(source)
    db = sqlite3.connect(f'file:{quote(str(source), safe="/")}?mode=ro', uri=True)
    db.execute('PRAGMA query_only=ON')
    report = {'source_sha256': before, 'quick_check': None, 'checks': {}, 'blockers': []}
    try:
        db.execute('BEGIN')
        report['quick_check'] = db.execute('PRAGMA quick_check').fetchone()[0]
        if report['quick_check'] != 'ok':
            report['blockers'].append('sqlite_integrity')
        tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        required = {table for table, _ in set(ENUMS) | set(LENGTHS) | DECIMALS | set(REFERENCES)}
        required |= {target for target, _ in REFERENCES.values()}
        missing = sorted(required - tables)
        report['checks']['missing_tables'] = missing
        if missing:
            report['blockers'].append('missing_tables')
        columns = {table: {r[1] for r in db.execute(f'PRAGMA table_info("{table}")')} for table in required & tables}
        expected_columns = set(ENUMS) | set(LENGTHS) | DECIMALS | set(REFERENCES)
        expected_columns |= {('users', 'password'), ('stock_movements', 'source_type'), ('stock_movements', 'source_id')}
        missing_columns = sorted(f'{t}.{c}' for t, c in expected_columns if t in columns and c not in columns[t])
        report['checks']['missing_columns'] = missing_columns
        if missing_columns:
            report['blockers'].append('missing_columns')

        enum_counts = {}
        for (table, column), allowed in ENUMS.items():
            if column not in columns.get(table, ()):
                continue
            counts = Counter(row[0] for row in db.execute(f'SELECT "{column}" FROM "{table}"'))
            enum_counts[f'{table}.{column}'] = {'known': {key: counts[key] for key in sorted(allowed) if counts[key]},
                                                'unknown_count': sum(n for key, n in counts.items() if key not in allowed)}
        report['checks']['enums'] = enum_counts
        if any(value['unknown_count'] for value in enum_counts.values()):
            report['blockers'].append('unknown_enums')

        overlong = {}
        for (table, column), limit in LENGTHS.items():
            if column in columns.get(table, ()):
                n, maxlen = db.execute(f'SELECT COUNT(*), COALESCE(MAX(LENGTH("{column}")),0) FROM "{table}" WHERE LENGTH("{column}")>?', (limit,)).fetchone()
                overlong[f'{table}.{column}'] = {'count': n, 'maximum_length': maxlen, 'target_limit': limit}
        report['checks']['overlong_fields'] = {key: value for key, value in overlong.items() if value['count']}
        if report['checks']['overlong_fields']:
            report['blockers'].append('overlong_fields')

        decimal_failures = {}
        for table, column in DECIMALS:
            if column not in columns.get(table, ()):
                continue
            invalid = 0
            for (raw,) in db.execute(f'SELECT "{column}" FROM "{table}" WHERE "{column}" IS NOT NULL'):
                try:
                    value = Decimal(str(raw))
                    if not value.is_finite() or value != value.quantize(Decimal('.001')) or abs(value) >= Decimal('1000000000000'):
                        invalid += 1
                except (InvalidOperation, ValueError):
                    invalid += 1
            if invalid:
                decimal_failures[f'{table}.{column}'] = invalid
        report['checks']['decimal_failures'] = decimal_failures
        if decimal_failures:
            report['blockers'].append('decimal_precision')

        orphan_counts = {}
        for (table, column), (target, key) in REFERENCES.items():
            if column in columns.get(table, ()) and target in tables:
                orphan_counts[f'{table}.{column}'] = db.execute(
                    f'SELECT COUNT(*) FROM "{table}" s LEFT JOIN "{target}" t ON s."{column}"=t."{key}" '
                    f'WHERE s."{column}" IS NOT NULL AND t."{key}" IS NULL').fetchone()[0]
        report['checks']['orphan_references'] = {key: count for key, count in orphan_counts.items() if count}
        if report['checks']['orphan_references']:
            report['blockers'].append('orphan_references')
        report['checks']['sqlite_fk_violations'] = sum(1 for _ in db.execute('PRAGMA foreign_key_check'))
        if report['checks']['sqlite_fk_violations']:
            report['blockers'].append('sqlite_foreign_keys')

        if {'stock_movements', 'inventory_transactions'} <= tables:
            bad_source = db.execute('''SELECT COUNT(*) FROM stock_movements s
                LEFT JOIN inventory_transactions t ON s.source_id=t.id
                WHERE s.source_type='App\\Models\\InventoryTransaction' AND (s.source_id IS NULL OR t.id IS NULL)''').fetchone()[0]
            other_source = db.execute('''SELECT COUNT(*) FROM stock_movements
                WHERE source_type IS NOT NULL AND source_type!='App\\Models\\InventoryTransaction' ''').fetchone()[0]
            report['checks']['movement_source'] = {'missing_transaction': bad_source, 'other_type': other_source}
            if bad_source or other_source:
                report['blockers'].append('movement_source')

        if {'stock_movements', 'inventory_items'} <= tables:
            bad_chain = 0
            bad_final_balance = 0
            without_movements = 0
            for item_id, raw_quantity in db.execute('SELECT id, quantity FROM inventory_items'):
                previous = None
                for raw_delta, raw_balance in db.execute('''SELECT quantity_change, balance_after FROM stock_movements
                    WHERE inventory_item_id=? ORDER BY created_at, id''', (item_id,)):
                    try:
                        delta, balance = Decimal(str(raw_delta)), Decimal(str(raw_balance))
                        if (previous if previous is not None else Decimal('0')) + delta != balance:
                            bad_chain += 1
                        previous = balance
                    except (InvalidOperation, ValueError):
                        bad_chain += 1
                if previous is None:
                    without_movements += 1
                elif previous != Decimal(str(raw_quantity)):
                    bad_final_balance += 1
            report['checks']['stock_chain'] = {'broken_steps': bad_chain, 'final_balance_mismatches': bad_final_balance,
                                               'items_without_movements': without_movements}
            if bad_chain or bad_final_balance:
                report['blockers'].append('stock_chain')

        date_formats = defaultdict(Counter)
        for table in sorted(tables):
            if table.startswith('sqlite_'):
                continue
            for column in columns.get(table, {r[1] for r in db.execute(f'PRAGMA table_info("{table}")')}):
                if column.endswith(('_at', '_until')) or column in {'starts_at', 'ends_at', 'due_at'}:
                    for (raw,) in db.execute(f'SELECT "{column}" FROM "{table}" WHERE "{column}" IS NOT NULL'):
                        value = str(raw)
                        if table == 'operating_hours' and column in {'opens_at', 'closes_at', 'latest_start_at'} and TIME_RE.fullmatch(value):
                            kind = 'time_only'
                        elif DATE_RE.fullmatch(value):
                            kind = 'date_only' if len(value) == 10 else 'offset' if value.endswith('Z') or re.search(r'[+-]\d\d:\d\d$', value) else 'naive'
                        else:
                            kind = 'invalid'
                        date_formats[f'{table}.{column}'][kind] += 1
        report['checks']['date_formats'] = {key: dict(value) for key, value in date_formats.items() if value}
        if any(value.get('invalid') for value in date_formats.values()):
            report['blockers'].append('invalid_dates')
        report['checks']['password_hash_formats'] = dict(Counter(
            'bcrypt_2y' if (raw or '').startswith('$2y$') else 'scrypt' if (raw or '').startswith('scrypt:') else 'other'
            for (raw,) in db.execute('SELECT password FROM users'))) if 'password' in columns.get('users', ()) else {}
        if report['checks']['password_hash_formats'].get('other'):
            report['blockers'].append('unknown_password_hash')
        if 'inventory_transactions' in tables:
            encrypted = {}
            for column in ('recipient_name', 'recipient_email'):
                if column not in columns['inventory_transactions']:
                    continue
                counts = Counter()
                for (raw,) in db.execute(f'SELECT "{column}" FROM inventory_transactions'):
                    if raw is None:
                        counts['null'] += 1
                        continue
                    try:
                        payload = json.loads(base64.b64decode(raw, validate=True))
                        if not isinstance(payload, dict) or not {'iv', 'value', 'mac'} <= payload.keys():
                            raise ValueError('not a Laravel encrypted payload')
                        counts['laravel_envelope'] += 1
                    except (ValueError, TypeError):
                        counts['other'] += 1
                encrypted[column] = dict(counts)
            report['checks']['encrypted_recipient_fields'] = encrypted
            if any(value.get('other') for value in encrypted.values()):
                report['blockers'].append('unexpected_recipient_encryption')
        db.execute('COMMIT')
    finally:
        db.close()
    if sha256(source) != before:
        raise RuntimeError('source changed during preflight; use a frozen copy')
    report['ready_for_detailed_mapping'] = not report['blockers']
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    if report['blockers']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
