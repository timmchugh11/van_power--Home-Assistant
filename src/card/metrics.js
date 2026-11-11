// Power metric tiles and floating 3D labels.
// Mixed into VanPowerCard.prototype; methods run with `this` = the card.
export const metricsMethods = {
  buildSceneLabels() {
    const batteryPercent = this.lookup(this._config.battery_percent);
    return {
      solar: {
        title: "SOLAR",
        lines: [
          this.format(this._config.solar_watt, "W"),
          this.format(this._config.solar_amp, "A"),
          this.format(this._config.solar_voltage, "V")
        ]
      },
      grid: {
        title: "HOOKUP",
        lines: [
          this.format(this._config.grid_watt, "W"),
          this.format(this._config.grid_amp, "A"),
          this.format(this._config.grid_voltage, "V")
        ]
      },
      alternator: {
        title: "ALTERNATOR",
        lines: [
          this.format(this._config.alternator_watt, "W"),
          this.format(this._config.alternator_amp, "A"),
          this.format(this._config.alternator_voltage, "V")
        ]
      },
      battery: {
        title: "BATTERY",
        lines: [
          batteryPercent ? `${batteryPercent.state}%` : "\u2014",
          this.format(this._config.battery_amp, "A"),
          this.format(this._config.battery_voltage, "V")
        ]
      }
    };
  },
  getTileMetrics() {
    const batteryPercent = this.lookup(this._config.battery_percent);
    return {
      solar: {
        title: "SOLAR",
        primary: this.format(this._config.solar_watt, "W"),
        detail: `${this.format(this._config.solar_amp, "A")} | ${this.format(this._config.solar_voltage, "V")}`
      },
      hookup: {
        title: "HOOKUP",
        primary: this.format(this._config.grid_watt, "W"),
        detail: `${this.format(this._config.grid_amp, "A")} | ${this.format(this._config.grid_voltage, "V")}`
      },
      alternator: {
        title: "ALTERNATOR",
        primary: this.format(this._config.alternator_watt, "W"),
        detail: `${this.format(this._config.alternator_amp, "A")} | ${this.format(this._config.alternator_voltage, "V")}`
      },
      battery: {
        title: "BATTERY",
        primary: batteryPercent ? `${batteryPercent.state}%` : "\u2014",
        detail: `${this.format(this._config.battery_amp, "A")} | ${this.format(this._config.battery_voltage, "V")}`
      }
    };
  },
  updateMetricTiles() {
    const metrics = this.getTileMetrics();
    const tileKeys = ["solar", "hookup", "alternator", "battery"];
    for (const key of tileKeys) {
      const tile = this.shadowRoot?.querySelector(`[data-tile="${key}"]`);
      if (!tile) continue;
      const tileData = metrics[key];
      const title = tile.querySelector("[data-role='title']");
      const primary = tile.querySelector("[data-role='primary']");
      const detail = tile.querySelector("[data-role='detail']");
      if (title) title.textContent = tileData.title;
      if (primary) primary.textContent = tileData.primary;
      if (detail) detail.textContent = tileData.detail;
    }
  },
  updateEvChargerVisibility() {
    const hookupVoltage = Number.parseFloat(this.lookup(this._config.grid_voltage)?.state);
    const hookupPresent = Number.isFinite(hookupVoltage) && hookupVoltage > 5;
    this._scene?.setAssetGroupVisible?.(
      "EV_CHARGER_AND_CABLE",
      hookupPresent
    );
  }
};
