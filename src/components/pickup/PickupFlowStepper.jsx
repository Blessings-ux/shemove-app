import { Check } from "lucide-react";
import { PICKUP_STEPS, getPickupStepIndex } from "../../utils/pickupFlow";

export default function PickupFlowStepper({ status, perspective = "passenger" }) {
  const currentIndex = getPickupStepIndex(status);

  if (currentIndex < 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Pickup sequence
        </p>
        <p className="text-xs font-medium text-slate-500">
          {perspective === "driver" ? "Driver first, then passenger" : "Step-by-step pickup"}
        </p>
      </div>

      <div className="space-y-3">
        {PICKUP_STEPS.map((step, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isUpcoming = index > currentIndex;

          return (
            <div key={step.key} className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  isComplete
                    ? "bg-green-500 text-white"
                    : isCurrent
                      ? "bg-purple-600 text-white ring-4 ring-purple-100"
                      : "bg-white text-slate-400 ring-1 ring-slate-200"
                }`}
              >
                {isComplete ? <Check className="h-4 w-4" /> : index + 1}
              </div>

              <div className="min-w-0 flex-1">
                <div
                  className={`text-sm font-bold ${
                    isCurrent
                      ? "text-purple-700"
                      : isComplete
                        ? "text-green-700"
                        : "text-slate-400"
                  }`}
                >
                  {step.label}
                  {isCurrent && (
                    <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-purple-700">
                      Now
                    </span>
                  )}
                </div>
                {(isCurrent || isComplete) && (
                  <p
                    className={`mt-0.5 text-xs ${
                      isUpcoming ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
