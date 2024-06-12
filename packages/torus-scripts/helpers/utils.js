import fs from "fs";
import path from "path";
import zlib from "zlib";
import { rimraf } from "rimraf";

export function formatSize(size) {
  return (size / 1024).toFixed(2) + " KiB";
}

export function getGzippedSize(asset, dir) {
  const filepath = new URL(path.join(dir, asset.name), import.meta.url);
  const buffer = fs.readFileSync(filepath);
  return formatSize(zlib.gzipSync(buffer).length);
}

export function getGzippedBufferSize(assetBuffer) {
  return formatSize(zlib.gzipSync(assetBuffer).length);
}

export function getGzippedBufferLength(assetBuffer) {
  return zlib.gzipSync(assetBuffer).length;
}

export function makeRow(a, b, c) {
  return `  ${a}\t    ${b}\t ${c}`;
}

export const readJSON = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

export const deleteFolder = async (folderPath) => {
  return rimraf(folderPath);
};

export const readFile = async (fullPath) => {
  if (!fs.existsSync(fullPath)) return {};
  const ext = path.extname(fullPath);
  if (ext === ".json") return readJSONFile(fullPath);
  return import(fullPath);
};

export const readJSONFile = (fullPathUrl) => {
  if (!fs.existsSync(fullPathUrl)) return {};
  return JSON.parse(fs.readFileSync(fullPathUrl instanceof URL ? fullPathUrl.pathname : new URL(fullPathUrl, import.meta.url).pathname));
};

export const resolveFileUrl = (path) => {
  return path instanceof URL ? path.pathname : new URL(path, import.meta.url).pathname;
};
