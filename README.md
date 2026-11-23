# Failure Trajectory Collection and Analysis

机器人评测中的失败轨迹，按模型、权重和 benchmark 建立独立分析页。每个入口提供实验结果、行为分布、代表视频和可检索的轨迹编号。

[打开实验目录](https://lihaojuan.github.io/failure-trajectory-collection-and-analysis/)

| 实验 | 权重 | 总轨迹 | 成功 | 失败 | 分析页 |
| --- | --- | ---: | ---: | ---: | --- |
| QwenOFT × RoboTwin | RoboTwin2-All · 140K | 10,000 | 8,807 | 1,193 | [打开全量分析](https://lihaojuan.github.io/failure-trajectory-collection-and-analysis/experiments/qwenoft-robotwin-140k/) |
| QwenOFT × LIBERO | LIBERO 4-in-1 · 50K | 2,000 | 1,956 | 44 | [打开既有视频库](https://lihaojuan.github.io/libero-failure-trajectories/) |
| QwenPI_v3 × LIBERO | 作者公开4-in-1 · JasonYang66 | 2,000 | 1,943 | 57 | [57条失败分析](https://lihaojuan.github.io/failure-trajectory-collection-and-analysis/experiments/qwenpiv3-libero-4in1/) |

[下载 RoboTwin 完整离线包](https://github.com/LIHAOJUAN/failure-trajectory-collection-and-analysis/releases/tag/qwenoft-robotwin-140k-v1)，包含全部原片、关键帧及逐条标注。解压后可直接打开 index.html。

新增实验时沿用[失败轨迹分析网页要求](docs/analysis-page-requirements.md)。
