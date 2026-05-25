use tauri::{Emitter, Manager, WebviewWindowBuilder, WebviewUrl, LogicalSize, LogicalPosition, WindowEvent};
use tauri::tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, CheckMenuItem};
use serde::Serialize;
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

/// 현재 등록된 클릭 통과 토글 단축키 (런타임 재바인딩용)
struct PassthroughHotkey(Mutex<Option<Shortcut>>);
/// 헤더 숨기기/보이기 토글 단축키
struct HeaderHiddenHotkey(Mutex<Option<Shortcut>>);
/// 사용자 정의 단축키 — id → Shortcut 매핑 (run-time 동적 등록/해제)
struct CustomHotkeys(Mutex<HashMap<String, Shortcut>>);
/// 종료 진행 중 플래그 — true 시 WindowEvent::CloseRequested의 prevent_close 스킵
struct ExitFlag(AtomicBool);

/// 사용자 입력 가속기 문자열을 KeyboardEvent.code 이름으로 정규화.
/// 백틱(`), 더하기(+), 마이너스(-) 같은 기호 문자는 Tauri 파서가 거부하므로
/// Code 이름(Backquote/Equal/Minus 등)으로 치환.
fn normalize_accelerator(input: &str) -> String {
    input
        .split('+')
        .map(|tok| match tok.trim() {
            "`" => "Backquote".to_string(),
            "~" => "Backquote".to_string(),
            "-" => "Minus".to_string(),
            "_" => "Minus".to_string(),
            "=" => "Equal".to_string(),
            "+" => "Equal".to_string(),
            "[" | "{" => "BracketLeft".to_string(),
            "]" | "}" => "BracketRight".to_string(),
            "\\" | "|" => "Backslash".to_string(),
            ";" | ":" => "Semicolon".to_string(),
            "'" | "\"" => "Quote".to_string(),
            "," | "<" => "Comma".to_string(),
            "." | ">" => "Period".to_string(),
            "/" | "?" => "Slash".to_string(),
            other => other.to_string(),
        })
        .collect::<Vec<_>>()
        .join("+")
}

#[derive(Serialize)]
struct ProxyResponse {
    status: u16,
    body: String,
}

/// aion2.plaync.com API 등 외부 URL을 Rust 백엔드에서 호출 (CORS 우회).
/// 허용된 호스트만 통과 — 보안 + 의도하지 않은 외부 호출 차단.
#[tauri::command]
async fn fetch_aion2_api(url: String) -> Result<ProxyResponse, String> {
    // 화이트리스트 — aion2 공식 도메인 + Inven 아이온2 스킬 DB
    let allowed_hosts = [
        "aion2.plaync.com",
        "static-aion2.plaync.com",
        "static-aion2-gamedata.plaync.com",
        "assets.playnccdn.com",
        "aion2.inven.co.kr",
        "aion2tool.com",
        "www.aion2tool.com",
    ];
    let parsed = url::Url::parse(&url).map_err(|e| format!("invalid url: {}", e))?;
    let host = parsed.host_str().unwrap_or("");
    if !allowed_hosts.iter().any(|h| host == *h || host.ends_with(&format!(".{}", h))) {
        return Err(format!("host not allowed: {}", host));
    }

    // 일부 사이트(예: Cloudflare 보호)는 짧은 UA를 차단 — 풀 Chrome UA 사용
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(15))
        .cookie_store(true)
        .build()
        .map_err(|e| format!("client build: {}", e))?;

    // Referer — 대상 호스트와 동일 origin 사용 (cross-origin Referer 시 일부 사이트 차단)
    let referer = format!("{}://{}/", parsed.scheme(), host);
    let res = client
        .get(&url)
        .header("Referer", referer)
        .send()
        .await
        .map_err(|e| format!("request failed: {}", e))?;

    let status = res.status().as_u16();
    let body = res.text().await.map_err(|e| format!("body read: {}", e))?;
    Ok(ProxyResponse { status, body })
}

