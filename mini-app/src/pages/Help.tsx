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
    fontSize: 'calc(var(--hs-font-size-body) + 2px)',
    fontWeight: 600,
    color: 'var(--hs-accent)',
    marginBottom: '8px',
    marginTop: '24px',
  };

  const tipStyle: React.CSSProperties = {
    color: 'var(--tgui--secondary_hint_color)',
    fontStyle: 'italic',
    fontSize: 'var(--hs-font-size-small)',
    marginTop: '6px',
    lineHeight: 1.4,
  };

  const paragraphStyle: React.CSSProperties = {
    fontSize: 'var(--hs-font-size-body)',
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
    fontSize: 'var(--hs-font-size-body)',
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
          paddingBottom: '4px',
        }}
      >
        Hey, I'm Sous!
      </div>
      <p style={{ ...paragraphStyle, marginBottom: '16px', color: 'var(--tgui--secondary_hint_color)' }}>
        I'm your cooking partner with a really good memory. Think of me as a
        friend who keeps track of all your recipes, helps plan the week, and
        makes sure the grocery run goes smoothly. Here's everything I can help
        with.
      </p>

      {/* Saving Recipes */}
      <div style={sectionHeaderStyle}>Saving Recipes</div>
      <p style={paragraphStyle}>
        I'm always happy to learn a new recipe. You've got a few ways to share
        them with me:
      </p>
      <p style={paragraphStyle}>
        - Just tell me the recipe in conversation and I'll offer to save it
      </p>
      <p style={paragraphStyle}>
        - Paste a URL from any recipe site and I'll pull it in automatically
      </p>
      <p style={paragraphStyle}>
        - Snap a photo of a recipe (from a cookbook, a friend's card, wherever) and send it -- I can read it
      </p>
      <p style={paragraphStyle}>
        Once saved, you can browse, search, and filter your whole collection in the Mini App.
      </p>
      <div style={tipStyle}>
        Try: "Here's my mom's chicken soup recipe..." or just paste a link like https://example.com/recipe
      </div>

      {/* Planning Meals */}
      <div style={sectionHeaderStyle}>Planning Meals</div>
      <p style={paragraphStyle}>
        This is where things get fun. Ask me to plan your week and I'll put
        together a full lineup based on your saved recipes, what you're in the
        mood for, and what you haven't had in a while. I keep track of your
        cooking history so things stay fresh.
      </p>
      <p style={paragraphStyle}>
        Not feeling Tuesday's dinner? No problem -- tell me to swap it out.
        Want to redo a whole day? I'm on it. You can also view and browse the
        plan in the Mini App with a 7-day grid that swipes between weeks.
      </p>
      <div style={tipStyle}>
        Try: "Plan my meals for the week" / "Swap Tuesday's dinner for something lighter" / "What did we have last week?"
      </div>

      {/* Grocery Lists */}
      <div style={sectionHeaderStyle}>Grocery Lists</div>
      <p style={paragraphStyle}>
        Once you've got a meal plan, I can turn it into a grocery list in
        seconds. Check items off as you shop in the Mini App, quick-add
        anything extra with the + button, and clear the list when you're done.
      </p>
      <p style={paragraphStyle}>
        If you've told me about your store preferences (like splitting between
        Kroger and Costco), I'll keep that in mind too.
      </p>
      <div style={tipStyle}>
        Try: "Make my grocery list" / "Add milk to the grocery list"
      </div>

      {/* Reminders & Timing */}
      <div style={sectionHeaderStyle}>Reminders & Timing</div>
      <p style={paragraphStyle}>
        I'll send you a morning heads-up about what's on the menu, a prep
        alert based on actual recipe cook times so you start at the right
        moment, and a dinner time nudge when it's go time.
      </p>
      <p style={paragraphStyle}>
        You can customize your schedule, set your preferred dinner time, or
        mute everything when life gets busy.
      </p>
      <div style={tipStyle}>
        Try: "Set my dinner time to 6:30pm" / "Mute reminders until Thursday"
      </div>

      {/* Preferences & Learning */}
      <div style={sectionHeaderStyle}>Preferences & Learning</div>
      <p style={paragraphStyle}>
        Here's a little secret: you don't have to formally "set" your
        preferences. Just mention things naturally in conversation -- that you
        don't eat pork, that you love spicy food, that you shop at Kroger -- and
        I'll pick it up and remember it.
      </p>
      <p style={paragraphStyle}>
        Of course, you can also tell me directly about dietary restrictions,
        allergies, or favorites. Either way, I'll use what I know about you
        when planning meals and suggesting recipes.
      </p>
      <div style={tipStyle}>
        Try: "We don't eat pork" / "I love spicy food" / "We usually shop at Kroger and Costco"
      </div>

      {/* Recipe Tweaks & Variations */}
      <div style={sectionHeaderStyle}>Recipe Tweaks & Variations</div>
      <p style={paragraphStyle}>
        Want to make a recipe dairy-free? Swap chicken for tofu? Just ask and
        I'll update the recipe in place with your changes. I also note
        interchangeable ingredients as variations so you can flex based on
        what's in the fridge.
      </p>
      <div style={tipStyle}>
        Try: "Make the pasta recipe dairy-free" / "Can I substitute chicken for tofu in the stir fry?"
      </div>

      {/* After Dinner (Feedback) */}
      <div style={sectionHeaderStyle}>After Dinner</div>
      <p style={paragraphStyle}>
        After you cook something, I'll check in to see how it went. Your
        feedback helps me learn what works and what doesn't -- so future plans
        get better over time. You can rate meals, let me know if something
        needs more salt, or flag a new favorite.
      </p>
      <div style={tipStyle}>
        Try: "The chicken was great!" / "That recipe needs more salt"
      </div>

      {/* Mini App Features */}
      <div style={sectionHeaderStyle}>Mini App Features</div>
      <p style={paragraphStyle}>
        The Mini App is your visual dashboard. Here's what each section does:
      </p>
      <p style={paragraphStyle}>
        - <b>Hub</b> -- Your overview dashboard
      </p>
      <p style={paragraphStyle}>
        - <b>Recipes</b> -- Browse, search, filter by tag, view details, delete
      </p>
      <p style={paragraphStyle}>
        - <b>Meal Plan</b> -- 7-day grid view, swipe between weeks
      </p>
      <p style={paragraphStyle}>
        - <b>Grocery List</b> -- Check off items, quick-add, clear the list
      </p>
      <p style={paragraphStyle}>
        - <b>Settings</b> -- Theme (light/dark) and font size preferences
      </p>

      {/* Commands */}
      <div style={{ ...sectionHeaderStyle, marginTop: '32px' }}>Commands</div>
      <p style={{ ...paragraphStyle, marginBottom: '8px', color: 'var(--tgui--secondary_hint_color)' }}>
        You can also use these shortcuts in the chat:
      </p>
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

      {/* Bottom spacing */}
      <div style={{ height: '32px' }} />
    </div>
  );
}
