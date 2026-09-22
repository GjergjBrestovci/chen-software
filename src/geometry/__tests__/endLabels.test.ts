import { describe, expect, it } from 'vitest';
import { floatingEdge, offsetEdge, spreadOffsets } from '../edges';
import {
  cardinalityLabelPlacement,
  endLabelPlacement,
  ROLE_FONT_SIZE,
  sideForOffset,
} from '../labels';
import { measureTextWidth, textLineHeight } from '../textMetrics';
import type { EdgeSegment } from '../edges';
import type { Point, ShapeBox } from '../types';
import { distance, normalize, subtract } from '../vectors';

function entityAt(x: number, y: number): ShapeBox {
  return { kind: 'rect', center: { x, y }, size: { width: 120, height: 56 } };
}

function diamondAt(x: number, y: number): ShapeBox {
  return { kind: 'diamond', center: { x, y }, size: { width: 140, height: 80 } };
}

/** Signed distance from `point` to the segment's line; positive is its left side. */
function sideOf(segment: EdgeSegment, point: Point): number {
  const unit = normalize(subtract(segment.end, segment.start));
  const relative = subtract(point, segment.start);
  return -(unit.x * relative.y - unit.y * relative.x);
}

describe('endLabelPlacement', () => {
  it('matches cardinalityLabelPlacement on the centre line', () => {
    const entity = entityAt(0, 0);
    const relationship = diamondAt(400, 120);
    const general = endLabelPlacement(floatingEdge(entity, relationship));
    const specific = cardinalityLabelPlacement(entity, relationship);
    expect(general.position).toEqual(specific.position);
    expect(general.attachment).toEqual(specific.attachment);
  });

  it('puts labels on the left of the line when asked', () => {
    const segment = floatingEdge(entityAt(0, 0), diamondAt(400, 0));
    expect(sideOf(segment, endLabelPlacement(segment, { side: 'left' }).position)).toBeGreaterThan(
      0,
    );
  });

  it('puts labels on the right of the line when asked', () => {
    const segment = floatingEdge(entityAt(0, 0), diamondAt(400, 0));
    expect(sideOf(segment, endLabelPlacement(segment, { side: 'right' }).position)).toBeLessThan(0);
  });

  it('follows the offset line of a spread end, not the centre line', () => {
    const entity = entityAt(0, 0);
    const relationship = diamondAt(400, 0);
    const shifted = endLabelPlacement(offsetEdge(entity, relationship, 18));
    const centred = endLabelPlacement(floatingEdge(entity, relationship));
    expect(shifted.attachment.y).toBeCloseTo(centred.attachment.y - 18, 9);
  });

  it('has no role position when the end has no role', () => {
    const segment = floatingEdge(entityAt(0, 0), diamondAt(400, 0));
    expect(endLabelPlacement(segment).rolePosition).toBeNull();
    expect(endLabelPlacement(segment, { role: null }).rolePosition).toBeNull();
  });

  it('puts the role on the same side as the cardinality, further out', () => {
    const segment = floatingEdge(entityAt(0, 0), diamondAt(400, 0));
    for (const side of ['left', 'right'] as const) {
      const placement = endLabelPlacement(segment, { side, role: 'supervisor' });
      const cardinality = sideOf(segment, placement.position);
      const role = sideOf(segment, placement.rolePosition ?? placement.position);
      expect(Math.sign(role)).toBe(Math.sign(cardinality));
      expect(Math.abs(role)).toBeGreaterThan(Math.abs(cardinality));
    }
  });

  it('keeps a long role name clear of the line and of the cardinality, at any angle', () => {
    const role = 'the_supervising_employee';
    const width = measureTextWidth(role, ROLE_FONT_SIZE);
    const height = textLineHeight(ROLE_FONT_SIZE);

    for (let index = 0; index < 16; index += 1) {
      const angle = (index * Math.PI) / 8 + 0.1;
      const segment = floatingEdge(
        entityAt(0, 0),
        diamondAt(Math.cos(angle) * 400, Math.sin(angle) * 400),
      );
      const placement = endLabelPlacement(segment, { side: 'left', role });
      const centre = placement.rolePosition;
      if (!centre) throw new Error('expected a role position');

      // The role's text box, and its nearest point to the line.
      const unit = normalize(subtract(segment.end, segment.start));
      const normal = { x: unit.y, y: -unit.x };
      const reach = (Math.abs(normal.x) * width + Math.abs(normal.y) * height) / 2;
      const nearEdge = sideOf(segment, centre) - reach;

      expect(nearEdge).toBeGreaterThan(sideOf(segment, placement.position));
    }
  });

  it('pushes a wide role further out on a vertical line than on a horizontal one', () => {
    // Text is wider than it is tall, so it needs more room beside a vertical line.
    const role = 'supervisee';
    const horizontal = floatingEdge(entityAt(0, 0), diamondAt(400, 0));
    const vertical = floatingEdge(entityAt(0, 0), diamondAt(0, 400));
    const offsetFor = (segment: EdgeSegment): number => {
      const placement = endLabelPlacement(segment, { side: 'left', role });
      return Math.abs(sideOf(segment, placement.rolePosition ?? placement.position));
    };
    expect(offsetFor(vertical)).toBeGreaterThan(offsetFor(horizontal));
  });

  it('honours a custom clearance', () => {
    const segment = floatingEdge(entityAt(0, 0), diamondAt(400, 0));
    const tight = endLabelPlacement(segment, { side: 'left', role: 'r', roleClearance: 0 });
    const loose = endLabelPlacement(segment, { side: 'left', role: 'r', roleClearance: 30 });
    expect(
      Math.abs(sideOf(segment, loose.rolePosition ?? loose.position)) -
        Math.abs(sideOf(segment, tight.rolePosition ?? tight.position)),
    ).toBeCloseTo(30, 9);
  });

  it('degrades gracefully when the shapes overlap', () => {
    const segment = floatingEdge(entityAt(0, 0), diamondAt(0, 0));
    const placement = endLabelPlacement(segment, { role: 'supervisor' });
    for (const point of [placement.position, placement.attachment, placement.rolePosition]) {
      expect(Number.isFinite(point?.x)).toBe(true);
      expect(Number.isFinite(point?.y)).toBe(true);
    }
  });

  it('keeps a missing role missing even when the shapes overlap', () => {
    const segment = floatingEdge(entityAt(0, 0), diamondAt(0, 0));
    expect(endLabelPlacement(segment).rolePosition).toBeNull();
  });
});

describe('sideForOffset', () => {
  it('faces a label away from the other lines of a spread end', () => {
    expect(sideForOffset(18)).toBe('left');
    expect(sideForOffset(-18)).toBe('right');
  });

  it('uses the shared rule for an end that was not spread', () => {
    expect(sideForOffset(0)).toBe('auto');
  });
});

describe('the two ends of a self-relationship', () => {
  it('get separate lines whose labels sit outside the pair, not between them', () => {
    const entity = entityAt(0, 0);
    const relationship = diamondAt(0, 300);
    const offsets = spreadOffsets(2);

    const placements = offsets.map((offset) =>
      endLabelPlacement(offsetEdge(entity, relationship, offset), {
        side: sideForOffset(offset),
        role: offset < 0 ? 'supervisor' : 'supervisee',
      }),
    );
    const [first, second] = placements;
    if (!first || !second) throw new Error('expected two placements');

    const linesApart = distance(first.attachment, second.attachment);
    const labelsApart = distance(first.position, second.position);
    const rolesApart = distance(
      first.rolePosition ?? first.position,
      second.rolePosition ?? second.position,
    );

    expect(labelsApart).toBeGreaterThan(linesApart);
    expect(rolesApart).toBeGreaterThan(labelsApart);
  });
});
