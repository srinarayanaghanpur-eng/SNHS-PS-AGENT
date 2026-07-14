#!/usr/bin/env python3
"""Photo intelligence: face/subject detection, crop focus, brightness, and
whether a title can be safely overlaid. Prints JSON to stdout.

Usage: python3 analyze_photo.py <image> <targetW> <targetH>
"""
import sys, os, json
import cv2
import numpy as np


def detect_faces(gray, w, h):
    boxes = []
    for name, params in [
        ('haarcascade_frontalface_default.xml', dict(scaleFactor=1.08, minNeighbors=5)),
        ('haarcascade_profileface.xml', dict(scaleFactor=1.1, minNeighbors=4)),
    ]:
        casc = cv2.CascadeClassifier(os.path.join(cv2.data.haarcascades, name))
        if casc.empty():
            continue
        found = casc.detectMultiScale(gray, minSize=(max(14, w // 90), max(14, h // 90)), **params)
        for (x, y, fw, fh) in found:
            boxes.append([int(x), int(y), int(fw), int(fh)])
    return boxes


def main():
    path = sys.argv[1]
    tw = float(sys.argv[2]) if len(sys.argv) > 2 else 1080.0
    th = float(sys.argv[3]) if len(sys.argv) > 3 else 486.0
    img = cv2.imread(path)
    if img is None:
        print(json.dumps({"error": "unreadable"})); return
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    faces = detect_faces(gray, w, h)
    face_frac = [[x / w, y / h, fw / w, fh / h] for (x, y, fw, fh) in faces]

    # Subject centroid (fallback to image-center-upper when no faces).
    if faces:
        cxs = [x + fw / 2 for (x, y, fw, fh) in faces]
        cys = [y + fh / 2 for (x, y, fw, fh) in faces]
        focus_x = sum(cxs) / len(cxs) / w
        focus_y = sum(cys) / len(cys) / h
        face_bottom = max(y + fh for (x, y, fw, fh) in faces) / h
        face_top = min(y for (x, y, fw, fh) in faces) / h
    else:
        # saliency-ish fallback: row detail energy to find subject band
        edges = cv2.Laplacian(gray, cv2.CV_64F)
        row_energy = np.abs(edges).mean(axis=1)
        band = int(np.argmax(np.convolve(row_energy, np.ones(max(1, h // 10)) / (h // 10), 'same')))
        focus_x, focus_y = 0.5, min(0.55, band / h)
        face_bottom, face_top = 0.6, 0.2

    # Brightness (0-255) of the bottom quarter where a title/scrim would sit.
    bottom = gray[int(h * 0.72):, :]
    bottom_brightness = float(bottom.mean()) if bottom.size else 128.0
    overall_brightness = float(gray.mean())

    # Can we overlay the title on a face-free bottom band?
    clear_bottom_frac = max(0.0, 1.0 - face_bottom)  # bottom band with no faces
    title_needs_frac = (0.16 * th) / th  # ~16% of hero height for a 2-line title
    can_overlay = clear_bottom_frac >= 0.20  # need >=20% clear at bottom

    # Recommended cover-crop focus for target aspect (keep faces in frame).
    target_ratio = tw / th
    src_ratio = w / h
    if src_ratio > target_ratio:
        # source wider -> crop sides, keep horizontal focus
        crop_focus = {"x": round(focus_x, 3), "y": 0.5}
    else:
        # source taller -> crop vertically, bias to keep faces (upper)
        crop_focus = {"x": 0.5, "y": round(min(0.5, focus_y), 3)}

    lowres = (w < tw * 0.85) or (h < th * 0.85)

    print(json.dumps({
        "width": w, "height": h, "aspect": round(src_ratio, 3),
        "orientation": "portrait" if src_ratio < 0.95 else ("square" if src_ratio < 1.15 else "landscape"),
        "faces": len(faces), "faceBoxes": [[round(v, 3) for v in b] for b in face_frac],
        "focus": {"x": round(focus_x, 3), "y": round(focus_y, 3)},
        "faceTop": round(face_top, 3), "faceBottom": round(face_bottom, 3),
        "cropFocus": crop_focus,
        "bottomBrightness": round(bottom_brightness, 1),
        "overallBrightness": round(overall_brightness, 1),
        "canOverlayTitle": bool(can_overlay),
        "clearBottomFrac": round(clear_bottom_frac, 3),
        "lowRes": bool(lowres),
        # scrim opacity scales with brightness: bright photo -> stronger scrim
        "recommendedScrim": round(min(0.95, max(0.55, bottom_brightness / 255.0 * 0.9 + 0.35)), 2),
    }))


if __name__ == "__main__":
    main()
