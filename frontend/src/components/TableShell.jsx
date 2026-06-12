function TableShell({ label, minWidth, children, className = "" }) {
  return (
    <div
      className={`table-shell scrollbar-thin focus-visible:ring-4 focus-visible:ring-blue-500/20 ${className}`}
      role="region"
      aria-label={`${label}. Scroll horizontally to review all columns when needed.`}
      tabIndex="0"
    >
      <table
        className="data-table"
        style={minWidth ? { minWidth } : undefined}
      >
        <caption className="sr-only">{label}</caption>
        {children}
      </table>
    </div>
  );
}

export default TableShell;
