# Card detection models

`cards.tflite` is the on-device card detector LivePlay's frame processor runs.
The file checked into the repo is a **placeholder** — loading it fails, and the
LivePlay screen falls back to demo mode.

For device testing, replace it locally with a 52-class playing-card detector
exported to TFLite:

- YOLO-style single-tensor output: `[1, 4 + 52, anchors]`, boxes as
  center/size in input pixels, one score per class (`decodeDetections.ts` is
  the contract).
- Static input shape (the Core ML delegate rejects dynamic shapes),
  320×320 RGB.
- Class labels in alphabetical order (`10C` … `SS`), matching
  `DEFAULT_CLASS_NAMES` in `src/services/vision/classMap.ts`.

A quick stand-in: `keremberke/yolov8n-playing-cards` (HuggingFace) exported
with `yolo export format=tflite int8`. **Do not commit real weights** — the
public stand-ins are AGPL-licensed and are for pipeline testing only. The
shippable, commercially-licensed model is its own workstream (see the PRD's
Phase 4–6 window).
