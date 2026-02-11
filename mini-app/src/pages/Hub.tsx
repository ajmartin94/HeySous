import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Section, Cell } from '@telegram-apps/telegram-ui';
import { ChefHat, ShoppingCart, CookingPot, CalendarDays, MessageSquare } from 'lucide-react';
import { apiFetch } from '../api';
import { SkeletonCard } from '../components/SkeletonCard';
import { colors } from '../theme/tokens';

interface SummaryData {
  grocery: { uncheckedCount: number };
  recipes: { count: number };
  plans: { mealCount: number };
}

function formatGrocerySubtitle(data: SummaryData | null, loading: boolean, error: boolean): string {
  if (loading) return 'Loading...';
  if (error || !data) return '--';
  if (data.grocery.uncheckedCount === 0) return 'No list yet -- ask me to make one in chat!';
  return `${data.grocery.uncheckedCount} item${data.grocery.uncheckedCount === 1 ? '' : 's'} to get`;
}

function formatRecipesSubtitle(data: SummaryData | null, loading: boolean, error: boolean): string {
  if (loading) return 'Loading...';
  if (error || !data) return '--';
  if (data.recipes.count === 0) return 'No recipes yet -- ask me to save one in chat!';
  return `${data.recipes.count} recipe${data.recipes.count === 1 ? '' : 's'} saved`;
}

function formatPlanSubtitle(data: SummaryData | null, loading: boolean, error: boolean): string {
  if (loading) return 'Loading...';
  if (error || !data) return '--';
  if (data.plans.mealCount === 0) return 'No plan yet -- ask me to plan your week in chat!';
  return `${data.plans.mealCount} meal${data.plans.mealCount === 1 ? '' : 's'} planned this week`;
}

export function Hub() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    apiFetch('/summary')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: SummaryData) => {
        if (!cancelled) {
          setSummary(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const iconStyle = { color: colors.accent, flexShrink: 0 };
  const cellStyle = { borderLeft: `3px solid ${colors.accent}` };

  return (
    <div style={{ padding: 'var(--hs-spacing-section)' }}>
      {/* Header */}
      <div
        style={{
          fontSize: 'var(--hs-font-size-heading)',
          fontWeight: 600,
          color: 'var(--hs-accent)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          paddingBottom: 'var(--hs-spacing-section)',
        }}
      >
        <ChefHat size={28} style={iconStyle} />
        HeySous
      </div>

      {/* Dashboard cards */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
      ) : (
        <Section>
          <Cell
            before={<ShoppingCart size={24} style={iconStyle} />}
            subtitle={formatGrocerySubtitle(summary, loading, error)}
            onClick={() => navigate('/grocery')}
            style={cellStyle}
          >
            Grocery List
          </Cell>
          <Cell
            before={<CookingPot size={24} style={iconStyle} />}
            subtitle={formatRecipesSubtitle(summary, loading, error)}
            onClick={() => navigate('/recipes')}
            style={cellStyle}
          >
            Recipes
          </Cell>
          <Cell
            before={<CalendarDays size={24} style={iconStyle} />}
            subtitle={formatPlanSubtitle(summary, loading, error)}
            onClick={() => navigate('/plan')}
            style={cellStyle}
          >
            Meal Plan
          </Cell>
          <Cell
            before={<MessageSquare size={24} style={iconStyle} />}
            subtitle="Share your thoughts"
            onClick={() => navigate('/feedback')}
            style={cellStyle}
          >
            Give Feedback
          </Cell>
        </Section>
      )}
    </div>
  );
}
