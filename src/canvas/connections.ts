import type { ElementKind, Id } from '../model/types';

/**
 * What to do when the student connects two shapes by dragging, or finishes a
 * drag somewhere (SPEC.md §5).
 *
 * Pure, because both of the bugs this guards against were decisions, not
 * rendering: one pair of clicks in relationship mode made two relationships,
 * and releasing a drag over the middle of a table did nothing.
 */
export type ConnectionDecision =
  | { kind: 'create'; source: Id; target: Id }
  | { kind: 'reject'; reason: 'self' | 'not-entities' }
  | { kind: 'ignore' };

const IGNORE: ConnectionDecision = { kind: 'ignore' };

export interface ConnectInput {
  /** The student is picking entities by clicking. */
  relationshipModeActive: boolean;
  source: Id;
  target: Id;
  kindOf: (id: Id) => ElementKind | undefined;
}

/** A connection React Flow completed on a handle. */
export function decideConnect(input: ConnectInput): ConnectionDecision {
  if (input.relationshipModeActive) {
    // A click that lands on a handle while picking must not also complete a
    // connection, or one pair of clicks makes two relationships.
    return IGNORE;
  }
  if (input.source === input.target) {
    return { kind: 'reject', reason: 'self' };
  }
  if (input.kindOf(input.source) !== 'entity' || input.kindOf(input.target) !== 'entity') {
    return { kind: 'reject', reason: 'not-entities' };
  }
  return { kind: 'create', source: input.source, target: input.target };
}

export interface ConnectEndInput {
  relationshipModeActive: boolean;
  /** React Flow found a handle within its radius, so `decideConnect` already ran. */
  handledByHandle: boolean;
  source: Id | undefined;
  /** The entity under the pointer on release, if any. */
  target: Id | undefined;
  kindOf: (id: Id) => ElementKind | undefined;
}

/**
 * A drag that ended without React Flow finding a handle.
 *
 * SPEC.md §5 says dragging onto another *entity* creates a relationship, but
 * React Flow only connects within a few pixels of a handle at the shape's
 * edge. This catches a release over the rest of the entity.
 */
export function decideConnectEnd(input: ConnectEndInput): ConnectionDecision {
  if (input.relationshipModeActive || input.handledByHandle) {
    return IGNORE;
  }
  if (input.source === undefined || input.kindOf(input.source) !== 'entity') {
    return IGNORE;
  }
  if (input.target === undefined) {
    // Released over empty canvas: nothing to connect to, nothing to say.
    return IGNORE;
  }
  if (input.target === input.source) {
    // What a plain click on a handle looks like. Not worth a message.
    return IGNORE;
  }
  return { kind: 'create', source: input.source, target: input.target };
}
