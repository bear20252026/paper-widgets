export interface AIStudioBridge {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

declare global {
  interface Window {
    aistudio?: AIStudioBridge;
  }
}

export interface StudioKeyHooks {
  ensureApiKey: () => Promise<boolean>;
  onApiKeyError: (message: string) => void;
  openApiKeyPicker: () => Promise<void>;
  getHasApiKey: () => boolean;
}
