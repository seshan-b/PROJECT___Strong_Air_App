#!/usr/bin/env python3
"""Dump all database tables to a JSON file for incremental backups."""

import asyncio
import asyncpg
import json
import os
import sys
from datetime import datetime, date

DB_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://strongair:strongair_pass@localhost:5432/strongair_db",
)

# Tables in insertion order (respects FK constraints)
TABLES = [
    "users",
    "jobs",
    "job_assignments",
    "clock_sessions",
    "message_threads",
    "messages",
    "message_recipients",
    "user_thread_deletions",
]


def serialize(val):
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    return val


async def backup(output_path: str):
    dsn = DB_URL.replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(dsn)
    data = {}
    try:
        for table in TABLES:
            rows = await conn.fetch(f"SELECT * FROM {table} ORDER BY id")
            data[table] = [{k: serialize(v) for k, v in row.items()} for row in rows]
    finally:
        await conn.close()

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(data, f, indent=2, default=str)

    print(f"  Backup saved: {os.path.basename(output_path)}")
    for table in TABLES:
        count = len(data[table])
        if count:
            print(f"    {table}: {count} rows")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 backup_db.py <output_path>")
        sys.exit(1)
    asyncio.run(backup(sys.argv[1]))
