# 인게임 오버레이 로드맵

판다의 A2 Ver.5.2.0을 Tauri 데스크톱 앱으로 전환한 이유 중 하나는 **인게임 오버레이 기능**을 위해서다. Rust 백엔드 + 시스템 webview를 사용하면 Electron보다 훨씬 가볍게 OS-level 윈도우 API에 접근할 수 있다.

## 단계별 구현 계획

### Phase 1 — 메인 윈도우 always-on-top (즉시 가능)

이미 구현된 Tauri 커맨드:
- `set_always_on_top(on: bool)` — [src/lib.rs](../src-tauri/src/lib.rs)
- 프런트 헬퍼: `lib/tauri.ts`의 `setAlwaysOnTop()`

UI에 토글 버튼만 추가하면 즉시 사용 가능. 게임 위에 메인 창이 떠 있는 가장 단순한 형태.

### Phase 2 — 별도 투명 오버레이 윈도우 (Phase 1과 별도 창)

`tauri.conf.json`에 두 번째 윈도우 정의:

```json
{
  "label": "overlay",
  "url": "/overlay",
  "transparent": true,
  "decorations": false,
  "alwaysOnTop": true,
  "skipTaskbar": true,
  "focus": false,
  "resizable": false,
  "width": 400, "height": 600
}
```

`app/overlay/page.tsx`로 오버레이 전용 화면 — 알리미 타이머만 작게 표시 등.

플랫폼 API:
- Windows: `WS_EX_LAYERED | WS_EX_TRANSPARENT` 스타일로 마우스 통과 가능
- Tauri 2: `window.set_ignore_cursor_events(true)`

### Phase 3 — 게임 윈도우 추적 + 자동 정렬

AION2 게임 프로세스를 감지해 그 위에 오버레이를 정렬:

```rust
// Windows API
use windows::Win32::UI::WindowsAndMessaging::{
    FindWindowW, GetWindowRect, EnumWindows,
};
```

- `FindWindowW(class_name, "AION2")`로 게임 핸들 획득
- `GetWindowRect`로 게임 창 위치/크기 추적
- 오버레이 윈도우를 게임 위에 자동 배치
- 알트탭 추적 (`SetWinEventHook(EVENT_SYSTEM_FOREGROUND, ...)`)

크레이트: `windows = "0.58"` (Microsoft 공식 Win32 바인딩)

### Phase 4 — 진짜 인게임 오버레이 (DirectX 후킹)

여기까지는 OS-level 투명 윈도우(별도 창)다. **게임의 렌더 파이프라인에 직접 그리는** 완전한 인게임 오버레이는 다음이 필요:

1. **DLL 인젝션** — 게임 프로세스에 코드 주입
2. **DirectX 후킹** — `Present()` 함수 후킹해 매 프레임 그리기
3. **ImGui DirectX 백엔드** 또는 자체 렌더링

크레이트:
- `dll-syringe` — DLL 인젝션
- `retour` — 함수 후킹
- `egui-d3d11` / `imgui-dx11-renderer` — DX11 렌더링

**주의**: 안티치트(예: 게임가드, EAC) 환경에서는 차단/제재 위험. AION2의 안티치트 정책 확인 필수.

### Phase 5 — Out-of-process screen capture overlay (대안)

DirectX 후킹 대신 좀 더 안전한 방법:
- Windows Graphics Capture API로 게임 화면 캡처
- 별도 투명 윈도우에 캡처 + 오버레이 합성
- 안티치트 우회 없음, 정책 충돌 ↓

## 권장 우선순위

1. **Phase 1** — 가장 즉시 효과적, 한 시간이면 구현 가능
2. **Phase 2 + 3** — Tauri 1주차 학습 후 충분히 도전 가능
3. **Phase 4** — 안티치트 정책 확인 후, 사용자 선택 옵션으로
4. **Phase 5** — 4가 불가능할 때 폴백

## 참고 자료

- Tauri 다중 윈도우: https://v2.tauri.app/learn/window-customization/
- Tauri 투명 윈도우: https://v2.tauri.app/learn/window-customization/#transparent-window
- Windows 오버레이 패턴: https://github.com/0x1F9F1/SubCharger (참고용)
- Tauri 플러그인 작성: https://v2.tauri.app/develop/plugins/
