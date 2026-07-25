/* @ds-bundle: {"format":3,"namespace":"ConcretaDesignSystem_bac861","components":[{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Panel","sourcePath":"components/core/Panel.jsx"},{"name":"StatusBadge","sourcePath":"components/core/StatusBadge.jsx"},{"name":"StatusTag","sourcePath":"components/core/StatusTag.jsx"},{"name":"CheckRow","sourcePath":"components/data/CheckRow.jsx"},{"name":"SectionHeader","sourcePath":"components/data/SectionHeader.jsx"},{"name":"ValueRow","sourcePath":"components/data/ValueRow.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"Tooltip","sourcePath":"components/feedback/Tooltip.jsx"},{"name":"NumberField","sourcePath":"components/forms/NumberField.jsx"},{"name":"SegmentedToggle","sourcePath":"components/forms/SegmentedToggle.jsx"},{"name":"ThemeToggle","sourcePath":"components/forms/ThemeToggle.jsx"},{"name":"ModuleIcon","sourcePath":"components/icons/ModuleIcon.jsx"},{"name":"Sidebar","sourcePath":"components/nav/Sidebar.jsx"},{"name":"Topbar","sourcePath":"components/nav/Topbar.jsx"}],"sourceHashes":{"components/core/Button.jsx":"cbf6d19fb16a","components/core/Panel.jsx":"eecc76cc756b","components/core/StatusBadge.jsx":"b40f675ab7b9","components/core/StatusTag.jsx":"33e605fcb053","components/data/CheckRow.jsx":"1b0d40955888","components/data/SectionHeader.jsx":"21cf01f860f6","components/data/ValueRow.jsx":"2a22dfc92809","components/feedback/Toast.jsx":"52527d709a3a","components/feedback/Tooltip.jsx":"90fd4db412b7","components/forms/NumberField.jsx":"c9bfaeaa9bab","components/forms/SegmentedToggle.jsx":"67cac5cde236","components/forms/ThemeToggle.jsx":"4e8185921ddc","components/icons/ModuleIcon.jsx":"262e53543b41","components/nav/Sidebar.jsx":"c01ed523f4cf","components/nav/Topbar.jsx":"7b0ccc6073b6","ui_kits/app/CalculatorApp.jsx":"53953e2f23a8","ui_kits/app/Canvas.jsx":"f80b0e7ce971","ui_kits/app/moduleData.js":"ce4036a45b4b","ui_kits/marketing/Landing.jsx":"8c51310178b6","ui_kits/marketing/LandingPreview.jsx":"25ae581cc1fb"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.ConcretaDesignSystem_bac861 = window.ConcretaDesignSystem_bac861 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
/**
 * Button — Concreta's button primitive.
 * Three variants: `secondary` (default outline), `primary` (accent fill),
 * `ghost` (borderless). Two sizes: `md` (32px) and `lg` (40px). Optional
 * trailing mono arrow. All state changes are 150ms transitions.
 */
function Button({
  variant = 'secondary',
  size = 'md',
  arrow = false,
  disabled = false,
  href,
  onClick,
  children,
  style,
  ...rest
}) {
  const [hover, setHover] = useState(false);
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    height: size === 'lg' ? 40 : 32,
    padding: size === 'lg' ? '0 18px' : '0 14px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--color-border-main)',
    background: 'var(--color-bg-surface)',
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-sans)',
    fontSize: size === 'lg' ? 14 : 13,
    fontWeight: 500,
    lineHeight: 1,
    textDecoration: 'none',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    transition: 'var(--transition)',
    boxSizing: 'border-box'
  };
  const variants = {
    secondary: {
      ...base,
      ...(hover && !disabled ? {
        borderColor: 'var(--color-accent)',
        color: 'var(--color-accent)'
      } : {})
    },
    primary: {
      ...base,
      fontWeight: 600,
      background: hover && !disabled ? 'var(--color-btn-primary-bg-hover)' : 'var(--color-btn-primary-bg)',
      borderColor: hover && !disabled ? 'var(--color-btn-primary-bg-hover)' : 'var(--color-btn-primary-bg)',
      color: 'var(--color-btn-primary-fg)'
    },
    ghost: {
      ...base,
      background: hover && !disabled ? 'var(--color-bg-surface)' : 'transparent',
      borderColor: hover && !disabled ? 'var(--color-border-main)' : 'transparent',
      color: hover && !disabled ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'
    }
  };
  const Tag = href ? 'a' : 'button';
  return /*#__PURE__*/React.createElement(Tag, _extends({
    href: href,
    onClick: disabled ? undefined : onClick,
    disabled: Tag === 'button' ? disabled : undefined,
    "aria-disabled": disabled || undefined,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      ...variants[variant],
      ...style
    }
  }, rest), children, arrow && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      opacity: 0.8
    }
  }, "\u2192"));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Panel.jsx
try { (() => {
const FG = {
  ok: 'var(--color-state-ok)',
  warn: 'var(--color-state-warn)',
  fail: 'var(--color-state-fail)',
  neutral: 'var(--color-state-neutral)'
};
const TINT = {
  ok: 'var(--color-tint-ok)',
  warn: 'var(--color-tint-warn)',
  fail: 'var(--color-tint-fail)',
  neutral: 'var(--color-tint-neutral)'
};

/**
 * Panel — a bordered surface block (sidebar, results column, card). When
 * `verdict` is set it applies the ambient state gradient + 2px top border used
 * by the results panel. Cards only when the card IS the interaction — never as
 * decoration.
 */
function Panel({
  verdict,
  title,
  header,
  children,
  style
}) {
  const ambient = verdict ? {
    background: `linear-gradient(180deg, ${TINT[verdict]} 0%, transparent 80px)`,
    borderTop: `2px solid ${FG[verdict]}`
  } : {};
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-bg-surface)',
      border: '1px solid var(--color-border-main)',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      ...ambient,
      ...style
    }
  }, (title || header) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 14px'
    }
  }, title && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--color-text-disabled)'
    }
  }, title), header), children);
}
Object.assign(__ds_scope, { Panel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Panel.jsx", error: String((e && e.message) || e) }); }

// components/core/StatusBadge.jsx
try { (() => {
const LABELS = {
  ok: 'CUMPLE',
  warn: 'ADVERT.',
  fail: 'INCUMPLE',
  neutral: '—'
};
const FG = {
  ok: 'var(--color-state-ok)',
  warn: 'var(--color-state-warn)',
  fail: 'var(--color-state-fail)',
  neutral: 'var(--color-state-neutral)'
};
const TINT = {
  ok: 'var(--color-tint-ok)',
  warn: 'var(--color-tint-warn)',
  fail: 'var(--color-tint-fail)',
  neutral: 'var(--color-tint-neutral)'
};

/**
 * StatusBadge — inline verdict pill (dot + label). Sits in a panel header, not
 * as a full-width chip. Defaults its label from the status; override with
 * `label`.
 */
function StatusBadge({
  status = 'ok',
  label,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    role: "status",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.05em',
      padding: '2px 7px',
      borderRadius: 'var(--radius)',
      color: FG[status],
      background: TINT[status],
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: 'currentColor'
    },
    "aria-hidden": "true"
  }), label ?? LABELS[status]);
}
Object.assign(__ds_scope, { StatusBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/StatusBadge.jsx", error: String((e && e.message) || e) }); }

// components/core/StatusTag.jsx
try { (() => {
const FG = {
  ok: 'var(--color-state-ok)',
  warn: 'var(--color-state-warn)',
  fail: 'var(--color-state-fail)',
  neutral: 'var(--color-state-neutral)'
};
const TINT = {
  ok: 'var(--color-tint-ok)',
  warn: 'var(--color-tint-warn)',
  fail: 'var(--color-tint-fail)',
  neutral: 'var(--color-tint-neutral)'
};

/**
 * StatusTag — the small mono utilization tag at the end of a check row (e.g.
 * "74%") or any semantic pill. Colored text on a matching 10% tint.
 */
function StatusTag({
  status = 'ok',
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-block',
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.03em',
      padding: '2px 7px',
      borderRadius: 'var(--radius)',
      textAlign: 'center',
      whiteSpace: 'nowrap',
      color: FG[status],
      background: TINT[status],
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { StatusTag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/StatusTag.jsx", error: String((e && e.message) || e) }); }

// components/data/CheckRow.jsx
try { (() => {
const BAR = {
  ok: 'var(--color-state-ok)',
  warn: 'var(--color-state-warn)',
  fail: 'var(--color-state-fail)',
  neutral: 'var(--color-state-neutral)'
};
const FG = BAR;
const TINT = {
  ok: 'var(--color-tint-ok)',
  warn: 'var(--color-tint-warn)',
  fail: 'var(--color-tint-fail)',
  neutral: 'var(--color-tint-neutral)'
};

/**
 * CheckRow — the 4-column verification row: name (+ CE article), value (+
 * limit), utilization bar, and a % / verdict tag. The house pattern for
 * showing a normative check result. Hover raises a 2px accent left rail.
 */
function CheckRow({
  name,
  article,
  value,
  limit,
  utilization = 0,
  status = 'ok'
}) {
  const finite = isFinite(utilization);
  const pct = finite ? Math.min(utilization * 100, 100) : 100;
  const tagText = finite && utilization <= 1 ? `${Math.round(utilization * 100)}%` : status === 'fail' ? 'INCUMPLE' : '—';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'grid',
      gridTemplateColumns: '1fr 140px 64px 60px',
      gap: 14,
      alignItems: 'center',
      padding: '10px 16px 10px 20px',
      borderBottom: '1px solid var(--color-border-sub)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      position: 'absolute',
      left: 0,
      top: 4,
      bottom: 4,
      width: 2,
      borderRadius: 1,
      background: 'transparent'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--color-text-primary)',
      lineHeight: 1.3,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, name), article && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      color: 'var(--color-text-disabled)'
    }
  }, article)), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: 'right',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      color: 'var(--color-text-secondary)',
      fontVariantNumeric: 'tabular-nums',
      lineHeight: 1.3
    }
  }, value), limit && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      color: 'var(--color-text-disabled)',
      fontVariantNumeric: 'tabular-nums',
      lineHeight: 1.3
    }
  }, limit)), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 4,
      background: 'var(--color-border-sub)',
      borderRadius: 2,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: `${pct}%`,
      background: BAR[status],
      borderRadius: 2,
      transition: 'width 200ms ease-in-out'
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.03em',
      padding: '2px 7px',
      borderRadius: 'var(--radius)',
      textAlign: 'center',
      whiteSpace: 'nowrap',
      color: FG[status],
      background: TINT[status]
    }
  }, tagText));
}
Object.assign(__ds_scope, { CheckRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/CheckRow.jsx", error: String((e && e.message) || e) }); }

// components/data/SectionHeader.jsx
try { (() => {
const {
  useState
} = React;
/**
 * SectionHeader — a collapsible group header for the inputs column. A chevron
 * that rotates on toggle, a 10px uppercase label, an optional normative
 * subtitle, and a border-b divider. Content mounts/unmounts (no CSS hide).
 */
function SectionHeader({
  label,
  description,
  defaultOpen = true,
  children
}) {
  const [open, setOpen] = useState(defaultOpen);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setOpen(o => !o),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      width: '100%',
      padding: '9px 0 7px',
      marginTop: 12,
      background: 'transparent',
      border: 'none',
      borderBottom: '1px solid var(--color-border-sub)',
      cursor: 'pointer',
      textAlign: 'left',
      color: 'var(--color-text-disabled)'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "10",
    height: "10",
    viewBox: "0 0 10 10",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    style: {
      transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
      transition: 'transform 150ms ease-in-out'
    },
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M2 3.5L5 6.5L8 3.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 10,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.07em'
    }
  }, label)), description && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '4px 0 0',
      fontSize: 10,
      color: 'var(--color-text-disabled)',
      lineHeight: 1.3
    }
  }, description), open && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, children));
}
Object.assign(__ds_scope, { SectionHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/SectionHeader.jsx", error: String((e && e.message) || e) }); }

// components/data/ValueRow.jsx
try { (() => {
/**
 * ValueRow — a label/value line in a results panel. `dimmed` renders a smaller,
 * paler breakdown sub-row so totals read first, breakdowns second.
 */
function ValueRow({
  label,
  value,
  dimmed = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '7px 16px',
      borderBottom: '1px solid var(--color-border-sub)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: dimmed ? 11 : 12,
      color: dimmed ? 'var(--color-text-disabled)' : 'var(--color-text-secondary)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: dimmed ? 10 : 11,
      fontVariantNumeric: 'tabular-nums',
      color: dimmed ? 'var(--color-text-disabled)' : 'var(--color-text-primary)'
    }
  }, value));
}
Object.assign(__ds_scope, { ValueRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/ValueRow.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
/**
 * Toast — a bottom-right notification card. Elevation via surface + border (the
 * system uses shadow only here). Optional inline action link, else a dismiss ✕.
 * Presentational: wire your own timing / stacking (max 3, 8px gap, 16px inset).
 */
function Toast({
  message,
  action,
  onDismiss,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "status",
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      width: 320,
      padding: '12px 16px',
      background: 'var(--color-bg-surface)',
      border: '1px solid var(--color-border-main)',
      borderRadius: 'var(--radius-md)',
      boxShadow: '0 8px 24px -12px rgba(15,23,42,0.35)',
      fontSize: 13,
      color: 'var(--color-text-primary)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, message), action ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: action.onClick,
    style: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontFamily: 'var(--font-sans)',
      fontSize: 13,
      fontWeight: 500,
      color: 'var(--color-accent)',
      flexShrink: 0
    }
  }, action.label) : /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onDismiss,
    "aria-label": "Cerrar",
    style: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: 'var(--color-text-disabled)',
      flexShrink: 0,
      fontSize: 13,
      lineHeight: 1
    }
  }, "\u2715"));
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tooltip.jsx
try { (() => {
const {
  useState
} = React;
/**
 * Tooltip — contextual field help via a stroke-only ⓘ icon (never in a colored
 * circle). Hover/focus reveals a bordered surface bubble (no shadow — elevation
 * is surface + border, like the rest of the app), with an optional mono `ce`
 * reference on a second line.
 */
function Tooltip({
  label = 'Ayuda',
  text,
  ce,
  children
}) {
  const [open, setOpen] = useState(false);
  const trigger = children ?? /*#__PURE__*/React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.75",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 16v-4M12 8h.01",
    strokeLinecap: "round"
  }));
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'inline-flex'
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": `Ayuda: ${label}`,
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false),
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false),
    style: {
      display: 'inline-flex',
      padding: 4,
      margin: -4,
      background: 'none',
      border: 'none',
      cursor: 'help',
      color: open ? 'var(--color-accent)' : 'var(--color-text-secondary)',
      transition: 'color 150ms ease-in-out'
    }
  }, trigger), open && /*#__PURE__*/React.createElement("span", {
    role: "tooltip",
    style: {
      position: 'absolute',
      bottom: 'calc(100% + 6px)',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 20,
      maxWidth: 260,
      width: 'max-content',
      padding: '6px 10px',
      background: 'var(--color-bg-surface)',
      border: '1px solid var(--color-border-main)',
      borderRadius: 'var(--radius)',
      fontSize: 12,
      lineHeight: 1.4,
      color: 'var(--color-text-primary)'
    }
  }, text, ce && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      marginTop: 2,
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      color: 'var(--color-text-disabled)'
    }
  }, ce)));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/forms/NumberField.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
