#!/usr/bin/env python3
"""Restore all database tables from a JSON backup file."""

import asyncio
import asyncpg
import json
import os
import sys
from datetime import datetime, timezone

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


def parse_value(val, data_type: str):
    """Convert a JSON value to the correct Python type for asyncpg."""
    if val is None:
        return None
    if "timestamp" in data_type:
        return datetime.fromisoformat(val)
    return val


async def restore(input_path: str):
    with open(input_path, "r") as f:
        data = json.load(f)

    dsn = DB_URL.replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(dsn)
    try:
        # Fetch column type info for all tables upfront
        col_types: dict[str, dict[str, str]] = {}
        for table in TABLES:
            rows = await conn.fetch(
                """
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = $1 AND table_schema = 'public'
                """,
                table,
            )
            col_types[table] = {r["column_name"]: r["data_type"] for r in rows}

        # Wipe all tables and reset sequences in one statement (CASCADE handles FK order)
        await conn.execute(
            "TRUNCATE TABLE users, jobs, job_assignments, clock_sessions, "
            "message_threads, messages, message_recipients, user_thread_deletions "
            "RESTART IDENTITY CASCADE"
        )

        # Insert rows in FK-safe order
        for table in TABLES:
            rows = data.get(table, [])
            if not rows:
                continue

            columns = list(rows[0].keys())
            col_names = ", ".join(f'"{c}"' for c in columns)
            placeholders = ", ".join(f"${i + 1}" for i in range(len(columns)))
            stmt = f"INSERT INTO {table} ({col_names}) VALUES ({placeholders})"

            for row in rows:
                values = [
                    parse_value(row[c], col_types[table].get(c, ""))
                    for c in columns
                ]
                await conn.execute(stmt, *values)

            # Advance the sequence past the max inserted ID so future inserts don't conflict
            ids = [r["id"] for r in rows if "id" in r]
            if ids:
                await conn.execute(
                    f"SELECT setval('{table}_id_seq', $1, true)", max(ids)
                )

        print(f"  Restored from: {os.path.basename(input_path)}")
        for table in TABLES:
            count = len(data.get(table, []))
            if count:
                print(f"    {table}: {count} rows")

    finally:
        await conn.close()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 restore_db.py <input_path>")
        sys.exit(1)
    asyncio.run(restore(sys.argv[1]))
