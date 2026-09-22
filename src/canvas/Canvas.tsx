import { useCallback, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, ReactElement } from 'react';
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  Panel,
  ReactFlow,
  useReactFlow,
} from '@xyflow/react';
import type { Connection, NodeChange } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { messages } from '../i18n/messages.en';
import { GRID_SIZE } from '../layout/types';
import type { Id, Position } from '../model/types';
import { useDocumentStore } from '../store/documentStore';
import { useUiStore } from '../store/uiStore';
import { useAutosave, useRestoreAutosave } from '../store/useAutosave';
import { useFileActions } from '../store/useFileActions';
import { redo, undo, useCanRedo, useCanUndo } from '../store/useTemporal';
import { Toolbar } from '../ui/Toolbar';
import { AttributeNode } from './nodes/AttributeNode';
import { EntityNode } from './nodes/EntityNode';
import { RelationshipNode } from './nodes/RelationshipNode';
import { ChenEdge } from './edges/ChenEdge';
import { readNodeChanges, toMoves } from './nodeChanges';
import { buildScene, midpointBetween } from './scene';
import type { AppNode } from './scene';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useUiReconciler } from './useUiReconciler';

const nodeTypes = {
  entity: EntityNode,
  relationship: RelationshipNode,
  attribute: AttributeNode,
};

const edgeTypes = { chen: ChenEdge };

/**
 * React Flow paints the grid with an SVG attribute, which cannot read a CSS
 * custom property, so the two themes are spelled out here. These are the only
 * colours in the app that live outside `styles/global.css`.
 */
const GRID_COLORS = {
  light: { fine: '#e4e7ec', coarse: '#d0d5dd' },
  dark: { fine: '#23272f', coarse: '#2c313a' },
} as const;

/** New shapes are created unnamed and go straight into rename mode (SPEC.md §5). */
const NEW_NAME = '';