/// aion2.plaync.com 서버 시간 조회 (HTTP Date 헤더)
/// 클라이언트 시계 오차 보정용. RFC 7231 형식 문자열 그대로 반환.
#[tauri::command]
async fn fetch_server_time() -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0")
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .map_err(|e| format!("client build: {}", e))?;

    // HEAD 가 가장 가벼움. 일부 서버는 HEAD 차단 → GET 폴백.
    let req = client
        .head("https://aion2.plaync.com/")
        .header("Referer", "https://aion2.plaync.com/")
        .send()
        .await;
    let res = match req {
        Ok(r) if r.status().is_success() || r.status().is_redirection() => r,
        _ => client
            .get("https://aion2.plaync.com/")
            .header("Referer", "https://aion2.plaync.com/")
            .send()
            .await
            .map_err(|e| format!("request failed: {}", e))?,
    };
    let date_header = res
        .headers()
        .get("date")
        .ok_or_else(|| "no Date header".to_string())?
        .to_str()
        .map_err(|e| format!("date parse: {}", e))?
        .to_string();
    Ok(date_header)
}

/// 메인 윈도우의 always-on-top 토글 — 추후 오버레이 기능의 기초
#[tauri::command]
fn set_always_on_top(window: tauri::Window, on: bool) -> Result<(), String> {
    window.set_always_on_top(on).map_err(|e| e.to_string())
}

/// 윈도우 표시/숨김 토글 — 트레이 메뉴 등에서 사용
#[tauri::command]
fn toggle_window_visibility(window: tauri::Window) -> Result<(), String> {
    let visible = window.is_visible().map_err(|e| e.to_string())?;
    if visible {
        window.hide().map_err(|e| e.to_string())
    } else {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())
    }
}

/// 앱 버전 — 프론트엔드 표시용
#[tauri::command]
fn app_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

const OVERLAY_LABEL: &str = "overlay";

/// 통합 오버레이 윈도우 열기 (탭으로 카테고리 전환). 이미 있으면 포커스만.
#[tauri::command]
async fn open_overlay(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(OVERLAY_LABEL) {
        let _ = w.show();
        let _ = w.set_focus();
        return Ok(());
    }
    let (w_size, h_size) = (380.0_f64, 480.0_f64);
    let url_path = "overlay/window/";
    // restore_state 플러그인은 Windows + transparent + decorations off 조합에서 hang 발생 → 사용 안 함.
    // 위치/크기 복원은 JS 측에서 store(localStorage) 읽어 set_overlay_position/set_overlay_size 호출.
    let win = WebviewWindowBuilder::new(&app, OVERLAY_LABEL, WebviewUrl::App(url_path.into()))
        .title("판다의 A2 오버레이")
        .inner_size(w_size, h_size)
        .min_inner_size(220.0, 140.0)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(true)
        .shadow(false)
        // OS drag-drop 핸들러 비활성화 — Tauri/WebView2가 HTML5 drag 이벤트를 가로채는 문제 방지.
        // 메인 윈도우는 tauri.conf.json에 dragDropEnabled:false 설정. 오버레이는 Rust 빌더라 명시 필요.
        .disable_drag_drop_handler()
        .build()
        .map_err(|e| format!("window build: {}", e))?;
    #[cfg(debug_assertions)]
    {
        win.open_devtools();
    }
    // 종료 X 클릭 시 → frontend에 확인 다이얼로그 트리거
    // ExitFlag set 시 (exit_app/restart_app/트레이 quit 등) prevent_close 스킵 — 정상 종료 허용
    {
        let h = win.clone();
        let app_handle = app.clone();
        win.on_window_event(move |event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let exiting = app_handle
                    .try_state::<ExitFlag>()
                    .map(|f| f.0.load(Ordering::SeqCst))
                    .unwrap_or(false);
                if exiting {
                    return; // 정상 종료 진행
                }
                api.prevent_close();
                let _ = h.emit("window-close-requested", "overlay");
            }
        });
    }
    // 디폴트 위치/크기 — JS 측 마운트 useEffect가 store 값 있으면 덮어씀
    if let Ok(Some(monitor)) = win.current_monitor() {
        let sz = monitor.size();
        let scale = monitor.scale_factor();
        let mw = sz.width as f64 / scale;
        let x = (mw - w_size - 20.0).max(0.0);
        let _ = win.set_position(LogicalPosition::new(x, 60.0));
    }
    let _ = win.set_size(LogicalSize::new(w_size, h_size));
    // 상태 변경 broadcast — 메인 윈도우 토글 버튼이 2초 폴링 없이 즉시 갱신
    let _ = app.emit("overlay-state-changed", true);
    Ok(())
}

