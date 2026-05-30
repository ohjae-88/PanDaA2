// 화면 캡처 + PaddleOCR(ONNX) 한국어 인식
//
// 흐름: 대상 프로그램(창) 지정 → 그 창 스크린샷에서 영역 지정 → [동기화 실행] 시
//       해당 창을 캡처하고 지정 영역만 크롭 → PaddleOCR(det+cls+rec, 한국어) 인식.
//
// - 캡처: xcap 크레이트 (Window / Monitor). 창은 제목으로 재탐색 → 창 이동에 강함.
// - OCR : paddle-ocr-rs (ONNX Runtime). 모델은 앱 리소스(resources/ocr/*)로 번들.
// - 로깅: debug 빌드에서만 OCR 원문을 <project>/OCR_Log 에 저장 (빌드 검증용, 릴리스 미사용).

use base64::{engine::general_purpose::STANDARD, Engine};
use image::{ImageEncoder, RgbaImage};
use serde::Serialize;

use paddle_ocr_rs::ocr_lite::OcrLite;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
pub struct OcrLine {
    pub text: String,
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

#[derive(Serialize)]
pub struct CaptureResult {
    pub width: u32,
    pub height: u32,
    pub png_base64: String,
}

#[derive(Serialize)]
pub struct WinInfo {
    pub id: u32,
    pub title: String,
    pub app: String,
}

// ── 캡처 ──────────────────────────────────────────────

/// 주 모니터 전체 캡처 → RgbaImage
fn capture_primary_image() -> Result<RgbaImage, String> {
    let monitors = xcap::Monitor::all().map_err(|e| format!("모니터 조회 실패: {e}"))?;
    let mon = monitors.first().ok_or_else(|| "모니터를 찾을 수 없습니다.".to_string())?;
    let shot = mon.capture_image().map_err(|e| format!("화면 캡처 실패: {e}"))?;
    let (w, h) = (shot.width(), shot.height());
    let raw: Vec<u8> = shot.into_raw();
    RgbaImage::from_raw(w, h, raw).ok_or_else(|| "캡처 이미지 변환 실패".to_string())
}

/// 구분자(│ |) 앞부분 prefix 추출 — "AION2 │ 닉네임" → "AION2"
fn title_prefix(s: &str) -> String {
    s.split(|c| c == '│' || c == '|').next().unwrap_or(s).trim().to_string()
}

/// 창 제목 매칭: 완전 일치 → prefix(구분자 앞) 일치 → 부분 일치.
/// 닉네임이 바뀌어도 "AION2 │ …" 형태면 동일 프로그램으로 인식.
fn window_matches(wtitle: &str, target: &str) -> bool {
    if wtitle == target {
        return true;
    }
    let tp = title_prefix(target);
    if tp.len() >= 2 && (wtitle == tp || wtitle.starts_with(&format!("{tp} ")) || title_prefix(wtitle) == tp) {
        return true;
    }
    wtitle.contains(target)
}

/// 대상 창을 전면으로 올림 (폴백 모니터-크롭 시 다른 창 가림 방지). Windows 전용 best-effort.
#[cfg(windows)]
fn raise_window(id: u32) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        BringWindowToTop, SetForegroundWindow, ShowWindow, SW_RESTORE,
    };
    let hwnd = HWND(id as usize as *mut core::ffi::c_void);
    unsafe {
        let _ = ShowWindow(hwnd, SW_RESTORE);
        let _ = BringWindowToTop(hwnd);
        let _ = SetForegroundWindow(hwnd);
    }
}
#[cfg(not(windows))]
fn raise_window(_id: u32) {}

/// 거의 검은 이미지인지 — DirectX 창 단독 캡처 실패 시 PrintWindow가 검은 화면 반환.
fn looks_blank(img: &RgbaImage) -> bool {
    let data = img.as_raw();
    let mut nonzero = 0u32;
    let mut i = 0usize;
    while i + 2 < data.len() {
        if data[i] > 8 || data[i + 1] > 8 || data[i + 2] > 8 {
            nonzero += 1;
            if nonzero > 50 {
                return false;
            }
        }
        i += 4 * 97; // 샘플링
    }
    true
}

