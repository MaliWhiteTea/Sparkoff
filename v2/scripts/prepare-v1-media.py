#!/usr/bin/env python3
"""Prepare V1 inventory media for a separate V2 import; never changes V1."""

import argparse
import hashlib
import json
import os
import re
import secrets
import sqlite3
from pathlib import Path
from urllib.parse import quote

PATH_RE = re.compile(r"^inventory-media/(\d+)/([A-Za-z0-9._-]+)$")
MAX_SIZE = {"image": 8 * 1024 * 1024, "video": 50 * 1024 * 1024}


def media_type(header: bytes, expected: str) -> str:
    if expected == "image":
        if header.startswith(b"\xff\xd8\xff"):
            return "jpg"
        if header.startswith(b"\x89PNG\r\n\x1a\n"):
            return "png"
        if header.startswith(b"RIFF") and header[8:12] == b"WEBP":
            return "webp"
    if expected == "video":
        if header[4:8] == b"ftyp" and header[8:12] in (b"isom", b"iso2", b"iso5", b"iso6", b"mp41", b"mp42", b"avc1", b"M4V ", b"MSNV"):
            return "mp4"
        if header.startswith(b"\x1a\x45\xdf\xa3") and b"webm" in header[:4096]:
            return "webm"
    raise ValueError(f"{expected} dosyasının içerik imzası tanınmıyor")


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, required=True, help="Salt okunur V1 SQLite kopyası")
    parser.add_argument("--source-dir", type=Path, required=True, help="V1 storage/app/public kopyası")
    parser.add_argument("--id-map", type=Path, required=True, help="V1 malzeme ID → V2 malzeme ID JSON sözlüğü")
    parser.add_argument("--target-dir", type=Path, required=True, help="V2 PUBLIC_UPLOAD_DIR")
    parser.add_argument("--manifest", type=Path, required=True, help="Yeni manifest JSON yolu")
    parser.add_argument("--copy", action="store_true", help="Dosyaları kopyala; verilmezse yalnız doğrula")
    args = parser.parse_args()

    source_root = args.source_dir.resolve(strict=True)
    db_path = args.db.resolve(strict=True)
    mapping = json.loads(args.id_map.read_text(encoding="utf-8"))
    if not isinstance(mapping, dict) or not mapping or any(not str(key).isdigit() or not isinstance(value, int) or value <= 0 for key, value in mapping.items()):
        raise ValueError("Kimlik eşlemesi pozitif V1/V2 malzeme ID sözlüğü olmalı")
    if args.manifest.exists():
        raise FileExistsError(f"Manifest zaten var: {args.manifest}")
    target_root = args.target_dir.resolve()
    if args.copy and (target_root == source_root or source_root in target_root.parents or target_root in source_root.parents):
        raise ValueError("Kaynak ve hedef dizinler birbirinden bağımsız olmalı")

    uri = f"file:{quote(str(db_path))}?mode=ro"
    connection = sqlite3.connect(uri, uri=True)
    connection.row_factory = sqlite3.Row
    try:
        rows = connection.execute("SELECT id, inventory_item_id, type, file_path, external_url, title, alt_text, sort_order, is_cover FROM inventory_media ORDER BY id").fetchall()
    finally:
        connection.close()

    prepared = []
    for row in rows:
        old_id = row["inventory_item_id"]
        new_id = mapping.get(str(old_id))
        if not new_id:
            raise ValueError(f"V1 malzeme #{old_id} için V2 kimlik eşlemesi yok")
        entry = {"oldMediaId": row["id"], "oldMaterialId": old_id, "newMaterialId": new_id,
                 "type": row["type"], "title": row["title"], "altText": row["alt_text"],
                 "sortOrder": row["sort_order"], "isCover": bool(row["is_cover"])}
        if row["type"] == "link":
            url = row["external_url"] or ""
            if not url.startswith("https://") or len(url) > 2048:
                raise ValueError(f"V1 medya #{row['id']} bağlantısı güvenli HTTPS değil")
            entry["externalUrl"] = url
        elif row["type"] in MAX_SIZE:
            relative = row["file_path"] or ""
            match = PATH_RE.fullmatch(relative)
            if not match or int(match.group(1)) != old_id:
                raise ValueError(f"V1 medya #{row['id']} dosya yolu geçersiz")
            source = source_root / relative
            resolved = source.resolve(strict=True)
            if source.is_symlink() or not resolved.is_relative_to(source_root) or not resolved.is_file():
                raise ValueError(f"V1 medya #{row['id']} güvenli normal dosya değil")
            size = resolved.stat().st_size
            if size == 0 or size > MAX_SIZE[row["type"]]:
                raise ValueError(f"V1 medya #{row['id']} dosya boyutu sınır dışında")
            with resolved.open("rb") as stream:
                extension = media_type(stream.read(4096), row["type"])
            entry.update({"oldPath": relative, "newPath": f"inventory-media/{new_id}/{secrets.token_hex(16)}.{extension}",
                          "bytes": size, "sha256": digest(resolved)})
        else:
            raise ValueError(f"V1 medya #{row['id']} türü tanınmıyor")
        prepared.append(entry)

    if not args.copy:
        print(f"Ön kontrol geçti: {len(prepared)} medya; kaynak ve eşleme salt okunur incelendi. Kopya için --copy kullanın.")
        return

    os.umask(0o077)
    created = []
    try:
        for entry in prepared:
            if "newPath" not in entry:
                continue
            source = source_root / entry["oldPath"]
            target = target_root / entry["newPath"]
            target.parent.mkdir(parents=True, exist_ok=True)
            with source.open("rb") as input_stream, target.open("xb") as output_stream:
                created.append(target)
                for chunk in iter(lambda: input_stream.read(1024 * 1024), b""):
                    output_stream.write(chunk)
            if digest(source) != entry["sha256"] or digest(target) != entry["sha256"]:
                raise ValueError(f"V1 medya #{entry['oldMediaId']} kopya sağlama toplamı uyuşmuyor")
        args.manifest.parent.mkdir(parents=True, exist_ok=True)
        temporary = args.manifest.with_name(args.manifest.name + "." + secrets.token_hex(8) + ".tmp")
        try:
            with temporary.open("x", encoding="utf-8") as stream:
                json.dump({"format": "sparkoff-v1-media-preparation-v1", "media": prepared}, stream, ensure_ascii=False, indent=2)
                stream.write("\n")
            os.link(temporary, args.manifest)
        finally:
            temporary.unlink(missing_ok=True)
    except Exception:
        for path in created:
            path.unlink(missing_ok=True)
        raise
    print(f"Kopya doğrulandı: {len(prepared)} medya; manifest {args.manifest}")


if __name__ == "__main__":
    main()
