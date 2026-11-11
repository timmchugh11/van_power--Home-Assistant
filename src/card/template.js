export const cardTemplate = `
<ha-card id="dynamic-card">
  <div class="wrap">
    <div class="stage">
      <div class="canvas" id="scene"></div>
      <div class="date-time-overlay">
        <div class="date-time-time" id="clock-time">--:--</div>
        <div class="date-time-date" id="clock-date">--</div>
      </div>
      <div class="metric-panel" id="metric-panel">
        <div class="metric-tile" data-tile="solar">
          <div class="metric-title" data-role="title">SOLAR</div>
          <div class="metric-primary" data-role="primary">—</div>
          <div class="metric-detail" data-role="detail">— | —</div>
        </div>
        <div class="metric-tile" data-tile="hookup">
          <div class="metric-title" data-role="title">HOOKUP</div>
          <div class="metric-primary" data-role="primary">—</div>
          <div class="metric-detail" data-role="detail">— | —</div>
        </div>
        <div class="metric-tile" data-tile="alternator">
          <div class="metric-title" data-role="title">ALTERNATOR</div>
          <div class="metric-primary" data-role="primary">—</div>
          <div class="metric-detail" data-role="detail">— | —</div>
        </div>
        <div class="metric-tile" data-tile="battery">
          <div class="metric-title" data-role="title">BATTERY</div>
          <div class="metric-primary" data-role="primary">—</div>
          <div class="metric-detail" data-role="detail">— | —</div>
        </div>
      </div>
      <div class="weather-panel is-hidden" id="weather-panel">
        <div class="weather-forecast is-hidden" id="weather-forecast"></div>
        <div class="weather-label" id="weather-label"></div>
        <div class="weather-label weather-inside-label is-hidden" id="weather-inside-label"></div>
      </div>
      <div class="media-player-panel is-hidden" id="media-player-panel">
        <img class="media-player-art is-hidden" id="media-player-art" alt="">
        <div class="media-player-label" id="media-player-label">
          <span class="media-player-text" id="media-player-text"></span>
        </div>
      </div>
      <van-music-player-page id="music-player-page"></van-music-player-page>
      <div class="scene-debug-controls" id="scene-debug-controls">
        <div class="debug-header">
          <span class="debug-title">Debug</span>
          <button class="debug-button" id="debug-reset" type="button">Reset all</button>
          <button class="debug-button" id="debug-close" type="button" aria-label="Close debug panel">×</button>
        </div>
        <div class="debug-row">
          <label for="debug-weather-select">Weather</label>
          <select id="debug-weather-select">
            <option value="">Auto</option>
            <option value="clear-day">Clear Day</option>
            <option value="clear-night">Clear Night</option>
            <option value="partly-cloudy-day">Partly Cloudy Day</option>
            <option value="partly-cloudy-night">Partly Cloudy Night</option>
            <option value="cloudy">Cloudy</option>
            <option value="fog">Fog</option>
            <option value="rain">Rain</option>
            <option value="pouring">Pouring</option>
            <option value="snow">Snow</option>
            <option value="sleet">Sleet</option>
            <option value="hail">Hail</option>
            <option value="lightning">Lightning</option>
            <option value="lightning-rainy">Lightning Rain</option>
            <option value="wind">Wind</option>
            <option value="windy-variant">Windy Variant</option>
            <option value="exceptional">Exceptional</option>
          </select>
        </div>
        <div class="debug-row">
          <label for="debug-daytime-slider">Day Time</label>
          <input id="debug-daytime-slider" type="range" min="0" max="1" step="0.001" value="0.5">
          <button class="debug-value" id="debug-daytime-value" type="button" title="Tap to return to auto">AUTO</button>
        </div>
        <div id="debug-weather-rows"></div>
        <div class="debug-meta" id="debug-weather-meta"></div>
        <div class="debug-meta" id="debug-time-meta"></div>
      </div>
      <div class="moon-panel is-hidden" id="moon-panel">
        <div class="moon-label" id="moon-label"></div>
        <div class="moon-icon" id="moon-icon"></div>
        <div class="water-heater-display" id="water-heater-display">
          <div class="water-heater-heading">Water heating</div>
          <div class="water-heater-temperature" id="water-heater-temperature">--<span>°C</span></div>
          <div class="water-heater-target" id="water-heater-target">WATER HEATING</div>
        </div>
      </div>
      <div class="starlink-panel is-hidden" id="starlink-panel">
        <button class="starlink-close" id="starlink-close" type="button" aria-label="Close Starlink panel">\u00D7</button>
        <iframe class="starlink-frame" id="starlink-frame" title="Starlink Combined"></iframe>
        <div class="starlink-card-host is-hidden" id="starlink-card-host"></div>
      </div>
      <div class="overlay"></div>
    </div>
  </div>
</ha-card>
`;
