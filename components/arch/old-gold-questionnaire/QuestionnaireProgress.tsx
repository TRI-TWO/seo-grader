type Props = {
  currentStep: number;
  totalSteps?: number;
};

export function QuestionnaireProgress({ currentStep, totalSteps = 5 }: Props) {
  return (
    <div className="flex items-center gap-2" aria-label="Progress">
      {Array.from({ length: totalSteps }, (_, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        return (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition ${
              active
                ? "bg-cyan-400/90"
                : done
                  ? "bg-cyan-500/35"
                  : "bg-slate-700/80"
            }`}
          />
        );
      })}
    </div>
  );
}
