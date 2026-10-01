//! Reads an emulated maki's screen, from a frame `shot` saved (a PGM, 128 by 128, lit pixels
//! light), for the emulator tests:
//!
//!     screenread text FRAME TEXT...   where each TEXT is drawn in one of maki's fonts, at any
//!                                     scale up to 4, or "missing"
//!     screenread qr FRAME             the QR code on it, or nothing (and exits 1)
//!
//! Text is found by drawing it with maki-wasm's canvas, whose glyphs are the ones maki draws its
//! own screens with, and looking for that exact bitmap. Build it before starting the emulator:
//! a build while it runs starves it.
use maki_wasm::{Canvas, Color, Style};

fn read_pgm(path: &str) -> (usize, usize, Vec<bool>) {
    let b = std::fs::read(path).unwrap_or_else(|e| panic!("{path}: {e}"));
    // P5, width, height, 255, then a byte a pixel
    let mut fields = Vec::new();
    let mut at = 0;
    while fields.len() < 4 {
        while b[at].is_ascii_whitespace() {
            at += 1;
        }
        let start = at;
        while !b[at].is_ascii_whitespace() {
            at += 1;
        }
        fields.push(String::from_utf8_lossy(&b[start..at]).into_owned());
    }
    at += 1;
    let (w, h): (usize, usize) = (fields[1].parse().unwrap(), fields[2].parse().unwrap());
    (w, h, b[at..at + w * h].iter().map(|&v| v >= 128).collect())
}

/// `text` drawn in `style` at `scale`: the box its lit pixels fill, as rows of booleans.
fn drawn(text: &str, style: Style, scale: i32) -> Option<(usize, usize, Vec<bool>)> {
    let mut c = Canvas::default();
    c.text_scaled(0, 0, text, style, scale, Color::Light);
    let lit: Vec<(i32, i32)> =
        (0..110).flat_map(|y| (0..128).map(move |x| (x, y))).filter(|&(x, y)| c.get(x, y)).collect();
    let (x0, y0) = (lit.iter().map(|p| p.0).min()?, lit.iter().map(|p| p.1).min()?);
    let (x1, y1) = (lit.iter().map(|p| p.0).max()?, lit.iter().map(|p| p.1).max()?);
    // all of it on the canvas, or it can't be compared
    if x1 == 127 || y1 == 109 {
        return None;
    }
    let (w, h) = ((x1 - x0 + 1) as usize, (y1 - y0 + 1) as usize);
    let bits = (0..h).flat_map(|y| (0..w).map(move |x| (x, y))).map(|(x, y)| c.get(x0 + x as i32, y0 + y as i32));
    Some((w, h, bits.collect()))
}

fn text(frame: &str, texts: &[String]) {
    let (fw, fh, px) = read_pgm(frame);
    for t in texts {
        let mut found = Vec::new();
        for style in [Style::Bold, Style::Small, Style::Regular, Style::Mono, Style::Tall] {
            for scale in 1..=4 {
                let Some((w, h, bits)) = drawn(t, style, scale) else { continue };
                for oy in 0..=fh.saturating_sub(h) {
                    for ox in 0..=fw.saturating_sub(w) {
                        if (0..h).all(|y| (0..w).all(|x| px[(oy + y) * fw + ox + x] == bits[y * w + x])) {
                            found.push(format!("{style:?} x{scale} at {ox},{oy}"));
                        }
                    }
                }
            }
        }
        println!("{t}\t{}", if found.is_empty() { "missing".into() } else { found.join("; ") });
    }
}

fn qr(frame: &str) -> bool {
    let (fw, fh, px) = read_pgm(frame);
    // bigger, with a light margin, as a camera would see it
    let (scale, margin) = (4, 16);
    let (w, h) = (fw * scale + 2 * margin, fh * scale + 2 * margin);
    let mut img = rqrr::PreparedImage::prepare_from_greyscale(w, h, |x, y| {
        let (x, y) = (x as i64 - margin as i64, y as i64 - margin as i64);
        let inside = x >= 0 && y >= 0 && x < (fw * scale) as i64 && y < (fh * scale) as i64;
        if !inside || px[(y as usize / scale) * fw + x as usize / scale] { 255 } else { 0 }
    });
    let grids = img.detect_grids();
    match grids.first().and_then(|g| g.decode().ok()) {
        Some((_, text)) => {
            println!("{text}");
            true
        }
        None => false,
    }
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match args.first().map(String::as_str) {
        Some("text") if args.len() >= 3 => text(&args[1], &args[2..]),
        Some("qr") if args.len() == 2 => std::process::exit(if qr(&args[1]) { 0 } else { 1 }),
        _ => {
            eprintln!("screenread text FRAME TEXT... | screenread qr FRAME");
            std::process::exit(2);
        }
    }
}
