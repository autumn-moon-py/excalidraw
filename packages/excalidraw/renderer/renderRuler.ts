import { THEME } from "@excalidraw/common";

import type { InteractiveCanvasAppState } from "../types";

const RULER_COLOR_LIGHT = "#1971c2";
const RULER_COLOR_DARK = "#4dabf7";

const LABEL_BG_LIGHT = "rgba(255, 255, 255, 0.92)";
const LABEL_BG_DARK = "rgba(30, 30, 30, 0.92)";
const LABEL_TEXT_LIGHT = "#101010";
const LABEL_TEXT_DARK = "#ececec";

// 量尺工具拖拽过程中的临时渲染：两点连线 + 端点 + 中点整数长度
export const renderRuler = (
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
) => {
  const { rulerMeasurement } = appState;
  if (!rulerMeasurement) {
    return;
  }

  const [startX, startY] = rulerMeasurement.start;
  const [endX, endY] = rulerMeasurement.end;

  const isLight = appState.theme === THEME.LIGHT;
  const lineColor = isLight ? RULER_COLOR_LIGHT : RULER_COLOR_DARK;
  const labelBg = isLight ? LABEL_BG_LIGHT : LABEL_BG_DARK;
  const labelTextColor = isLight ? LABEL_TEXT_LIGHT : LABEL_TEXT_DARK;

  const zoom = appState.zoom.value;

  context.save();
  context.translate(appState.scrollX, appState.scrollY);

  // 测量线段
  context.lineWidth = 1 / zoom;
  context.strokeStyle = lineColor;
  context.beginPath();
  context.moveTo(startX, startY);
  context.lineTo(endX, endY);
  context.stroke();

  // 起终点
  const dotRadius = 3 / zoom;
  context.fillStyle = lineColor;
  for (const [x, y] of [
    [startX, startY],
    [endX, endY],
  ]) {
    context.beginPath();
    context.arc(x, y, dotRadius, 0, Math.PI * 2);
    context.fill();
  }

  // 长度已按单位取整（格子模式=1格，否则=场景像素）
  const label = `${rulerMeasurement.length}`;

  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  // 字号/间距除以缩放，保证屏幕上尺寸恒定
  const fontSize = 12 / zoom;
  const padding = 3 / zoom;
  context.font = `600 ${fontSize}px "Segoe UI", system-ui, -apple-system, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";

  const textWidth = context.measureText(label).width;
  const boxX = midX - textWidth / 2 - padding;
  const boxY = midY - fontSize / 2 - padding;
  const boxWidth = textWidth + padding * 2;
  const boxHeight = fontSize + padding * 2;

  // 底框盖住穿过中点的线段，提升可读性
  context.fillStyle = labelBg;
  context.fillRect(boxX, boxY, boxWidth, boxHeight);
  context.lineWidth = 1 / zoom;
  context.strokeStyle = lineColor;
  context.strokeRect(boxX, boxY, boxWidth, boxHeight);

  context.fillStyle = labelTextColor;
  context.fillText(label, midX, midY);

  context.restore();
};
