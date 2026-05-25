# 판다의 A2 통합 — Ver.5.2.0

**Tauri v2 + Next.js 15 + React 19 + TypeScript + Tailwind CSS + shadcn/ui**

네이티브 데스크톱 앱 (Windows). 인게임 오버레이 기능 탑재 예정 — 자세한 계획은 [docs/overlay-roadmap.md](docs/overlay-roadmap.md) 참조.

## 시작하기 (Windows)

처음 설치 시:

```
1. Node.js 자동 설치.bat   더블클릭 → 설치 후 창 닫기
2. Rust 자동 설치.bat      더블클릭 → 설치 후 창 닫기
3. 실행.bat                더블클릭 → npm install + Tauri dev 실행
```

이후 실행:

```
실행.bat   더블클릭 → 네이티브 창이 열림
```

프로덕션 빌드 (.exe 설치 파일 생성):

```
빌드.bat   더블클릭 → src-tauri\target\release\bundle\nsis\*.exe 생성
```

## 기술 스택

- **Tauri 2.1** — Rust 백엔드 + 시스템 webview (Windows: WebView2)
  - 단일 .exe 배포, Electron 대비 ~10x 작음
  - Rust로 OS-level 윈도우 API 자유 — 향후 오버레이 구현의 핵심
- **Next.js 15 (App Router) + 정적 export** (`output: "export"`)
  - 모든 라우트가 정적 HTML로 미리 빌드됨 → Tauri webview가 로컬 파일 로드
- **React 19 + TypeScript 5.6**
- **Tailwind CSS 3 + shadcn/ui** (Radix UI primitives)
- **Zustand + persist** — localStorage 기반 상태 영속화
- **lucide-react** 아이콘

타입 체크:

```bash
npm run typecheck
```

브라우저 단독 실행 (Tauri 없이):

```bash
npm run dev   # http://localhost:3000 — 모든 기능 동일 동작
```

## 구조

```
src-tauri/                  # Rust 네이티브 셸
  Cargo.toml                # Rust 의존성 (tauri 2.1, tauri-plugin-shell)
  tauri.conf.json           # 윈도우/번들/아이콘 설정
  build.rs                  # 빌드 스크립트
  src/main.rs               # 엔트리 (Windows 릴리즈는 콘솔 숨김)
  src/lib.rs                # Tauri 빌더 + #[tauri::command]
                            #   - set_always_on_top(on)
                            #   - toggle_window_visibility()
                            #   - app_version()
  capabilities/default.json # 권한 (always-on-top, show/hide 등)
  icons/                    # 앱 아이콘 (1024x1024 PNG에서 자동 생성 가능)

app/
  layout.tsx                # 루트 레이아웃 — ThemeProvider + SiteHeader + TooltipProvider
  page.tsx                  # / → /dashboard 클라이언트 리다이렉트 (정적 export 호환)
  globals.css               # Tailwind + 디자인 토큰(HSL) + 카테고리 색상
  dashboard/                # 📊 배럭관리 (stub)
  simple/                   # ⚡ 심플 (stub)
  characters/               # 👤 캐릭터 (stub)
  db/                       # ⚙ DB 설정 (stub)
  party/                    # 🧩 파티편집 (stub)
    db/                     # 🗂 캐릭터 DB (stub)
  arcana/                   # 🎴 카드빌드 (stub)
    db-card/                # 🗂 아르카나 DB (stub)
    db-skill/               # 📘 스킬 DB (stub)
  notifier/                 # ⏰ 알리미 — 완전 이식 ✅
    page.tsx                #   타이머 페이지 (전체/구분 모드, 드래그, 툴팁, 알림)
    db/page.tsx             #   DB 페이지 (정렬, 필터, 토글, 저장/불러오기)

components/
  site-header.tsx           # 상단 메뉴 — 4개 카테고리 + 드롭다운
  theme-provider.tsx
  theme-toggle.tsx
  stub-page.tsx
  ui/                       # shadcn 프리미티브 — button, card, dialog, input, select, switch, checkbox, dropdown-menu, tooltip, label
  notifier/                 # 알리미 도메인 컴포넌트
    notifier-card.tsx       #   카드 (드래그 + 호버 툴팁 + 5개 액션)
    edit-dialog.tsx         #   항목 편집 (매시간 옵션 포함)
    time-input-dialog.tsx   #   시간 입력 (시:분:초)
    bulk-alert-dialog.tsx   #   알림 일괄 편집 (직전 알림 N초 전)
    alert-modal.tsx         #   알림 팝업 (글로벌 zustand)
    use-notifier-tick.ts    #   1초 tick — 자동 진행 + 알림 트리거
  unified/                  # 통합 저장 / 불러오기
    unified-button.tsx      #   헤더 진입 버튼
    unified-dialog.tsx      #   영역별 체크박스 + 파일 export/import

lib/
  utils.ts                  # cn 헬퍼
  tauri.ts                  # Tauri invoke 래퍼 + isTauri() 감지 (브라우저 폴백 포함)
  notifier/
    types.ts                # NotifierItem / SpecificTime / NotifierSettings 등
    seed.ts                 # 260520_보스젠.CSV 시드 (31개)
    time.ts                 # nextSpecific / nextSpawnMs / nextSpawnList / formatRemaining / formatAbsTime / typeKey / remainingPhase
    store.ts                # Zustand + persist (localStorage key: `a2-notifier`)
    id.ts                   # newNotifierId
  unified/
    areas.ts                # UnifiedArea 레지스트리 — 도메인 이식 시 available()/getSection()/applySection() 채우기
    normalize.ts            # v2/v4 포맷 → v4 정규화
    types.ts
```

