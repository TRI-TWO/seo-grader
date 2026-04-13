"use client";

import { useState } from "react";
import { QUESTIONNAIRE_STEPS } from "@/lib/arch/oldGoldQuestionnaire/constants";
import { useOldGoldQuestionnaireWizard } from "@/lib/arch/oldGoldQuestionnaire/useWizard";
import { validateAllSteps, validateStepIndex } from "@/lib/arch/oldGoldQuestionnaire/validation";
import { QuestionnaireProgress } from "./QuestionnaireProgress";
import { QuestionnaireStepHeader } from "./QuestionnaireStepHeader";
import { StepBusinessInfo } from "./StepBusinessInfo";
import { StepHoursServiceArea } from "./StepHoursServiceArea";
import { StepServicesOffered } from "./StepServicesOffered";
import { StepCallHandling } from "./StepCallHandling";
import { StepReviewSave } from "./StepReviewSave";

type Props = {
  clientId: string;
};

export function ArchQuestionnaireWizard({ clientId }: Props) {
  const wizard = useOldGoldQuestionnaireWizard(clientId);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [stepMessage, setStepMessage] = useState<string | null>(null);

  const { envelope, loaded, saving, message, error } = wizard;
  const stepMeta = QUESTIONNAIRE_STEPS[envelope.stepIndex];

  function clearErrors() {
    setFieldErrors({});
    setStepMessage(null);
  }

  async function goNext() {
    clearErrors();
    const v = validateStepIndex(envelope.stepIndex, {
      data: envelope.data,
      wizardServiceAnswers: envelope.wizardServiceAnswers,
      customServices: envelope.customServices,
    });
    if (!v.ok) {
      setFieldErrors(v.fieldErrors ?? {});
      setStepMessage(v.stepMessage ?? null);
      return;
    }
    wizard.setStepIndex(envelope.stepIndex + 1);
  }

  function goBack() {
    clearErrors();
    wizard.setStepIndex(envelope.stepIndex - 1);
  }

  async function finish() {
    clearErrors();
    const v = validateAllSteps({
      data: envelope.data,
      wizardServiceAnswers: envelope.wizardServiceAnswers,
      customServices: envelope.customServices,
    });
    if (!v.ok) {
      setFieldErrors(v.fieldErrors ?? {});
      setStepMessage(v.stepMessage ?? null);
      return;
    }
    const ok = await wizard.submitFinal();
    if (ok) {
      try {
        sessionStorage.removeItem(`oldGoldQuestionnaireDraft:${clientId}`);
      } catch {
        // ignore
      }
    }
  }

  if (!loaded) {
    return (
      <div className="rounded-xl border border-slate-700/80 bg-slate-950/50 p-8 text-center text-sm text-slate-400">
        Loading questionnaire…
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-cyan-500/15 bg-gradient-to-br from-slate-900/90 to-slate-950/95 p-6 shadow-[0_0_0_1px_rgba(6,182,212,0.06)] sm:p-8">
      <QuestionnaireProgress currentStep={envelope.stepIndex} />
      <div className="mt-6">
        <QuestionnaireStepHeader
          stepLabel={`Step ${envelope.stepIndex + 1} of ${QUESTIONNAIRE_STEPS.length}`}
          title={stepMeta.title}
          description={stepMeta.description}
        />

        {envelope.stepIndex === 0 ? (
          <StepBusinessInfo
            data={envelope.data}
            fieldErrors={fieldErrors}
            patchData={wizard.patchData}
          />
        ) : null}
        {envelope.stepIndex === 1 ? (
          <StepHoursServiceArea
            data={envelope.data}
            fieldErrors={fieldErrors}
            patchData={wizard.patchData}
          />
        ) : null}
        {envelope.stepIndex === 2 ? (
          <StepServicesOffered
            data={envelope.data}
            wizardServiceAnswers={envelope.wizardServiceAnswers}
            customServices={envelope.customServices}
            fieldErrors={fieldErrors}
            stepMessage={stepMessage}
            setCategories={wizard.setCategories}
            patchWizardAnswer={wizard.patchWizardAnswer}
            setCustomServices={wizard.setCustomServices}
          />
        ) : null}
        {envelope.stepIndex === 3 ? (
          <StepCallHandling
            data={envelope.data}
            fieldErrors={fieldErrors}
            patchData={wizard.patchData}
          />
        ) : null}
        {envelope.stepIndex === 4 ? (
          <StepReviewSave
            data={envelope.data}
            wizardServiceAnswers={envelope.wizardServiceAnswers}
            customServices={envelope.customServices}
          />
        ) : null}
      </div>

      {message ? (
        <p className="mt-4 text-sm text-emerald-300/90" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-rose-300/90" role="alert">
          {error}
        </p>
      ) : null}

      <footer className="mt-8 flex flex-col gap-3 border-t border-slate-700/80 pt-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={goBack}
            disabled={envelope.stepIndex === 0 || saving}
            className="rounded-lg border border-slate-600/80 bg-slate-900/60 px-4 py-2 text-sm font-medium text-slate-200 disabled:opacity-40 hover:border-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
          >
            Back
          </button>
          {envelope.stepIndex < 4 ? (
            <button
              type="button"
              onClick={() => void goNext()}
              disabled={saving}
              className="rounded-lg border border-cyan-500/50 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-50 hover:bg-cyan-500/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
            >
              Next
            </button>
          ) : null}
        </div>
        {envelope.stepIndex === 4 ? (
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => void wizard.saveDraftRemote()}
              disabled={saving}
              className="rounded-lg border border-slate-600/80 bg-slate-900/60 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
            >
              Save draft
            </button>
            <button
              type="button"
              onClick={() => void finish()}
              disabled={saving}
              className="rounded-lg border border-cyan-500/60 bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-50 hover:bg-cyan-500/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
            >
              Finish setup
            </button>
          </div>
        ) : null}
      </footer>
    </div>
  );
}
