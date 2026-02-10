import { Placeholder } from '@telegram-apps/telegram-ui';
import { CalendarDays } from 'lucide-react';
import { colors } from '../theme/tokens';

export function MealPlan() {
  return (
    <Placeholder
      header="Meal Plan"
      description="Meal plan viewer coming soon"
    >
      <CalendarDays size={48} style={{ color: colors.accent }} />
    </Placeholder>
  );
}
