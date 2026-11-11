import { NOW_PLAYING_FALLBACK_ENTITIES } from "./config.js";

// Reading and parsing Home Assistant entity states.
// Mixed into VanPowerCard.prototype; methods run with `this` = the card.
const ENTITY_ID_PATTERN = /^[a-z_]+\.[a-z0-9_]+$/;

export const entityStateMethods = {
  // Entity ids the card reads: every entity-id-shaped string in the config plus
  // the now-playing fallbacks. Cached until the next setConfig().
  getWatchedEntityIds() {
    if (!this._watchedEntityIds) {
      const ids = new Set(NOW_PLAYING_FALLBACK_ENTITIES);
      for (const value of Object.values(this._config)) {
        if (typeof value === "string" && ENTITY_ID_PATTERN.test(value.trim())) ids.add(value.trim());
      }
      this._watchedEntityIds = [...ids];
    }
    return this._watchedEntityIds;
  },
  // Home Assistant pushes a new hass object for every state change anywhere in
  // the system, but reuses unchanged state objects. Returns true when anything
  // this card renders from has changed (or a minute has passed, so time-based
  // display such as day/night styling keeps up).
  hasRelevantHassChange(hass) {
    const snapshot = [
      hass?.config,
      hass?.locale,
      Math.floor(Date.now() / 6e4),
      ...this.getWatchedEntityIds().map((entityId) => hass?.states?.[entityId])
    ];
    const previous = this._hassSnapshot;
    this._hassSnapshot = snapshot;
    return !previous || previous.length !== snapshot.length || snapshot.some((value, index) => value !== previous[index]);
  },
  lookup(entityId) {
    return this._hass?.states?.[entityId];
  },
  format(entityId, fallbackUnit = "") {
    const state = this.lookup(entityId);
    if (!state) return "\u2014";
    const unit = state.attributes?.unit_of_measurement || fallbackUnit;
    return `${state.state}${unit}`;
  },
  parseLightPercent(entityId) {
    if (!entityId) return 100;
    const state = this.lookup(entityId);
    if (!state) return 0;
    const attributes = state.attributes || {};
    const pctFromAttr = Number(attributes.brightness_pct);
    if (Number.isFinite(pctFromAttr)) {
      return Math.max(0, Math.min(100, pctFromAttr));
    }
    const rawBrightness = Number(attributes.brightness);
    if (Number.isFinite(rawBrightness)) {
      return Math.max(0, Math.min(100, rawBrightness / 255 * 100));
    }
    if (state.state === "on") return 100;
    if (state.state === "off") return 0;
    const numericState = Number(state.state);
    if (Number.isFinite(numericState)) {
      return Math.max(0, Math.min(100, numericState));
    }
    return 0;
  },
  parseStateNumber(entityId) {
    if (!entityId) return null;
    const state = this.lookup(entityId);
    if (!state) return null;
    const raw = String(state.state ?? "").trim();
    if (!raw || raw === "unknown" || raw === "unavailable") return null;
    const direct = Number(raw);
    if (Number.isFinite(direct)) return direct;
    const match = raw.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : null;
  },
  parseConfiguredNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  },
  parseEntityAttributeNumber(entityId, attributeName) {
    if (!entityId || !attributeName) return null;
    const state = this.lookup(entityId);
    if (!state) return null;
    const raw = state.attributes?.[attributeName];
    if (raw == null) return null;
    const direct = Number(raw);
    if (Number.isFinite(direct)) return direct;
    const text = String(raw).trim();
    if (!text || text === "unknown" || text === "unavailable") return null;
    const match = text.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }
};
