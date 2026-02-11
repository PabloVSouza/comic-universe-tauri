#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const args = parseArgs(process.argv.slice(2));
const dbPath = path.resolve(args.db ?? "dev-data/database/comic_universe.db");
const comicsRoot = path.resolve(args.comicsRoot ?? "dev-data/comics");
const dryRun = Boolean(args.dryRun);
const extensions = (args.extensions ?? "cbz,cbr,cb7,cbt,pdf,epub,zip")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

ensureCommand("sqlite3");

if (!fs.existsSync(dbPath)) {
  fail(`Database not found: ${dbPath}`);
}

if (!fs.existsSync(comicsRoot)) {
  fail(`Comics root not found: ${comicsRoot}`);
}

const rows = loadRows(dbPath);
const updates = [];
let hasOfflineCount = 0;
let missingOfflineCount = 0;

for (const row of rows) {
  const hasOffline = detectHasOffline(comicsRoot, row, extensions);
  if (hasOffline) {
    hasOfflineCount += 1;
  } else {
    missingOfflineCount += 1;
  }

  if (row.currentHasOffline !== hasOffline) {
    updates.push({ id: row.id, hasOffline });
  }
}

if (dryRun) {
  console.log(`[dry-run] would update ${updates.length} chapters`);
  logSummary(rows.length, hasOfflineCount, missingOfflineCount, updates.length);
  process.exit(0);
}

applyUpdates(dbPath, updates);
logSummary(rows.length, hasOfflineCount, missingOfflineCount, updates.length);

function parseArgs(rawArgs) {
  const parsed = {};
  for (let i = 0; i < rawArgs.length; i += 1) {
    const token = rawArgs[i];
    if (token === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (token === "--db") {
      parsed.db = rawArgs[i + 1];
      i += 1;
      continue;
    }
    if (token === "--comics-root") {
      parsed.comicsRoot = rawArgs[i + 1];
      i += 1;
      continue;
    }
    if (token === "--extensions") {
      parsed.extensions = rawArgs[i + 1];
      i += 1;
    }
  }
  return parsed;
}

function ensureCommand(command) {
  const result = spawnSync("which", [command], { encoding: "utf8" });
  if (result.status !== 0) {
    fail(`Required command not found: ${command}`);
  }
}

function loadRows(databasePath) {
  const query = `
    SELECT
      ch.id AS id,
      json_extract(ch.data, '$.comicId') AS comicId,
      json_extract(ch.data, '$.name') AS chapterName,
      json_extract(ch.data, '$.number') AS chapterNumber,
      json_extract(ch.data, '$.hasOffline') AS currentHasOffline,
      json_extract(c.data, '$.name') AS comicName
    FROM chapters ch
    LEFT JOIN comics c ON c.id = json_extract(ch.data, '$.comicId')
    ORDER BY comicName, chapterNumber, chapterName, id;
  `;

  const result = spawnSync("sqlite3", ["-json", databasePath, query], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 64,
  });

  if (result.status !== 0) {
    fail(`sqlite3 query failed: ${result.stderr || "unknown error"}`);
  }

  try {
    const parsed = JSON.parse(result.stdout);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function detectHasOffline(comicsDir, row, supportedExtensions) {
  const comicId = safeString(row.comicId) ?? "";
  const comicName = safeString(row.comicName) ?? comicId;
  const chapterName = chapterDisplayName(row);
  const chapterNumber = safeString(row.chapterNumber);

  const comicBase = sanitizeSegment(comicName);
  const dirCandidates = [
    path.join(comicsDir, comicBase),
    path.join(comicsDir, sanitizeSegment(comicId)),
  ];

  for (const entry of safeReadDir(comicsDir)) {
    const full = path.join(comicsDir, entry);
    if (!isDirectory(full)) {
      continue;
    }
    if (entry === comicBase || entry.startsWith(`${comicBase} (`)) {
      dirCandidates.push(full);
    }
  }

  const fileBases = chapterFileCandidates(chapterName, chapterNumber);
  for (const dirPath of dirCandidates) {
    if (!isDirectory(dirPath)) {
      continue;
    }

    for (const fileBase of fileBases) {
      for (const extension of supportedExtensions) {
        const candidate = path.join(dirPath, `${fileBase}.${extension}`);
        if (fs.existsSync(candidate)) {
          return true;
        }
      }
    }
  }

  return false;
}

function chapterDisplayName(row) {
  const fromName = safeString(row.chapterName);
  if (fromName) {
    return fromName;
  }
  const number = safeString(row.chapterNumber);
  if (number) {
    return `Chapter ${number}`;
  }
  return "chapter";
}

function chapterFileCandidates(chapterName, chapterNumber) {
  const values = [];
  const seen = new Set();

  pushUnique(values, seen, sanitizeSegment(chapterName));
  if (chapterNumber) {
    pushUnique(values, seen, sanitizeSegment(chapterNumber));
    pushUnique(values, seen, sanitizeSegment(`${chapterNumber} - ${chapterName}`));
    pushUnique(values, seen, sanitizeSegment(`Chapter ${chapterNumber}`));
  }
  return values;
}

function pushUnique(values, seen, candidate) {
  if (!candidate || seen.has(candidate)) {
    return;
  }
  seen.add(candidate);
  values.push(candidate);
}

function sanitizeSegment(value) {
  let out = "";
  for (const ch of value) {
    if (
      (ch >= "a" && ch <= "z") ||
      (ch >= "A" && ch <= "Z") ||
      (ch >= "0" && ch <= "9") ||
      ch === "_" ||
      ch === "-" ||
      ch === "." ||
      ch === " "
    ) {
      out += ch;
    } else {
      out += "_";
    }
  }

  const cleaned = out.trim().replace(/^\.+/, "");
  if (!cleaned) {
    return "untitled";
  }
  return cleaned.length > 180 ? cleaned.slice(0, 180) : cleaned;
}

function safeString(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function safeReadDir(directoryPath) {
  try {
    return fs.readdirSync(directoryPath);
  } catch {
    return [];
  }
}

function isDirectory(target) {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function applyUpdates(databasePath, updates) {
  if (updates.length === 0) {
    return;
  }

  const escaped = updates
    .map(({ id, hasOffline }) => {
      const safeId = id.replace(/'/g, "''");
      return `UPDATE chapters
SET data = json_set(data, '$.hasOffline', ${hasOffline ? "1" : "0"}),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE id = '${safeId}';`;
    })
    .join("\n");

  const sql = `BEGIN;\n${escaped}\nCOMMIT;`;
  const result = spawnSync("sqlite3", [databasePath, sql], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 32,
  });
  if (result.status !== 0) {
    fail(`sqlite3 update failed: ${result.stderr || "unknown error"}`);
  }
}

function logSummary(total, hasOffline, missingOffline, updated) {
  console.log(`Database: ${dbPath}`);
  console.log(`Comics root: ${comicsRoot}`);
  console.log(`Total chapters: ${total}`);
  console.log(`hasOffline=true: ${hasOffline}`);
  console.log(`hasOffline=false: ${missingOffline}`);
  console.log(`Updated rows: ${updated}`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