export function Canvas(): ReactElement {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const document = useDocumentStore((state) => state.document);
  const addEntityAt = useDocumentStore((state) => state.addEntityAt);
  const addAttributeTo = useDocumentStore((state) => state.addAttributeTo);
  const addRelationshipBetween = useDocumentStore((state) => state.addRelationshipBetween);
  const moveMany = useDocumentStore((state) => state.moveMany);
  const remove = useDocumentStore((state) => state.remove);

  const selectedIds = useUiStore((state) => state.selectedIds);
  const renamingId = useUiStore((state) => state.renamingId);
  const relationshipMode = useUiStore((state) => state.relationshipMode);
  const snapToGrid = useUiStore((state) => state.snapToGrid);
  const setSelectedIds = useUiStore((state) => state.setSelectedIds);
  const startRenaming = useUiStore((state) => state.startRenaming);
  const stopRenaming = useUiStore((state) => state.stopRenaming);
  const toggleRelationshipMode = useUiStore((state) => state.toggleRelationshipMode);
  const armRelationshipFrom = useUiStore((state) => state.armRelationshipFrom);
  const cancelRelationshipMode = useUiStore((state) => state.cancelRelationshipMode);
  const toggleSnapToGrid = useUiStore((state) => state.toggleSnapToGrid);
  const notify = useUiStore((state) => state.notify);
  const theme = useUiStore((state) => state.theme);
  const toggleTheme = useUiStore((state) => state.toggleTheme);
  const openContextMenu = useUiStore((state) => state.openContextMenu);
  const closeContextMenu = useUiStore((state) => state.closeContextMenu);

  const canUndo = useCanUndo();
  const canRedo = useCanRedo();
  const file = useFileActions();

  // Restore first, then start saving, so the empty starting document never
  // overwrites what is being restored.
  const restored = useRestoreAutosave();
  useAutosave(restored);

  // Undo can delete whatever is selected or being renamed out from under us.
  useUiReconciler(document);

  /**
   * Positions mid-drag. Kept out of the document on purpose: the store is only
   * written once, on drag stop, which is what makes a whole drag a single undo
   * entry (SPEC.md §5).
   */
  const [dragPositions, setDragPositions] = useState<Record<Id, Position>>({});

  const scene = useMemo(
    () => buildScene({ document, selectedIds, renamingId, dragPositions }),
    [document, selectedIds, renamingId, dragPositions],
  );

  const nodeById = useCallback(
    (id: Id): AppNode | undefined => scene.nodes.find((node) => node.id === id),
    [scene],
  );

  const createEntityAt = useCallback(
    (position: Position) => {
      startRenaming(addEntityAt(position));
    },
    [addEntityAt, startRenaming],
  );

  const createRelationship = useCallback(
    (firstId: Id, secondId: Id) => {
      const position = midpointBetween(scene.boxes, firstId, secondId, NEW_NAME);
      startRenaming(addRelationshipBetween([firstId, secondId], position));
    },
    [addRelationshipBetween, scene.boxes, startRenaming],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<AppNode>[]) => {
      const { moved, selection } = readNodeChanges(changes, selectedIds);

      if (Object.keys(moved).length > 0) {
        setDragPositions((current) => ({ ...current, ...moved }));
      }
      if (selection) {
        setSelectedIds(selection);
      }
    },
    [selectedIds, setSelectedIds],
  );

  const onNodeDragStop = useCallback(() => {
    moveMany(toMoves(dragPositions));
    setDragPositions({});
  }, [dragPositions, moveMany]);

  const onNodeClick = useCallback(
    (_event: ReactMouseEvent, node: AppNode) => {
      if (!relationshipMode.active) {
        return;
      }
      if (node.type !== 'entity') {
        notify(messages.canvas.relationshipNeedsEntities);
        return;
      }
      if (relationshipMode.firstEntityId === null) {
        armRelationshipFrom(node.id);
        notify(messages.canvas.pickSecondEntity);
        return;
      }
      if (relationshipMode.firstEntityId === node.id) {
        // Self-relationships are phase 2. Stay armed and keep the first pick,
        // so the student can simply click a different second entity.
        notify(messages.canvas.selfRelationshipRejected);
        return;
      }
      createRelationship(relationshipMode.firstEntityId, node.id);
      cancelRelationshipMode();
    },
    [armRelationshipFrom, cancelRelationshipMode, createRelationship, notify, relationshipMode],
  );

  const onNodeContextMenu = useCallback(
    (event: ReactMouseEvent, node: AppNode) => {
      event.preventDefault();
      openContextMenu({ elementId: node.id, x: event.clientX, y: event.clientY });
    },
    [openContextMenu],
  );

  const onNodeDoubleClick = useCallback(
    (event: ReactMouseEvent, node: AppNode) => {
      event.stopPropagation();
      startRenaming(node.id);
    },
    [startRenaming],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const { source, target } = connection;
      if (source === target) {
        notify(messages.canvas.selfRelationshipRejected);
        return;
      }
      if (nodeById(source)?.type !== 'entity' || nodeById(target)?.type !== 'entity') {
        notify(messages.canvas.relationshipNeedsEntities);
        return;
      }
      createRelationship(source, target);
    },
    [createRelationship, nodeById, notify],
  );

  const onPaneDoubleClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (
        !(event.target instanceof Element) ||
        !event.target.classList.contains('react-flow__pane')
      ) {
        return;
      }
      createEntityAt(screenToFlowPosition({ x: event.clientX, y: event.clientY }));
    },
    [createEntityAt, screenToFlowPosition],
  );

  const viewportCenter = useCallback((): Position => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: 0, y: 0 };
    }
    return screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }, [screenToFlowPosition]);

  const addAttributeToSelection = useCallback(() => {
    const [onlyId, ...rest] = selectedIds;
    const owner = onlyId === undefined ? undefined : nodeById(onlyId);
    if (rest.length > 0 || !owner || owner.type === 'attribute') {
      notify(messages.canvas.attributeNeedsOwner);
      return;
    }
    startRenaming(addAttributeTo(owner.id));
  }, [addAttributeTo, nodeById, notify, selectedIds, startRenaming]);

  const deleteSelection = useCallback(() => {
    if (selectedIds.length === 0) {
      return;
    }
    remove(selectedIds);
    setSelectedIds([]);
    stopRenaming();
  }, [remove, selectedIds, setSelectedIds, stopRenaming]);

  const onEscape = useCallback(() => {
    closeContextMenu();
    if (relationshipMode.active) {
      cancelRelationshipMode();
    }
  }, [cancelRelationshipMode, closeContextMenu, relationshipMode.active]);

  useKeyboardShortcuts(
    useMemo(
      () => ({
        onNewEntity: () => {
          createEntityAt(viewportCenter());
        },
        onAddAttribute: addAttributeToSelection,
        onToggleRelationshipMode: toggleRelationshipMode,
        onDeleteSelection: deleteSelection,
        onUndo: undo,
        onRedo: redo,
        onSave: file.saveDiagram,
        onEscape,
      }),
      [
        addAttributeToSelection,
        createEntityAt,
        deleteSelection,
        file.saveDiagram,
        onEscape,
        toggleRelationshipMode,
        viewportCenter,
      ],
    ),
  );

  const selectedOwner = selectedIds.length === 1 ? nodeById(selectedIds[0] ?? '') : undefined;

  return (
    <div
      className={relationshipMode.active ? 'chen-canvas is-linking' : 'chen-canvas'}
      ref={wrapperRef}
      onDoubleClick={onPaneDoubleClick}
    >
      <ReactFlow<AppNode>
        nodes={scene.nodes}
        edges={scene.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={closeContextMenu}
        onConnect={onConnect}
        connectionMode={ConnectionMode.Loose}
        snapToGrid={snapToGrid}
        snapGrid={[GRID_SIZE, GRID_SIZE]}
        // Delete is handled by our own shortcut so it can be one undo entry.
        deleteKeyCode={null}
        multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
        selectionOnDrag
        panOnDrag={[1, 2]}
        minZoom={0.2}
        maxZoom={2.5}
        fitView
        proOptions={{ hideAttribution: true }}
        aria-label={messages.canvas.label}
      >
        <Background
          variant={BackgroundVariant.Lines}
          gap={GRID_SIZE}
          color={GRID_COLORS[theme].fine}
        />
        <Background
          variant={BackgroundVariant.Lines}
          gap={GRID_SIZE * 5}
          color={GRID_COLORS[theme].coarse}
          id="coarse"
        />
        <Controls showInteractive={false} />
        <Panel position="top-left">
          <Toolbar
            onNewDiagram={file.newDiagram}
            onOpenDiagram={file.openDiagram}
            onSaveDiagram={file.saveDiagram}
            hasUnsavedChanges={file.hasUnsavedChanges}
            onNewEntity={() => {
              createEntityAt(viewportCenter());
            }}
            onAddAttribute={addAttributeToSelection}
            onToggleRelationshipMode={toggleRelationshipMode}
            onDeleteSelection={deleteSelection}
            onToggleSnap={toggleSnapToGrid}
            onToggleTheme={toggleTheme}
            theme={theme}
            onUndo={undo}
            onRedo={redo}
            relationshipModeActive={relationshipMode.active}
            snapToGrid={snapToGrid}
            canAddAttribute={selectedOwner !== undefined && selectedOwner.type !== 'attribute'}
            canDelete={selectedIds.length > 0}
            canUndo={canUndo}
            canRedo={canRedo}
          />
        </Panel>
      </ReactFlow>
    </div>
  );
}
