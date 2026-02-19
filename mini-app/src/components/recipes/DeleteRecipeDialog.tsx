import { useCallback } from 'react';

interface DeleteRecipeDialogProps {
  open: boolean;
  recipeName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Confirmation dialog for deleting a recipe.
 * Modal overlay with centered dialog box.
 * Backdrop click triggers cancel.
 * Follows the same pattern as ClearListDialog (Phase 22).
 */
export function DeleteRecipeDialog({ open, recipeName, onCancel, onConfirm }: DeleteRecipeDialogProps) {
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
    <div className="delete-recipe-dialog__overlay" onClick={handleOverlayClick}>
      <div className="delete-recipe-dialog">
        <h2 className="delete-recipe-dialog__title">Delete this recipe?</h2>
        <p className="delete-recipe-dialog__body">
          &ldquo;{recipeName}&rdquo; will be permanently removed.
        </p>
        <div className="delete-recipe-dialog__actions">
          <button
            className="delete-recipe-dialog__btn delete-recipe-dialog__btn--cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="delete-recipe-dialog__btn delete-recipe-dialog__btn--confirm"
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
