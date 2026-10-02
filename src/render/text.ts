const FONT = "'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif";

/** 어두운 외곽선이 있는 글자를 그립니다. y는 글자의 위쪽 끝입니다. */
export function drawText(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  align: CanvasTextAlign = 'left',
  color = '#ffffff',
): void {
  ctx.font = `bold ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size / 7);
  ctx.strokeStyle = 'rgba(0,0,0,0.65)';
  ctx.strokeText(value, x, y);
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}