## 통합 저장 / 불러오기

헤더의 `💾 통합 저장/불러오기` 버튼 → 영역별 체크박스 모달. Ver.4.0.9와 동일한 8개 영역:

| 영역             | 상태       | 페이로드                                       |
|------------------|------------|------------------------------------------------|
| 🏰 배럭관리      | 준비 중    | `{accounts, characters}` (도메인 이식 후 활성) |
| 🗄 배럭관리DB    | 준비 중    | `{dbSettings}`                                 |
| ⚔ 파티구성       | 준비 중    | `{...partyData}` (players 제외)                |
| 🗂 파티구성DB    | 준비 중    | `{players}`                                    |
| 🎴 아르카나      | 준비 중    | `{characters, buildList, ownedCards}`          |
| 📚 아르카나DB    | 준비 중    | `{arcana, skills, sets}`                       |
| ⏰ 알리미        | ✅ 사용 가능 | `{settings, itemOrder, groupOrder, notified}`  |
| 🗂 알리미DB      | ✅ 사용 가능 | `{items}` (보스 31개 + 사용자 추가)            |

준비 중인 영역은 모달에서 회색 처리되며 도메인 이식 시 `lib/unified/areas.ts`의 해당 항목만 채우면 자동으로 활성화됩니다. v4(`_kind: 'a2-unified'`) 포맷 + Ver.4.0.9의 v2 레거시 포맷 모두 불러오기 지원.

## 알리미 이식 상태 (✅ 완료)

Ver.4.0.9의 모든 알리미 기능을 그대로 이식:

- ✅ 31개 시드 (CSV 기반), localStorage 영속화
- ✅ 그룹 모드: 가로 그룹 컬럼 + 그룹/카드 드래그 정렬
- ✅ 전체 모드: 3분할 균등 배치 + 카드 높이 통일(140px)
- ✅ 잔여시간 단계: na/due/near(10분 미만 빨강)/soon(분 전 펄스)/normal
- ✅ 10분 그레이스 + 쿨타임 자동 진행
- ✅ 카드 호버 툴팁: 다음 5회 완료 시간, 수요일 5AM 리셋 이전까지
- ✅ 항목 편집 모달: 매일/매시간/요일 + 시분 + 알림 활성/시점
- ✅ 시간 입력 모달: 잡은 일시 / 남은 시간(시:분:초)
- ✅ 알림 일괄 편집: 그룹별 토글 + 직전 알림 N초 전
- ✅ DB 페이지: 정렬·필터·알림 토글·중요 표시·저장·불러오기

## 나머지 카테고리 이식 가이드

남은 3개 카테고리(배럭관리/파티구성/아르카나)는 stub 페이지로 비워두었음. 각 도메인의 Ver.4.0.9 코드 위치:

- 배럭관리: `app.js` 1~3500 라인대 — accounts, characters, dbSettings, dashboard render
- 파티구성: `app.js` 후반부 `partyApp` 영역
- 아르카나: `card/` 디렉터리 (`window.CardApp` IIFE)

각 도메인을 `lib/{domain}/{types,seed,store}.ts` + `app/{route}/page.tsx` + `components/{domain}/*` 패턴으로 이식.

## 디자인 토큰

`app/globals.css` CSS 변수:
- 카테고리 색상: `--cat-barrack` / `--cat-party` / `--cat-arcana` / `--cat-notifier`
- 골드 강조: `--gold`, `--gold-light`
- 다크/라이트 모드 모두 정의

`tailwind.config.ts`에서 `cat.{barrack,party,arcana,notifier}` 및 `gold.{DEFAULT,light}`로 노출.

## 상태 관리

Zustand + `persist` 미들웨어. localStorage 키는 Ver.4.0.9와 동일하게 `a2-notifier` 사용 → 데이터 호환성 유지(아이템 스키마는 동일).

## 인게임 오버레이 (예정)

상세 계획은 [docs/overlay-roadmap.md](docs/overlay-roadmap.md). 단계 요약:

1. **Phase 1** — 메인 윈도우 always-on-top 토글 ✅ Rust 커맨드 이미 노출, UI 버튼만 추가하면 즉시 사용 가능
2. **Phase 2** — 별도 투명 오버레이 윈도우 (Tauri 다중 윈도우)
3. **Phase 3** — 게임 윈도우 자동 추적 (Windows API `FindWindow` + `GetWindowRect`)
4. **Phase 4** — DirectX 후킹 인-프로세스 오버레이 (안티치트 정책 확인 필요)
5. **Phase 5** — Windows Graphics Capture API 합성 오버레이 (대안)

## 라우팅 차이점 (Ver.4.0.9 → 5.2.0)

| 4.0.9 view             | 5.2.0 route          |
|------------------------|----------------------|
| `dashboard`            | `/dashboard`         |
| `simple`               | `/simple`            |
| `characters`           | `/characters`        |
| `db`                   | `/db`                |
| `partycomp`            | `/party`             |
| `partydb`              | `/party/db`          |
| `card-build`           | `/arcana`            |
| `card-arcana-db`       | `/arcana/db-card`    |
| `card-skill-db`        | `/arcana/db-skill`   |
| `notifier`             | `/notifier`          |
| `notifier-db`          | `/notifier/db`       |
