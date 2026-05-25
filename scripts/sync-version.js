#!/usr/bin/env node
/**
 * 버전 동기화 스크립트
 *
 * package.json의 version을 읽어 Cargo.toml에 반영.
 * tauri.conf.json은 "../package.json" 참조 방식으로 자동 동기화됨 (별도 수정 불필요).
 *
 * 사용법:
 *   npm run sync-version          -- 수동 실행
 *   npm version 5.6.0             -- 자동 실행 (version lifecycle hook)
 *
 * npm version <ver> 실행 시 흐름:
 *   1. package.json version 업데이트
 *   2. 이 스크립트 실행 (Cargo.toml 동기화)
 *   3. Cargo.toml git stage
 *   4. git commit + git tag v<ver> 자동 생성
 *   → 이후 git push && git push --tags 하면 CI 빌드 트리거
 */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

// package.json에서 버전 읽기
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const version = pkg.version;

// Cargo.toml 업데이트
const cargoPath = path.join(root, "src-tauri", "Cargo.toml");
let cargo = fs.readFileSync(cargoPath, "utf8");
const updated = cargo.replace(/^version = "[\d.]+"/m, `version = "${version}"`);
if (updated === cargo) {
  console.log(`  Cargo.toml 이미 ${version} — 변경 없음`);
} else {
  fs.writeFileSync(cargoPath, updated);
  console.log(`✓ Cargo.toml → ${version}`);
}

console.log(`\n버전: ${version}`);
