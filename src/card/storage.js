import { STORAGE_KEYS } from "./config.js";

// Per-browser persistence (localStorage) of view state and toggles.
// Mixed into VanPowerCard.prototype; methods run with `this` = the card.
// True once a scene has been created in this page load. With reset_view_on_reload,
// only the first scene after a page (re)load ignores the stored view; cards that HA
// rebuilds when navigating between dashboard views keep the current view.
let sceneCreatedThisPageLoad = false;

export const storageMethods = {
  // View to start the scene with: the stored/session view, unless this is the
  // first scene since the page loaded and reset_view_on_reload is on.
  takeInitialViewState() {
    const firstSinceReload = !sceneCreatedThisPageLoad;
    sceneCreatedThisPageLoad = true;
    if (firstSinceReload && this.shouldResetViewOnReload()) return null;
    return this._viewState;
  },
  readStoredBoolean(key, fallback) {
    try {
      const value = window.localStorage.getItem(key);
      if (value === null) return fallback;
      return value === "true";
    } catch {
      return fallback;
    }
  },
  writeStoredBoolean(key, value) {
    try {
      window.localStorage.setItem(key, String(Boolean(value)));
    } catch {
    }
  },
  readStoredNumber(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw == null) return fallback;
      const value = Number(raw);
      return Number.isFinite(value) ? value : fallback;
    } catch {
      return fallback;
    }
  },
  writeStoredNumber(key, value) {
    try {
      window.localStorage.setItem(key, String(Number(value)));
    } catch {
    }
  },
  sanitizeViewState(value) {
    if (!value || typeof value !== "object") return null;
    const rotationY = Number(value.rotationY);
    const pitch = Number(value.pitch);
    const radius = Number(value.radius);
    if (!Number.isFinite(rotationY) || !Number.isFinite(pitch) || !Number.isFinite(radius)) {
      return null;
    }
    return {
      rotationY,
      pitch: Math.max(-0.7, Math.min(1.5, pitch)),
      radius: Math.max(7, Math.min(18, radius))
    };
  },
  readStoredViewState(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      return this.sanitizeViewState(JSON.parse(raw)) || fallback;
    } catch {
      return fallback;
    }
  },
  writeStoredViewState(key, value) {
    try {
      const state = this.sanitizeViewState(value);
      if (!state) return;
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
    }
  },
  persistViewState() {
    const state = this._scene?.getViewState?.();
    if (!state) return;
    this._viewState = this.sanitizeViewState(state) || this._viewState;
    if (this._viewState) {
      this.writeStoredViewState(STORAGE_KEYS.viewState, this._viewState);
    }
  },
  startViewStatePersistence() {
    if (this._viewSaveTimer) {
      clearInterval(this._viewSaveTimer);
    }
    this._viewSaveTimer = setInterval(() => {
      if (!this._scene || this._spinEnabled) return;
      this.persistViewState();
    }, 1e3);
  }
};
