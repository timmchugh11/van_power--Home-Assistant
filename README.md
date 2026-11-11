# Van Power

A Home Assistant Lovelace card that renders a 3D model of the van with live power, weather, sun/moon, media and climate information around it. It is designed for an always-on wall tablet.

- 3D van model with day/night lighting driven by real sun position, van heading and weather
- Animated sky, clouds, rain/snow/hail, stars and moon
- Live weather: clouds drift with the real wind direction and speed, cloud amount follows cloud cover, and visibility drives haze and fog
- Grass ground to the horizon with sun shadows, a contact shadow under the van, wet ground and puddles, settling snow and frost
- Solar, hookup, alternator and battery tiles, plus optional floating labels on the model
- Tap the model's lights to toggle them (long-press for more-info); tap the cameras, grills or Starlink dish to open them
- Clock and date, weather panel, moon phase / water-heater panel
- Now-playing tile that opens a full-screen music player (transport, seek, shuffle, repeat, source, volume, Arylic grouping with a second-speaker volume)
- Fullscreen kiosk mode with burn-in pixel shift
- Performance controls (FPS cap, pixel ratio, low-power mode); rendering pauses when the card or tab is hidden

## Installation

### HACS

1. Add this repository as a custom HACS repository of type **Dashboard**.
2. Install **Van Power**.

### Pinned CDN build

Add a Lovelace resource pointing at a specific commit or tag:

```yaml
url: https://cdn.jsdelivr.net/gh/timmchugh11/van_power--Home-Assistant@<commit-or-tag>/van-power-card.js
type: module
```

### Manual

Copy the repo into `config/www/van_power/` and add:

```yaml
url: /local/van_power/van-power-card.js
type: module
```

Other cards (`campervan-energy-dashboard`, `starlink-obstruction-card`) load `/local/van_power/vendor/shared/*.js` and `/local/van_power/van.glb`, so they need this copy even when this card is loaded from HACS or the CDN.

## Example

```yaml
type: custom:van-power-card
battery_voltage: sensor.fogstar_bms_voltage
location_entity: device_tracker.garmin_glo2
van_heading_entity: sensor.starlink_azimuth
van_heading_offset_degrees: 90
sun_entity: sun.sun
weather_entity: weather.dynamic_weather_template
inside_temp_entity: sensor.main_room_586c_temperature
moon_entity: sensor.moon_phase
water_heater_entity: water_heater.water_water_heater
model_light_1_entity: light.power_board_outside_light
model_light_2_entity: light.power_board_outside_light_2
camera_left_entity: camera.h41_mainstream
camera_right_entity: camera.drivers_mainstream
upper_grill: fan.extractor_fan_extractor_fan
lower_grill: climate.152832116388611_climate
media_player_entity: media_player.master_room
media_player_filter: Youtube,Netflix,Prime Video,Disney+
starlink_card:
  type: custom:starlink-obstruction-card
light_style: spotlight
spin_enabled: false
fullscreen: true
homepage_url: /lovelace/default_view
```

All options can also be set in the visual editor.

## Options

### Power

| Option | Default | Description |
| --- | --- | --- |
| `solar_voltage` / `solar_amp` / `solar_watt` | `sensor.epever_pv_*` | Solar input |
| `grid_voltage` / `grid_amp` / `grid_watt` | `sensor.charger_hookup_*` | Hookup (mains) charger |
| `alternator_voltage` / `alternator_amp` / `alternator_watt` | `sensor.charger_alternator_*` | Alternator charger |
| `battery_voltage` | `sensor.epever_battery_voltage` | Battery voltage |
| `battery_amp` / `battery_watt` | `sensor.battery_current` / `sensor.battery_wattage` | Battery current / power |
| `battery_percent` | `sensor.battery_percentage` | State of charge |

The power defaults are kept for backwards compatibility. Set each one explicitly if your entities are named differently.

### Location, sun and sky

