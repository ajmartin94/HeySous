import { useCallback } from 'react';

interface ClearListDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Confirmation dialog for clearing the entire grocery list.
 * Modal overlay with centered dialog box.
 * Backdrop click triggers cancel.
 */
export function ClearListDialog({ open, onCancel, onConfirm }: ClearListDialogProps) {
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onCancel();
      }
    },
    [onCancel],
  );

  if (!open) return null;

  return (
    <div className="clear-dialog__overlay" onClick={handleOverlayClick}>
      <div className="clear-dialog">
        <h2 className="clear-dialog__title">Clear entire grocery list?</h2>
        <p className="clear-dialog__body">This can't be undone.</p>
        <div className="clear-dialog__actions">
          <button
            className="clear-dialog__btn clear-dialog__btn--cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="clear-dialog__btn clear-dialog__btn--confirm"
            onClick={onConfirm}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
