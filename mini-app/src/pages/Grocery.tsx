import { Placeholder } from '@telegram-apps/telegram-ui';
import { ShoppingCart } from 'lucide-react';
import { colors } from '../theme/tokens';

export function Grocery() {
  return (
    <Placeholder
      header="Grocery List"
      description="Grocery list coming soon"
    >
      <ShoppingCart size={48} style={{ color: colors.accent }} />
    </Placeholder>
  );
}
