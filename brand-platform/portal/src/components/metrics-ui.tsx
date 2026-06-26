export function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="card-duo p-5">
      <p className="font-display text-xs font-extrabold uppercase tracking-wide text-ink-light">
        {label}
      </p>
      <p className="mt-2 font-display text-3xl font-extrabold tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs font-medium text-ink-light">{hint}</p>}
    </div>
  );
}

export function FunnelChart({
  funnel,
}: {
  funnel: {
    enrolled: number;
    completed: number;
    qr_issued: number;
    qr_redeemed: number;
  };
}) {
  const steps = [
    { key: "enrolled", label: "Enrolled", value: funnel.enrolled },
    { key: "completed", label: "Completed", value: funnel.completed },
    { key: "qr_issued", label: "QR issued", value: funnel.qr_issued },
    { key: "qr_redeemed", label: "Redeemed", value: funnel.qr_redeemed },
  ];

  const max = Math.max(...steps.map((s) => s.value), 1);

  return (
    <div className="card">
      <h2 className="font-display text-lg font-extrabold text-ink">Funnel</h2>
      <p className="mt-1 text-sm font-medium text-ink-light">
        Enrolled → completed → QR issued → redeemed
      </p>
      <div className="mt-6 space-y-4">
        {steps.map((step, i) => {
          const width = Math.max((step.value / max) * 100, step.value > 0 ? 8 : 0);
          const prev = i > 0 ? steps[i - 1].value : null;
          const conv =
            prev && prev > 0 ? `${Math.round((step.value / prev) * 100)}%` : null;

          return (
            <div key={step.key}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className="font-display font-extrabold text-ink">{step.label}</span>
                <span className="tabular-nums font-medium text-ink">
                  {step.value}
                  {conv && (
                    <span className="ml-2 text-xs font-medium text-ink-light">({conv} of prev)</span>
                  )}
                </span>
              </div>
              <div className="funnel-track">
                <div className="funnel-fill" style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
