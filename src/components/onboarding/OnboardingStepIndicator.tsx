import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface Step {
    label: string;
    description?: string;
}

interface OnboardingStepIndicatorProps {
    steps: Step[];
    currentStep: number;      // 0-indexed
    className?: string;
    onStepClick?: (step: number) => void;
}

export function OnboardingStepIndicator({ steps, currentStep, className, onStepClick }: OnboardingStepIndicatorProps) {
    const progress = Math.round(((currentStep) / steps.length) * 100);

    return (
        <div className={cn("w-full", className)}>
            {/* Progress bar */}
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Progres</span>
                <span className="text-sm font-bold text-primary">{progress}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden mb-6">
                <div
                    className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Steps */}
            <div className="flex items-start gap-0">
                {steps.map((step, i) => {
                    const isComplete = i < currentStep;
                    const isCurrent = i === currentStep;
                    const isClickable = isComplete && onStepClick;

                    return (
                        <div key={i} className="flex-1 flex flex-col items-center relative">
                            {/* Connector line */}
                            {i > 0 && (
                                <div
                                    className={cn(
                                        "absolute top-4 right-1/2 w-full h-0.5 -translate-y-1/2",
                                        isComplete ? "bg-primary" : "bg-muted"
                                    )}
                                />
                            )}

                            {/* Circle */}
                            <button
                                type="button"
                                disabled={!isClickable}
                                onClick={() => isClickable && onStepClick(i)}
                                className={cn(
                                    "relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 text-xs font-bold transition-all duration-300",
                                    isComplete
                                        ? "bg-primary border-primary text-primary-foreground"
                                        : isCurrent
                                            ? "bg-background border-primary text-primary ring-4 ring-primary/20"
                                            : "bg-background border-muted-foreground/30 text-muted-foreground",
                                    isClickable && "cursor-pointer hover:ring-4 hover:ring-primary/20 hover:scale-110",
                                    !isClickable && !isCurrent && "cursor-default"
                                )}
                            >
                                {isComplete ? <Check className="h-4 w-4" /> : i + 1}
                            </button>

                            {/* Label */}
                            <span
                                className={cn(
                                    "mt-2 text-xs text-center font-medium leading-tight max-w-[60px] sm:max-w-[80px]",
                                    isCurrent ? "text-primary" : isComplete ? "text-foreground" : "text-muted-foreground"
                                )}
                            >
                                {step.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
