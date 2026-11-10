import { cn } from '@/lib/utils';

export interface Tab {
  key?: string;
  id?: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  tabs: Tab[];
  activeKey?: string;
  activeTab?: string;
  onChange?: (key: string) => void;
  onTabChange?: (key: string) => void;
}

export default function Tabs({ tabs, activeKey, activeTab, onChange, onTabChange }: TabsProps) {
  const currentKey = activeKey ?? activeTab ?? '';
  const handleChange = onChange ?? onTabChange ?? (() => {});

  return (
    <div className="flex gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1 mb-4 scrollbar-none">
      {tabs.map((tab) => {
        const tabKey = tab.key ?? tab.id ?? tab.label;
        return (
        <button
          key={tabKey}
          onClick={() => handleChange(tabKey)}
          className={cn(
            'flex-shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
            currentKey === tabKey
              ? 'bg-white text-primary-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={cn(
                'ml-1.5 rounded-full px-1.5 py-0.5 text-xs',
                currentKey === tabKey
                  ? 'bg-primary-50 text-primary-700'
                  : 'bg-gray-200 text-gray-500'
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
        );
      })}
    </div>
  );
}

export { Tabs };
