type Props = {
  stepLabel: string;
  title: string;
  description?: string;
};

export function QuestionnaireStepHeader({ stepLabel, title, description }: Props) {
  return (
    <header className="mb-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-400/80">
        {stepLabel}
      </p>
      <h2 className="mt-1 text-lg font-semibold text-white">{title}</h2>
      {description ? <p className="mt-1 max-w-2xl text-sm text-slate-400">{description}</p> : null}
    </header>
  );
}
