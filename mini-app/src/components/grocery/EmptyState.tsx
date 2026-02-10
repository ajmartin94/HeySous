import { ShoppingCart } from 'lucide-react';
import { colors } from '../../theme/tokens.js';

export function EmptyState() {
  return (
    <div className="empty-state">
      <ShoppingCart size={48} color={colors.accent} />
      <h2 style={{ margin: '16px 0 8px', fontSize: '18px' }}>No grocery list</h2>
      <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.4 }}>
        Ask the bot to create a meal plan or grocery list to get started.
      </p>
    </div>
  );
}
