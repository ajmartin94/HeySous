import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { backButton } from '@tma.js/sdk-react';
import { useUserRole } from '../hooks/useUserRole';

export function Help() {
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();

  // BackButton: navigate back to hub
  useEffect(() => {
    if (!backButton.onClick.isAvailable()) return;
    const off = backButton.onClick(() => navigate(-1));
    return () => {
      off();
    };
  }, [navigate]);

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: '17px',
    fontWeight: 600,
    color: 'var(--hs-accent)',
    marginBottom: '8px',
    marginTop: '24px',
  };

  const tipStyle: React.CSSProperties = {
    color: 'var(--tgui--secondary_hint_color)',
    fontStyle: 'italic',
    fontSize: '13px',
    marginTop: '6px',
    lineHeight: 1.4,
  };

  const paragraphStyle: React.CSSProperties = {
    fontSize: '14px',
    lineHeight: 1.6,
    color: 'var(--tgui--text_color)',
    margin: '0 0 4px 0',
  };

  const commandStyle: React.CSSProperties = {
    fontFamily: 'monospace',
    fontWeight: 600,
    color: 'var(--hs-accent)',
  };

  const commandRowStyle: React.CSSProperties = {
    fontSize: '14px',
    lineHeight: 1.8,
    color: 'var(--tgui--text_color)',
  };

  return (
    <div style={{ padding: 'var(--hs-spacing-section)' }}>
      {/* Header */}
      <div
        style={{
          fontSize: 'var(--hs-font-size-heading)',
          fontWeight: 600,
          color: 'var(--hs-accent)',
          paddingBottom: '8px',
        }}
      >
        Help
      </div>
      <p style={{ ...paragraphStyle, marginBottom: '16px', color: 'var(--tgui--secondary_hint_color)' }}>
        Everything HeySous can do for you, all in one place.
      </p>

      {/* Recipes */}
      <div style={sectionHeaderStyle}>Recipes</div>
      <p style={paragraphStyle}>
        Save recipes by pasting a URL or typing out ingredients and steps.
        Browse your saved recipes, search by name or ingredient, and view
        full details anytime.
      </p>
      <div style={tipStyle}>Try: paste a recipe URL and I'll save it!</div>

      {/* Meal Planning */}
      <div style={sectionHeaderStyle}>Meal Planning</div>
      <p style={paragraphStyle}>
        Ask me to plan your meals for the week and I'll create a full plan
        based on your saved recipes and preferences. You can modify individual
        days, swap meals, or regenerate the whole plan.
      </p>
      <div style={tipStyle}>Try: "plan my meals for the week" and I'll build a full plan based on your recipes!</div>

      {/* Grocery Lists */}
      <div style={sectionHeaderStyle}>Grocery Lists</div>
      <p style={paragraphStyle}>
        Generate a grocery list from your meal plan automatically. Add extra
        items, check things off as you shop, and start fresh whenever you need.
      </p>
      <div style={tipStyle}>Try: "make my grocery list" after creating a meal plan!</div>

      {/* Reminders */}
      <div style={sectionHeaderStyle}>Reminders</div>
      <p style={paragraphStyle}>
        Get morning summaries of what's on the menu, prep alerts before
        cooking, and dinner time reminders. Set your timezone and customize
        when you'd like to be reminded.
      </p>
      <div style={tipStyle}>Try: "set my dinner time to 6:30pm" to customize reminders</div>

      {/* Preferences */}
      <div style={sectionHeaderStyle}>Preferences</div>
      <p style={paragraphStyle}>
        Tell me about dietary restrictions, allergies, or foods you love and
        hate. I'll remember everything and use it when planning meals and
        suggesting recipes.
      </p>
      <div style={tipStyle}>Just mention preferences naturally -- I'll remember them!</div>

      {/* Commands */}
      <div style={{ ...sectionHeaderStyle, marginTop: '32px' }}>Commands</div>
      <div style={commandRowStyle}>
        <span style={commandStyle}>/help</span> -- Open this help page
      </div>
      <div style={commandRowStyle}>
        <span style={commandStyle}>/grocery</span> -- View your grocery list
      </div>
      <div style={commandRowStyle}>
        <span style={commandStyle}>/plan</span> -- View your meal plan
      </div>
      <div style={commandRowStyle}>
        <span style={commandStyle}>/preferences</span> -- See your saved preferences
      </div>
      <div style={commandRowStyle}>
        <span style={commandStyle}>/reminders</span> -- View reminder settings
      </div>
      <div style={commandRowStyle}>
        <span style={commandStyle}>/feedback</span> -- Share feedback about the app
      </div>

      {/* Admin Commands (conditional) */}
      {isAdmin && (
        <>
          <div style={{ ...sectionHeaderStyle, marginTop: '32px' }}>Admin Commands</div>
          <div style={commandRowStyle}>
            <span style={commandStyle}>/invite</span> -- Generate a single-use invite link
          </div>
          <div style={commandRowStyle}>
            <span style={commandStyle}>/costs</span> -- View API usage costs
          </div>
          <div style={commandRowStyle}>
            <span style={commandStyle}>/debug</span> -- View retrieval stats
          </div>
        </>
      )}
    </div>
  );
}
