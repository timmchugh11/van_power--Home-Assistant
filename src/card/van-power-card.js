import { actionMethods } from "./actions.js";
import { cardStyles } from "./styles.js";
import { cardTemplate } from "./template.js";
import { clockMethods } from "./clock.js";
import { createMoonIconScene } from "../scene/moon-icon-scene.js";
import { createVanScene } from "../scene/van-scene.js";
import { DEFAULT_CONFIG, STORAGE_KEYS } from "./config.js";
import { entityStateMethods } from "./entity-state.js";
import { fullscreenMethods } from "./fullscreen.js";
import { mediaMethods } from "./media.js";
import { metricsMethods } from "./metrics.js";
import { MOON_MODEL_URL, VAN_MODEL_URL } from "../assets.js";
import { moonPanelMethods } from "./moon-panel.js";
import { settingsMethods } from "./settings.js";
import { starlinkMethods } from "./starlink.js";
import { storageMethods } from "./storage.js";
import { weatherDebugMethods } from "./weather-debug.js";
import { weatherInputMethods } from "./weather-inputs.js";
import { weatherMethods } from "./weather.js";

export class VanPowerCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = { ...DEFAULT_CONFIG };
    this._rawConfig = {};
    this._scene = null;
    this._moonScene = null;
    this._morphOpen = this.readStoredBoolean(STORAGE_KEYS.morphOpen, false);
    this._spinEnabled = true;
    this._lightingMode = this.normalizeLightingStyle(this._config.light_style);
    this._sunIntensityScale = 2.45;
    this._sunSimulationProgress = null;
    this._modelLightsLevel = this.readStoredNumber(STORAGE_KEYS.modelLightsLevel, 1);
    this._viewState = this.readStoredViewState(STORAGE_KEYS.viewState, null);
    this._viewSaveTimer = null;
    this._dateTimeTimer = null;
    this._daySimAdjustingTimer = null;
    this._fullscreenApplied = false;
    this._pixelShiftTimer = null;
    this._debugWeatherOverride = "";
    this._debugDayTimeOverride = null;
    this._starlinkCardElement = null;
    this._starlinkCardConfigKey = "";
    this._starlinkCardBuildId = 0;
  }
  connectedCallback() {
    this.render();
    this.applyFullscreenMode();
    this.update();
  }
  setConfig(config) {
    const previousConfig = this._config;
    this._rawConfig = config || {};
    this._config = { ...DEFAULT_CONFIG, ...config || {} };
    this._watchedEntityIds = null;
    this._hassSnapshot = null;
    const starlinkCardChanged = JSON.stringify(previousConfig?.starlink_card ?? null) !== JSON.stringify(this._config.starlink_card ?? null);
    if (this._scene && this.performanceSceneConfigChanged(previousConfig, this._config)) {
      this.persistViewState();
      this._scene.destroy();
      this._scene = null;
    }
    if (starlinkCardChanged) {
      this.resetStarlinkCard();
    }
    const configuredSunScale = Number(this._config.sun_intensity_scale);
    if (Number.isFinite(configuredSunScale)) {
      this._sunIntensityScale = Math.max(0, Math.min(5, configuredSunScale));
    }
    this._lightingMode = this.normalizeLightingStyle(this._config.light_style);
    this._spinEnabled = this.getConfiguredSpinEnabled();
    if (!this.shadowRoot.innerHTML) {
      this.render();
    }
    this._sunIntensityScale = this._scene?.setSunIntensityScale?.(this._sunIntensityScale) ?? this._sunIntensityScale;
    this._lightingMode = this._scene?.setLightingMode?.(this._lightingMode) || this._lightingMode;
    this.applySceneControlConfig();
    this.applyDisplayScales();
    this.updateWeatherDisplay();
    this.updateMediaPlayerDisplay();
    this.updateMoonDisplay();
    this.updateStarlinkCardHass();
    this.applyFullscreenMode();
    this.applyDebugPanelVisibility();
  }
  set hass(hass) {
    this._hass = hass;
    if (!this.shadowRoot.innerHTML) {
      this.render();
    }
    if (!this.hasRelevantHassChange(hass)) {
      // Nothing the card shows has changed; child elements still need every push.
      this.updateMusicPlayerPage();
      this.updateStarlinkCardHass();
      return;
    }
    this.update();
  }
  getCardSize() {
    return 6;
  }
  disconnectedCallback() {
    this.persistViewState();
    if (this._viewSaveTimer) {
      clearInterval(this._viewSaveTimer);
      this._viewSaveTimer = null;
    }
    if (this._dateTimeTimer) {
      clearInterval(this._dateTimeTimer);
      this._dateTimeTimer = null;
    }
    if (this._daySimAdjustingTimer) {
      clearTimeout(this._daySimAdjustingTimer);
      this._daySimAdjustingTimer = null;
    }
    clearTimeout(this._weatherLongPressTimer);
    this._weatherLongPressTimer = null;
    this.stopForecastSubscription();
    this.restoreFullscreenMode();
    this._scene?.destroy();
    this._scene = null;
    this._moonScene?.destroy?.();
    this._moonScene = null;
  }
  render() {
    if (!this.shadowRoot.innerHTML) {
      this.shadowRoot.innerHTML = `<style>${cardStyles}</style>${cardTemplate}`;
      this.shadowRoot.getElementById("clock-time")?.addEventListener("click", () => {
        this.openHomepageUrl();
      });
      this.shadowRoot.getElementById("clock-date")?.addEventListener("click", () => {
        this.openHomepageUrl();
      });
      this.shadowRoot.getElementById("weather-panel")?.addEventListener("click", () => {
        this.handleWeatherClick();
      });
      this.shadowRoot.getElementById("media-player-panel")?.addEventListener("click", () => {
        this.handleMediaPlayerClick();
      });
      this.updateMusicPlayerPage();
      this.shadowRoot.getElementById("media-player-art")?.addEventListener("error", (event) => {
        event.target.classList.add("is-hidden");
        event.target.dataset.src = "";
        this.shadowRoot.getElementById("media-player-panel")?.classList.remove("has-art");
      });
      this.shadowRoot.getElementById("debug-weather-select")?.addEventListener("change", (event) => {
        this.handleDebugWeatherSelectChange(event);
      });
      this.shadowRoot.getElementById("debug-weather-select")?.addEventListener("click", (event) => {
        event.stopPropagation();
      });
      this.shadowRoot.getElementById("debug-daytime-slider")?.addEventListener("input", (event) => {
        this.handleDebugDayTimeInput(event);
      });
      this.shadowRoot.getElementById("debug-daytime-slider")?.addEventListener("click", (event) => {
        event.stopPropagation();
      });
      this.syncDebugWeatherSelect();
      this.buildWeatherDebugRows();
      this.attachDebugPanelControls();
      this.attachWeatherLongPress();
      this.applyDebugPanelVisibility();
      this.shadowRoot.getElementById("starlink-close")?.addEventListener("click", () => {
        this.closeStarlinkPanel();
      });
      this.shadowRoot.getElementById("starlink-panel")?.addEventListener("click", (event) => {
        if (event?.target?.id === "starlink-panel") {
          this.closeStarlinkPanel();
        }
      });
      this.shadowRoot.addEventListener("pointerdown", (event) => {
        const panel = this.shadowRoot?.getElementById("starlink-panel");
        if (!panel || panel.classList.contains("is-hidden")) return;
        const target = event?.target;
        if (target && panel.contains(target)) return;
        this.closeStarlinkPanel();
      });
    }
    if (!this._scene) {
      const storedView = this.takeInitialViewState();
      const initialView = !this._spinEnabled ? storedView : null;
      this._scene = createVanScene(this.shadowRoot.getElementById("scene"), {
        modelUrl: VAN_MODEL_URL,
        interactive: true,
        onContextLost: () => {
          this._scene = null;
          if (this.isConnected) setTimeout(() => this.render(), 2000);
        },
        lowPowerMode: this.isLowPowerModeEnabled(),
        maxPixelRatio: this.getConfiguredMaxPixelRatio(),
        fpsLimit: this.getConfiguredFpsLimit(),
        autoRotate: this.getConfiguredSpinEnabled(),
        autoRotateSpeed: 0.18,
        initialLightingMode: this._lightingMode,
        initialSunIntensityScale: this._sunIntensityScale,
        latitude: this.getConfiguredLatitude(),
        longitude: this.getConfiguredLongitude(),
        initialVanHeadingDegrees: this.parseStateNumber(this._config.van_heading_entity),
        initialVanHeadingOffsetDegrees: this.parseConfiguredNumber(this._config.van_heading_offset_degrees),
        initialModelLightsLevel: this._modelLightsLevel,
        modelLightConeDegrees: Number(this._config.model_light_cone_degrees),
        modelLightDistance: Number(this._config.model_light_distance),
        modelLightPenumbra: Number(this._config.model_light_penumbra),
        modelLightIntensityBoost: Number(this._config.model_light_intensity_boost),
        initialRotationY: initialView?.rotationY,
        initialPitch: initialView?.pitch,
        initialRadius: initialView?.radius,
        compassVisible: this.useCompass(),
        labelsVisible: this.useFloatingMetrics(),
        cloudsVisible: this.useClouds(),
        onModelLightClick: (index, detail) => {
          this.handleModelLightClick(index, detail);
        },
        onGrillClick: (index) => {
          this.handleGrillClick(index);
        },
        onCameraClick: (index) => {
          this.handleCameraClick(index);
        },
        onStarlinkClick: (_, detail) => {
          this.handleStarlinkClick(detail);
        },
        onMorphChange: (value) => {
          this._morphOpen = Number(value) >= 0.5;
          this.writeStoredBoolean(STORAGE_KEYS.morphOpen, this._morphOpen);
        },
        labelsSpinWithModel: false,
        morphTargetName: "Key 1"
      });
      this._scene.setMorphValue(this._morphOpen ? 1 : 0);
      this._sunIntensityScale = this._scene.setSunIntensityScale?.(this._sunIntensityScale) ?? this._sunIntensityScale;
      this.applySceneControlConfig();
      this._scene.setCompassVisible?.(this.useCompass());
      this._scene.setLabelsVisible?.(this.useFloatingMetrics());
      this._scene.setCloudsVisible?.(this.useClouds());
      this.updateEvChargerVisibility();
      this._lightingMode = this._scene.setLightingMode?.(this._lightingMode) || this._lightingMode;
      this._modelLightsLevel = this._scene.setModelLightsLevel?.(this._modelLightsLevel) ?? this._modelLightsLevel;
      this.writeStoredNumber(STORAGE_KEYS.modelLightsLevel, this._modelLightsLevel);
      this.startViewStatePersistence();
      this.applyWeatherInputs();
    }
    if (!this._moonScene) {
      const initialMoonAngles = this.getMoonLightAngles();
      this._moonScene = createMoonIconScene(this.shadowRoot.getElementById("moon-icon"), {
        modelUrl: MOON_MODEL_URL,
        initialMoonAzimuthDegrees: initialMoonAngles?.azimuthDeg,
        initialMoonElevationDegrees: initialMoonAngles?.elevationDeg
      });
    }
    this.updateWeatherDisplay();
    this.updateMoonDisplay();
    this.updateMoonLightFromEntity();
    this.updateDaySimulationControl();
    this.startDateTimeTimer();
    this.applyDisplayScales();
    this.updateMetricTiles();
    this.updateMediaPlayerDisplay();
  }
  update() {
    if (!this._hass) return;
    this.applyDisplayScales();
    this._scene?.setCompassVisible?.(this.useCompass());
    this._scene?.setLabelsVisible?.(this.useFloatingMetrics());
    this._scene?.setCloudsVisible?.(this.useClouds());
    this._scene?.setLabels?.(this.buildSceneLabels());
    this.updateMetricTiles();
    this.updateEvChargerVisibility();
    this.updateMediaPlayerDisplay();
    this.updateMusicPlayerPage();
    this._scene?.setSunLocation?.(
      this.getConfiguredLatitude(),
      this.getConfiguredLongitude()
    );
    this._scene?.setVanHeading?.(
      this.parseStateNumber(this._config.van_heading_entity),
      this.parseConfiguredNumber(this._config.van_heading_offset_degrees)
    );
    const sunTimes = this.getSunTimes();
    this._scene?.setSunTimes?.(sunTimes?.sunriseMs, sunTimes?.sunsetMs);
    this.applySceneControlConfig();
    this.updateDaySimulationControl();
    this._scene?.setModelLightLevels?.([
      this.parseLightPercent(this._config.model_light_1_entity) / 100,
      this.parseLightPercent(this._config.model_light_2_entity) / 100
    ]);
    this.updateWeatherDisplay();
    this.updateMoonDisplay();
    this.updateMoonLightFromEntity();
    this.updateStarlinkCardHass();
  }
}
Object.assign(
  VanPowerCard.prototype,
  entityStateMethods,
  settingsMethods,
  clockMethods,
  actionMethods,
  fullscreenMethods,
  starlinkMethods,
  storageMethods,
  metricsMethods,
  weatherMethods,
  mediaMethods,
  moonPanelMethods,
  weatherInputMethods,
  weatherDebugMethods
);
VanPowerCard.getConfigElement = function() {
  return document.createElement("van-power-card-editor");
};
VanPowerCard.getStubConfig = function() {
  return { type: "custom:van-power-card" };
};
