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

/// 제목으로 창 찾아 캡처 → RgbaImage.
/// 게임(DirectX) 창은 개별 창 캡처가 0x80070005(액세스 거부)로 막히므로,
/// 창이 속한 모니터를 캡처한 뒤 창 사각형으로 크롭한다.
fn capture_window_image(title: &str) -> Result<RgbaImage, String> {
    let windows = xcap::Window::all().map_err(|e| format!("창 목록 조회 실패: {e}"))?;
    let win = windows
        .iter()
        .find(|w| w.title() == title)
        .or_else(|| windows.iter().find(|w| w.title().contains(title)))
        .ok_or_else(|| format!("창을 찾을 수 없습니다: {title}"))?;

    let mon = win.current_monitor();
    let shot = mon.capture_image().map_err(|e| format!("화면 캡처 실패: {e}"))?;
    let (mw, mh) = (shot.width(), shot.height());
    let raw: Vec<u8> = shot.into_raw();
    let mon_img = RgbaImage::from_raw(mw, mh, raw).ok_or_else(|| "캡처 이미지 변환 실패".to_string())?;

    // 창 영역 = 창 좌표 - 모니터 좌표 (모니터-상대 픽셀)
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

fn init_engine(app: &AppHandle) -> Result<OcrLite, String> {
    let det = model_path(app, "ocr/det.onnx")?;
    let cls = model_path(app, "ocr/cls.onnx")?;
    let rec = model_path(app, "ocr/rec.onnx")?;
    let dict = model_path(app, "ocr/korean_dict.txt")?;
    let mut ocr = OcrLite::new();
    ocr.init_models_with_dict(&det, &cls, &rec, &dict, 4)
        .map_err(|e| format!("OCR 모델 로드 실패: {e}"))?;
    Ok(ocr)
}

/// 크롭 이미지에 OCR 수행 → 라인 목록 (정렬 + 로깅)
fn ocr_on_image(
    app: &AppHandle,
    img: RgbaImage,
    x: i32,
    y: i32,
    w: i32,
    h: i32,
    source: &str,
) -> Result<Vec<OcrLine>, String> {
    let cropped = crop_region(&img, x, y, w, h);
    let rgb = image::DynamicImage::ImageRgba8(cropped).to_rgb8();
    let max_side = rgb.width().max(rgb.height()).max(1);

    let mut engine = init_engine(app)?;
    // padding, max_side_len, box_score_thresh, box_thresh, un_clip_ratio, do_angle, most_angle
    let result = engine
        .detect(&rgb, 50, max_side, 0.5, 0.3, 1.6, true, true)
        .map_err(|e| format!("OCR 인식 실패: {e}"))?;

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
                text: b.text.clone(),
                x: minx,
                y: miny,
                w: (maxx - minx).max(0.0),
                h: (maxy - miny).max(0.0),
            }
        })
        .collect();
    lines.sort_by(|a, b| a.y.partial_cmp(&b.y).unwrap_or(std::cmp::Ordering::Equal));
    write_ocr_log(&lines, source);
    Ok(lines)
}

/// OCR 원문 로그 — debug 빌드 전용 (<project>/OCR_Log). 릴리스에서는 no-op.
#[cfg(debug_assertions)]
fn write_ocr_log(lines: &[OcrLine], source: &str) {
    use std::io::Write;
    // CARGO_MANIFEST_DIR = src-tauri → 부모 = 프로젝트 루트
    let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|p| p.join("OCR_Log"));
    let Some(dir) = dir else { return };
    if std::fs::create_dir_all(&dir).is_err() {
        return;
    }
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let path = dir.join(format!("ocr_{ts}.txt"));
    if let Ok(mut f) = std::fs::File::create(&path) {
        let _ = writeln!(f, "# source: {source}");
        let _ = writeln!(f, "# lines: {}", lines.len());
        for l in lines {
            let _ = writeln!(f, "[y={:.0} x={:.0}] {}", l.y, l.x, l.text);
        }
    }
}
#[cfg(not(debug_assertions))]
fn write_ocr_log(_lines: &[OcrLine], _source: &str) {}

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
