# Portfolio performance audit (live-after-2)

- Measured: 2026-11-01T23:45:36.503Z
- Mode: headed (GPU)
- WebGL renderer: ANGLE (NVIDIA, NVIDIA GeForce RTX 3050 (0x00002582) Direct3D11 vs_5_0 ps_5_0, D3D11)
- Viewport: 1440x900 @ 2x device pixel ratio

| Scenario | Avg FPS | p95 frame | Worst frame | Frames > 50 ms |
|----------|--------:|----------:|------------:|---------------:|
| Idle at the top | 165.2 | 6.2 ms | 6.2 ms | 0 / 661 |
| 3D toolbox on screen | 165.1 | 6.2 ms | 6.2 ms | 0 / 661 |

**Main-thread long tasks:** 6 tasks, 931 ms total, worst 330 ms.

**CPU used while idle (5 s window):** 937 ms task time, 176 ms script time.

**JS heap:** 10.5 MB after load → 10.4 MB after idle → 15.3 MB after scrolling.

**WebGL canvases:** 1440x900 buffer 2160x1350 @1.5x

> Absolute FPS in headless mode uses software WebGL, so it is not representative of a GPU machine;
> the before/after comparison and the long-task and heap figures are the meaningful signals.
