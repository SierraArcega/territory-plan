/* global React */
// IconSystem.jsx — canonical Lucide icons used in Mapomatic chrome
// Stroke-based, currentColor, 2px strokes, round caps/joins, 24x24 viewBox

function makeIcon(d, { extraChildren = null, strokeWidth = 2 } = {}) {
  return function Icon({ size = 20, style }) {
    return (
      <svg
        width={size} height={size} viewBox="0 0 24 24"
        fill="none" stroke="currentColor"
        strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
        style={{ flexShrink: 0, ...style }}>
        {typeof d === 'string' ? <path d={d} /> : d}
      </svg>
    );
  };
}

const HomeIcon = makeIcon(
  <>
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </>
);
const MapIcon = makeIcon(
  <>
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
    <line x1="8" y1="2" x2="8" y2="18" />
    <line x1="16" y1="6" x2="16" y2="22" />
  </>
);
const PlansIcon = makeIcon(
  <>
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="m9 14 2 2 4-4" />
  </>
);
const ActivitiesIcon = makeIcon(
  <>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </>
);
const TasksIcon = makeIcon(
  <>
    <path d="m3 7 2 2 4-4" />
    <line x1="13" y1="7" x2="21" y2="7" />
    <path d="m3 17 2 2 4-4" />
    <line x1="13" y1="17" x2="21" y2="17" />
  </>
);
const LeaderboardIcon = makeIcon(
  <>
    <path d="M8 21h8M12 17v4" />
    <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
    <path d="M17 4h3v2a3 3 0 0 1-3 3M7 4H4v2a3 3 0 0 0 3 3" />
  </>
);
const ResourcesIcon = makeIcon('M4 19.5A2.5 2.5 0 0 1 6.5 17H20V5a2 2 0 0 0-2-2H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5V21h14');
const ProfileIcon = makeIcon(
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </>
);
const SearchIcon = makeIcon(<><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>);
const FilterIcon = makeIcon('M22 3H2l8 9.46V19l4 2v-8.54z');
const LayersIcon = makeIcon(
  <>
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </>
);
const PlusIcon = makeIcon(<><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>);
const XIcon = makeIcon(<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>);
const PencilIcon = makeIcon('M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z');
const ListPlusIcon = makeIcon(<><line x1="11" y1="12" x2="3" y2="12" /><line x1="16" y1="6" x2="3" y2="6" /><line x1="11" y1="18" x2="3" y2="18" /><line x1="15" y1="15" x2="21" y2="15" /><line x1="18" y1="12" x2="18" y2="18" /></>);
const FileEditIcon = makeIcon(
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M18.375 14.625a1.97 1.97 0 0 1 2.828 2.828L15 23.656l-4 1 1-4z" />
  </>
);
const ChevronDownIcon = makeIcon('M6 9l6 6 6-6');
const ChevronLeftIcon = makeIcon('M15 18l-6-6 6-6');
const ChevronRightIcon = makeIcon('M9 18l6-6-6-6');
const MapPinIcon = makeIcon(
  <>
    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </>
);
const SchoolIcon = makeIcon(
  <>
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
    <path d="M6 12v5c3 3 9 3 12 0v-5" />
  </>
);
const UsersIcon = makeIcon(
  <>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </>
);
const SettingsIcon = makeIcon(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </>
);

const PaperclipIcon = makeIcon('M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.49');
const CameraIcon = makeIcon(
  <>
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </>
);
const DollarIcon = makeIcon(<><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>);
const CheckIcon = makeIcon('M20 6L9 17l-5-5');
const CheckCircleIcon = makeIcon(
  <>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </>
);
const ClockIcon = makeIcon(<><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>);
const TrashIcon = makeIcon(
  <>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </>
);
const DownloadIcon = makeIcon(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>);
const ImageIcon = makeIcon(
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </>
);
const FileIcon = makeIcon(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></>);
const MoreIcon = makeIcon(<><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></>);
const SparkleIcon = makeIcon('M12 3l2.09 5.26L20 10l-5.91 1.74L12 17l-2.09-5.26L4 10l5.91-1.74z');
const LinkIcon = makeIcon(
  <>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </>
);

Object.assign(window, {
  HomeIcon, MapIcon, PlansIcon, ActivitiesIcon, TasksIcon, LeaderboardIcon,
  ResourcesIcon, ProfileIcon, SearchIcon, FilterIcon, LayersIcon, PlusIcon,
  XIcon, PencilIcon, ListPlusIcon, FileEditIcon, ChevronDownIcon,
  ChevronLeftIcon, ChevronRightIcon, MapPinIcon, SchoolIcon, UsersIcon, SettingsIcon,
  PaperclipIcon, CameraIcon, DollarIcon, CheckIcon, CheckCircleIcon, ClockIcon,
  TrashIcon, DownloadIcon, ImageIcon, FileIcon, MoreIcon, SparkleIcon, LinkIcon,
});
