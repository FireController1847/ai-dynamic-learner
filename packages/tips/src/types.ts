export type TipsFeatureId = string;
export interface TipsFeature { id: TipsFeatureId; label: string }
export type TargetSelector = string | string[];
export type Placement = 'top' | 'bottom' | 'left' | 'right' | 'center';
export interface StepAction { click: TargetSelector }
export interface TipStep {
  title: string; body: string; target: TargetSelector; targetLabel: string;
  placement?: Placement; nextAction?: StepAction; backAction?: StepAction;
  nextLabel?: string; back?: boolean; blockTarget?: boolean;
}
export interface TipSection {
  id: string; title: string; description: string; steps: TipStep[];
  when?: TargetSelector; prepare?: string; auto?: boolean; finishLabel?: string;
  continueToAvailable?: boolean; finishAction?: StepAction;
}
export interface Tutorial { version: number; sections: TipSection[] }
export type TipsCatalog = Record<TipsFeatureId, Tutorial>;
export type TutorialCleanup = () => void | Promise<void>;
export interface TutorialRequest {
  featureId: TipsFeatureId;
  action: string;
  handled: boolean;
  resolve: (cleanup: TutorialCleanup) => void;
  reject: (reason: unknown) => void;
}
export interface TipsPreferences {
  enabled: boolean;
  seen: Record<string, unknown>;
}
export interface TipsProps {
  feature: TipsFeature | null;
  catalog: TipsCatalog;
  storageKey: string;
  actionEventName: string;
}
