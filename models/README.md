# Models used by the site tools

## u2netp.onnx (Token creator, "AI remove")

| | |
|---|---|
| Model | U2-Netp, the small version of U^2-Net (Qin et al., 2020), salient object detection |
| File | `u2netp.onnx`, 4,574,861 bytes |
| SHA-256 | `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8` |
| Downloaded from | https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx (the ONNX export distributed by the rembg project, MIT code) on 2026-11-20 |
| Original weights and code | https://github.com/xuebinqin/U-2-Net |
| License | Apache License 2.0 (the U-2-Net repository's LICENSE file, checked 2026-11-20); the weights carry no separate license |
| Input | 1 x 3 x 320 x 320, RGB divided by the picture's maximum, then ImageNet mean and standard deviation |
| Output | the first output (d0), 1 x 1 x 320 x 320, scaled to 0..1 |

The token creator downloads this file from this site only when someone presses "AI remove", keeps it in the browser's cache storage for the next time, and runs it in the browser with ONNX Runtime Web 1.31.1 (MIT), loaded from the pinned jsDelivr path `https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/`. The picture never leaves the browser.
