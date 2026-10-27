import assert from "node:assert/strict";
import test from "node:test";

import {
  easeOutCubic,
  fitViewBox,
  formatViewBox,
  interpolateViewBox,
  localBoxToViewBox,
  parseScaleTransform,
  parseViewBox,
  viewBoxesMatch,
} from "../src/map-camera.mjs";

test("parseViewBox reads space-separated values", () => {
  assert.deepEqual(parseViewBox("-73.9 -5.2 39.2 39"), {
    x: -73.9,
    y: -5.2,
    width: 39.2,
    height: 39,
  });
});

test("parseScaleTransform reads the IBGE scale", () => {
  assert.deepEqual(parseScaleTransform("scale(0.0001,-0.0001)"), {
    sx: 0.0001,
    sy: -0.0001,
  });
});

test("localBoxToViewBox flips a negative scale into a positive geographic box", () => {
  const box = localBoxToViewBox(
    { x: -479386, y: -160499, width: 9733, height: 5482 },
    { sx: 0.0001, sy: -0.0001 },
  );

  assert.ok(
    viewBoxesMatch(box, {
      x: -47.9386,
      y: 15.5017,
      width: 0.9733,
      height: 0.5482,
    }),
  );
});

test("fitViewBox keeps the frame aspect and adds padding around a wide state", () => {
  const fitted = fitViewBox(
    { x: 10, y: 10, width: 20, height: 5 },
    { x: 0, y: 0, width: 40, height: 40 },
    0.1,
  );

  assert.equal(fitted.width / fitted.height, 1);
  assert.ok(fitted.width > 20);
  assert.ok(fitted.x < 10);
  assert.ok(fitted.y < 10);
});

test("fitViewBox expands a tall state to the square national frame", () => {
  const fitted = fitViewBox(
    { x: 0, y: 0, width: 4, height: 20 },
    { x: 0, y: 0, width: 40, height: 40 },
    0,
  );

  assert.deepEqual(fitted, {
    x: -8,
    y: 0,
    width: 20,
    height: 20,
  });
});

test("interpolateViewBox and easing stay within 0 and 1", () => {
  const from = parseViewBox("0 0 10 10");
  const to = parseViewBox("10 20 30 40");

  assert.deepEqual(interpolateViewBox(from, to, 0), from);
  assert.deepEqual(interpolateViewBox(from, to, 1), to);
  assert.deepEqual(interpolateViewBox(from, to, 0.5), {
    x: 5,
    y: 10,
    width: 20,
    height: 25,
  });
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.ok(easeOutCubic(0.5) > 0.5);
});

test("formatViewBox and viewBoxesMatch round-trip a camera", () => {
  const box = { x: -48.2, y: 15.5, width: 1.1, height: 0.8 };
  assert.equal(formatViewBox(box), "-48.2 15.5 1.1 0.8");
  assert.equal(viewBoxesMatch(box, parseViewBox(formatViewBox(box))), true);
});
