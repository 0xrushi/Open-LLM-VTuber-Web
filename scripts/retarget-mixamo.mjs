#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';
import * as retargetLib from 'vrm-mixamo-retarget/dist/index.esm.js';

const retargetAnimation = retargetLib?.retargetAnimation ?? retargetLib?.default?.retargetAnimation ?? retargetLib?.loadAnim;
if (!retargetAnimation) {
  throw new Error('vrm-mixamo-retarget: retargetAnimation export not found');
}

if (typeof globalThis.ProgressEvent === 'undefined') {
  globalThis.ProgressEvent = class ProgressEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.lengthComputable = Boolean(init.lengthComputable);
      this.loaded = Number(init.loaded ?? 0);
      this.total = Number(init.total ?? 0);
    }
  };
}
if (typeof globalThis.self === 'undefined') {
  globalThis.self = globalThis;
}

const cwd = process.cwd();
const defaultVrmPath = path.resolve(cwd, '../frontend/models/testavatar1.vrm');
const defaultInputDir = path.resolve(cwd, 'src/renderer/public/models/animations');
const defaultOutputDir = path.resolve(defaultInputDir, 'retargeted');

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const idx = args.indexOf(name);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
};

const vrmPath = path.resolve(cwd, getArg('--vrm', defaultVrmPath));
const inputDir = path.resolve(cwd, getArg('--input', defaultInputDir));
const outputDir = path.resolve(cwd, getArg('--output', defaultOutputDir));

const fbxFromCli = args
  .filter((a) => a.toLowerCase().endsWith('.fbx'))
  .map((a) => path.resolve(cwd, a));

const gltfLoader = new GLTFLoader();
gltfLoader.register((parser) => new VRMLoaderPlugin(parser));
const fbxLoader = new FBXLoader();

const loadGltfFromFile = async (filePath) => {
  const bytes = await fs.readFile(filePath);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return await new Promise((resolve, reject) => {
    gltfLoader.parse(buffer, path.dirname(filePath) + path.sep, resolve, reject);
  });
};

const loadFbxFromFile = async (filePath) => {
  const bytes = await fs.readFile(filePath);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return fbxLoader.parse(buffer, path.dirname(filePath) + path.sep);
};

const loadVrm = async () => {
  const gltf = await loadGltfFromFile(vrmPath);
  const vrm = gltf.userData.vrm;
  if (!vrm) throw new Error(`No VRM parsed from: ${vrmPath}`);
  return vrm;
};

const discoverFbx = async () => {
  if (fbxFromCli.length > 0) return fbxFromCli;
  const entries = await fs.readdir(inputDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.fbx'))
    .map((e) => path.join(inputDir, e.name));
};

const main = async () => {
  await fs.mkdir(outputDir, { recursive: true });

  const vrm = await loadVrm();
  const fbxFiles = await discoverFbx();
  if (fbxFiles.length === 0) {
    console.log('No FBX files found to retarget.');
    return;
  }

  for (const fbxPath of fbxFiles) {
    try {
      const fbxAsset = await loadFbxFromFile(fbxPath);
      const clip = retargetAnimation(fbxAsset, vrm, { logWarnings: false });
      if (!clip) {
        console.warn(`[skip] no retargeted clip for ${path.basename(fbxPath)}`);
        continue;
      }

      const outputName = `${path.parse(fbxPath).name}.clip.json`;
      const outputPath = path.join(outputDir, outputName);
      await fs.writeFile(outputPath, JSON.stringify(clip.toJSON(), null, 2), 'utf8');
      console.log(`[ok] ${path.basename(fbxPath)} -> ${path.relative(cwd, outputPath)}`);
    } catch (error) {
      console.error(`[fail] ${path.basename(fbxPath)}:`, error?.message ?? error);
    }
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