/// 제목으로 창 찾아 캡처 → RgbaImage.
/// 1) 창 단독 캡처(다른 창에 가려도 해당 창만) 우선.
/// 2) 실패/검은화면(게임 DirectX 등)이면 → 창을 전면으로 올린 뒤 모니터 캡처 → 창 영역 크롭.
fn capture_window_image(title: &str) -> Result<RgbaImage, String> {
    let windows = xcap::Window::all().map_err(|e| format!("창 목록 조회 실패: {e}"))?;
    let win = windows
        .iter()
        .find(|w| window_matches(w.title(), title))
        .ok_or_else(|| format!("창을 찾을 수 없습니다: {title}"))?;

    // 1) 창 단독 캡처 — occlusion-free. 검은화면이면 폴백.
    if let Ok(shot) = win.capture_image() {
        let (w, h) = (shot.width(), shot.height());
        if w > 4 && h > 4 {
            let raw: Vec<u8> = shot.into_raw();
            if let Some(img) = RgbaImage::from_raw(w, h, raw) {
                if !looks_blank(&img) {
                    return Ok(img);
                }
            }
        }
    }

    // 2) 폴백 — 전면화 후 모니터 캡처 → 창 영역 크롭
    raise_window(win.id());
    std::thread::sleep(std::time::Duration::from_millis(250));
    let mon = win.current_monitor();
    let shot = mon.capture_image().map_err(|e| format!("화면 캡처 실패: {e}"))?;
    let (mw, mh) = (shot.width(), shot.height());
    let raw: Vec<u8> = shot.into_raw();
    let mon_img = RgbaImage::from_raw(mw, mh, raw).ok_or_else(|| "캡처 이미지 변환 실패".to_string())?;
    let ox = win.x() - mon.x();
    let oy = win.y() - mon.y();
    Ok(crop_region(&mon_img, ox, oy, win.width() as i32, win.height() as i32))
}

/// region(이미지 기준)을 잘라낸 RgbaImage 반환.
fn crop_region(img: &RgbaImage, x: i32, y: i32, w: i32, h: i32) -> RgbaImage {
    let iw = img.width() as i32;
    let ih = img.height() as i32;
    let x0 = x.clamp(0, (iw - 1).max(0));
    let y0 = y.clamp(0, (ih - 1).max(0));
    let x1 = (x + w).clamp(0, iw);
    let y1 = (y + h).clamp(0, ih);
    let cw = (x1 - x0).max(1) as u32;
    let ch = (y1 - y0).max(1) as u32;
    let mut out = RgbaImage::new(cw, ch);
    for (dy, sy) in (y0..y1).enumerate() {
        for (dx, sx) in (x0..x1).enumerate() {
            out.put_pixel(dx as u32, dy as u32, *img.get_pixel(sx as u32, sy as u32));
        }
    }
    out
}

/// RgbaImage → PNG base64 미리보기
fn encode_capture(img: &RgbaImage) -> Result<CaptureResult, String> {
    let (w, h) = (img.width(), img.height());
    let mut png = Vec::new();
    image::codecs::png::PngEncoder::new(&mut png)
        .write_image(img.as_raw(), w, h, image::ExtendedColorType::Rgba8)
        .map_err(|e| format!("PNG 인코딩 실패: {e}"))?;
    Ok(CaptureResult {
        width: w,
        height: h,
        png_base64: STANDARD.encode(png),
    })
}

// ── OCR ───────────────────────────────────────────────

fn model_path(app: &AppHandle, rel: &str) -> Result<String, String> {
    let p = app
        .path()
        .resolve(rel, BaseDirectory::Resource)
        .map_err(|e| format!("리소스 경로 해석 실패({rel}): {e}"))?;
    Ok(p.to_string_lossy().to_string())
}

