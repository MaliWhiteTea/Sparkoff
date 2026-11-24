#!/usr/bin/env python3
"""Print a PII-free, read-only manifest for a copied V1 SQLite database."""

import argparse
import hashlib
import json
import sqlite3
from decimal import Decimal
from pathlib import Path
from urllib.parse import quote


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def groups(db: sqlite3.Connection, table: str, columns: str) -> list[dict]:
    keys = columns.split(', ')
    rows = db.execute(f'SELECT {columns}, COUNT(*) FROM "{table}" GROUP BY {columns} ORDER BY {columns}')
    return [{**dict(zip(keys, row[:-1])), 'count': row[-1]} for row in rows]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('database', type=Path, help='a copied V1 SQLite database')
    args = parser.parse_args()
    path = args.database.resolve(strict=True)
    initial_hash = sha256(path)
    db = sqlite3.connect(f'file:{quote(str(path), safe="/")}?mode=ro', uri=True)
    db.execute('PRAGMA query_only=ON')
    try:
        db.execute('BEGIN')
        quick_check = db.execute('PRAGMA quick_check').fetchone()[0]
        if quick_check != 'ok':
            raise RuntimeError(f'SQLite quick_check failed: {quick_check}')
        names = [row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
        required = {'inventory_items', 'stock_movements', 'inventory_transactions', 'users', 'roles', 'role_user'}
        if not required.issubset(names):
            raise RuntimeError(f'not a complete V1 copy; missing tables: {sorted(required - set(names))}')
        counts = {name: db.execute(f'SELECT COUNT(*) FROM "{name}"').fetchone()[0] for name in names}
        total = sum((Decimal(str(row[0])) for row in db.execute('SELECT quantity FROM inventory_items')), Decimal('0'))
        orphan_movements = db.execute('SELECT COUNT(*) FROM stock_movements s LEFT JOIN inventory_items i ON i.id=s.inventory_item_id WHERE i.id IS NULL').fetchone()[0]
        orphan_transactions = db.execute('SELECT COUNT(*) FROM inventory_transactions t LEFT JOIN inventory_items i ON i.id=t.inventory_item_id WHERE i.id IS NULL').fetchone()[0]
        latest_balances = db.execute('''
          SELECT i.quantity, s.balance_after FROM inventory_items i
          JOIN stock_movements s ON s.id = (
            SELECT s2.id FROM stock_movements s2 WHERE s2.inventory_item_id=i.id
            ORDER BY s2.created_at DESC, s2.id DESC LIMIT 1
          )
        ''').fetchall()
        latest_mismatch = sum(Decimal(str(quantity)) != Decimal(str(balance)) for quantity, balance in latest_balances)
        result = {
            'source_kind': 'v1-sqlite-copy',
            'path': str(path),
            'sha256': initial_hash,
            'size_bytes': path.stat().st_size,
            'quick_check': quick_check,
            'table_counts': counts,
            'inventory_quantity_total': f'{total:.3f}',
            'item_types': groups(db, 'inventory_items', 'item_type'),
            'movement_types': groups(db, 'stock_movements', 'movement_type'),
            'transaction_types_statuses': groups(db, 'inventory_transactions', 'item_type, status'),
            'orphan_movements': orphan_movements,
            'orphan_transactions': orphan_transactions,
            'latest_movement_balance_mismatches': latest_mismatch,
            'items_without_movements': counts['inventory_items'] - len(latest_balances),
        }
        db.execute('COMMIT')
    finally:
        db.close()
    if sha256(path) != initial_hash:
        raise RuntimeError('source changed during audit; repeat on a frozen copy')
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == '__main__':
    main()
