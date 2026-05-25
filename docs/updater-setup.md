# 인앱 업데이터 설정 가이드

GitHub Release 기반 자동 업데이트 활성화 절차.

## 1. 서명 키 생성

```bash
# 키 페어 생성 — 별도의 안전한 위치에 보관 (Git에 커밋 금지!)
npx @tauri-apps/cli signer generate -w ~/.tauri/aion2.key

# 출력:
#   ~/.tauri/aion2.key       (private key — 절대 공개 금지)
#   ~/.tauri/aion2.key.pub   (public key — tauri.conf.json 에 입력)
```

## 2. tauri.conf.json 수정

`src-tauri/tauri.conf.json` 의 `plugins.updater` 섹션:

```json
"updater": {
  "active": true,
  "endpoints": [
    "https://github.com/ohjae-88/PanDaA2/releases/latest/download/latest.json"
  ],
  "dialog": false,
  "pubkey": "여기에 aion2.key.pub 내용 (base64 한 줄) 붙여넣기"
}
```

## 3. GitHub Secrets 등록

Repo Settings → Secrets and variables → Actions:

| Secret 이름 | 값 |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | `~/.tauri/aion2.key` 의 전체 내용 |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 키 생성 시 입력한 암호 |

## 4. 릴리즈 만들기

```bash
# 로컬에서 버전 태그 푸시
git tag v5.4.1
git push origin v5.4.1
```

- `.github/workflows/release.yml` 이 자동 트리거
- Windows 러너에서 빌드 → draft release 생성 + .exe / .sig / latest.json 첨부
- GitHub UI에서 draft 검토 후 publish
- 사용자 앱 다음 실행 시 updater가 `latest.json` 확인 → 알림

## 5. 프론트엔드 호출 예시

```ts
import { checkForUpdate, downloadAndInstall } from "@/lib/util/updater";

// 업데이트 확인 (앱 시작 시 또는 사용자 클릭)
const info = await checkForUpdate();
if (info?.available) {
  // 사용자에게 알림 + 동의 받기
  if (await confirmDialog({
    title: `업데이트 ${info.newVersion} 사용 가능`,
    description: info.notes ?? "최신 버전이 출시되었습니다.",
    confirmText: "지금 업데이트",
    cancelText: "나중에",
  })) {
    await downloadAndInstall((done, total) => {
      console.log(`${done} / ${total ?? "?"}`);
    });
  }
}
```

## 보안 주의

- 개인 키 (`.key`) 는 절대 Git/Discord/Slack 공유 금지
- 개인 키 분실 시 모든 기존 사용자는 신규 키로 빌드된 새 .exe 수동 설치 필요
- pubkey 변경 시 기존 설치자 업데이트 채널 끊김 (사실상 키 로테이션 = 강제 재설치)