fn init_engine_paths(det: &str, cls: &str, rec: &str, dict: &str) -> Result<OcrLite, String> {
    let mut ocr = OcrLite::new();
    ocr.init_models_with_dict(det, cls, rec, dict, 4)
        .map_err(|e| format!("OCR 모델 로드 실패: {e}"))?;
    Ok(ocr)
}

/// 크롭 이미지에 OCR 수행 → 라인 목록 (정렬 + 진단 로깅)
fn ocr_on_image(
    app: &AppHandle,
    img: RgbaImage,
    x: i32,
    y: i32,
    w: i32,
    h: i32,
    source: &str,
) -> Result<Vec<OcrLine>, String> {
    let (iw, ih) = (img.width(), img.height());
    let cropped = crop_region(&img, x, y, w, h);
    let (cw, ch) = (cropped.width(), cropped.height());
    let rgb = image::DynamicImage::ImageRgba8(cropped).to_rgb8();
    let max_side = rgb.width().max(rgb.height()).max(1);

    let det = model_path(app, "ocr/det.onnx").unwrap_or_default();
    let cls = model_path(app, "ocr/cls.onnx").unwrap_or_default();
    let rec = model_path(app, "ocr/rec.onnx").unwrap_or_default();
    let dict = model_path(app, "ocr/korean_dict.txt").unwrap_or_default();
    let ex = |p: &str| if std::path::Path::new(p).exists() { "O" } else { "X" };

    let mut log = String::new();
    log.push_str(&format!("# source: {source}\n"));
    log.push_str(&format!("# capture: {iw}x{ih}  region(req): x={x} y={y} w={w} h={h}  crop: {cw}x{ch}\n"));
    log.push_str(&format!("# det[{}] {det}\n# cls[{}] {cls}\n# rec[{}] {rec}\n# dict[{}] {dict}\n", ex(&det), ex(&cls), ex(&rec), ex(&dict)));

    let mut engine = match init_engine_paths(&det, &cls, &rec, &dict) {
        Ok(e) => e,
        Err(e) => {
            log.push_str(&format!("# ENGINE ERROR: {e}\n"));
            save_ocr_log(&log);
            return Err(e);
        }
    };
    // padding, max_side_len, box_score_thresh, box_thresh, un_clip_ratio, do_angle, most_angle
    let result = match engine.detect(&rgb, 50, max_side, 0.5, 0.3, 1.6, true, true) {
        Ok(r) => r,
        Err(e) => {
            log.push_str(&format!("# DETECT ERROR: {e}\n"));
            save_ocr_log(&log);
            return Err(format!("OCR 인식 실패: {e}"));
        }
    };

    let mut lines: Vec<OcrLine> = result
        .text_blocks
        .iter()
        .filter(|b| !b.text.trim().is_empty())
        .map(|b| {
            let (mut minx, mut miny, mut maxx, mut maxy) = (f64::MAX, f64::MAX, f64::MIN, f64::MIN);
            for p in &b.box_points {
                let (px, py) = (p.x as f64, p.y as f64);
                minx = minx.min(px);
                miny = miny.min(py);
                maxx = maxx.max(px);
                maxy = maxy.max(py);
            }
            if minx == f64::MAX {
                minx = 0.0;
                miny = 0.0;
                maxx = 0.0;
                maxy = 0.0;
            }
            OcrLine {
                // dict가 CRLF면 키마다 \r이 붙어 글자 사이 제어문자 삽입됨 → 제거
                text: b.text.chars().filter(|c| !c.is_control()).collect::<String>(),
                x: minx,
                y: miny,
                w: (maxx - minx).max(0.0),
                h: (maxy - miny).max(0.0),
            }
        })
        .collect();
    lines.sort_by(|a, b| a.y.partial_cmp(&b.y).unwrap_or(std::cmp::Ordering::Equal));

    log.push_str(&format!("# lines: {}\n", lines.len()));
    for l in &lines {
        log.push_str(&format!("[y={:.0} x={:.0}] {}\n", l.y, l.x, l.text));
    }
    save_ocr_log(&log);
    Ok(lines)
}

