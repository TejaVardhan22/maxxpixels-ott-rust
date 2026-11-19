#!/usr/bin/env python3
"""Combine the OTT and games env files into the root .env used by Docker Compose.

Usage:
    python3 scripts/combine_env.py
    python3 scripts/combine_env.py --check

Sources (by default):
    .env.ott   OTT platform, web, admin, API, storage, payments, notifications
    .env.games Games/coins service, PFF credentials, games DB, shared JWT/payments

Output:
    .env       Generated combined file. Do not edit by hand.

Duplicate keys are allowed only when the value is identical in both sources.
Conflicting values abort the merge so the two services cannot silently drift.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import tempfile
from pathlib import Path

ASSIGNMENT_RE = re.compile(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$")

HEADER = """# ==============================================================================
# MaxxPixels combined Docker environment (.env)
#
# GENERATED FILE — DO NOT EDIT DIRECTLY.
# Sources: .env.ott + .env.games
# Regenerate: python3 scripts/combine_env.py
# Validate:    python3 scripts/combine_env.py --check
# ==============================================================================
"""


def parse_env(path: Path) -> tuple[list[str], dict[str, str]]:
    lines = path.read_text(encoding="utf-8").splitlines()
    values: dict[str, str] = {}
    for line in lines:
        match = ASSIGNMENT_RE.match(line)
        if match:
            values[match.group(1)] = match.group(2)
    return lines, values


def combine(ott: Path, games: Path, out: Path, check_only: bool) -> int:
    for source in (ott, games):
        if not source.is_file():
            print(f"Missing env source: {source}", file=sys.stderr)
            return 1

    ott_lines, ott_values = parse_env(ott)
    games_lines, games_values = parse_env(games)

    conflicts = sorted(
        key for key in set(ott_values) & set(games_values)
        if ott_values[key] != games_values[key]
    )
    if conflicts:
        print(
            "Conflicting values for shared keys: " + ", ".join(conflicts),
            file=sys.stderr,
        )
        print("Update .env.ott and .env.games, then regenerate .env.", file=sys.stderr)
        return 1

    if check_only:
        print(
            f"Env files OK: {len(ott_values)} OTT vars, {len(games_values)} games vars, "
            f"{len(set(ott_values) & set(games_values))} shared"
        )
        return 0

    seen: dict[str, str] = {}
    skipped = 0
    chunks: list[str] = [HEADER, "\n"]

    for label, source, lines in (
        (".env.ott — OTT platform", ott, ott_lines),
        (".env.games — games & coins service", games, games_lines),
    ):
        chunks.append(f"# --- {label} -------------------------------------------------\n")
        for line in lines:
            match = ASSIGNMENT_RE.match(line)
            if match:
                key, value = match.group(1), match.group(2)
                if key in seen:
                    skipped += 1
                    continue
                seen[key] = value
            chunks.append(line + "\n")
        chunks.append("\n")

    out.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=out.name + ".", dir=out.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.writelines(chunks)
        os.chmod(tmp_name, 0o600)
        os.replace(tmp_name, out)
    except Exception:
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise

    print(
        f"Combined {ott.name} + {games.name} -> {out.name} "
        f"({len(seen)} variables, {skipped} shared duplicates skipped)"
    )
    return 0


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ott", type=Path, default=root / ".env.ott")
    parser.add_argument("--games", type=Path, default=root / ".env.games")
    parser.add_argument("--out", type=Path, default=root / ".env")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Validate the two source files without rewriting .env",
    )
    args = parser.parse_args()
    return combine(args.ott, args.games, args.out, args.check)


if __name__ == "__main__":
    raise SystemExit(main())