/**
 * NumberField — the inline input row: label on the left, a right-aligned mono
 * value input joined to a unit suffix chip on the right. Focus turns the input
 * border accent. Optional persistent `helpText` (normative, multi-line) and
 * `error`.
 */
function NumberField({
  label,
  value,
  defaultValue,
  unit,
  helpText,
  error,
  onChange,
  ...rest
}) {
  const [focus, setFocus] = useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 13,
      color: 'var(--color-text-secondary)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'stretch'
    }
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "text",
    value: value,
    defaultValue: defaultValue,
    onChange: onChange,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      width: 60,
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      textAlign: 'right',
      padding: '3px 8px',
      background: 'var(--color-bg-primary)',
      color: 'var(--color-text-primary)',
      border: `1px solid ${error ? 'var(--color-state-fail)' : focus ? 'var(--color-accent)' : 'var(--color-border-main)'}`,
      borderRadius: unit ? 'var(--radius) 0 0 var(--radius)' : 'var(--radius)',
      outline: 'none',
      transition: 'border-color 150ms ease-in-out',
      boxSizing: 'border-box'
    }
  }, rest)), unit && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      color: 'var(--color-text-disabled)',
      padding: '0 8px',
      background: 'var(--color-bg-elevated)',
      border: '1px solid var(--color-border-main)',
      borderLeft: 'none',
      borderRadius: '0 var(--radius) var(--radius) 0'
    }
  }, unit))), helpText && !error && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '4px 0 0',
      fontSize: 10,
      color: 'var(--color-text-disabled)',
      lineHeight: 1.3,
      whiteSpace: 'pre-line'
    }
  }, helpText), error && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '4px 0 0',
      fontSize: 10,
      color: 'var(--color-state-fail)',
      lineHeight: 1.3
    }
  }, error));
}
Object.assign(__ds_scope, { NumberField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/NumberField.jsx", error: String((e && e.message) || e) }); }

// components/forms/SegmentedToggle.jsx
try { (() => {
/**
 * SegmentedToggle — the bordered 2+ option segmented control (e.g. the unit
 * system N/mm² ↔ kg/cm²). Active segment is accent text on an accent/10 tint;
 * segments split by a 1px border. Mono labels.
 */
function SegmentedToggle({
  options = [],
  value,
  onChange,
  ariaLabel
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "group",
    "aria-label": ariaLabel,
    style: {
      display: 'inline-flex',
      alignItems: 'stretch',
      border: '1px solid var(--color-border-main)',
      borderRadius: 'var(--radius)',
      overflow: 'hidden'
    }
  }, options.map((opt, i) => {
    const active = opt.value === value;
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: opt.value
    }, i > 0 && /*#__PURE__*/React.createElement("span", {
      "aria-hidden": "true",
      style: {
        width: 1,
        background: 'var(--color-border-main)'
      }
    }), /*#__PURE__*/React.createElement("button", {
      type: "button",
      "aria-pressed": active,
      onClick: () => onChange && onChange(opt.value),
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        padding: '4px 10px',
        border: 'none',
        cursor: 'pointer',
        transition: 'color 150ms ease-in-out, background 150ms ease-in-out',
        background: active ? 'var(--color-tint-accent)' : 'transparent',
        color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)'
      }
    }, opt.label));
  }));
}
Object.assign(__ds_scope, { SegmentedToggle });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/SegmentedToggle.jsx", error: String((e && e.message) || e) }); }

// components/forms/ThemeToggle.jsx
try { (() => {
const {
  useEffect,
  useState
} = React;
/**
 * ThemeToggle — the two-state sun/moon button in the topbar. Flips
 * document.documentElement[data-theme] and shows the icon of the theme you'll
 * switch TO. Light is the default; dark is the signature.
 */
function ThemeToggle({
  onChange
}) {
  const [theme, setTheme] = useState(typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  const [hover, setHover] = useState(false);
  const isDark = theme === 'dark';
  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  const toggle = () => {
    const next = isDark ? 'light' : 'dark';
    setTheme(next);
    if (onChange) onChange(next);
  };
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: toggle,
    "aria-label": `Tema ${isDark ? 'oscuro' : 'claro'}. Cambiar a tema ${isDark ? 'claro' : 'oscuro'}.`,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 6,
      borderRadius: 'var(--radius)',
      border: '1px solid var(--color-border-main)',
      background: hover ? 'var(--color-bg-elevated)' : 'transparent',
      color: hover ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
      cursor: 'pointer',
      transition: 'color 150ms ease-in-out, background 150ms ease-in-out'
    }
  }, isDark ? /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
  })) : /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"
  })));
}
Object.assign(__ds_scope, { ThemeToggle });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/ThemeToggle.jsx", error: String((e && e.message) || e) }); }

// components/icons/ModuleIcon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * ModuleIcon — the small structural icon per calculation module. 16×16
 * viewBox, stroke-only, currentColor. Differentiated by material: curved grain
 * for timber, rebar dots for RC, I-section paths for steel, coursing for
 * masonry. Single source of truth for both the app sidebar and the module grid.
 */
