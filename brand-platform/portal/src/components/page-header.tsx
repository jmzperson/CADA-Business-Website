export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      {eyebrow && (
        <p className="font-display text-xs font-extrabold uppercase tracking-wide text-teal">
          {eyebrow}
        </p>
      )}
      <h1 className="font-display text-3xl font-extrabold text-ink">{title}</h1>
      {description && <p className="mt-1 font-medium text-ink-light">{description}</p>}
    </div>
  );
}
