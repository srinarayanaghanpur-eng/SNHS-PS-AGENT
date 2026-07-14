#!/usr/bin/env python3
"""Extract multiple DISTINCT, face-safe portrait crops from one event photo.
Turns a single wide assembly photograph into real sub-photos (prayer leader,
student groups, individuals) so a photo-rich collage uses only real pixels.

Usage: python3 crop_subjects.py <image> <outDir> <count>
Prints JSON manifest of produced crops (role, path, faces, focusY).
"""
import sys, os, json
import cv2
import numpy as np

def detect(gray, w, h):
    boxes = []
    for name, p in [('haarcascade_frontalface_default.xml', dict(scaleFactor=1.06, minNeighbors=6)),
                    ('haarcascade_profileface.xml', dict(scaleFactor=1.1, minNeighbors=5))]:
        c = cv2.CascadeClassifier(os.path.join(cv2.data.haarcascades, name))
        if c.empty():
            continue
        for (x, y, fw, fh) in c.detectMultiScale(gray, minSize=(max(16, w // 80), max(16, h // 80)), **p):
            boxes.append((int(x), int(y), int(fw), int(fh)))
    # dedupe overlapping
    boxes.sort(key=lambda b: -b[2] * b[3])
    kept = []
    for b in boxes:
        bx, by = b[0] + b[2] / 2, b[1] + b[3] / 2
        if all(((bx - (k[0] + k[2] / 2)) ** 2 + (by - (k[1] + k[3] / 2)) ** 2) ** 0.5 > (b[2] + k[2]) * 0.5 for k in kept):
            kept.append(b)
    return kept

def portrait_crop(img, face, ar=0.75, headroom=0.8, body=5.0):
    H, W = img.shape[:2]
    x, y, fw, fh = face
    cx = x + fw / 2
    top = max(0, int(y - fh * headroom))
    ch = int(fh * body)
    cw = int(ch * ar)
    left = int(cx - cw / 2)
    left = max(0, min(left, W - cw)) if cw < W else 0
    if top + ch > H:
        ch = H - top
        cw = int(ch * ar)
        left = max(0, min(int(cx - cw / 2), W - cw))
    cw = min(cw, W - left); ch = min(ch, H - top)
    return img[top:top + ch, left:left + cw]

def group_crop(img, faces, ar=0.72):
    """Crop a portrait region containing a small cluster of faces."""
    H, W = img.shape[:2]
    xs = [f[0] for f in faces] + [f[0] + f[2] for f in faces]
    ys = [f[1] for f in faces]
    left = max(0, min(xs) - 20); right = min(W, max(xs) + 20)
    top = max(0, min(ys) - 30)
    cw = right - left
    ch = int(cw / ar)
    if top + ch > H:
        ch = H - top
    return img[top:top + ch, left:left + cw]

def main():
    path, outDir = sys.argv[1], sys.argv[2]
    count = int(sys.argv[3]) if len(sys.argv) > 3 else 8
    os.makedirs(outDir, exist_ok=True)
    img = cv2.imread(path)
    H, W = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = detect(gray, W, H)
    # drop implausible detections (too small, or at ground level)
    faces = [b for b in faces if b[2] >= W*0.012 and (b[1]+b[3]) <= H*0.9 and b[1] >= 0]
    faces.sort(key=lambda b: b[0])  # left-to-right

    manifest = []
    # Prayer leader = most prominent (largest) face, prefer front (higher y)
    if faces:
        centre = [b for b in faces if 0.2*H <= b[1]+b[3]/2 <= 0.72*H] or faces
        leader = max(centre, key=lambda b: b[2]*b[3])
        crop = portrait_crop(img, leader, ar=0.78, headroom=1.1, body=4.2)
        p = os.path.join(outDir, 'leader.jpg'); cv2.imwrite(p, crop)
        manifest.append({"role": "leader", "path": p, "faces": 1})

    # Remaining faces -> distinct group/individual portrait crops spread across width
    others = [f for f in faces if f is not leader] if faces else []
    # sort by size desc for quality, then take spread
    others.sort(key=lambda b: -b[2] * b[3])
    picks = others[:max(0, count)]
    picks.sort(key=lambda b: b[0])
    for i, f in enumerate(picks):
        # include a neighbour for a small group when close
        near = [g for g in faces if g is not f and abs((g[0] + g[2] / 2) - (f[0] + f[2] / 2)) < f[2] * 2.2]
        clust = [f] + near[:1]
        crop = group_crop(img, clust) if len(clust) > 1 else portrait_crop(img, f, body=4.6)
        if crop.size == 0 or crop.shape[0] < 40:
            crop = portrait_crop(img, f, body=4.0)
        p = os.path.join(outDir, f'subject{i+1}.jpg'); cv2.imwrite(p, crop)
        manifest.append({"role": "gallery", "path": p, "faces": len(clust)})

    print(json.dumps({"source": path, "sourceFaces": len(faces), "crops": manifest}))

if __name__ == '__main__':
    main()
