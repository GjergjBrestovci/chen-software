import { describe, expect, it } from 'vitest';
import { markerSlots, MARKER_SIZE } from '../markers';
import type { ShapeBox } from '../types';

const box: ShapeBox = {
  kind: 'ellipse',
  center: { x: 100, y: 200 },
  size: { width: 96, height: 46 },
};

describe('markerSlots', () => {
  it('returns nothing when there is nothing to mark', () => {
    expect(markerSlots(box, 0)).toEqual([]);
    expect(markerSlots(box, -1)).toEqual([]);
  });

  it('centres a single marker above the shape', () => {
    const [slot] = markerSlots(box, 1);
    expect(slot?.x).toBeCloseTo(0, 9);
    expect(slot?.y).toBeLessThan(0);
  });

  it('clears the top of the shape', () => {
    const [slot] = markerSlots(box, 1);
    const topOfMarker = (slot?.y ?? 0) - MARKER_SIZE.height / 2;
    expect(topOfMarker).toBeLessThan(-box.size.height / 2);
  });

  it('spaces two markers symmetrically about the centre', () => {
    const [first, second] = markerSlots(box, 2);
    expect(first?.x).toBeCloseTo(-(second?.x ?? 0), 9);
    expect(first?.y).toBeCloseTo(second?.y ?? 0, 9);
  });

  it('never overlaps two markers', () => {
    const [first, second] = markerSlots(box, 2);
    expect((second?.x ?? 0) - (first?.x ?? 0)).toBeGreaterThanOrEqual(MARKER_SIZE.width);
  });

  it('keeps every marker on the same row', () => {
    const slots = markerSlots(box, 3);
    expect(new Set(slots.map((slot) => slot.y)).size).toBe(1);
  });

  it('sits higher above a taller shape', () => {
    const tall: ShapeBox = { ...box, size: { width: 96, height: 120 } };
    const [onTall] = markerSlots(tall, 1);
    const [onShort] = markerSlots(box, 1);
    expect(onTall?.y).toBeLessThan(onShort?.y ?? 0);
  });

  it('honours a custom marker size', () => {
    const [wide] = markerSlots(box, 2, { width: 40, height: 11 });
    const [narrow] = markerSlots(box, 2, { width: 10, height: 11 });
    expect(Math.abs(wide?.x ?? 0)).toBeGreaterThan(Math.abs(narrow?.x ?? 0));
  });

  it('is deterministic', () => {
    expect(markerSlots(box, 2)).toEqual(markerSlots(box, 2));
  });
});
