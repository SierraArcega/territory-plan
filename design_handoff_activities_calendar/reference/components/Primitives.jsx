/* global React */
// Primitives.jsx — design-token-driven atoms for Mapomatic



// ============================================================================
// Button
// ============================================================================
const BTN_STYLES = {
  primary:   { bg: '#403770', color: '#fff',    border: 'transparent', hoverBg: '#322a5a' },
  coral:     { bg: '#F37167', color: '#fff',    border: 'transparent', hoverBg: '#e25f55' },
  secondary: { bg: '#fff',    color: '#403770', border: '#D4CFE2',     hoverBg: '#F7F5FA' },
  ghost:     { bg: 'transparent', color: '#403770', border: 'transparent', hoverBg: '#EFEDF5' },
  danger:    { bg: '#fff',    color: '#c25a52', border: '#f58d85',     hoverBg: '#fef1f0' },
};

function Button({ variant = 'primary', size = 'md', children, onClick, icon, type = 'button', disabled = false }) {
  const [hover, setHover] = useState(false);
  const s = BTN_STYLES[variant];
  const pad = size === 'sm' ? '6px 12px' : size === 'lg' ? '10px 20px' : '8px 16px';
  const fs = size === 'sm' ? 12 : 14;
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        fontFamily: 'inherit', fontWeight: 500, fontSize: fs, padding: pad,
        borderRadius: 8, border: `1px solid ${s.border}`,
        background: disabled ? '#F7F5FA' : (hover ? s.hoverBg : s.bg),
        color: disabled ? '#A69DC0' : s.color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        transition: 'background 120ms ease-out, border-color 120ms ease-out',
      }}>
      {icon && <span style={{ display: 'inline-flex' }}>{icon}</span>}
      {children}
    </button>
  );
}

// ============================================================================
// Input
// ============================================================================
function Input({ value, onChange, placeholder, type = 'text', error, prefix, style, ...rest }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: 'relative', ...style }}>
      {prefix && (
        <span style={{
          position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
          color: '#A69DC0', fontSize: 14, pointerEvents: 'none',
        }}>{prefix}</span>
      )}
      <input
        {...rest}
        type={type}
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: prefix ? '8px 12px 8px 24px' : '8px 12px',
          fontSize: 14, fontFamily: 'inherit',
          border: focused ? '1px solid transparent' : `1px solid ${error ? '#f58d85' : '#C2BBD4'}`,
          borderRadius: 8,
          background: error ? '#fef1f0' : '#fff',
          color: '#403770', outline: focused ? '2px solid #F37167' : 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

// ============================================================================
// Badge
// ============================================================================
const SIGNAL_STYLES = {
  growing:   { bg: '#EDFFE3', fg: '#5f665b', dot: '#69B34A', label: 'Growing' },
  stable:    { bg: '#e8f1f5', fg: '#4d7285', dot: '#6EA3BE', label: 'Stable' },
  at_risk:   { bg: '#fffaf1', fg: '#997c43', dot: '#FFCF70', label: 'At Risk' },
  declining: { bg: '#fef1f0', fg: '#c25a52', dot: '#F37167', label: 'Declining' },
};
const STATUS_STYLES = {
  active:   { bg: '#F7FFF2', fg: '#69B34A', label: 'Active' },
  planning: { bg: '#e8f1f5', fg: '#6EA3BE', label: 'Planning' },
  stale:    { bg: '#fffaf1', fg: '#D4A84B', label: 'Stale' },
  closed:   { bg: '#FEF1F0', fg: '#F37167', label: 'Closed' },
};

function Badge({ kind = 'signal', level, children, dot = true }) {
  const pal = kind === 'status' ? STATUS_STYLES[level] : SIGNAL_STYLES[level];
  if (!pal) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '2px 10px', borderRadius: 999,
      background: pal.bg, color: pal.fg,
      fontSize: 12, fontWeight: kind === 'status' ? 600 : 500,
    }}>
      {kind === 'signal' && dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: pal.dot }} />}
      {children || pal.label}
    </span>
  );
}

// ============================================================================
// Card
// ============================================================================
function Card({ children, interactive, onClick, style, compact }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: '#fff',
        border: `1px solid ${interactive && hover ? '#B8B0D0' : '#D4CFE2'}`,
        borderRadius: 8,
        padding: compact ? 12 : 16,
        boxShadow: interactive && hover
          ? '0 4px 6px -1px rgba(64,55,112,0.08)'
          : '0 1px 2px rgba(64,55,112,0.05)',
        cursor: interactive ? 'pointer' : 'default',
        transition: 'all 120ms ease-out',
        ...style,
      }}>
      {children}
    </div>
  );
}

// ============================================================================
// Stat
// ============================================================================
function Stat({ label, value, delta, deltaDir }) {
  const col = deltaDir === 'up' ? '#69B34A' : deltaDir === 'down' ? '#c25a52' : '#8A80A8';
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#8A80A8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#403770', fontVariantNumeric: 'tabular-nums', marginTop: 4, letterSpacing: '-0.01em' }}>{value}</div>
      {delta && <div style={{ fontSize: 11, color: col, marginTop: 2, fontWeight: 500 }}>{delta}</div>}
    </div>
  );
}

// ============================================================================
// Progress bar
// ============================================================================
function ProgressBar({ pct, label = 'Revenue to target' }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const fill = pct >= 100 ? '#69B34A' : pct >= 75 ? '#6EA3BE' : pct >= 50 ? '#D4A84B' : '#F37167';
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
        <span style={{ color: '#8A80A8', fontWeight: 500 }}>{label}</span>
        <span style={{ color: fill, fontWeight: 500 }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: '#EFEDF5', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${clamped}%`, background: fill, borderRadius: 999, transition: 'width 400ms ease-out' }} />
      </div>
    </div>
  );
}

Object.assign(window, { Button, Input, Badge, Card, Stat, ProgressBar });
