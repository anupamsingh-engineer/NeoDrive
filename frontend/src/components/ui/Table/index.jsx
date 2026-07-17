const Table = ({ children, className = "" }) => (
  <div className={`overflow-x-auto rounded-md border border-border ${className}`}>
    <table className="w-full border-collapse text-left text-sm">{children}</table>
  </div>
);

Table.Head = ({ children }) => (
  <thead className="border-b border-border bg-surface text-xs font-medium uppercase tracking-wide text-ink-faint">
    <tr>{children}</tr>
  </thead>
);

Table.HeaderCell = ({ children, className = "" }) => (
  <th className={`px-4 py-3 font-medium ${className}`}>{children}</th>
);

Table.Body = ({ children }) => <tbody className="divide-y divide-border">{children}</tbody>;

Table.Row = ({ children, className = "", ...rest }) => (
  <tr className={`transition-colors hover:bg-surface/60 ${className}`} {...rest}>
    {children}
  </tr>
);

Table.Cell = ({ children, className = "" }) => <td className={`px-4 py-3 text-ink ${className}`}>{children}</td>;

export default Table;