| Option | Default | Description |
| --- | --- | --- |
| `sun_entity` | – | Sun entity; `next_dawn` / `next_dusk` attributes drive day/night |
| `location_entity` | – | Entity with latitude/longitude attributes (e.g. a GPS tracker) |
| `latitude_attribute` / `longitude_attribute` | `latitude` / `longitude` | Attribute names on `location_entity` |
| `latitude_entity` / `longitude_entity` | – | Alternative: separate numeric entities |
| `latitude` / `longitude` | – | Alternative: fixed values. Falls back to the Home Assistant home location |
| `van_heading_entity` | – | Entity giving the van's compass heading in degrees |
| `van_heading_offset_degrees` | `0` | Offset added to the heading |
| `sun_intensity_scale` | `2.45` | Sunlight strength, 0–5 |
| `weather_entity` | – | Weather entity. The condition picks the scene (clouds, rain, snow, fog, storms); `wind_speed`, `wind_gust_speed` and `wind_bearing` drive cloud drift and rain slant (relative to the van's heading); `cloud_coverage` sets how much cloud there is; `visibility` and `humidity` set haze and fog; `temperature` and `humidity` drive drying, frost and snow melt; the hourly forecast's rainfall sets rain strength |
| `show_forecast` | `true` | Show the next few hours of the hourly forecast above the weather label |
| `forecast_hours` | `5` | Number of forecast hours to show, 1–12 |
| `inside_temp_entity` | – | Inside temperature shown under the weather |
| `moon_entity` | – | Moon phase sensor (shown at night) |
| `show_clouds` | `true` | Show the cloud layer |
| `show_compass` | `true` | Compass ring under the van |

### Model and interaction

| Option | Default | Description |
| --- | --- | --- |
| `light_style` | `studio` | `studio` (even lighting) or `spotlight` (lit by the van's own lights) |
| `model_light_1_entity` / `model_light_2_entity` | – | Lights mapped to the model's lamps; tap toggles, long-press opens more-info |
| `model_light_cone_degrees` / `model_light_distance` / `model_light_penumbra` / `model_light_intensity_boost` | `160` / `26` / `0.45` / `6` | Model lamp shape and strength |
| `camera_left_entity` / `camera_right_entity` | – | Opened when the model's cameras are tapped |
| `upper_grill` / `lower_grill` | – | Opened when the model's grills are tapped |
| `starlink_card` | – | Card config shown in a pop-up when the Starlink dish is tapped |
| `water_heater_entity` | – | Shows the water-heater panel while its state is `gas` |
| `spin_enabled` | `true` | Slowly rotate the model |
| `reset_view_on_reload` | `false` | Start from the default camera view after a page reload instead of the last saved one (navigating between dashboard views still keeps the current view) |
| `show_floating_metrics` | `false` | Show power figures as floating labels on the model |

### Media

| Option | Default | Description |
| --- | --- | --- |
| `media_player_entity` | – | Player whose metadata is shown; falls back to the Music Assistant players when idle |
| `media_volume_entity` | – | Player used for the primary volume slider |
| `media_player_secondary_entity` | – | Second speaker, with its own volume slider while grouped |
| `media_group_leader_entity` | – | Group leader for Arylic grouping |
| `media_player_filter` | – | Comma-separated terms; matching apps or titles (e.g. `Netflix`) hide the tile |

### Display and performance

| Option | Default | Description |
| --- | --- | --- |
| `fullscreen` | `false` | Hide the Home Assistant header and sidebar and enable burn-in pixel shift |
| `homepage_url` | – | Where tapping the clock navigates to |
| `date_time_scale` / `metrics_scale` / `weather_scale` | `1` | Size multipliers for the clock, power tiles and weather panel |
| `fps_limit` | `30` (`15` in low-power mode) | Frame-rate cap, 1–60 |
| `max_pixel_ratio` | `1.5` (`1` in low-power mode) | Render resolution cap, 0.5–2 |
| `low_power_mode` | `auto` | `auto` (on for Android), `true` or `false`; disables antialiasing and sun shadows, and lowers defaults |
| `debug_time_of_day` | – | 0–1 to simulate the time of day |
| `show_debug_controls` | `false` | Always show the debug panel. Long-press the weather panel to toggle it either way |

### Debug panel

Long-press the weather panel to open it. It overrides the weather condition, time of day, wind, gusts, wind direction, cloud cover, visibility, humidity, temperature, rainfall, ground wetness and snow cover for this browser only. Values marked `AUTO` come from Home Assistant; tap a value to return it to auto, or use **Reset all**.

## Development

The card is written as ES modules in `src/` and bundled into `van-power-card.js`, the file HACS and the CDN serve. Edit `src/`, never `van-power-card.js` directly.

```sh
npm install
npm run build     # bundle src/ -> van-power-card.js
npm run watch     # rebuild on change
npm run check     # build, syntax-check, validate van.glb and compare it with the source model
```

Commit the rebuilt `van-power-card.js` with your `src/` changes. If you load the card from jsDelivr, update the commit or tag in the Lovelace resource URL after pushing.

### Testing on Home Assistant

To try a build before committing, copy it next to the other files under a different name and point the Lovelace resource at it, with a query string that changes per build so browsers fetch the new file:

```sh
scp van-power-card.js <ha-host>:/config/www/van_power/van-power-card.dev.js
```

```yaml
url: /local/van_power/van-power-card.dev.js?v=<build-hash>
type: module
```

The dev file loads the same `van.glb`, ground textures and `vendor/shared/` files from `/local/van_power/`, so those need to match the repo. Point the resource back at the jsDelivr URL once the change is committed and pushed.

### Layout

```
src/
  index.js                 entrypoint: registers the card and editor
  platform/image-bitmap.js texture-decode workarounds (Android, decode throttling)
  assets.js                model and texture URLs
  card/                    the <van-power-card> element
    van-power-card.js        lifecycle, render, update
    config.js                defaults and storage keys
    styles.js, template.js   shadow DOM CSS and markup
    weather-inputs.js        weather measurements, unit conversion, hourly forecast subscription
    weather-debug.js         the debug panel
    *.js                     other feature mixins (weather, media, starlink, fullscreen, clock, metrics, ...)
  editor/                  the visual config editor
  music/player-page.js     full-screen music player
  scene/                   three.js scene
    van-scene.js             scene setup, sun/lighting, model loading, input, render loop
    weather-model.js         turns measurements (wind, visibility, rain, temperature) into effect levels
    sky-dome.js, ground.js, clouds.js, precipitation.js, weather-recipes.js
    hotspot-picker.js, labels.js, compass.js, moon-icon-scene.js
    math.js, sprite-textures.js, model-loader.js, model-bounds.js
  vendor/                  entry files for the shared three.js build
```

three.js is not bundled into the card. It is built once into `vendor/shared/` by `npm run build:vendor` and shared with the other van cards. Only rebuild it when upgrading three.js, because the other cards import those files directly.

### 3D model

The editable source model is `assets/van.source.glb`. Regenerate the optimised runtime model with `npm run optimize:model`, then run `npm run check`. The check fails if a node name, extras key or animation the code relies on has been lost. The card uses the 1024 px WebP ground textures in `ground/`. The original PNG sources are kept for asset work but excluded from HACS.
