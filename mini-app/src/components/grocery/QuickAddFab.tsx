import { useState, useRef, useEffect } from 'react';
import { Plus, X } from 'lucide-react';

interface QuickAddFabProps {
  activeStore: string;
  onAdd: (name: string, quantity: string | undefined, store: string) => Promise<void>;
}

export function QuickAddFab({ activeStore, onAdd }: QuickAddFabProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Autofocus name input when form opens
  useEffect(() => {
    if (isOpen && nameInputRef.current) {
      // Small delay to let the animation start
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  function handleClose() {
    setIsOpen(false);
    setName('');
    setQuantity('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || submitting) return;

    setSubmitting(true);
    try {
      await onAdd(trimmedName, quantity.trim() || undefined, activeStore);
      // Success: clear fields but keep form open for rapid adds
      setName('');
      setQuantity('');
      nameInputRef.current?.focus();
    } catch {
      // Error is handled by the hook
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        className="quick-add-fab"
        onClick={() => setIsOpen(true)}
        aria-label="Add item"
        style={{
          bottom: 'calc(var(--tg-viewport-content-safe-area-inset-bottom, 0px) + 80px)',
          right: '16px',
        }}
      >
        <Plus size={24} color="#fff" />
      </button>
    );
  }

  return (
    <>
      <div className="quick-add-backdrop" onClick={handleClose} />
      <div
        className="quick-add-form"
        style={{
          paddingBottom:
            'calc(var(--tg-viewport-content-safe-area-inset-bottom, 0px) + 16px)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
          }}
        >
          <span style={{ fontWeight: 700, fontSize: '18px' }}>Add Item</span>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: 'var(--tg-theme-hint-color, #999)',
            }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            ref={nameInputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Item name"
            required
          />
          <input
            type="text"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Quantity (optional)"
          />
          <button
            type="submit"
            className="quick-add-form__submit"
            disabled={!name.trim() || submitting}
          >
            {submitting ? 'Adding...' : 'Add'}
          </button>
        </form>
        <div className="quick-add-form__hint">Adding to {activeStore}</div>
      </div>
    </>
  );
}