/// 오버레이 윈도우 위치 설정 (LogicalPosition)
#[tauri::command]
fn set_overlay_position(app: tauri::AppHandle, x: f64, y: f64) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(OVERLAY_LABEL) {
        w.set_position(LogicalPosition::new(x, y)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 오버레이 윈도우 현재 위치/크기 조회 (LogicalPosition + LogicalSize)
#[derive(Serialize)]
struct OverlayGeometry {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

#[tauri::command]
fn get_overlay_geometry(app: tauri::AppHandle) -> Result<Option<OverlayGeometry>, String> {
    let Some(win) = app.get_webview_window(OVERLAY_LABEL) else {
        return Ok(None);
    };
    let scale = win.scale_factor().map_err(|e| e.to_string())?;
    let pos = win.outer_position().map_err(|e| e.to_string())?;
    let sz = win.inner_size().map_err(|e| e.to_string())?;
    Ok(Some(OverlayGeometry {
        x: pos.x as f64 / scale,
        y: pos.y as f64 / scale,
        w: sz.width as f64 / scale,
        h: sz.height as f64 / scale,
    }))
}

#[tauri::command]
fn close_overlay(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(OVERLAY_LABEL) {
        w.close().map_err(|e| e.to_string())?;
        let _ = app.emit("overlay-state-changed", false);
    }
    Ok(())
}

#[tauri::command]
fn set_overlay_passthrough(app: tauri::AppHandle, ignore: bool) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(OVERLAY_LABEL) {
        w.set_ignore_cursor_events(ignore).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn set_overlay_always_on_top(app: tauri::AppHandle, on: bool) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(OVERLAY_LABEL) {
        w.set_always_on_top(on).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn is_overlay_open(app: tauri::AppHandle) -> bool {
    app.get_webview_window(OVERLAY_LABEL).is_some()
}

/// 오버레이 크기 조정 — 확장/축소 모드 전환용
#[tauri::command]
fn set_overlay_size(app: tauri::AppHandle, width: f64, height: f64) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(OVERLAY_LABEL) {
        w.set_size(LogicalSize::new(width, height)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 클릭 통과 토글 단축키 등록 — 이전 단축키는 자동 해제.
/// accelerator 예: "Alt+`", "Ctrl+Shift+O" 등.
/// 사용자 입력 편의를 위해 일부 기호를 KeyboardEvent.code 이름으로 정규화한 뒤 파싱.
#[tauri::command]
fn register_overlay_passthrough_hotkey(
    app: tauri::AppHandle,
    accelerator: String,
) -> Result<(), String> {
    let normalized = normalize_accelerator(&accelerator);
    let shortcut = Shortcut::from_str(&normalized)
        .map_err(|e| format!("invalid accelerator '{}' (정규화: '{}'): {}", accelerator, normalized, e))?;
    let gs = app.global_shortcut();
    // 기존 단축키가 있으면 해제
    let state = app.state::<PassthroughHotkey>();
    if let Ok(mut guard) = state.0.lock() {
        if let Some(prev) = guard.take() {
            let _ = gs.unregister(prev);
        }
    }
    // 새 단축키 등록 — 누르면 오버레이 윈도우에 'overlay-passthrough-toggle' 이벤트 emit
    // shortcut을 보관해야 unregister 가능하므로 clone하여 핸들러에 전달.
    let shortcut_for_handler = shortcut.clone();
    gs.on_shortcut(shortcut_for_handler, |app, _shortcut, event| {
        if event.state() != ShortcutState::Pressed {
            return;
        }
        if let Some(win) = app.get_webview_window(OVERLAY_LABEL) {
            let _ = win.emit("overlay-passthrough-toggle", ());
        }
    })
    .map_err(|e| format!("hotkey register: {}", e))?;
    if let Ok(mut guard) = state.0.lock() {
        *guard = Some(shortcut);
    }
    Ok(())
}

#[tauri::command]
fn unregister_overlay_passthrough_hotkey(app: tauri::AppHandle) -> Result<(), String> {
    let gs = app.global_shortcut();
    let state = app.state::<PassthroughHotkey>();
    if let Ok(mut guard) = state.0.lock() {
        if let Some(prev) = guard.take() {
            gs.unregister(prev).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// 헤더 숨기기/보이기 단축키 등록 — 누르면 오버레이에 'overlay-header-toggle' 이벤트 emit
#[tauri::command]
fn register_overlay_header_toggle_hotkey(
    app: tauri::AppHandle,
    accelerator: String,
) -> Result<(), String> {
    let normalized = normalize_accelerator(&accelerator);
    let shortcut = Shortcut::from_str(&normalized)
        .map_err(|e| format!("invalid accelerator '{}' (정규화: '{}'): {}", accelerator, normalized, e))?;
    let gs = app.global_shortcut();
    let state = app.state::<HeaderHiddenHotkey>();
    if let Ok(mut guard) = state.0.lock() {
        if let Some(prev) = guard.take() {
            let _ = gs.unregister(prev);
        }
    }
    let shortcut_for_handler = shortcut.clone();
    gs.on_shortcut(shortcut_for_handler, |app, _shortcut, event| {
        if event.state() != ShortcutState::Pressed {
            return;
        }
        if let Some(win) = app.get_webview_window(OVERLAY_LABEL) {
            let _ = win.emit("overlay-header-toggle", ());
        }
    })
    .map_err(|e| format!("hotkey register: {}", e))?;
    if let Ok(mut guard) = state.0.lock() {
        *guard = Some(shortcut);
    }
    Ok(())
}

#[tauri::command]
fn unregister_overlay_header_toggle_hotkey(app: tauri::AppHandle) -> Result<(), String> {
    let gs = app.global_shortcut();
    let state = app.state::<HeaderHiddenHotkey>();
    if let Ok(mut guard) = state.0.lock() {
        if let Some(prev) = guard.take() {
            gs.unregister(prev).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// 앱 완전 종료 — 트레이/숨김 우회. 종료 확인 다이얼로그에서 호출.
#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    // ExitFlag 설정 — CloseRequested 핸들러가 prevent_close 스킵하도록
    if let Some(flag) = app.try_state::<ExitFlag>() {
        flag.0.store(true, Ordering::SeqCst);
    }
    app.exit(0);
}

/// 앱 재시작 — 두 번째 인스턴스 확인 시 기존 종료 후 새 프로세스로 재실행.
#[tauri::command]
fn restart_app(app: tauri::AppHandle) {
    if let Some(flag) = app.try_state::<ExitFlag>() {
        flag.0.store(true, Ordering::SeqCst);
    }
    app.restart();
}

/// 메인 윈도우 표시 (Tauri 부팅 시 visible=false 이므로 명시적 호출 필요)
#[tauri::command]
fn show_main_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("main") {
        w.show().map_err(|e| e.to_string())?;
        let _ = w.unminimize();
        w.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 사용자 정의 단축키 등록 — 동일 id 기존 등록은 자동 해제.
/// 누르면 모든 윈도우에 `custom-hotkey-fired` 이벤트(payload = id) emit.
#[tauri::command]
fn register_custom_hotkey(
    app: tauri::AppHandle,
    id: String,
    accelerator: String,
) -> Result<(), String> {
    let normalized = normalize_accelerator(&accelerator);
    let shortcut = Shortcut::from_str(&normalized)
        .map_err(|e| format!("invalid accelerator '{}' (정규화: '{}'): {}", accelerator, normalized, e))?;
    let gs = app.global_shortcut();
    let state = app.state::<CustomHotkeys>();
    // 동일 id 이전 등록 해제
    if let Ok(mut map) = state.0.lock() {
        if let Some(prev) = map.remove(&id) {
            let _ = gs.unregister(prev);
        }
    }
    let id_for_handler = id.clone();
    let shortcut_for_handler = shortcut.clone();
    gs.on_shortcut(shortcut_for_handler, move |app, _shortcut, event| {
        if event.state() != ShortcutState::Pressed {
            return;
        }
        // 모든 윈도우에 emit — 메인/오버레이 어디서든 listener 동작 가능
        let _ = app.emit("custom-hotkey-fired", &id_for_handler);
    })
    .map_err(|e| format!("hotkey register: {}", e))?;
    if let Ok(mut map) = state.0.lock() {
        map.insert(id, shortcut);
    }
    Ok(())
}

#[tauri::command]
fn unregister_custom_hotkey(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let gs = app.global_shortcut();
    let state = app.state::<CustomHotkeys>();
    if let Ok(mut map) = state.0.lock() {
        if let Some(prev) = map.remove(&id) {
            gs.unregister(prev).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
fn unregister_all_custom_hotkeys(app: tauri::AppHandle) -> Result<(), String> {
    let gs = app.global_shortcut();
    let state = app.state::<CustomHotkeys>();
    if let Ok(mut map) = state.0.lock() {
        let prev_list: Vec<Shortcut> = map.drain().map(|(_, s)| s).collect();
        for s in prev_list {
            let _ = gs.unregister(s);
        }
    }
    Ok(())
}

/// 오버레이 토글 (열려있으면 닫고, 닫혀있으면 엶)
#[tauri::command]
async fn toggle_overlay(app: tauri::AppHandle) -> Result<bool, String> {
    if app.get_webview_window(OVERLAY_LABEL).is_some() {
        close_overlay(app)?;
        Ok(false)
    } else {
        open_overlay(app).await?;
        Ok(true)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // 두 번째 인스턴스 감지 — 기존 인스턴스가 처리, 두 번째 인스턴스는 자동 종료.
            // 메인 윈도우 표시 + 프론트엔드에 이벤트 emit (사용자 확인 다이얼로그 트리거).
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
            let _ = app.emit("second-instance-detected", ());
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            // 로그 — stdout + 로그 파일 (LOG_DIR/logs/). 사용자 버그 리포트 시 첨부 가능.
            // 레벨: 기본 Info. 패닉/네트워크 실패 등 추적용.
            tauri_plugin_log::Builder::default()
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir { file_name: None }),
                ])
                .level(log::LevelFilter::Info)
                .max_file_size(2_000_000) // 2MB cap — rotation
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
                .build(),
        )
        .manage(PassthroughHotkey(Mutex::new(None)))
        .manage(HeaderHiddenHotkey(Mutex::new(None)))
        .manage(CustomHotkeys(Mutex::new(HashMap::new())))
        .manage(ExitFlag(AtomicBool::new(false)))
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }
            // 1) 트레이 아이콘 + 메뉴 구성
            let handle = app.handle().clone();
            let open_main = MenuItem::with_id(app, "open_main", "프로그램 열기", true, None::<&str>)?;
            let toggle_aot = CheckMenuItem::with_id(app, "toggle_aot", "항상 위", true, true, None::<&str>)?;
            let toggle_pass = CheckMenuItem::with_id(app, "toggle_pass", "클릭 통과", true, false, None::<&str>)?;
            let toggle_overlay_item = MenuItem::with_id(app, "toggle_overlay", "오버레이 표시/숨김", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_main, &toggle_overlay_item, &toggle_aot, &toggle_pass, &sep, &quit])?;
            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("판다의 A2")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| {
                    match event.id.as_ref() {
                        "open_main" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.unminimize();
                                let _ = w.set_focus();
                            }
                        }
                        "toggle_overlay" => {
                            if app.get_webview_window(OVERLAY_LABEL).is_some() {
                                let _ = close_overlay(app.clone());
                            } else {
                                let app_clone = app.clone();
                                tauri::async_runtime::spawn(async move {
                                    let _ = open_overlay(app_clone).await;
                                });
                            }
                        }
                        "toggle_aot" => {
                            if let Some(w) = app.get_webview_window(OVERLAY_LABEL) {
                                // 현재 상태 알기 어려우므로 상시 토글
                                let _ = w.set_always_on_top(true);
                            }
                        }
                        "toggle_pass" => {
                            if let Some(w) = app.get_webview_window(OVERLAY_LABEL) {
                                // 단순 토글 — 트레이에서 현재 값 추적 어려움, 프론트가 동기화함
                                let _ = w.emit("overlay-passthrough-toggle", ());
                            }
                        }
                        "quit" => {
                            if let Some(flag) = app.try_state::<ExitFlag>() {
                                flag.0.store(true, Ordering::SeqCst);
                            }
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        let app = tray.app_handle();
                        // 좌클릭 — 오버레이 표시/숨김 토글
                        if let Some(w) = app.get_webview_window(OVERLAY_LABEL) {
                            let visible = w.is_visible().unwrap_or(false);
                            if visible {
                                let _ = w.hide();
                            } else {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        } else {
                            // 없으면 새로 엶
                            let app_clone = app.clone();
                            tauri::async_runtime::spawn(async move {
                                let _ = open_overlay(app_clone).await;
                            });
                        }
                    }
                })
                .build(app)?;
            // 메뉴 항목 참조 누수 방지 — managed로 보관
            let _ = open_main; let _ = toggle_aot; let _ = toggle_pass; let _ = toggle_overlay_item; let _ = sep; let _ = quit;

            // 2) 메인/오버레이 윈도우 X 클릭 시 → frontend에 확인 다이얼로그 트리거.
            //    종료/숨김 결정은 사용자가 다이얼로그에서 선택 (프론트엔드 exit_app/hide 호출).
            if let Some(main_win) = app.get_webview_window("main") {
                let h = main_win.clone();
                let app_handle = app.handle().clone();
                main_win.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        let exiting = app_handle
                            .try_state::<ExitFlag>()
                            .map(|f| f.0.load(Ordering::SeqCst))
                            .unwrap_or(false);
                        if exiting {
                            return; // 정상 종료 진행 — prevent_close 스킵
                        }
                        api.prevent_close();
                        let _ = h.emit("window-close-requested", "main");
                    }
                });
            }
            // 오버레이 윈도우는 동적 생성이므로 open_overlay 내부에서 close-requested 핸들러 등록 (별도)

            // 3) 기본 실행 시 오버레이 윈도우 열기 (메인 윈도우는 visible=false로 숨김)
            tauri::async_runtime::spawn(async move {
                let _ = open_overlay(handle.clone()).await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_always_on_top,
            toggle_window_visibility,
            app_version,
            fetch_aion2_api,
            fetch_server_time,
            open_overlay,
            close_overlay,
            set_overlay_passthrough,
            set_overlay_always_on_top,
            is_overlay_open,
            set_overlay_size,
            toggle_overlay,
            show_main_window,
            set_overlay_position,
            get_overlay_geometry,
            register_overlay_passthrough_hotkey,
            unregister_overlay_passthrough_hotkey,
            register_overlay_header_toggle_hotkey,
            unregister_overlay_header_toggle_hotkey,
            register_custom_hotkey,
            unregister_custom_hotkey,
            unregister_all_custom_hotkeys,
            exit_app,
            restart_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
