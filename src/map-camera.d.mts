export type ViewBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ScaleTransform = {
  sx: number;
  sy: number;
};

export function parseViewBox(value: string): ViewBox;

export function formatViewBox(box: ViewBox): string;

export function parseScaleTransform(transform: string): ScaleTransform;

export function localBoxToViewBox(
  box: ViewBox,
  scale: ScaleTransform,
): ViewBox;

export function fitViewBox(
  target: ViewBox,
  frame: ViewBox,
  paddingRatio?: number,
): ViewBox;

export function interpolateViewBox(
  from: ViewBox,
  to: ViewBox,
  t: number,
): ViewBox;

export function easeOutCubic(t: number): number;

export function viewBoxesMatch(
  left: ViewBox,
  right: ViewBox,
  epsilon?: number,
): boolean;