function ModuleIcon({
  moduleKey,
  size = 14
}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    'aria-hidden': true,
    style: {
      flexShrink: 0
    }
  };
  switch (moduleKey) {
    case 'rc-beams':
      return /*#__PURE__*/React.createElement("svg", _extends({}, common, {
        strokeWidth: "1"
      }), /*#__PURE__*/React.createElement("rect", {
        x: "2",
        y: "4",
        width: "12",
        height: "8",
        rx: "0.5"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "6",
        cy: "6.2",
        r: "0.62",
        fill: "currentColor",
        stroke: "none"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "10",
        cy: "6.2",
        r: "0.62",
        fill: "currentColor",
        stroke: "none"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "4.6",
        cy: "9.9",
        r: "0.8",
        fill: "currentColor",
        stroke: "none"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "8",
        cy: "9.9",
        r: "0.8",
        fill: "currentColor",
        stroke: "none"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "11.4",
        cy: "9.9",
        r: "0.8",
        fill: "currentColor",
        stroke: "none"
      }));
    case 'rc-columns':
      return /*#__PURE__*/React.createElement("svg", _extends({}, common, {
        strokeWidth: "1"
      }), /*#__PURE__*/React.createElement("rect", {
        x: "3.5",
        y: "3.5",
        width: "9",
        height: "9",
        rx: "0.5"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "5.7",
        cy: "5.7",
        r: "0.85",
        fill: "currentColor",
        stroke: "none"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "10.3",
        cy: "5.7",
        r: "0.85",
        fill: "currentColor",
        stroke: "none"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "5.7",
        cy: "10.3",
        r: "0.85",
        fill: "currentColor",
        stroke: "none"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "10.3",
        cy: "10.3",
        r: "0.85",
        fill: "currentColor",
        stroke: "none"
      }));
    case 'steel-beams':
      return /*#__PURE__*/React.createElement("svg", _extends({}, common, {
        strokeWidth: "1.4",
        strokeLinecap: "round"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M3 4h10M3 12h10M8 4v8"
      }));
    case 'steel-columns':
      return /*#__PURE__*/React.createElement("svg", _extends({}, common, {
        strokeWidth: "1.4",
        strokeLinecap: "round"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M4 3v10M12 3v10M4 8h8"
      }));
    case 'anchor-plate':
      return /*#__PURE__*/React.createElement("svg", _extends({}, common, {
        strokeWidth: "1"
      }), /*#__PURE__*/React.createElement("rect", {
        x: "2",
        y: "3",
        width: "12",
        height: "10",
        rx: "0.5"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "4.5",
        cy: "5.5",
        r: "0.9",
        fill: "currentColor",
        stroke: "none"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "11.5",
        cy: "5.5",
        r: "0.9",
        fill: "currentColor",
        stroke: "none"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "4.5",
        cy: "10.5",
        r: "0.9",
        fill: "currentColor",
        stroke: "none"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "11.5",
        cy: "10.5",
        r: "0.9",
        fill: "currentColor",
        stroke: "none"
      }));
    case 'timber-beams':
      return /*#__PURE__*/React.createElement("svg", _extends({}, common, {
        strokeWidth: "1",
        strokeLinecap: "round"
      }), /*#__PURE__*/React.createElement("rect", {
        x: "2",
        y: "5",
        width: "12",
        height: "6",
        rx: "0.5"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M2 7.2c2 -0.8 4 -0.8 6 0s4 0.8 6 0",
        strokeOpacity: "0.8"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M2 9.2c2 -0.8 4 -0.8 6 0s4 0.8 6 0",
        strokeOpacity: "0.5"
      }));
    case 'timber-columns':
      return /*#__PURE__*/React.createElement("svg", _extends({}, common, {
        strokeWidth: "1",
        strokeLinecap: "round"
      }), /*#__PURE__*/React.createElement("rect", {
        x: "5",
        y: "2",
        width: "6",
        height: "12",
        rx: "0.5"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M6.8 2c-0.8 2 -0.8 4 0 6s0.8 4 0 6",
        strokeOpacity: "0.8"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M9.2 2c-0.8 2 -0.8 4 0 6s0.8 4 0 6",
        strokeOpacity: "0.5"
      }));
    case 'punching':
      return /*#__PURE__*/React.createElement("svg", _extends({}, common, {
        strokeWidth: "1.25"
      }), /*#__PURE__*/React.createElement("rect", {
        x: "5",
        y: "5",
        width: "6",
        height: "6"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "8",
        cy: "8",
        r: "6",
        strokeDasharray: "2 1.5"
      }));
    case 'composite-section':
      return /*#__PURE__*/React.createElement("svg", _extends({}, common, {
        strokeWidth: "1.25"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M3 3h10v2H3zM3 11h10v2H3zM7 5v6h2V5z"
      }));
    case 'retaining-wall':
      return /*#__PURE__*/React.createElement("svg", _extends({}, common, {
        strokeWidth: "1.1",
        strokeLinejoin: "round"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M3 2.5H5.5V11H13.5V13.5H3Z"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M7 10l2.2 -2.2M7 7.4l3 -3M8.4 5.6l2.4 -2.4",
        strokeWidth: "0.75",
        strokeOpacity: "0.6"
      }));
    case 'pile-cap':
      return /*#__PURE__*/React.createElement("svg", _extends({}, common, {
        strokeWidth: "1.25"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M2 10h12M3 14l2-4M13 14l-2-4M8 2v8"
      }));
    case 'footings':
      return /*#__PURE__*/React.createElement("svg", _extends({}, common, {
        strokeWidth: "1.25"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M2 11h12M4 11V7h8v4M7 7V2h2v5"
      }));
    case 'forjados':
      return /*#__PURE__*/React.createElement("svg", _extends({}, common, {
        strokeWidth: "1"
      }), /*#__PURE__*/React.createElement("rect", {
        x: "2",
        y: "2",
        width: "12",
        height: "12"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M6 2v12M10 2v12M2 6h12M2 10h12"
      }));
    case 'fem-2d':
      return /*#__PURE__*/React.createElement("svg", _extends({}, common, {
        strokeWidth: "1",
        strokeLinecap: "round"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M3 13V4M13 13V4M3 4h10M3 13l10-9"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "3",
        cy: "4",
        r: "1.1",
        fill: "currentColor",
        stroke: "none"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "13",
        cy: "4",
        r: "1.1",
        fill: "currentColor",
        stroke: "none"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "3",
        cy: "13",
        r: "1.1",
        fill: "currentColor",
        stroke: "none"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "13",
        cy: "13",
        r: "1.1",
        fill: "currentColor",
        stroke: "none"
      }));
    case 'empresillado':
      return /*#__PURE__*/React.createElement("svg", _extends({}, common, {
        strokeWidth: "1.1",
        strokeLinecap: "round"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M4 2v12M12 2v12"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M4 4.5h8M4 8h8M4 11.5h8",
        strokeWidth: "1.4"
      }));
    case 'micropiles':
      return /*#__PURE__*/React.createElement("svg", _extends({}, common, {
        strokeWidth: "1.1",
        strokeLinecap: "round"
      }), /*#__PURE__*/React.createElement("rect", {
        x: "3.5",
        y: "2",
        width: "9",
        height: "2.5",
        rx: "0.3"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M7.3 4.5v9 M8.7 4.5v9",
        strokeWidth: "0.9"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M6 13.5h4"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M2 6.5l1.4 -1.4 M2 9l1.4 -1.4 M2 11.5l1.4 -1.4",
        strokeWidth: "0.6",
        strokeOpacity: "0.55"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M14 6.5l-1.4 -1.4 M14 9l-1.4 -1.4 M14 11.5l-1.4 -1.4",
        strokeWidth: "0.6",
        strokeOpacity: "0.55"
      }));
    case 'masonry-walls':
      return /*#__PURE__*/React.createElement("svg", _extends({}, common, {
        strokeWidth: "0.9"
      }), /*#__PURE__*/React.createElement("rect", {
        x: "2",
        y: "2",
        width: "12",
        height: "12"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M2 5h12M2 8h12M2 11h12"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M5 2v3M9 2v3M5 8v3M9 8v3M7 5v3M11 5v3M7 11v3M11 11v3"
      }), /*#__PURE__*/React.createElement("rect", {
        x: "9.5",
        y: "9",
        width: "3",
        height: "2.5",
        fill: "currentColor",
        stroke: "none",
        opacity: "0.55"
      }));
    case 'slope-stability':
      return /*#__PURE__*/React.createElement("svg", _extends({}, common, {
        strokeWidth: "1",
        strokeLinecap: "round",
        strokeLinejoin: "round"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M2 4h5l5 6h2"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M4 4a8 8 0 0 0 9 9",
        strokeWidth: "0.75",
        strokeOpacity: "0.55",
        strokeDasharray: "2 1.5"
      }));
    default:
      return /*#__PURE__*/React.createElement("span", {
        style: {
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: 'currentColor',
          flexShrink: 0,
          display: 'inline-block'
        },
        "aria-hidden": "true"
      });
  }
}
Object.assign(__ds_scope, { ModuleIcon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/icons/ModuleIcon.jsx", error: String((e && e.message) || e) }); }

// components/nav/Sidebar.jsx
try { (() => {
/**
 * Sidebar — the calculator's module navigation. Favicon I-beam mark + wordmark
 * on top, then material-grouped nav items (group label 10px caps, items 13px).
 * The active item is accent text on an accent tint with a 2px left rail; the
 * module icon brightens to full opacity. Disabled items read "pronto".
 * `showLogo` renders the I-beam header — set false when the brand lives in the
 * topbar instead (the current app layout).
 */
function Sidebar({
  groups = [],
  activeKey,
  onSelect,
  version = 'v0.1.1',
  showLogo = true,
  style
}) {
  return /*#__PURE__*/React.createElement("nav", {
    "aria-label": "Navegaci\xF3n de m\xF3dulos",
    style: {
      width: 'var(--sidebar-w)',
      flexShrink: 0,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--color-bg-surface)',
      borderRight: '1px solid var(--color-border-main)',
      ...style
    }
  }, showLogo && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '0 16px',
      height: 'var(--topbar-h)',
      borderBottom: '1px solid var(--color-border-main)'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/favicon.svg",
    alt: "",
    width: "20",
    height: "20",
    style: {
      borderRadius: 3,
      flexShrink: 0
    },
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      letterSpacing: '-0.01em',
      color: 'var(--color-text-primary)'
    }
  }, "Concreta")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '6px 0'
    }
  }, groups.map((g, gi) => /*#__PURE__*/React.createElement("div", {
    key: g.label,
    style: {
      marginTop: gi === 0 ? 0 : 12
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      padding: '2px 16px',
      fontSize: 10,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.11em',
      color: 'var(--color-text-disabled)'
    }
  }, g.label), g.items.map(it => {
    const active = it.key === activeKey;
    const disabled = it.disabled;
    return /*#__PURE__*/React.createElement("button", {
      key: it.key,
      type: "button",
      onClick: () => !disabled && onSelect && onSelect(it.key),
      "aria-current": active ? 'page' : undefined,
      style: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '5px 16px',
        border: 'none',
        textAlign: 'left',
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'color 150ms ease-in-out, background 150ms ease-in-out',
        background: active ? 'var(--color-tint-accent)' : 'transparent',
        color: disabled ? 'var(--color-text-disabled)' : active ? 'var(--color-accent)' : 'var(--color-text-secondary)'
      }
    }, active && /*#__PURE__*/React.createElement("span", {
      "aria-hidden": "true",
      style: {
        position: 'absolute',
        left: 0,
        top: 6,
        bottom: 6,
        width: 2,
        borderRadius: '0 2px 2px 0',
        background: 'var(--color-accent)'
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        opacity: active ? 1 : 0.75,
        display: 'inline-flex'
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.ModuleIcon, {
      moduleKey: it.key
    })), /*#__PURE__*/React.createElement("span", null, it.label), disabled && /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        fontSize: 10,
        color: 'var(--color-text-disabled)'
      }
    }, "pronto"));
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 16px',
      borderTop: '1px solid var(--color-border-main)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      color: 'var(--color-text-disabled)'
    }
  }, version), /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.25",
    "aria-hidden": "true",
    style: {
      color: 'var(--color-text-disabled)'
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "7",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10 10l3 3",
    strokeLinecap: "round"
  }))));
}
Object.assign(__ds_scope, { Sidebar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/nav/Sidebar.jsx", error: String((e && e.message) || e) }); }

// components/nav/Topbar.jsx
try { (() => {
/**
 * Topbar — the 48px app header. Optional `brand` block on the far left (sits
 * over the sidebar, divider on its right), then a GROUP / Module breadcrumb,
 * then a right-aligned actions slot. Same surface as the sidebar so they read
 * as one chrome.
 */
function Topbar({
  brand,
  brandWidth = 'var(--sidebar-w)',
  moduleGroup,
  moduleLabel,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      height: 'var(--topbar-h)',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      background: 'var(--color-bg-surface)',
      borderBottom: '1px solid var(--color-border-main)',
      ...style
    }
  }, brand != null && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      width: brandWidth,
      flexShrink: 0,
      height: '100%',
      padding: '0 16px',
      borderRight: '1px solid var(--color-border-main)',
      boxSizing: 'border-box'
    }
  }, brand), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      minWidth: 0,
      padding: '0 20px',
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: 'var(--color-text-disabled)',
      whiteSpace: 'nowrap'
    }
  }, moduleGroup), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--color-text-disabled)'
    }
  }, "/"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 500,
      color: 'var(--color-text-primary)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, moduleLabel)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
      padding: '0 16px'
    }
  }, children));
}
Object.assign(__ds_scope, { Topbar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/nav/Topbar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/CalculatorApp.jsx
try { (() => {
// CalculatorApp.jsx — full interactive recreation of the Concreta calculator,
// matching the real layout: brand in the topbar over the sidebar; inputs
// column; a main area with the live SVG canvas on top and a FULL-WIDTH results
// panel below it. Light-first. Composes the DS primitives. window.CalculatorApp.
const NS = window.ConcretaDesignSystem_bac861;
const {
  Sidebar,
  Topbar,
  SegmentedToggle,
  ThemeToggle,
  StatusBadge,
  StatusTag
} = NS;
const VERDICT_LABEL = {
  ok: 'CUMPLE',
  warn: 'ADVERT.',
  fail: 'INCUMPLE'
};
function InfoIcon() {
  return /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.75",
    style: {
      color: 'var(--color-text-disabled)',
      flexShrink: 0
    },
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 16v-4M12 8h.01",
    strokeLinecap: "round"
  }));
}
function Chevron() {
  return /*#__PURE__*/React.createElement("svg", {
    width: "10",
    height: "10",
    viewBox: "0 0 10 10",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.4",
    style: {
      color: 'var(--color-text-disabled)',
      flexShrink: 0
    },
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M2 3.5L5 6.5L8 3.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }));
}
function Select({
  value
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      minWidth: 104,
      padding: '4px 8px',
      background: 'var(--color-bg-primary)',
      border: '1px solid var(--color-border-main)',
      borderRadius: 'var(--radius)',
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      color: 'var(--color-text-primary)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, value), /*#__PURE__*/React.createElement(Chevron, null));
}
function InputRow({
  row
}) {
  const twoLine = row.sel && row.sym && row.l;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      padding: '5px 0',
      minHeight: 30
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      flexDirection: twoLine ? 'column' : 'row',
      alignItems: twoLine ? 'flex-start' : 'baseline',
      gap: twoLine ? 0 : 6,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 6
    }
  }, row.sym && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      color: 'var(--color-text-primary)'
    }
  }, row.sym), row.l && !twoLine && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--color-text-secondary)'
    }
  }, row.l), /*#__PURE__*/React.createElement(InfoIcon, null)), twoLine && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--color-text-disabled)',
      marginTop: 1
    }
  }, row.l)), row.sel ? /*#__PURE__*/React.createElement(Select, {
    value: row.v
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'stretch',
      gap: 6
    }
  }, row.auto && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      color: 'var(--color-accent)',
      background: 'var(--color-tint-accent)',
      border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
      borderRadius: 'var(--radius)',
      padding: '0 6px',
      display: 'inline-flex',
      alignItems: 'center'
    }
  }, "auto"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'stretch'
    }
  }, /*#__PURE__*/React.createElement("input", {
    defaultValue: row.v,
    style: {
      width: 54,
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      textAlign: 'right',
      padding: '3px 8px',
      background: 'var(--color-bg-primary)',
      color: 'var(--color-text-primary)',
      border: '1px solid var(--color-border-main)',
      borderRadius: row.u ? 'var(--radius) 0 0 var(--radius)' : 'var(--radius)',
      outline: 'none',
      boxSizing: 'border-box'
    },
    onFocus: e => e.target.style.borderColor = 'var(--color-accent)',
    onBlur: e => e.target.style.borderColor = 'var(--color-border-main)'
  }), row.u && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      color: 'var(--color-text-disabled)',
      padding: '0 7px',
      background: 'var(--color-bg-elevated)',
      border: '1px solid var(--color-border-main)',
      borderLeft: 'none',
      borderRadius: '0 var(--radius) var(--radius) 0'
    }
  }, row.u))));
}
function InputsColumn({
  mod
}) {
  const segTabs = mod.tabs || mod.supportTabs;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 268,
      flexShrink: 0,
      background: 'var(--color-bg-surface)',
      borderRight: '1px solid var(--color-border-main)',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '12px 14px'
    }
  }, segTabs && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginBottom: 12
    }
  }, segTabs.map((t, i) => /*#__PURE__*/React.createElement("button", {
    key: t,
    style: {
      flex: mod.tabs ? 1 : 'none',
      padding: '7px 10px',
      fontFamily: 'var(--font-sans)',
      fontSize: 12,
      borderRadius: 'var(--radius)',
      cursor: 'pointer',
      border: '1px solid ' + (i === 0 ? 'color-mix(in srgb, var(--color-accent) 40%, transparent)' : 'var(--color-border-main)'),
      background: i === 0 ? 'var(--color-tint-accent)' : 'transparent',
      color: i === 0 ? 'var(--color-accent)' : 'var(--color-text-secondary)'
    }
  }, t))), mod.inputs.map((sec, si) => /*#__PURE__*/React.createElement("div", {
    key: sec.s,
    style: {
      marginTop: si === 0 ? 0 : 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 8,
      padding: '9px 0 7px',
      marginTop: si === 0 ? 0 : 8,
      borderBottom: '1px solid var(--color-border-sub)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.07em',
      color: 'var(--color-text-disabled)'
    }
  }, "\u25BE ", sec.s), sec.sub && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      color: 'var(--color-text-disabled)',
      textAlign: 'right'
    }
  }, sec.sub)), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 4
    }
  }, sec.rows.map((r, i) => /*#__PURE__*/React.createElement(InputRow, {
    key: i,
    row: r
  }))))), mod.derivation && /*#__PURE__*/React.createElement("pre", {
    style: {
      marginTop: 14,
      padding: 12,
      background: 'var(--color-bg-primary)',
      border: '1px solid var(--color-border-sub)',
      borderRadius: 'var(--radius)',
      fontFamily: 'var(--font-mono)',
      fontSize: 10.5,
      lineHeight: 1.5,
      color: 'var(--color-text-secondary)',
      whiteSpace: 'pre-wrap',
      overflow: 'hidden'
    }
  }, mod.derivation)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 14px',
      borderTop: '1px solid var(--color-border-main)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--color-text-secondary)',
      cursor: 'pointer'
    }
  }, "Restablecer valores")));
}
function CanvasRegion({
  mod
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      borderBottom: '1px solid var(--color-border-main)',
      background: 'var(--color-bg-canvas)'
    }
  }, mod.viewTabs && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      padding: '8px 12px',
      borderBottom: '1px solid var(--color-border-sub)'
    }
  }, mod.viewTabs.map((t, i) => /*#__PURE__*/React.createElement("span", {
    key: t,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 10px',
      borderRadius: 'var(--radius)',
      fontSize: 12,
      background: i === 0 ? 'var(--color-tint-accent)' : 'transparent',
      color: i === 0 ? 'var(--color-accent)' : 'var(--color-text-secondary)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 15,
      height: 15,
      borderRadius: '50%',
      fontFamily: 'var(--font-mono)',
      fontSize: 9,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '1px solid currentColor'
    }
  }, i + 1), t))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: mod.viewTabs ? 44 : 12,
      right: 16,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      zIndex: 2
    }
  }, mod.indicators ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14
    }
  }, mod.indicators.map(([k, v]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 9,
      color: 'var(--color-text-disabled)',
      letterSpacing: '0.06em'
    }
  }, k), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      color: 'var(--color-text-primary)'
    }
  }, v)))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      fontWeight: 600,
      color: `var(--color-state-${mod.status})`
    }
  }, mod.capacity, "% capacidad"), /*#__PURE__*/React.createElement(StatusBadge, {
    status: mod.status,
    label: VERDICT_LABEL[mod.status]
  }))), /*#__PURE__*/React.createElement("div", {
    className: "canvas-dot-grid",
    style: {
      padding: '32px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 380
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: mod.canvas === 'micropile' ? 'min(420px,100%)' : 'min(560px, 100%)',
      aspectRatio: mod.canvas === 'micropile' ? '320 / 260' : '320 / 200'
    }
  }, /*#__PURE__*/React.createElement(window.ModuleCanvas, {
    canvas: mod.canvas
  }))), mod.caption && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      padding: '0 24px 18px',
      fontSize: 13,
      color: 'var(--color-text-secondary)',
      lineHeight: 1.5
    }
  }, mod.caption));
}
function ValueResultRow({
  name,
  desc,
  value
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 16,
      padding: '9px 20px',
      borderBottom: '1px solid var(--color-border-sub)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--color-text-secondary)'
    }
  }, name, desc && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--color-text-disabled)',
      fontSize: 12
    }
  }, " (", desc, ")")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      color: 'var(--color-text-primary)',
      fontVariantNumeric: 'tabular-nums',
      whiteSpace: 'nowrap'
    }
  }, value));
}
function CheckResultRow({
  c
}) {
  const pct = Math.round(c.util * 100);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr auto 120px 44px',
      gap: 16,
      alignItems: 'center',
      padding: '10px 20px',
      borderBottom: '1px solid var(--color-border-sub)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--color-text-secondary)'
    }
  }, c.name, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--color-text-disabled)',
      fontSize: 12
    }
  }, " (", c.desc, ")")), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: 'right',
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      fontVariantNumeric: 'tabular-nums',
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      color: 'var(--color-text-primary)'
    }
  }, c.value), c.limit && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      color: 'var(--color-text-disabled)',
      fontSize: 10
    }
  }, c.limit)), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 4,
      background: 'var(--color-border-sub)',
      borderRadius: 2,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: `${Math.min(pct, 100)}%`,
      background: `var(--color-state-${c.status})`,
      transition: 'width 200ms ease-in-out'
    }
  })), /*#__PURE__*/React.createElement(StatusTag, {
    status: c.status,
    style: {
      justifySelf: 'end'
    }
  }, pct, "%"));
}
function GroupLabel({
  children
}) {
  return /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      padding: '12px 20px 8px',
      fontSize: 10,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: 'var(--color-text-disabled)'
    }
  }, children);
}
function ResultsPanel({
  mod
}) {
  const st = mod.resultStatus || mod.status;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      border: '1px solid var(--color-border-main)',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      borderTop: `2px solid var(--color-state-${st})`,
      background: `linear-gradient(180deg, var(--color-tint-${st}) 0%, var(--color-bg-surface) 88px)`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 20px 12px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      letterSpacing: '0.08em',
      color: 'var(--color-text-disabled)'
    }
  }, mod.resultTitle), /*#__PURE__*/React.createElement(StatusBadge, {
    status: st,
    label: VERDICT_LABEL[st]
  })), /*#__PURE__*/React.createElement(GroupLabel, null, "VALORES"), mod.values.map((v, i) => /*#__PURE__*/React.createElement(ValueResultRow, {
    key: i,
    name: v[0],
    desc: v[1],
    value: v[2]
  })), mod.classRow && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(GroupLabel, null, "SECCI\xD3N"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 16,
      padding: '9px 20px',
      borderBottom: '1px solid var(--color-border-sub)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--color-text-secondary)'
    }
  }, mod.classRow[0], /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--color-text-disabled)',
      fontSize: 12
    }
  }, " (", mod.classRow[1], ")")), /*#__PURE__*/React.createElement(StatusTag, {
    status: "neutral"
  }, mod.classRow[2]))), mod.checks.map((c, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, c.grp && /*#__PURE__*/React.createElement(GroupLabel, null, c.grp), /*#__PURE__*/React.createElement(CheckResultRow, {
    c: c
  })))));
}
window.CalculatorApp = function CalculatorApp() {
  const [active, setActive] = React.useState('rc-beams');
  const [sys, setSys] = React.useState('si');
  const [toast, setToast] = React.useState(false);
  const mod = window.CONCRETA.modules[active];
  const copyLink = () => {
    setToast(true);
    setTimeout(() => setToast(false), 2000);
  };
  const brand = /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/favicon.svg",
    alt: "",
    width: "22",
    height: "22",
    style: {
      borderRadius: 4,
      flexShrink: 0
    },
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      letterSpacing: '-0.01em',
      color: 'var(--color-text-primary)'
    }
  }, "Concreta"));
  const actionBtn = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 30,
    padding: '0 10px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--color-border-main)',
    background: 'var(--color-bg-surface)',
    color: 'var(--color-text-secondary)',
    fontFamily: 'var(--font-sans)',
    fontSize: 12,
    cursor: 'pointer'
  };
  const linkBtn = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 30,
    padding: '0 8px',
    border: 'none',
    background: 'transparent',
    color: 'var(--color-text-secondary)',
    fontFamily: 'var(--font-sans)',
    fontSize: 12,
    cursor: 'pointer'
  };
  const pdfBtn = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 30,
    padding: '0 10px',
    borderRadius: 'var(--radius)',
    color: 'var(--color-accent)',
    border: '1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)',
    background: 'color-mix(in srgb, var(--color-accent) 6%, transparent)',
    fontFamily: 'var(--font-sans)',
    fontSize: 12,
    cursor: 'pointer'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--color-bg-primary)',
      color: 'var(--color-text-primary)',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement(Topbar, {
    brand: brand,
    moduleGroup: mod.bcGroup,
    moduleLabel: mod.name
  }, /*#__PURE__*/React.createElement("button", {
    style: actionBtn
  }, /*#__PURE__*/React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.3",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "1.5",
    width: "10",
    height: "13",
    rx: "1.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 4.5h6M5 7h6",
    strokeLinecap: "round"
  })), "Calculadora ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      color: 'var(--color-text-disabled)',
      border: '1px solid var(--color-border-main)',
      borderRadius: 3,
      padding: '0 4px'
    }
  }, "C")), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 1,
      height: 20,
      background: 'var(--color-border-main)',
      margin: '0 2px'
    }
  }), /*#__PURE__*/React.createElement(SegmentedToggle, {
    ariaLabel: "Sistema de unidades",
    value: sys,
    onChange: setSys,
    options: [{
      value: 'si',
      label: 'N/mm²'
    }, {
      value: 'tecnico',
      label: 'kg/cm²'
    }]
  }), /*#__PURE__*/React.createElement(ThemeToggle, null), /*#__PURE__*/React.createElement("button", {
    style: linkBtn,
    onClick: copyLink
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.25",
    strokeLinecap: "round",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M6 10a3 3 0 0 0 4 0l2-2a3 3 0 0 0-4-4l-1 1M10 6a3 3 0 0 0-4 0L4 8a3 3 0 0 0 4 4l1-1"
  })), "Copiar enlace"), /*#__PURE__*/React.createElement("button", {
    style: pdfBtn
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.25",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M4 2h5l3 3v9H4zM9 2v3h3"
  })), "Exportar PDF")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement(Sidebar, {
    showLogo: false,
    groups: window.CONCRETA.sidebarGroups,
    activeKey: active,
    onSelect: setActive
  }), /*#__PURE__*/React.createElement(InputsColumn, {
    mod: mod
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement(CanvasRegion, {
    mod: mod
  }), /*#__PURE__*/React.createElement(ResultsPanel, {
    mod: mod
  }))), toast && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      bottom: 16,
      right: 16,
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      width: 300,
      padding: '12px 16px',
      background: 'var(--color-bg-surface)',
      border: '1px solid var(--color-border-main)',
      borderRadius: 'var(--radius-md)',
      boxShadow: '0 8px 24px -12px rgba(15,23,42,0.35)',
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, "Enlace copiado"), /*#__PURE__*/React.createElement("span", {
    style: {
      cursor: 'pointer',
      color: 'var(--color-text-disabled)'
    },
    onClick: () => setToast(false)
  }, "\u2715")));
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/CalculatorApp.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Canvas.jsx
try { (() => {
// Canvas.jsx — live SVG section drawings per module. "El SVG es el
// protagonista." Uses the chart-* + text-* tokens so it themes automatically.
// Defines window.ModuleCanvas.
const AXIS = 'var(--color-chart-axis)';
const PRIMARY = 'var(--color-text-primary)';
const DIM = 'var(--color-text-disabled)';
const MONO = 'var(--font-mono)';
function CanvasRCBeam() {
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 320 220",
    style: {
      width: '100%',
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("rect", {
    x: "80",
    y: "40",
    width: "160",
    height: "140",
    stroke: PRIMARY,
    fill: "none",
    strokeWidth: "1.3"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "88",
    y: "48",
    width: "144",
    height: "124",
    rx: "3",
    stroke: DIM,
    fill: "none",
    strokeWidth: "0.9"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "98",
    cy: "60",
    r: "3.6",
    fill: PRIMARY
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "222",
    cy: "60",
    r: "3.6",
    fill: PRIMARY
  }), [98, 138, 178, 222].map(x => /*#__PURE__*/React.createElement("circle", {
    key: x,
    cx: x,
    cy: "160",
    r: "4.5",
    fill: PRIMARY
  })), /*#__PURE__*/React.createElement("line", {
    x1: "80",
    y1: "92",
    x2: "240",
    y2: "92",
    stroke: AXIS,
    strokeWidth: "1",
    strokeDasharray: "4 3"
  }), /*#__PURE__*/React.createElement("text", {
    x: "248",
    y: "95",
    fontFamily: MONO,
    fontSize: "9",
    fill: AXIS
  }, "x=164"), /*#__PURE__*/React.createElement("rect", {
    x: "80",
    y: "40",
    width: "160",
    height: "34",
    fill: AXIS,
    opacity: "0.10"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "80",
    y1: "195",
    x2: "240",
    y2: "195",
    stroke: DIM,
    strokeWidth: "0.6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "80",
    y1: "190",
    x2: "80",
    y2: "200",
    stroke: DIM,
    strokeWidth: "0.6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "240",
    y1: "190",
    x2: "240",
    y2: "200",
    stroke: DIM,
    strokeWidth: "0.6"
  }), /*#__PURE__*/React.createElement("text", {
    x: "160",
    y: "208",
    textAnchor: "middle",
    fontFamily: MONO,
    fontSize: "9",
    fill: DIM
  }, "b = 300 mm"), /*#__PURE__*/React.createElement("line", {
    x1: "60",
    y1: "40",
    x2: "60",
    y2: "180",
    stroke: DIM,
    strokeWidth: "0.6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "55",
    y1: "40",
    x2: "65",
    y2: "40",
    stroke: DIM,
    strokeWidth: "0.6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "55",
    y1: "180",
    x2: "65",
    y2: "180",
    stroke: DIM,
    strokeWidth: "0.6"
  }), /*#__PURE__*/React.createElement("text", {
    x: "46",
    y: "112",
    textAnchor: "middle",
    transform: "rotate(-90, 46, 112)",
    fontFamily: MONO,
    fontSize: "9",
    fill: DIM
  }, "h = 500 mm"));
}
function CanvasPunching() {
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 320 220",
    style: {
      width: '100%',
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("rect", {
    x: "40",
    y: "20",
    width: "240",
    height: "180",
    stroke: DIM,
    strokeDasharray: "3 3",
    fill: "none",
    strokeWidth: "0.6"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "130",
    y: "80",
    width: "60",
    height: "60",
    stroke: PRIMARY,
    fill: AXIS,
    fillOpacity: "0.06",
    strokeWidth: "1.3"
  }), /*#__PURE__*/React.createElement("text", {
    x: "160",
    y: "115",
    textAnchor: "middle",
    fontFamily: MONO,
    fontSize: "9",
    fill: PRIMARY
  }, "30\xD730"), /*#__PURE__*/React.createElement("rect", {
    x: "80",
    y: "30",
    width: "160",
    height: "160",
    rx: "45",
    stroke: AXIS,
    strokeDasharray: "5 3",
    fill: "none",
    strokeWidth: "1.2"
  }), /*#__PURE__*/React.createElement("text", {
    x: "244",
    y: "32",
    fontFamily: MONO,
    fontSize: "10",
    fill: AXIS
  }, "u1"), [100, 130, 160, 190, 220].map(x => /*#__PURE__*/React.createElement("circle", {
    key: `t${x}`,
    cx: x,
    cy: "30",
    r: "2",
    fill: DIM
  })), [100, 130, 160, 190, 220].map(x => /*#__PURE__*/React.createElement("circle", {
    key: `b${x}`,
    cx: x,
    cy: "190",
    r: "2",
    fill: DIM
  })), /*#__PURE__*/React.createElement("line", {
    x1: "160",
    y1: "110",
    x2: "80",
    y2: "30",
    stroke: AXIS,
    strokeWidth: "0.5",
    strokeDasharray: "2 2"
  }), /*#__PURE__*/React.createElement("text", {
    x: "115",
    y: "68",
    fontFamily: MONO,
    fontSize: "9",
    fill: AXIS
  }, "2d"), /*#__PURE__*/React.createElement("text", {
    x: "160",
    y: "216",
    textAnchor: "middle",
    fontFamily: MONO,
    fontSize: "9",
    fill: DIM
  }, "VEd = 420 kN"));
}
function CanvasSteelBeam() {
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 320 220",
    style: {
      width: '100%',
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("rect", {
    x: "100",
    y: "50",
    width: "120",
    height: "14",
    stroke: PRIMARY,
    fill: "none",
    strokeWidth: "1.3"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "153",
    y: "64",
    width: "14",
    height: "92",
    stroke: PRIMARY,
    fill: "none",
    strokeWidth: "1.3"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "100",
    y: "156",
    width: "120",
    height: "14",
    stroke: PRIMARY,
    fill: "none",
    strokeWidth: "1.3"
  }), /*#__PURE__*/React.createElement("text", {
    x: "160",
    y: "115",
    textAnchor: "middle",
    fontFamily: MONO,
    fontSize: "13",
    fill: PRIMARY,
    fontWeight: "600"
  }, "IPE 300"), /*#__PURE__*/React.createElement("line", {
    x1: "85",
    y1: "110",
    x2: "235",
    y2: "110",
    stroke: AXIS,
    strokeWidth: "1",
    strokeDasharray: "4 3"
  }), /*#__PURE__*/React.createElement("text", {
    x: "243",
    y: "113",
    fontFamily: MONO,
    fontSize: "9",
    fill: AXIS
  }, "y-y"), /*#__PURE__*/React.createElement("line", {
    x1: "78",
    y1: "50",
    x2: "78",
    y2: "170",
    stroke: DIM,
    strokeWidth: "0.6"
  }), /*#__PURE__*/React.createElement("text", {
    x: "64",
    y: "112",
    textAnchor: "middle",
    transform: "rotate(-90, 64, 112)",
    fontFamily: MONO,
    fontSize: "9",
    fill: DIM
  }, "h=300"), /*#__PURE__*/React.createElement("text", {
    x: "160",
    y: "200",
    textAnchor: "middle",
    fontFamily: MONO,
    fontSize: "9",
    fill: DIM
  }, "b = 150 mm"));
}
function CanvasWall() {
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 320 220",
    style: {
      width: '100%',
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("rect", {
    x: "60",
    y: "150",
    width: "200",
    height: "26",
    stroke: PRIMARY,
    fill: "none",
    strokeWidth: "1.3"
  }), /*#__PURE__*/React.createElement("polygon", {
    points: "135,30 168,30 188,150 135,150",
    stroke: PRIMARY,
    fill: "none",
    strokeWidth: "1.3"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "20",
    y1: "176",
    x2: "300",
    y2: "176",
    stroke: PRIMARY,
    strokeWidth: "1"
  }), [40, 60, 80, 100, 120, 140].map(y => /*#__PURE__*/React.createElement("line", {
    key: `g${y}`,
    x1: 188 - (150 - y) * 0.27 + 5,
    y1: y,
    x2: 278 - (150 - y) * 0.2,
    y2: y,
    stroke: DIM,
    strokeWidth: "0.4"
  })), [60, 95, 130].map(y => /*#__PURE__*/React.createElement("g", {
    key: y
  }, /*#__PURE__*/React.createElement("line", {
    x1: 195 + (y - 30) * 0.3,
    y1: y,
    x2: 175 + (y - 30) * 0.05,
    y2: y,
    stroke: AXIS,
    strokeWidth: "1"
  }), /*#__PURE__*/React.createElement("polygon", {
    points: `${175 + (y - 30) * 0.05},${y - 2.5} ${168 + (y - 30) * 0.05},${y} ${175 + (y - 30) * 0.05},${y + 2.5}`,
    fill: AXIS
  }))), /*#__PURE__*/React.createElement("text", {
    x: "245",
    y: "60",
    fontFamily: MONO,
    fontSize: "9",
    fill: AXIS
  }, "Ea"), /*#__PURE__*/React.createElement("text", {
    x: "102",
    y: "92",
    textAnchor: "middle",
    transform: "rotate(-90, 102, 92)",
    fontFamily: MONO,
    fontSize: "9",
    fill: DIM
  }, "H=3.5m"), /*#__PURE__*/React.createElement("text", {
    x: "160",
    y: "200",
    textAnchor: "middle",
    fontFamily: MONO,
    fontSize: "9",
    fill: DIM
  }, "B = 2.20 m"));
}
function CanvasTimber() {
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 320 220",
    style: {
      width: '100%',
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("rect", {
    x: "80",
    y: "40",
    width: "160",
    height: "140",
    stroke: PRIMARY,
    fill: "none",
    strokeWidth: "1.3"
  }), [55, 70, 85, 100, 115, 130, 145, 160].map((y, i) => /*#__PURE__*/React.createElement("path", {
    key: y,
    d: `M 80 ${y} Q 160 ${y - 4 + i % 2 * 8} 240 ${y}`,
    stroke: DIM,
    strokeWidth: "0.6",
    fill: "none"
  })), /*#__PURE__*/React.createElement("circle", {
    cx: "180",
    cy: "100",
    r: "5",
    stroke: DIM,
    strokeWidth: "0.6",
    fill: "none"
  }), /*#__PURE__*/React.createElement("text", {
    x: "160",
    y: "205",
    textAnchor: "middle",
    fontFamily: MONO,
    fontSize: "9",
    fill: DIM
  }, "b = 140 mm"), /*#__PURE__*/React.createElement("text", {
    x: "46",
    y: "112",
    textAnchor: "middle",
    transform: "rotate(-90, 46, 112)",
    fontFamily: MONO,
    fontSize: "9",
    fill: DIM
  }, "h = 240 mm"), /*#__PURE__*/React.createElement("rect", {
    x: "92",
    y: "50",
    width: "46",
    height: "16",
    fill: AXIS,
    fillOpacity: "0.1",
    stroke: AXIS,
    strokeWidth: "0.6"
  }), /*#__PURE__*/React.createElement("text", {
    x: "115",
    y: "61",
    textAnchor: "middle",
    fontFamily: MONO,
    fontSize: "9",
    fill: AXIS
  }, "GL24h"));
}
function CanvasMicropile() {
  const strata = [{
    y: 40,
    h: 55,
    a: 'var(--color-geo-s1a)',
    label: 'E1 · Granular'
  }, {
    y: 95,
    h: 75,
    a: 'var(--color-geo-s2a)',
    label: 'E2 · Cohesivo'
  }, {
    y: 170,
    h: 45,
    a: 'var(--color-geo-s3a)',
    label: 'E3 · Cohesivo'
  }, {
    y: 215,
    h: 35,
    a: 'var(--color-geo-s4a)',
    label: 'E4 · Granular'
  }];
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 320 260",
    style: {
      width: '100%',
      height: '100%'
    }
  }, strata.map((s, i) => /*#__PURE__*/React.createElement("rect", {
    key: i,
    x: "40",
    y: s.y,
    width: "200",
    height: s.h,
    fill: s.a
  })), /*#__PURE__*/React.createElement("line", {
    x1: "40",
    y1: "150",
    x2: "240",
    y2: "150",
    stroke: AXIS,
    strokeWidth: "1",
    strokeDasharray: "4 3"
  }), /*#__PURE__*/React.createElement("text", {
    x: "44",
    y: "147",
    fontFamily: MONO,
    fontSize: "8",
    fill: AXIS
  }, "NF z=7.5"), /*#__PURE__*/React.createElement("rect", {
    x: "120",
    y: "32",
    width: "40",
    height: "10",
    rx: "1",
    fill: "var(--color-text-secondary)"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "136",
    y: "42",
    width: "8",
    height: "188",
    fill: "var(--color-text-primary)",
    opacity: "0.85"
  }), strata.map((s, i) => /*#__PURE__*/React.createElement("g", {
    key: `t${i}`
  }, /*#__PURE__*/React.createElement("rect", {
    x: "248",
    y: s.y + 4,
    width: "66",
    height: "22",
    rx: "2",
    fill: "none",
    stroke: "var(--color-border-main)",
    strokeWidth: "0.7"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "252",
    y: s.y + 9,
    width: "6",
    height: "6",
    fill: s.a
  }), /*#__PURE__*/React.createElement("text", {
    x: "262",
    y: s.y + 14,
    fontFamily: MONO,
    fontSize: "7",
    fill: "var(--color-text-secondary)"
  }, s.label))), /*#__PURE__*/React.createElement("text", {
    x: "140",
    y: "248",
    textAnchor: "middle",
    fontFamily: MONO,
    fontSize: "8",
    fill: DIM
  }, "\xD8185 \xB7 L=16 m"));
}
const CANVAS = {
  'rc-beam': CanvasRCBeam,
  punching: CanvasPunching,
  'steel-beam': CanvasSteelBeam,
  wall: CanvasWall,
  timber: CanvasTimber,
  micropile: CanvasMicropile
};
window.ModuleCanvas = function ModuleCanvas({
  canvas
}) {
  const C = CANVAS[canvas] || CanvasRCBeam;
  return /*#__PURE__*/React.createElement(C, null);
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Canvas.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/moduleData.js
try { (() => {
// moduleData.js — module registry + demo state for the Concreta calculator UI
// kit. Shapes mirror the real app: inputs (with selects + sublabels), a live
// capacity %, a VALORES result list (each citing its CE/EC article), optional
// ELU check rows with utilization bars, and a canvas key. window.CONCRETA.
window.CONCRETA = {
  sidebarGroups: [{
    label: 'HORMIGÓN',
    items: [{
      key: 'rc-beams',
      label: 'Vigas'
    }, {
      key: 'rc-columns',
      label: 'Pilares',
      disabled: true
    }, {
      key: 'punching',
      label: 'Punzonamiento'
    }, {
      key: 'forjados',
      label: 'Forjados',
      disabled: true
    }]
  }, {
    label: 'ACERO',
    items: [{
      key: 'steel-beams',
      label: 'Vigas'
    }, {
      key: 'steel-columns',
      label: 'Pilares',
      disabled: true
    }, {
      key: 'composite-section',
      label: 'Sección compuesta',
      disabled: true
    }, {
      key: 'anchor-plate',
      label: 'Placas de anclaje',
      disabled: true
    }]
  }, {
    label: 'CIMENTACIÓN',
    items: [{
      key: 'footings',
      label: 'Zapatas',
      disabled: true
    }, {
      key: 'retaining-wall',
      label: 'Muros'
    }, {
      key: 'pile-cap',
      label: 'Encepados',
      disabled: true
    }, {
      key: 'micropiles',
      label: 'Micropilotes'
    }]
  }, {
    label: 'REHABILITACIÓN',
    items: [{
      key: 'empresillado',
      label: 'Empresillado',
      disabled: true
    }, {
      key: 'masonry-walls',
      label: 'Muros de fábrica',
      disabled: true
    }]
  }, {
    label: 'MADERA',
    items: [{
      key: 'timber-beams',
      label: 'Vigas'
    }, {
      key: 'timber-columns',
      label: 'Pilares',
      disabled: true
    }]
  }, {
    label: 'ANÁLISIS',
    items: [{
      key: 'fem-2d',
      label: 'FEM 1D',
      disabled: true
    }]
  }, {
    label: 'GEOTECNIA',
    items: [{
      key: 'slope-stability',
      label: 'Taludes',
      disabled: true
    }]
  }],
  modules: {
    'rc-beams': {
      bcGroup: 'HORMIGÓN ARMADO',
      group: 'HORMIGÓN',
      name: 'Vigas',
      tabs: ['Sección simple', 'Pórtico'],
      inputs: [{
        s: 'GEOMETRÍA',
        rows: [{
          sym: 'b',
          l: 'Ancho',
          v: '300',
          u: 'mm'
        }, {
          sym: 'h',
          l: 'Canto',
          v: '350',
          u: 'mm'
        }, {
          sym: 'r',
          l: 'Recubrimiento',
          v: '40',
          u: 'mm'
        }, {
          sym: 'L',
          l: 'luz (esbeltez L/d)',
          v: '6',
          u: 'm'
        }, {
          l: 'Sistema',
          v: 'Vano interior',
          sel: true
        }]
      }, {
        s: 'MATERIALES',
        rows: [{
          sym: 'fck',
          l: 'Característica hormigón',
          v: '25 MPa',
          sel: true
        }, {
          sym: 'fyk',
          l: 'Característica acero',
          v: '400 MPa',
          sel: true
        }]
      }, {
        s: 'USO Y EXPOSICIÓN (FISURACIÓN ELS)',
        rows: [{
          l: 'Clase exposición',
          v: 'XC1',
          sel: true
        }, {
          l: 'Categoría',
          v: 'Residencial…',
          sel: true
        }]
      }, {
        s: 'TRACCIÓN (BARRAS INF.)',
        rows: [{
          l: 'Num. barras',
          v: '2',
          u: 'ud'
        }, {
          l: 'Diámetro',
          v: 'ø 20',
          sel: true
        }]
      }, {
        s: 'COMPRESIÓN (BARRAS SUP.)',
        rows: [{
          l: 'Num. barras',
          v: '2',
          u: 'ud'
        }, {
          l: 'Diámetro',
          v: 'ø 20',
          sel: true
        }]
      }, {
        s: 'ARMADURA TRANSVERSAL',
        rows: [{
          sym: 'Ø',
          l: 'Ø cerco',
          v: 'ø 8',
          sel: true
        }, {
          sym: 's',
          l: 'Separación',
          v: '150',
          u: 'mm'
        }]
      }],
      capacity: 25,
      status: 'warn',
      caption: 'Sección NO fisurada. Md < Mcrit: el hormigón sigue trabajando elásticamente, fibra neutra al centroide bruto (h/2).',
      resultTitle: 'VANO',
      resultStatus: 'warn',
      values: [['d (canto útil)', '', '292 mm'], ['As — Tracción', 'CE art. 42.3.2', '628 mm²'], ['As,c — Compresión', 'CE art. 42.3.3', '628 mm²'], ['x (eje neutro)', '', '59 mm'], ['MRd — Resistente sección', 'CE art. 42.1.2', '58.71 kNm'], ['VRd,c — Sin armadura', 'CE art. 44.2.3.2.1', '153.26 kN'], ['wk — Abertura fisura', 'CE art. 49.2.4 eq. 49.2.3.b', '0.394 mm']],
      checks: [],
      canvas: 'rc-beam'
    },
    'steel-beams': {
      bcGroup: 'ACERO',
      group: 'ACERO',
      name: 'Vigas',
      supportTabs: ['Biart.', 'Ménsula', 'Art-Emp.', 'Biempotr.'],
      inputs: [{
        s: 'PERFIL',
        rows: [{
          sym: 'Tipo',
          l: '',
          v: 'IPE',
          sel: true
        }, {
          sym: 'Tamaño',
          l: '',
          v: 'IPE 300',
          sel: true
        }, {
          sym: 'Acero',
          l: '',
          v: 'S275',
          sel: true
        }, {
          sym: 'L',
          l: 'Luz',
          v: '6',
          u: 'm'
        }]
      }, {
        s: 'CARGAS',
        rows: [{
          sym: 'b',
          l: 'Ancho tributario',
          v: '3',
          u: 'm'
        }, {
          sym: 'g',
          l: 'Permanente adicional',
          v: '1.00',
          u: 'kN/m²'
        }, {
          sym: 'q',
          l: 'Sobrecarga de uso',
          v: '2.00',
          u: 'kN/m²'
        }, {
          l: 'Categoría',
          v: 'A1 Residencial',
          sel: true
        }]
      }, {
        s: 'PANDEO LATERAL (LTB)',
        rows: [{
          sym: 'Lcr',
          l: 'Longitud pandeo',
          v: '6',
          u: 'm',
          auto: true
        }]
      }, {
        s: 'FLECHA ELS',
        rows: [{
          l: 'Combinación E…',
          v: 'Característica',
          sel: true
        }]
      }],
      derivation: 'DERIVACIÓN ELU (CTE DB-SE)\nGk = 1.0 × 3.0 = 3.0 kN/m\nQk = 2.0 × 3.0 = 6.0 kN/m\nwEd = 1.35×3.0 + 1.50×6.0 = 13.1\nkN/m [γG=1.35, γQ=1.50]\n\nMEd = wEd·L²/8 = 58.7 kNm\nVEd = wEd·L/2 = 39.2 kN',
      capacity: 36,
      status: 'ok',
      resultTitle: 'RESULTADOS CALCULADOS',
      resultStatus: 'ok',
      values: [['Mc,Rd — Resistente sección', 'EC3 §6.2.5 eq. 6.12-6.14', '164.48 kNm'], ['Vc,Rd — Resistente sección', 'EC3 §6.2.6 eq. 6.17-6.18', '388.15 kN'], ['Mb,Rd — Resistente vuelco', 'EC3 §6.3.2.1 eq. 6.54', '71.74 kNm'], ['χLT — Reducción vuelco', 'EC3 §6.3.2.2 eq. 6.56', '0.436'], ['λLT — Esbeltez vuelco', 'EC3 §6.3.2.2 eq. 6.56', '1.479'], ['δmax — Flecha máxima', 'CE art. 50 / EC3 §7.2.1', '8.7 mm'], ['δadm — admisible (L/300)', '', '20.0 mm']],
      classRow: ['Clasificación sección', 'CTE DB-SE-A §5.5', 'CLASE 1'],
      checks: [{
        grp: 'ELU FLEXIÓN',
        name: 'Flexión Mc,Rd',
        desc: 'CTE DB-SE-A §6.2.5',
        value: '58.73 kNm',
        limit: '164.48 kNm',
        util: 0.36,
        status: 'ok'
      }, {
        grp: 'ELU CORTANTE',
        name: 'Cortante Vc,Rd',
        desc: 'CTE DB-SE-A §6.2.6',
        value: '39.24 kN',
        limit: '388.15 kN',
        util: 0.10,
        status: 'ok'
      }, {
        grp: 'ELU PANDEO LATERAL',
        name: 'Vuelco Mb,Rd',
        desc: 'CTE DB-SE-A §6.3.2',
        value: '58.73 kNm',
        limit: '71.74 kNm',
        util: 0.82,
        status: 'warn'
      }],
      canvas: 'steel-beam'
    },
    'punching': {
      bcGroup: 'HORMIGÓN ARMADO',
      group: 'HORMIGÓN',
      name: 'Punzonamiento',
      inputs: [{
        s: 'PILAR',
        rows: [{
          sym: 'a',
          l: 'Lado',
          v: '300',
          u: 'mm'
        }, {
          sym: 'b',
          l: 'Lado',
          v: '300',
          u: 'mm'
        }, {
          l: 'Posición',
          v: 'Interior',
          sel: true
        }]
      }, {
        s: 'PLACA',
        rows: [{
          sym: 'h',
          l: 'Canto',
          v: '220',
          u: 'mm'
        }, {
          sym: 'd',
          l: 'Canto útil',
          v: '180',
          u: 'mm'
        }]
      }, {
        s: 'ESFUERZO',
        rows: [{
          sym: 'VEd',
          l: 'Axil de cálculo',
          v: '420',
          u: 'kN'
        }, {
          sym: 'β',
          l: 'Excentricidad',
          v: '1.15'
        }]
      }, {
        s: 'MATERIALES',
        rows: [{
          sym: 'fck',
          l: 'Hormigón',
          v: '30 MPa',
          sel: true
        }, {
          sym: 'fywd',
          l: 'Acero cercos',
          v: '434 MPa',
          sel: true
        }]
      }],
      capacity: 92,
      status: 'warn',
      caption: 'u1 a 2d del borde del pilar. Requiere armadura de punzonamiento (cercos a 0.75d).',
      resultTitle: 'RESULTADOS CALCULADOS',
      resultStatus: 'warn',
      values: [['u1 — Perímetro crítico', 'CE art. 45', '2434 mm'], ['vEd — Tensión tangencial', '', '0.82 MPa'], ['vRd,c — Sin armadura', 'CE art. 45', '0.61 MPa'], ['uout — Perímetro exterior', '', '3180 mm']],
      checks: [{
        grp: 'ELU PUNZONAMIENTO',
        name: 'v · borde pilar',
        desc: 'vRd,max',
        value: '0.68',
        limit: '≤ 1.00',
        util: 0.68,
        status: 'ok'
      }, {
        grp: null,
        name: 'v · u1 a 2d',
        desc: 'vRd,c',
        value: '0.92',
        limit: '≤ 1.00',
        util: 0.92,
        status: 'warn'
      }, {
        grp: null,
        name: 'Cercos a 0.75d',
        desc: 'vRd,cs',
        value: '0.86',
        limit: '≤ 1.00',
        util: 0.86,
        status: 'warn'
      }],
      canvas: 'punching'
    },
    'retaining-wall': {
      bcGroup: 'CIMENTACIÓN',
      group: 'CIMENTACIÓN',
      name: 'Muros de contención',
      inputs: [{
        s: 'GEOMETRÍA',
        rows: [{
          sym: 'H',
          l: 'Altura',
          v: '3.50',
          u: 'm'
        }, {
          sym: 'B',
          l: 'Ancho zapata',
          v: '2.20',
          u: 'm'
        }, {
          sym: 'e',
          l: 'Espesor fuste',
          v: '0.30',
          u: 'm'
        }]
      }, {
        s: 'ZAPATA',
        rows: [{
          sym: 't',
          l: 'Canto',
          v: '0.40',
          u: 'm'
        }, {
          l: 'Puntera',
          v: '0.80',
          u: 'm'
        }]
      }, {
        s: 'TERRENO',
        rows: [{
          sym: 'φ',
          l: 'Rozamiento',
          v: '30',
          u: '°'
        }, {
          sym: 'γ',
          l: 'Densidad',
          v: '18',
          u: 'kN/m³'
        }, {
          sym: 'σadm',
          l: 'Tensión adm.',
          v: '200',
          u: 'kPa'
        }]
      }, {
        s: 'MATERIALES',
        rows: [{
          sym: 'fck',
          l: 'Hormigón',
          v: '30 MPa',
          sel: true
        }]
      }],
      capacity: 78,
      status: 'ok',
      caption: 'Empuje activo de Rankine sobre el trasdós. Verificación de estabilidad global y resistencia del fuste.',
      resultTitle: 'RESULTADOS CALCULADOS',
      resultStatus: 'ok',
      values: [['Ea — Empuje activo', 'DB-SE-C §6', '38.6 kN/m'], ['FS vuelco', '', '3.21'], ['FS deslizamiento', '', '1.92'], ['σmax — Tensión máx.', '', '128 kPa']],
      checks: [{
        grp: 'ESTABILIDAD',
        name: 'Vuelco',
        desc: 'Mest/Mvol',
        value: '0.56',
        limit: '≥ 1.80',
        util: 0.56,
        status: 'ok'
      }, {
        grp: null,
        name: 'Deslizamiento',
        desc: 'Fres/Hd',
        value: '0.78',
        limit: '≥ 1.50',
        util: 0.78,
        status: 'ok'
      }, {
        grp: null,
        name: 'σ suelo máx.',
        desc: 'σmax/σadm',
        value: '0.64',
        limit: '≤ 1.00',
        util: 0.64,
        status: 'ok'
      }],
      canvas: 'wall'
    },
    'micropiles': {
      bcGroup: 'CIMENTACIÓN',
      group: 'CIMENTACIÓN',
      name: 'Micropilotes',
      viewTabs: ['Perfil', 'Rfc curva', 'Sección tope'],
      indicators: [['IH', '0.68'], ['IC', '0.51'], ['IM', '0.00'], ['IV', '0.00']],
      inputs: [{
        s: 'GEOMETRÍA DEL MICROPILOTE',
        sub: 'Guía Fomento cap. 3.2',
        rows: [{
          sym: 'z',
          l: 'cabeza bajo rasante',
          v: '1',
          u: 'm'
        }, {
          sym: 'z',
          l: 'apoyo bajo rasante',
          v: '17',
          u: 'm'
        }, {
          sym: 'Dn',
          l: 'Ø perforación',
          v: '185',
          u: 'mm'
        }, {
          sym: 'z',
          l: 'NF nivel freático',
          v: '7.5',
          u: 'm'
        }, {
          sym: 'p,inj',
          l: 'presión',
          v: '300',
          u: 'kPa'
        }]
      }, {
        s: 'CARGA Y MODO',
        sub: 'Guía Fomento cap. 3.3',
        rows: [{
          sym: 'Nc,d',
          l: 'por pilote',
          v: '350.00',
          u: 'kN'
        }, {
          l: 'Esfuerzo',
          v: 'Compresión',
          sel: true
        }, {
          l: 'Método',
          v: 'Teórico',
          sel: true
        }]
      }],
      capacity: 68,
      status: 'ok',
      caption: 'Micropilote Ø185 mm · L = 16,00 m bajo encepado. Perfil de estratos editable.',
      resultTitle: 'RESULTADOS CALCULADOS',
      resultStatus: 'ok',
      values: [['L (longitud bajo encepado)', '', '16,00 m'], ['Discretización', '', '50 × 0,32 m'], ['Dn (perforación)', '', '185 mm'], ['Rfc — Rozamiento acumulado', 'Guía Fomento Tabla 3.5', '514 kN'], ['Nc,Rd — Tope estructural', 'EC3 §6.2', '689 kN']],
      checks: [{
        grp: 'COMPROBACIONES',
        name: 'Hundimiento fuste',
        desc: 'IH · Guía Fomento',
        value: '0.68',
        limit: '≤ 1.00',
        util: 0.68,
        status: 'ok'
      }, {
        grp: null,
        name: 'Tope estructural',
        desc: 'IC · EC3 §6.2',
        value: '0.51',
        limit: '≤ 1.00',
        util: 0.51,
        status: 'ok'
      }],
      canvas: 'micropile'
    },
    'timber-beams': {
      bcGroup: 'MADERA',
      group: 'MADERA',
      name: 'Vigas',
      inputs: [{
        s: 'SECCIÓN',
        rows: [{
          sym: 'b',
          l: 'Ancho',
          v: '140',
          u: 'mm'
        }, {
          sym: 'h',
          l: 'Canto',
          v: '240',
          u: 'mm'
        }]
      }, {
        s: 'CLASE',
        rows: [{
          l: 'Material',
          v: 'GL24h',
          sel: true
        }, {
          l: 'Clase servicio',
          v: '1',
          sel: true
        }]
      }, {
        s: 'LUZ',
        rows: [{
          sym: 'L',
          l: 'Luz',
          v: '4.50',
          u: 'm'
        }, {
          sym: 'kmod',
          l: 'Modificación',
          v: '0.80'
        }]
      }, {
        s: 'ACCIONES',
        rows: [{
          sym: 'g',
          l: 'Permanente',
          v: '1.8',
          u: 'kN/m'
        }, {
          sym: 'q',
          l: 'Sobrecarga',
          v: '2.5',
          u: 'kN/m'
        }]
      }],
      capacity: 81,
      status: 'warn',
      caption: 'Madera laminada encolada GL24h, clase de servicio 1. Verificación EC5 con flecha diferida.',
      resultTitle: 'RESULTADOS CALCULADOS',
      resultStatus: 'warn',
      values: [['Wy — Módulo resistente', '', '1344 cm³'], ['fm,d — Resistencia flexión', 'EC5 §2.4.1', '13.1 N/mm²'], ['wfin — Flecha final', 'EC5 §7.2', '11.3 mm']],
      checks: [{
        grp: 'ELU',
        name: 'Flexión',
        desc: 'fm,d · EC5 §6.1.6',
        value: '0.62',
        limit: '≤ 1.00',
        util: 0.62,
        status: 'ok'
      }, {
        grp: null,
        name: 'Pandeo lateral',
        desc: 'kcrit · §6.3.3',
        value: '0.74',
        limit: '≤ 1.00',
        util: 0.74,
        status: 'ok'
      }, {
        grp: 'ELS',
        name: 'Flecha final',
        desc: 'wfin ≤ L/200',
        value: '0.81',
        limit: '≤ 1.00',
        util: 0.81,
        status: 'warn'
      }],
      canvas: 'timber'
    }
  }
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/moduleData.js", error: String((e && e.message) || e) }); }

// ui_kits/marketing/Landing.jsx
try { (() => {
// Landing.jsx — Concreta marketing landing, composed from DS primitives
// (Button, ModuleIcon, ThemeToggle) + the hero LandingPreview. window.Landing.
const LNS = window.ConcretaDesignSystem_bac861;
const {
  Button,
  ModuleIcon,
  ThemeToggle
} = LNS;
const NAV = ['Módulos', 'Filosofía', 'Normativa', 'Precio', 'Blog'];
const MODULE_CARDS = [{
  key: 'rc-beams',
  name: 'Vigas',
  group: 'Hormigón',
  desc: 'Flexión, cortante, fisuración (ELS), armado mín/máx.'
}, {
  key: 'rc-columns',
  name: 'Pilares',
  group: 'Hormigón',
  desc: 'Flexocompresión, pandeo, cuantías geométricas.'
}, {
  key: 'punching',
  name: 'Punzonamiento',
  group: 'Hormigón',
  desc: 'Comprobación CE para placas y forjados sobre soporte.'
}, {
  key: 'steel-beams',
  name: 'Vigas',
  group: 'Acero',
  desc: 'Flexión, M-V, pandeo lateral (LTB), flecha, clase de sección.'
}, {
  key: 'steel-columns',
  name: 'Pilares',
  group: 'Acero',
  desc: 'Pandeo por eje, compresión, esbeltez. I/H, tubulares, CHS.'
}, {
  key: 'anchor-plate',
  name: 'Placas de anclaje',
  group: 'Acero',
  desc: 'Placa, pernos embebidos, cono, splitting, pry-out.'
}, {
  key: 'footings',
  name: 'Zapatas',
  group: 'Cimentación',
  desc: 'Tensiones, vuelco, deslizamiento, punzonamiento, armado.'
}, {
  key: 'retaining-wall',
  name: 'Muros de contención',
  group: 'Cimentación',
  desc: 'Empuje de tierras, vuelco, deslizamiento, flexión del fuste.'
}, {
  key: 'micropiles',
  name: 'Micropilotes',
  group: 'Cimentación',
  desc: 'Guía Fomento 2005 + EC3 §6.2. Catálogo PIRESA o tubo.'
}, {
  key: 'empresillado',
  name: 'Empresillado',
  group: 'Rehabilitación',
  desc: 'Pilares compuestos batidos según EC3 §6.4.2.'
}, {
  key: 'masonry-walls',
  name: 'Muros de fábrica',
  group: 'Rehabilitación',
  desc: 'Muros de carga multi-planta (CTE DB-SE-F), huecos, machones.'
}, {
  key: 'timber-beams',
  name: 'Vigas y pilares',
  group: 'Madera',
  desc: 'Clases europeas, EC5, resistencia al fuego R30–R120.'
}];
const PRINCIPLES = [['01', 'Velocidad antes que complejidad', 'Resuelve bien los casos comunes del día a día, no el 1% exótico.'], ['02', 'Claridad antes que densidad', 'Explica sin abrumar. Cada resultado se lee de un vistazo.'], ['03', 'Visual antes que textual', 'Diagramas, esquemas y SVG en vivo — el cálculo se ve.'], ['04', 'Rigor sin opacidad', 'Cada comprobación cita el artículo normativo que la respalda.'], ['05', 'Sin backend, sin cuentas', 'PWA local. Los enlaces son estado serializado en la URL.']];
function Nav() {
  return /*#__PURE__*/React.createElement("header", {
    className: "nav"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container nav-inner"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "brand"
  }, /*#__PURE__*/React.createElement("span", {
    className: "brand-dot"
  }), /*#__PURE__*/React.createElement("span", null, "Concreta")), /*#__PURE__*/React.createElement("nav", {
    className: "nav-links"
  }, NAV.map(l => /*#__PURE__*/React.createElement("a", {
    key: l,
    href: "#"
  }, l))), /*#__PURE__*/React.createElement("div", {
    className: "nav-right"
  }, /*#__PURE__*/React.createElement(ThemeToggle, null), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost"
  }, "Acceder"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    arrow: true
  }, "Suscribirse"))));
}
function Hero() {
  const keys = window.LP_MODULE_KEYS;
  const [idx, setIdx] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  React.useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIdx(i => (i + 1) % keys.length), 4200);
    return () => clearInterval(t);
  }, [paused]);
  const cur = keys[idx];
  const cfg = window.LP_MODULES[cur];
  return /*#__PURE__*/React.createElement("section", {
    className: "hero"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container hero-split"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero-copy"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow-dot"
  }), /*#__PURE__*/React.createElement("span", null, "C\xC1LCULO ESTRUCTURAL \xB7 CE \xB7 CTE \xB7 EUROC\xD3DIGOS")), /*#__PURE__*/React.createElement("h1", {
    className: "hero-title"
  }, "El c\xE1lculo estructural que no te frena."), /*#__PURE__*/React.createElement("p", {
    className: "hero-sub"
  }, "La herramienta pensada por arquitectos e ingenieros calculistas espa\xF1oles: comprobaciones normativas r\xE1pidas, trazables y defendibles ante visado y obra."), /*#__PURE__*/React.createElement("div", {
    className: "hero-cta"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    arrow: true
  }, "Suscribirse"), /*#__PURE__*/React.createElement(Button, {
    size: "lg"
  }, "Ver m\xF3dulos")), /*#__PURE__*/React.createElement("div", {
    className: "carousel",
    onMouseEnter: () => setPaused(true),
    onMouseLeave: () => setPaused(false)
  }, keys.map((k, i) => /*#__PURE__*/React.createElement("button", {
    key: k,
    className: 'ctab' + (i === idx ? ' on' : ''),
    onClick: () => {
      setIdx(i);
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "cnum"
  }, String(i + 1).padStart(2, '0')), /*#__PURE__*/React.createElement("span", {
    className: "cname"
  }, window.LP_MODULES[k].name), /*#__PURE__*/React.createElement("span", {
    className: "cgrp"
  }, window.LP_MODULES[k].group)))), /*#__PURE__*/React.createElement("div", {
    className: "meta"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mi"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mv"
  }, "12+"), /*#__PURE__*/React.createElement("div", {
    className: "ml"
  }, "m\xF3dulos")), /*#__PURE__*/React.createElement("div", {
    className: "mi"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mv"
  }, "PDF"), /*#__PURE__*/React.createElement("div", {
    className: "ml"
  }, "vectorial en 5 s")), /*#__PURE__*/React.createElement("div", {
    className: "mi"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mv"
  }, "PWA"), /*#__PURE__*/React.createElement("div", {
    className: "ml"
  }, "offline \xB7 sin login")), /*#__PURE__*/React.createElement("div", {
    className: "mi"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mv"
  }, "CE\xB7CTE"), /*#__PURE__*/React.createElement("div", {
    className: "ml"
  }, "art. en cada check")))), /*#__PURE__*/React.createElement("div", {
    className: "hero-preview",
    onMouseEnter: () => setPaused(true),
    onMouseLeave: () => setPaused(false)
  }, /*#__PURE__*/React.createElement("div", {
    className: "frame",
    key: cur
  }, /*#__PURE__*/React.createElement(window.LandingPreview, {
    moduleId: cur
  })), /*#__PURE__*/React.createElement("div", {
    className: "caption"
  }, /*#__PURE__*/React.createElement("span", null, cfg.group.toLowerCase(), " / ", cfg.name.toLowerCase()), /*#__PURE__*/React.createElement("span", {
    className: "dim"
  }, idx + 1, " / ", keys.length)))));
}
function Modules() {
  return /*#__PURE__*/React.createElement("section", {
    className: "sec",
    id: "modulos"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sec-eyebrow"
  }, "M\xD3DULOS"), /*#__PURE__*/React.createElement("h2", null, "Todo el c\xE1lculo recurrente, en una mesa.")), /*#__PURE__*/React.createElement("div", {
    className: "mod-grid"
  }, MODULE_CARDS.map(m => /*#__PURE__*/React.createElement("div", {
    className: "mod-card",
    key: m.group + m.name
  }, /*#__PURE__*/React.createElement("div", {
    className: "mod-icon"
  }, /*#__PURE__*/React.createElement(ModuleIcon, {
    moduleKey: m.key,
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    className: "mod-grp"
  }, m.group), /*#__PURE__*/React.createElement("div", {
    className: "mod-name"
  }, m.name), /*#__PURE__*/React.createElement("p", {
    className: "mod-desc"
  }, m.desc))))));
}
function Philosophy() {
  return /*#__PURE__*/React.createElement("section", {
    className: "sec alt",
    id: "filosofia"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sec-eyebrow"
  }, "FILOSOF\xCDA"), /*#__PURE__*/React.createElement("h2", null, "Una herramienta de mesa, no un CYPE.")), /*#__PURE__*/React.createElement("div", {
    className: "phil-grid"
  }, PRINCIPLES.map(([n, t, d]) => /*#__PURE__*/React.createElement("div", {
    className: "phil",
    key: n
  }, /*#__PURE__*/React.createElement("span", {
    className: "phil-n"
  }, n), /*#__PURE__*/React.createElement("h3", null, t), /*#__PURE__*/React.createElement("p", null, d))))));
}
function Pricing() {
  return /*#__PURE__*/React.createElement("section", {
    className: "sec",
    id: "precio"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sec-eyebrow"
  }, "PRECIO"), /*#__PURE__*/React.createElement("h2", null, "Una suscripci\xF3n. Todos los m\xF3dulos.")), /*#__PURE__*/React.createElement("div", {
    className: "price-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "price-top"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "price-name"
  }, "Concreta Pro"), /*#__PURE__*/React.createElement("div", {
    className: "price-sub"
  }, "Para el estudio que calcula cada d\xEDa.")), /*#__PURE__*/React.createElement("div", {
    className: "price-amt"
  }, /*#__PURE__*/React.createElement("span", {
    className: "price-num"
  }, "19 \u20AC"), /*#__PURE__*/React.createElement("span", {
    className: "price-per"
  }, "/ mes"))), /*#__PURE__*/React.createElement("ul", {
    className: "price-list"
  }, /*#__PURE__*/React.createElement("li", null, "Los 12+ m\xF3dulos, actualizados con la norma"), /*#__PURE__*/React.createElement("li", null, "Exportaci\xF3n PDF vectorial ilimitada"), /*#__PURE__*/React.createElement("li", null, "Enlaces compartibles y PWA offline"), /*#__PURE__*/React.createElement("li", null, "Sin cuentas obligatorias, sin backend")), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    arrow: true
  }, "Suscribirse"))));
}
function Footer() {
  return /*#__PURE__*/React.createElement("footer", {
    className: "footer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container footer-inner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "footer-brand"
  }, /*#__PURE__*/React.createElement("span", {
    className: "brand-dot"
  }), /*#__PURE__*/React.createElement("span", null, "Concreta")), /*#__PURE__*/React.createElement("div", {
    className: "footer-links"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "Normativa"), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "Blog"), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "About"), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "Licencia")), /*#__PURE__*/React.createElement("div", {
    className: "footer-social"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    "aria-label": "GitHub"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16"
  }, /*#__PURE__*/React.createElement("use", {
    href: "../../assets/social-icons.svg#github-icon"
  }))), /*#__PURE__*/React.createElement("a", {
    href: "#",
    "aria-label": "X"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16"
  }, /*#__PURE__*/React.createElement("use", {
    href: "../../assets/social-icons.svg#x-icon"
  }))), /*#__PURE__*/React.createElement("a", {
    href: "#",
    "aria-label": "Bluesky"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16"
  }, /*#__PURE__*/React.createElement("use", {
    href: "../../assets/social-icons.svg#bluesky-icon"
  }))))), /*#__PURE__*/React.createElement("div", {
    className: "container footer-legal"
  }, "\xA9 2026 Javier Ram\xEDrez Bandera \xB7 PolyForm Noncommercial 1.0.0"));
}
window.Landing = function Landing() {
  return /*#__PURE__*/React.createElement("div", {
    className: "landing-root"
  }, /*#__PURE__*/React.createElement(Nav, null), /*#__PURE__*/React.createElement(Hero, null), /*#__PURE__*/React.createElement(Modules, null), /*#__PURE__*/React.createElement(Philosophy, null), /*#__PURE__*/React.createElement(Pricing, null), /*#__PURE__*/React.createElement(Footer, null));
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing/Landing.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketing/LandingPreview.jsx
try { (() => {
// LandingPreview.jsx — the mini Concreta app replica shown in the hero frame.
// Faithful to the app's three-column workbench at 520px height. Reuses
// window.ModuleCanvas (from ../app/Canvas.jsx) for the SVG. Defines
// window.LandingPreview.
const LP_MODULES = {
  'rc-beams': {
    group: 'HORMIGÓN',
    name: 'Vigas',
    highlight: 'Vigas',
    inputs: [{
      s: 'GEOMETRÍA',
      r: [['b', '300', 'mm'], ['h', '500', 'mm'], ["d'", '40', 'mm']]
    }, {
      s: 'ARMADURA',
      r: [['nº barras', '4', ''], ['Ø', '20', 'mm']]
    }, {
      s: 'MATERIALES',
      r: [['fck', '25', 'MPa'], ['fyk', '500', 'MPa']]
    }],
    checks: [['Flexión', 'Md/MRd', 74, 'ok'], ['Cortante', 'Vd/VRd', 52, 'ok'], ['Fisuración', 'wk', 31, 'ok'], ['Cuantía mín.', 'ρ', 24, 'ok'], ['Anclaje', 'lb,rqd', 67, 'ok']],
    norm: 'CE art.42 · γc=1.5',
    canvas: 'rc-beam'
  },
  'steel-beams': {
    group: 'ACERO',
    name: 'Vigas',
    highlight: 'Vigas',
    sidebarGroup: 'ACERO',
    inputs: [{
      s: 'PERFIL',
      r: [['familia', 'IPE', ''], ['perfil', 'IPE 300', ''], ['S', '275', 'MPa']]
    }, {
      s: 'LUZ',
      r: [['L', '6.00', 'm'], ['apoyo', 'biart.', '']]
    }, {
      s: 'ACCIONES',
      r: [['g', '5.2', 'kN/m'], ['q', '3.5', 'kN/m']]
    }],
    checks: [['Flexión', 'Mc,Rd', 63, 'ok'], ['Cortante', 'Vc,Rd', 38, 'ok'], ['M-V', 'interact.', 41, 'ok'], ['LTB', 'Mb,Rd', 88, 'warn'], ['Flecha', 'L/300', 71, 'ok']],
    norm: 'DB-SE-A §6.2 · γM0=1.05',
    canvas: 'steel-beam'
  },
  'retaining-wall': {
    group: 'CIMENTACIÓN',
    name: 'Muros',
    highlight: 'Muros',
    sidebarGroup: 'CIMENTACIÓN',
    inputs: [{
      s: 'GEOMETRÍA',
      r: [['H', '3.50', 'm'], ['B', '2.20', 'm'], ['e', '0.30', 'm']]
    }, {
      s: 'TERRENO',
      r: [['φ', '30', '°'], ['γ', '18', 'kN/m³'], ['σadm', '200', 'kPa']]
    }],
    checks: [['Vuelco', 'Mest/Mvol', 56, 'ok'], ['Deslizam.', 'Fres/Hd', 78, 'ok'], ['σ suelo máx', 'σmax/σadm', 64, 'ok'], ['Flexión fuste', 'Md/MRd', 61, 'ok']],
    norm: 'DB-SE-C §6 · γR=1.5',
    canvas: 'wall'
  },
  'timber-beams': {
    group: 'MADERA',
    name: 'Vigas',
    highlight: 'Vigas',
    sidebarGroup: 'MADERA',
    inputs: [{
      s: 'SECCIÓN',
      r: [['b', '140', 'mm'], ['h', '240', 'mm']]
    }, {
      s: 'CLASE',
      r: [['material', 'GL24h', ''], ['kmod', '0.80', '']]
    }, {
      s: 'ACCIONES',
      r: [['g', '1.8', 'kN/m'], ['q', '2.5', 'kN/m']]
    }],
    checks: [['Flexión', 'fm,d', 62, 'ok'], ['Cortante', 'fv,d', 35, 'ok'], ['LTB', 'kcrit', 74, 'ok'], ['Flecha final', 'L/200', 81, 'warn']],
    norm: 'EC5 · clase servicio 1',
    canvas: 'timber'
  },
  'punching': {
    group: 'HORMIGÓN',
    name: 'Punzonamiento',
    highlight: 'Punzonamiento',
    inputs: [{
      s: 'PILAR',
      r: [['a', '300', 'mm'], ['b', '300', 'mm']]
    }, {
      s: 'PLACA',
      r: [['h', '220', 'mm'], ['d', '180', 'mm']]
    }, {
      s: 'ESFUERZO',
      r: [['VEd', '420', 'kN'], ['β', '1.15', '']]
    }],
    checks: [['v · borde', 'vRd,max', 68, 'ok'], ['v · u1 a 2d', 'vRd,c', 92, 'warn'], ['Cercos 0.75d', 'vRd,cs', 86, 'warn'], ['uout', 'vRd,c', 54, 'ok']],
    norm: 'CE art.45 · u1 = 2d',
    canvas: 'punching'
  }
};
const LP_NAV = [{
  group: 'HORMIGÓN',
  items: ['Vigas', 'Pilares', 'Punzonamiento', 'Forjados']
}, {
  group: 'ACERO',
  items: ['Vigas', 'Pilares', 'Anclaje']
}, {
  group: 'CIMENTACIÓN',
  items: ['Zapatas', 'Muros']
}, {
  group: 'MADERA',
  items: ['Vigas', 'Pilares']
}];
window.LandingPreview = function LandingPreview({
  moduleId = 'rc-beams'
}) {
  const cfg = LP_MODULES[moduleId] || LP_MODULES['rc-beams'];
  const eta = cfg.checks[0][2];
  const state = eta < 80 ? 'ok' : eta < 100 ? 'warn' : 'fail';
  const verdict = state === 'ok' ? 'CUMPLE' : state === 'warn' ? 'REVISAR' : 'INCUMPLE';
  const activeGroup = cfg.sidebarGroup || cfg.group;
  return /*#__PURE__*/React.createElement("div", {
    className: "ap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ap-top"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ap-brand"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ap-brand-dot"
  }), /*#__PURE__*/React.createElement("span", null, "Concreta")), /*#__PURE__*/React.createElement("div", {
    className: "ap-bread"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ap-bg"
  }, cfg.group), /*#__PURE__*/React.createElement("span", {
    className: "ap-bs"
  }, "/"), /*#__PURE__*/React.createElement("span", {
    className: "ap-bm"
  }, cfg.name)), /*#__PURE__*/React.createElement("div", {
    className: "ap-tools"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ap-tool"
  }, "N/mm\xB2"), /*#__PURE__*/React.createElement("span", {
    className: "ap-tool"
  }, "\u2318K"), /*#__PURE__*/React.createElement("span", {
    className: "ap-tool"
  }, "PDF"))), /*#__PURE__*/React.createElement("div", {
    className: "ap-body"
  }, /*#__PURE__*/React.createElement("aside", {
    className: "ap-sb"
  }, LP_NAV.map(g => /*#__PURE__*/React.createElement("div", {
    className: "ap-sbg",
    key: g.group
  }, /*#__PURE__*/React.createElement("div", {
    className: "ap-sbl"
  }, g.group), g.items.map((it, i) => {
    const on = g.group === activeGroup && it === cfg.highlight;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      className: 'ap-sbi' + (on ? ' on' : '')
    }, /*#__PURE__*/React.createElement("span", {
      className: "ap-sbd"
    }), it);
  }))), /*#__PURE__*/React.createElement("div", {
    className: "ap-ver"
  }, "v0.1.1")), /*#__PURE__*/React.createElement("div", {
    className: "ap-in"
  }, cfg.inputs.map(sec => /*#__PURE__*/React.createElement(React.Fragment, {
    key: sec.s
  }, /*#__PURE__*/React.createElement("div", {
    className: "ap-sh"
  }, "\u25BC ", sec.s), sec.r.map(([k, v, u]) => /*#__PURE__*/React.createElement("div", {
    className: "ap-ir",
    key: k
  }, /*#__PURE__*/React.createElement("span", {
    className: "ap-il"
  }, k), /*#__PURE__*/React.createElement("span", {
    className: "ap-iv"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ap-ivv"
  }, v), u && /*#__PURE__*/React.createElement("span", {
    className: "ap-ivu"
  }, u))))))), /*#__PURE__*/React.createElement("div", {
    className: "ap-cv canvas-dot-grid"
  }, /*#__PURE__*/React.createElement(window.ModuleCanvas, {
    canvas: cfg.canvas
  })), /*#__PURE__*/React.createElement("div", {
    className: 'ap-res ' + state
  }, /*#__PURE__*/React.createElement("div", {
    className: "ap-rh"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ap-rt"
  }, "VERIFICACIONES"), /*#__PURE__*/React.createElement("span", {
    className: 'ap-rb ' + state
  }, /*#__PURE__*/React.createElement("span", {
    className: "ap-rd"
  }), verdict)), cfg.checks.map(([n, r, e, st], i) => /*#__PURE__*/React.createElement("div", {
    className: "ap-ch",
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "ap-cn"
  }, n, /*#__PURE__*/React.createElement("div", {
    className: "ap-cr"
  }, r)), /*#__PURE__*/React.createElement("div", {
    className: "ap-cb"
  }, /*#__PURE__*/React.createElement("div", {
    className: 'ap-cf ' + st,
    style: {
      width: Math.min(e, 100) + '%'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: 'ap-ct ' + st
  }, e, "%"))), /*#__PURE__*/React.createElement("div", {
    className: "ap-rf"
  }, cfg.norm))));
};
window.LP_MODULE_KEYS = ['rc-beams', 'punching', 'steel-beams', 'retaining-wall', 'timber-beams'];
window.LP_MODULES = LP_MODULES;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing/LandingPreview.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Panel = __ds_scope.Panel;

__ds_ns.StatusBadge = __ds_scope.StatusBadge;

__ds_ns.StatusTag = __ds_scope.StatusTag;

__ds_ns.CheckRow = __ds_scope.CheckRow;

__ds_ns.SectionHeader = __ds_scope.SectionHeader;

__ds_ns.ValueRow = __ds_scope.ValueRow;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.NumberField = __ds_scope.NumberField;

__ds_ns.SegmentedToggle = __ds_scope.SegmentedToggle;

__ds_ns.ThemeToggle = __ds_scope.ThemeToggle;

__ds_ns.ModuleIcon = __ds_scope.ModuleIcon;

__ds_ns.Sidebar = __ds_scope.Sidebar;

__ds_ns.Topbar = __ds_scope.Topbar;

})();
