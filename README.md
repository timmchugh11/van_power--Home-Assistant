# Van Power

Standalone HACS-compatible Home Assistant custom card that renders the 3D van power model directly in Lovelace.

The card reads Home Assistant entity states directly from Lovelace and renders the 3D scene entirely inside the custom card.

## Features

- Standalone `custom:van-power-card` Lovelace card
- 3D van model rendered directly in the card
- Reads Home Assistant sensor state from the current Lovelace session
- No add-on ingress dependency
- Full-screen artwork-led music player opened from the now-playing tile
- Transport, seek, shuffle, repeat, source, mute and volume controls
- Arylic grouping with an independent second-speaker volume slider while grouped

## Installation

### HACS

1. Add this repository as a custom HACS repository of type `Dashboard`.
2. Install `Van Power`.

### Manual

Copy the contents of this folder into your Home Assistant `www` directory, then add:

```yaml
url: /local/van_power/van-power-card.js
type: module
```

The card entrypoint is `van-power-card.js`.

## Development

Install the pinned development dependencies and build the shared Three.js modules:

```sh
npm install
npm run build
```

The editable source model is `assets/van.source.glb`. Regenerate the optimized runtime model and validate the complete package with:

```sh
npm run optimize:model
npm run check
```

The runtime model preserves the source node names and animation while applying Meshopt geometry compression and limiting embedded textures to 2048px. Both 3D cards use the same statically imported, preconfigured GLTFLoader. The card uses the 1024px WebP ground textures in `ground/`; the original texture sources remain available for future asset work but are excluded from HACS releases.

## Example Card

```yaml
type: custom:van-power-card
solar_voltage: sensor.epever_pv_voltage
solar_amp: sensor.epever_pv_current
solar_watt: sensor.epever_pv_power
battery_voltage: sensor.epever_battery_voltage
battery_amp: sensor.battery_current
battery_watt: sensor.battery_wattage
grid_voltage: sensor.charger_hookup_voltage
grid_amp: sensor.charger_hookup_current
grid_watt: sensor.charger_hookup_power
alternator_voltage: sensor.charger_alternator_voltage
alternator_amp: sensor.charger_alternator_current
alternator_watt: sensor.charger_alternator_power
battery_percent: sensor.battery_percentage
media_player_entity: media_player.front_music_assistant
media_volume_entity: media_player.front
media_player_secondary_entity: media_player.master_room
media_group_leader_entity: media_player.front
```

## Default Entities

If a field is omitted, the card falls back to these defaults:

- `sensor.epever_pv_voltage`
- `sensor.epever_pv_current`
- `sensor.epever_pv_power`
- `sensor.epever_battery_voltage`
- `sensor.battery_current`
- `sensor.battery_wattage`
- `sensor.charger_hookup_voltage`
- `sensor.charger_hookup_current`
- `sensor.charger_hookup_power`
- `sensor.charger_alternator_voltage`
- `sensor.charger_alternator_current`
- `sensor.charger_alternator_power`
- `sensor.battery_percentage`
