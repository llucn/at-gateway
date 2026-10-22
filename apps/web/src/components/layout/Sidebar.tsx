import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';

interface NavChild {
  label: string;
  path: string;
}

interface NavGroup {
  label: string;
  children: NavChild[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    children: [
      { label: 'Dashboard', path: '/' },
    ],
  },
  {
    label: 'Communications',
    children: [
      { label: 'SMS', path: '/sms' },
      { label: 'Calls', path: '/calls' },
      { label: 'Recordings', path: '/recordings' },
    ],
  },
  {
    label: 'System',
    children: [
      { label: 'Settings', path: '/settings' },
      { label: 'Credentials', path: '/credentials' },
    ],
  },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const location = useLocation();
  // All groups open by default
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    Object.fromEntries(NAV_GROUPS.map((g) => [g.label, true]))
  );

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <>
      {/* Overlay — only on narrow viewports */}
      <div
        className={`sidebar-overlay${open ? ' active' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Main navigation">
        <nav className="nav" role="navigation">
          {NAV_GROUPS.map((group) => {
            const expanded = !!openGroups[group.label];
            return (
              <div key={group.label} className="nav-group">
                {/* Group header */}
                <button
                  className="nav-group-header"
                  onClick={() => toggleGroup(group.label)}
                  aria-expanded={expanded}
                >
                  <span className="nav-group-label">{group.label}</span>
                  <ChevronIcon className={`nav-group-icon${expanded ? ' open' : ''}`} />
                </button>

                {/* Children */}
                {expanded && (
                  <div className="nav-group-children">
                    {group.children.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`nav-item${isActive(item.path) ? ' active' : ''}`}
                        onClick={onClose}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