/// OCR 진단 로그 저장 — 설치 폴더(exe 경로)/OCR_Log, 최근 5개 유지.
/// 릴리스에서도 동작 (배포본 문제 진단용).
fn save_ocr_log(content: &str) {
    let dir = match std::env::current_exe().ok().and_then(|p| p.parent().map(|d| d.join("OCR_Log"))) {
        Some(d) => d,
        None => return,
    };
    if std::fs::create_dir_all(&dir).is_err() {
        return;
    }
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let _ = std::fs::write(dir.join(format!("ocr_{ts}.txt")), content);

    // 최근 5개만 유지 (파일명 ts 정렬 = 시간순)
    if let Ok(rd) = std::fs::read_dir(&dir) {
        let mut files: Vec<std::path::PathBuf> = rd
            .flatten()
            .map(|e| e.path())
            .filter(|p| {
                p.file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n.starts_with("ocr_") && n.ends_with(".txt"))
                    .unwrap_or(false)
            })
            .collect();
        files.sort();
        let excess = files.len().saturating_sub(5);
        for f in files.into_iter().take(excess) {
            let _ = std::fs::remove_file(f);
        }
    }
}

// ── Tauri 커맨드 ──────────────────────────────────────

/// 열린 창 목록 (최소화/무제목 제외)
#[tauri::command]
pub fn ocr_list_windows() -> Result<Vec<WinInfo>, String> {
    let windows = xcap::Window::all().map_err(|e| format!("창 목록 조회 실패: {e}"))?;
    let mut out = Vec::new();
    for w in &windows {
        if w.is_minimized() {
            continue;
        }
        let title = w.title().to_string();
        if title.trim().is_empty() {
            continue;
        }
        out.push(WinInfo {
            id: w.id(),
            title,
            app: w.app_name().to_string(),
        });
    }
    Ok(out)
}

/// 지정 창 캡처 → PNG base64 (영역 지정 미리보기)
#[tauri::command]
pub fn ocr_capture_window(title: String) -> Result<CaptureResult, String> {
    let img = capture_window_image(&title)?;
    encode_capture(&img)
}

/// 주 모니터 캡처 → PNG base64 (창 지정 안 할 때 폴백)
#[tauri::command]
pub fn ocr_capture_primary() -> Result<CaptureResult, String> {
    let img = capture_primary_image()?;
    encode_capture(&img)
}

/// 지정 창의 영역 캡처 + OCR
#[tauri::command]
pub fn ocr_region_window(
    app: AppHandle,
    title: String,
    x: i32,
    y: i32,
    w: i32,
    h: i32,
) -> Result<Vec<OcrLine>, String> {
    if w <= 0 || h <= 0 {
        return Err("영역 크기가 올바르지 않습니다.".into());
    }
    let img = capture_window_image(&title)?;
    // 폴백 캡처 시 대상 창을 전면화했을 수 있음 → 우리 메인 창으로 포커스 복귀 (결과 표시)
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_focus();
    }
    ocr_on_image(&app, img, x, y, w, h, &format!("window:{title}"))
}

/// 주 모니터 영역 캡처 + OCR (폴백)
#[tauri::command]
pub fn ocr_region(app: AppHandle, x: i32, y: i32, w: i32, h: i32) -> Result<Vec<OcrLine>, String> {
    if w <= 0 || h <= 0 {
        return Err("영역 크기가 올바르지 않습니다.".into());
    }
    let img = capture_primary_image()?;
    ocr_on_image(&app, img, x, y, w, h, "primary")
}
