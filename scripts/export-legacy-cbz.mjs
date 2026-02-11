#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const args = parseArgs(process.argv.slice(2));

const dbPath = path.resolve(
  args.db ?? "../comic-universe/dev-data/database/database.db",
);
const comicsRoot = path.resolve(
  args.comicsRoot ?? "../comic-universe/dev-data/comics",
);
const overwrite = Boolean(args.overwrite);
const dryRun = Boolean(args.dryRun);

ensureCommand("sqlite3");
ensureCommand("zip");

if (!fs.existsSync(dbPath)) {
  fail(`Legacy DB not found: ${dbPath}`);
}

if (!fs.existsSync(comicsRoot)) {
  fail(`Comics root not found: ${comicsRoot}`);
}

const rows = loadChapterRows(dbPath);

let created = 0;
let skippedNoLocalPages = 0;
let skippedMissingFiles = 0;
let skippedExists = 0;
let failed = 0;
const plannedOutputPaths = new Set();
const comicDirByKey = new Map();
const usedComicDirs = new Set();

for (const row of rows) {
  const parsedPages = safeParseJson(row.pages, []);
  const pages = Array.isArray(parsedPages) ? parsedPages : [];
  const localFiles = pages
    .map((page) => page?.path)
    .filter((value) => typeof value === "string")
    .filter((value) => !value.startsWith("http://") && !value.startsWith("https://"))
    .map((value) => resolvePagePath(comicsRoot, value));

  if (localFiles.length === 0) {
    skippedNoLocalPages += 1;
    continue;
  }

  const existingFiles = localFiles.filter((file) => fs.existsSync(file));
  if (existingFiles.length === 0) {
    skippedMissingFiles += 1;
    continue;
  }

  const outDir = path.join(comicsRoot, resolveComicDirectoryName(row, comicDirByKey, usedComicDirs));
  fs.mkdirSync(outDir, { recursive: true });

  const outFileName = buildChapterFileName(row.chapterName, row.number);
  const outPath = path.join(outDir, outFileName);
  const resolvedOutPath = ensureUniquePath(outPath, plannedOutputPaths);

  if (fs.existsSync(resolvedOutPath) && !overwrite) {
    skippedExists += 1;
    continue;
  }

  if (dryRun) {
    console.log(`[dry-run] ${resolvedOutPath} <= ${existingFiles.length} pages`);
    created += 1;
    continue;
  }

  if (fs.existsSync(resolvedOutPath)) {
    fs.rmSync(resolvedOutPath, { force: true });
  }

  const sortedFiles = [...existingFiles].sort((a, b) => a.localeCompare(b, "en"));
  const success = createCbz(resolvedOutPath, sortedFiles);
  if (success) {
    created += 1;
    console.log(`Created: ${resolvedOutPath}`);
  } else {
    failed += 1;
  }
}

console.log("");
console.log("Export finished");
console.log(`DB: ${dbPath}`);
console.log(`Comics root: ${comicsRoot}`);
console.log(`Created: ${created}`);
console.log(`Skipped (no local pages): ${skippedNoLocalPages}`);
console.log(`Skipped (all local pages missing): ${skippedMissingFiles}`);
console.log(`Skipped (already exists): ${skippedExists}`);
console.log(`Failed: ${failed}`);

function parseArgs(rawArgs) {
  const parsed = {};

  for (let i = 0; i < rawArgs.length; i += 1) {
    const token = rawArgs[i];
    if (token === "--overwrite") {
      parsed.overwrite = true;
      continue;
    }

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
  }

  return parsed;
}

function ensureCommand(command) {
  const result = spawnSync("which", [command], { encoding: "utf8" });
  if (result.status !== 0) {
    fail(`Required command not found: ${command}`);
  }
}

function loadChapterRows(databasePath) {
  const query = `
    SELECT
      ch.id AS chapterId,
      ch.comicId AS comicId,
      c.name AS comicName,
      ch.name AS chapterName,
      ch.number AS number,
      ch.pages AS pages
    FROM "Chapter" ch
    LEFT JOIN "Comic" c ON c.id = ch.comicId
    ORDER BY c.name, CAST(ch.number AS REAL), ch.number, ch.id;
  `;

  const result = spawnSync(
    "sqlite3",
    ["-json", databasePath, query],
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 64 },
  );

  if (result.status !== 0) {
    fail(`sqlite3 query failed: ${result.stderr || "unknown error"}`);
  }

  return safeParseJson(result.stdout, []);
}

function resolvePagePath(comicsDir, pagePath) {
  if (path.isAbsolute(pagePath)) {
    return pagePath;
  }

  return path.join(comicsDir, pagePath);
}

function buildChapterFileName(chapterName, number) {
  const name = (chapterName ?? "").toString().trim();
  const fallback = `Chapter ${String(number ?? "").trim()}`.trim();
  const baseName = sanitizeSegment(name || fallback || "chapter");
  return `${baseName}.cbz`;
}

function sanitizeSegment(value) {
  return value
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.*/, "")
    .slice(0, 180) || "untitled";
}

function createCbz(destinationPath, files) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cu-cbz-"));
  const zipFile = path.join(tempDir, "chapter.cbz");

  const zipResult = spawnSync(
    "zip",
    ["-q", "-j", zipFile, ...files],
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 32 },
  );

  if (zipResult.status !== 0) {
    console.error(`Failed to create ${destinationPath}`);
    console.error(zipResult.stderr || zipResult.stdout || "zip failed");
    fs.rmSync(tempDir, { recursive: true, force: true });
    return false;
  }

  fs.copyFileSync(zipFile, destinationPath);
  fs.rmSync(tempDir, { recursive: true, force: true });
  return true;
}

function ensureUniquePath(candidatePath, plannedPaths) {
  if (!plannedPaths.has(candidatePath)) {
    plannedPaths.add(candidatePath);
    return candidatePath;
  }

  const parsed = path.parse(candidatePath);
  let counter = 2;
  let alternative = path.join(parsed.dir, `${parsed.name} (${counter})${parsed.ext}`);
  while (plannedPaths.has(alternative)) {
    counter += 1;
    alternative = path.join(parsed.dir, `${parsed.name} (${counter})${parsed.ext}`);
  }

  plannedPaths.add(alternative);
  return alternative;
}

function resolveComicDirectoryName(row, comicDirMap, usedDirs) {
  if (comicDirMap.has(row.comicId)) {
    return comicDirMap.get(row.comicId);
  }

  const baseName = sanitizeSegment((row.comicName ?? "").toString().trim() || "Unknown Comic");
  let candidate = baseName;
  let counter = 2;
  while (usedDirs.has(candidate)) {
    candidate = `${baseName} (${counter})`;
    counter += 1;
  }

  usedDirs.add(candidate);
  comicDirMap.set(row.comicId, candidate);
  return candidate;
}

function safeParseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
