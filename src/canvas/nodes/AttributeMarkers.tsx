import type { CSSProperties, ReactElement } from 'react';
import { CROWN_PATH, markerSlots, MARKER_SIZE, PLUG_BODY, PLUG_STROKE_PATH } from '../../geometry';
import type { ShapeBox } from '../../geometry';
import { messages } from '../../i18n/messages.en';

/**
 * The crown and cable markers above an attribute (SPEC.md §6).
 *
 * Neither is part of Chen notation. They earn their place by making a diagram
 * quicker to read while working, and the PDF export can suppress them so a
 * hand-in stays standard.
 *
 * Positions come from `geometry/markers.ts`, the same function the exporter
 * will use, so the two cannot drift.
 */
export interface AttributeMarkersProps {
  size: { width: number; height: number };
  isPrimaryKey: boolean;
  isForeignKey: boolean;
}

function Crown(): ReactElement {
  return (
    <svg viewBox="0 0 14 11" aria-hidden="true">
      <path className="chen-marker-fill" d={CROWN_PATH} />
    </svg>
  );
}

/** A plug on a lead: two prongs, a body and a trailing cable. */
function Cable(): ReactElement {
  return (
    <svg viewBox="0 0 14 11" aria-hidden="true">
      <rect
        className="chen-marker-fill"
        x={PLUG_BODY.x}
        y={PLUG_BODY.y}
        width={PLUG_BODY.width}
        height={PLUG_BODY.height}
        rx={PLUG_BODY.radius}
      />
      <path className="chen-marker-stroke" d={PLUG_STROKE_PATH} />
    </svg>
  );
}

export function AttributeMarkers({
  size,
  isPrimaryKey,
  isForeignKey,
}: AttributeMarkersProps): ReactElement | null {
  const shown: ('key' | 'foreign')[] = [];
  if (isPrimaryKey) shown.push('key');
  if (isForeignKey) shown.push('foreign');

  if (shown.length === 0) {
    return null;
  }

  const box: ShapeBox = { kind: 'ellipse', center: { x: 0, y: 0 }, size };
  const slots = markerSlots(box, shown.length);

  return (
    <>
      {shown.map((marker, index) => {
        const slot = slots[index];
        // The node div spans the shape, so a slot relative to the centre
        // becomes a percentage offset plus the slot's own coordinates.
        const style: CSSProperties = {
          left: `calc(50% + ${slot?.x ?? 0}px)`,
          top: `calc(50% + ${slot?.y ?? 0}px)`,
          width: MARKER_SIZE.width,
          height: MARKER_SIZE.height,
        };
        return (
          <span
            key={marker}
            className={`chen-marker chen-marker--${marker}`}
            style={style}
            title={marker === 'key' ? messages.marker.primaryKey : messages.marker.foreignKey}
            role="img"
            aria-label={marker === 'key' ? messages.marker.primaryKey : messages.marker.foreignKey}
          >
            {marker === 'key' ? <Crown /> : <Cable />}
          </span>
        );
      })}
    </>
  );
}
