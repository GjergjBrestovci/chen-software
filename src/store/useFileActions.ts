import { useCallback } from 'react';
import { messages } from '../i18n/messages.en';
import { createEmptyDocument } from '../model/operations';
import { loadDocument, useDocumentStore } from './documentStore';
import { useUiStore } from './uiStore';
import {
  downloadDocument,
  openDocumentText,
  pickDocumentFile,
  placementNotice,
} from '../persistence/fileIO';

/**
 * New / Open / Save, shared by the toolbar and the keyboard shortcut so there
 * is one implementation of each (SPEC.md §5, §8, §9).
 */
export interface FileActions {
  newDiagram: () => void;
  openDiagram: () => void;
  saveDiagram: () => void;
  hasUnsavedChanges: boolean;
}

export function useFileActions(): FileActions {
  const document = useDocumentStore((state) => state.document);
  const exportedDocument = useUiStore((state) => state.exportedDocument);
  const markExported = useUiStore((state) => state.markExported);
  const notify = useUiStore((state) => state.notify);
  const ask = useUiStore((state) => state.ask);
  const setSelectedIds = useUiStore((state) => state.setSelectedIds);
  const stopRenaming = useUiStore((state) => state.stopRenaming);

  // Reference equality is enough: operations return a new document on change
  // and the same one on a no-op.
  const hasUnsavedChanges = document !== exportedDocument;

  const startFresh = useCallback(() => {
    loadDocument(createEmptyDocument());
    setSelectedIds([]);
    stopRenaming();
  }, [setSelectedIds, stopRenaming]);

  const newDiagram = useCallback(() => {
    if (!hasUnsavedChanges) {
      startFresh();
      return;
    }
    ask({
      message: messages.file.discardChanges,
      confirmLabel: messages.file.discardConfirm,
      onConfirm: startFresh,
    });
  }, [ask, hasUnsavedChanges, startFresh]);

  const openDiagram = useCallback(() => {
    void (async () => {
      const file = await pickDocumentFile();
      if (!file) {
        return;
      }

      const outcome = openDocumentText(await file.text());
      if (!outcome.ok) {
        notify(outcome.message);
        return;
      }

      loadDocument(outcome.value.document);
      setSelectedIds([]);
      stopRenaming();
      // An opened file is, by definition, saved.
      markExported(outcome.value.document);
      notify(placementNotice(outcome.value.placedIds) ?? messages.file.opened(file.name));
    })();
  }, [markExported, notify, setSelectedIds, stopRenaming]);

  const saveDiagram = useCallback(() => {
    downloadDocument(document);
    markExported(document);
  }, [document, markExported]);

  return { newDiagram, openDiagram, saveDiagram, hasUnsavedChanges };
}
