export declare function userNeedsOnboarding(userId: string): Promise<boolean>;

export declare function hasCompletedWizardStep(userId: string, step: string): Promise<boolean>;

export declare function getNextWizardStep(userId: string): Promise<string | null>;

export declare function markWizardStepCompleted(userId: string, step: string): Promise<void>;

export declare const WIZARD_STEPS: readonly string[];