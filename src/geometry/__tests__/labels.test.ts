import { describe, expect, it } from 'vitest';
import { cardinalityLabelPlacement } from '../labels';
import { floatingEdge, edgeLength } from '../edges';
import type { ShapeBox } from '../types';
import { distance } from '../vectors';

function entityAt(x: number, y: number): ShapeBox {
  return { kind: 'rect', center: { x, y }, size: { width: 100, height: 60 } };
}

function relationshipAt(x: number, y: number): ShapeBox {
  return { kind: 'diamond', center: { x, y }, size: { width: 120, height: 70 } };
}

describe('cardinalityLabelPlacement', () => {
  it('attaches about 20 px from the entity boundary along the edge', () => {
    const entity = entityAt(0, 0);
    const placement = cardinalityLabelPlacement(entity, relationshipAt(400, 0));
    expect(distance(floatingEdge(entity, relationshipAt(400, 0)).start, placement.attachment)).toBe(
      20,
    );
  });

  it('sits beside the entity it counts, not beside the relationship', () => {
    const entity = entityAt(0, 0);
    const relationship = relationshipAt(400, 0);
    const placement = cardinalityLabelPlacement(entity, relationship);
    expect(distance(placement.attachment, entity.center)).toBeLessThan(
      distance(placement.attachment, relationship.center),
    );
  });

  it('offsets the label off the line so the two never overlap', () => {
    const placement = cardinalityLabelPlacement(entityAt(0, 0), relationshipAt(400, 0));
    expect(placement.position.y).not.toBe(placement.attachment.y);
    expect(distance(placement.position, placement.attachment)).toBeCloseTo(12, 10);
  });

  it('puts the label above a horizontal line, whichever way it points', () => {
    const rightwards = cardinalityLabelPlacement(entityAt(0, 0), relationshipAt(400, 0));
    const leftwards = cardinalityLabelPlacement(entityAt(400, 0), relationshipAt(0, 0));
    expect(rightwards.position.y).toBeLessThan(rightwards.attachment.y);
    expect(leftwards.position.y).toBeLessThan(leftwards.attachment.y);
  });

  it('puts the label to the right of a vertical line, whichever way it points', () => {
    const downwards = cardinalityLabelPlacement(entityAt(0, 0), relationshipAt(0, 400));
    const upwards = cardinalityLabelPlacement(entityAt(0, 400), relationshipAt(0, 0));
    expect(downwards.position.x).toBeGreaterThan(downwards.attachment.x);
    expect(upwards.position.x).toBeGreaterThan(upwards.attachment.x);
  });

  it('places both ends of one relationship on the same side of the line', () => {
    const left = entityAt(0, 0);
    const right = entityAt(600, 0);
    const relationship = relationshipAt(300, 0);
    const leftLabel = cardinalityLabelPlacement(left, relationship);
    const rightLabel = cardinalityLabelPlacement(right, relationship);
    expect(leftLabel.position.y).toBeLessThan(0);
    expect(rightLabel.position.y).toBeLessThan(0);
  });

  it('clamps the distance on a short edge so the label cannot overshoot the diamond', () => {
    const entity = entityAt(0, 0);
    const relationship = relationshipAt(125, 0);
    const segment = floatingEdge(entity, relationship);
    const placement = cardinalityLabelPlacement(entity, relationship);
    const travelled = distance(segment.start, placement.attachment);

    expect(edgeLength(segment)).toBeLessThan(20 / 0.35);
    expect(travelled).toBeLessThan(20);
    expect(travelled).toBeCloseTo(edgeLength(segment) * 0.35, 10);
  });

  it('honours custom distances and offsets', () => {
    const entity = entityAt(0, 0);
    const relationship = relationshipAt(600, 0);
    const placement = cardinalityLabelPlacement(entity, relationship, {
      distanceFromEntity: 40,
      perpendicularOffset: 5,
    });
    expect(distance(floatingEdge(entity, relationship).start, placement.attachment)).toBeCloseTo(
      40,
      10,
    );
    expect(distance(placement.attachment, placement.position)).toBeCloseTo(5, 10);
  });

  it('degrades gracefully when the shapes overlap', () => {
    const entity = entityAt(0, 0);
    const placement = cardinalityLabelPlacement(entity, relationshipAt(0, 0));
    expect(Number.isFinite(placement.position.x)).toBe(true);
    expect(Number.isFinite(placement.position.y)).toBe(true);
  });

  it('depends only on layout, so it is pure and repeatable', () => {
    const first = cardinalityLabelPlacement(entityAt(0, 0), relationshipAt(400, 120));
    const second = cardinalityLabelPlacement(entityAt(0, 0), relationshipAt(400, 120));
    expect(first).toEqual(second);
  });
});
