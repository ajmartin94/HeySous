import { Placeholder } from '@telegram-apps/telegram-ui';
import { CookingPot } from 'lucide-react';
import { colors } from '../theme/tokens';

export function Recipes() {
  return (
    <Placeholder
      header="Recipes"
      description="Recipe browser coming soon"
    >
      <CookingPot size={48} style={{ color: colors.accent }} />
    </Placeholder>
  );
}
