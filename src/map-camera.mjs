export function parseViewBox(value) {
  const parts = String(value)
    .trim()
    .split(/[\s,]+/)
    .map(Number);

  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    throw new Error("viewBox inválido.");
  }
  if (parts[2] <= 0 || parts[3] <= 0) {
    throw new Error("viewBox precisa ter largura e altura positivas.");
  }

  return {
    x: parts[0],
    y: parts[1],
    width: parts[2],
    height: parts[3],
  };
}

export function formatViewBox(box) {
  return `${box.x} ${box.y} ${box.width} ${box.height}`;
}

export function parseScaleTransform(transform) {
  const match = /^\s*scale\(\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*[, ]\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*\)\s*$/i.exec(
    transform,
  );

  if (!match) {
    throw new Error("O mapa espera um transform scale(sx,sy).");
  }

  return {
    sx: Number(match[1]),
    sy: Number(match[2]),
  };
}

export function localBoxToViewBox(box, scale) {
  const x1 = box.x * scale.sx;
  const y1 = box.y * scale.sy;
  const x2 = (box.x + box.width) * scale.sx;
  const y2 = (box.y + box.height) * scale.sy;

  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

export function fitViewBox(target, frame, paddingRatio = 0.14) {
  if (target.width <= 0 || target.height <= 0) {
    return { ...frame };
  }

  const frameAspect = frame.width / frame.height;
  let { x, y, width, height } = target;

  if (width / height > frameAspect) {
    const fittedHeight = width / frameAspect;
    y -= (fittedHeight - height) / 2;
    height = fittedHeight;
  } else {
    const fittedWidth = height * frameAspect;
    x -= (fittedWidth - width) / 2;
    width = fittedWidth;
  }

  const padX = width * paddingRatio;
  const padY = height * paddingRatio;

  return {
    x: x - padX,
    y: y - padY,
    width: width + padX * 2,
    height: height + padY * 2,
  };
}

export function interpolateViewBox(from, to, t) {
  const progress = Math.min(1, Math.max(0, t));

  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
    width: from.width + (to.width - from.width) * progress,
    height: from.height + (to.height - from.height) * progress,
  };
}

export function easeOutCubic(t) {
  const progress = Math.min(1, Math.max(0, t));
  return 1 - (1 - progress) ** 3;
}

export function viewBoxesMatch(left, right, epsilon = 0.000001) {
  return (
    Math.abs(left.x - right.x) <= epsilon &&
    Math.abs(left.y - right.y) <= epsilon &&
    Math.abs(left.width - right.width) <= epsilon &&
    Math.abs(left.height - right.height) <= epsilon
  );
}
