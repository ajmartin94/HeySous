interface StoreTabsProps {
  stores: string[];
  activeStore: string;
  onStoreChange: (store: string) => void;
}

export function StoreTabs({ stores, activeStore, onStoreChange }: StoreTabsProps) {
  return (
    <div className="store-tabs">
      {stores.map((store) => (
        <button
          key={store}
          className={`store-tab${store === activeStore ? ' store-tab--active' : ''}`}
          onClick={() => onStoreChange(store)}
        >
          {store}
        </button>
      ))}
    </div>
  );
}
