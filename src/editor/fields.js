export const EDITOR_FIELD_GROUPS = [
  {
    title: "Power Entities",
    fields: [
      { key: "solar_voltage", label: "Solar Voltage Entity", type: "entity", includeDomains: ["sensor"] },
      { key: "solar_amp", label: "Solar Current Entity", type: "entity", includeDomains: ["sensor"] },
      { key: "solar_watt", label: "Solar Power Entity", type: "entity", includeDomains: ["sensor"] },
      { key: "battery_voltage", label: "Battery Voltage Entity", type: "entity", includeDomains: ["sensor"] },
      { key: "battery_amp", label: "Battery Current Entity", type: "entity", includeDomains: ["sensor"] },
      { key: "battery_watt", label: "Battery Power Entity", type: "entity", includeDomains: ["sensor"] },
      { key: "battery_percent", label: "Battery Percent Entity", type: "entity", includeDomains: ["sensor"] },
      { key: "grid_voltage", label: "Hookup Voltage Entity", type: "entity", includeDomains: ["sensor"] },
      { key: "grid_amp", label: "Hookup Current Entity", type: "entity", includeDomains: ["sensor"] },
      { key: "grid_watt", label: "Hookup Power Entity", type: "entity", includeDomains: ["sensor"] },
      { key: "alternator_voltage", label: "Alternator Voltage Entity", type: "entity", includeDomains: ["sensor"] },
      { key: "alternator_amp", label: "Alternator Current Entity", type: "entity", includeDomains: ["sensor"] },
      { key: "alternator_watt", label: "Alternator Power Entity", type: "entity", includeDomains: ["sensor"] }
    ]
  },
  {
    title: "Sun Model",
    fields: [
      { key: "sun_entity", label: "Sun Entity (next_dawn/next_dusk)", type: "entity", includeDomains: ["sun"] },
      { key: "moon_entity", label: "Moon Phase Entity", type: "entity", includeDomains: ["sensor"] },
      { key: "water_heater_entity", label: "Water Heater Entity", type: "entity", includeDomains: ["water_heater"] },
      { key: "location_entity", label: "Location Entity", type: "entity", includeDomains: ["device_tracker", "person", "zone", "sensor"] },
      { key: "latitude_attribute", label: "Latitude Attribute", type: "text" },
      { key: "longitude_attribute", label: "Longitude Attribute", type: "text" },
      { key: "latitude_entity", label: "Latitude Entity", type: "entity", includeDomains: ["sensor", "input_number", "number"] },
      { key: "longitude_entity", label: "Longitude Entity", type: "entity", includeDomains: ["sensor", "input_number", "number"] },
      { key: "van_heading_entity", label: "Van Heading Entity", type: "entity", includeDomains: ["sensor", "input_number", "number", "device_tracker"] },
      { key: "van_heading_offset_degrees", label: "Van Heading Offset (deg)", type: "number", step: "0.1" },
      { key: "sun_intensity_scale", label: "Sun Intensity Scale (0-5)", type: "number", step: "0.01", min: "0", max: "5" }
    ]
  },
  {
    title: "Model Lights",
    fields: [
      { key: "model_light_1_entity", label: "Model Light 1 Entity", type: "entity", includeDomains: ["light"] },
      { key: "model_light_2_entity", label: "Model Light 2 Entity", type: "entity", includeDomains: ["light"] },
      { key: "camera_left_entity", label: "Camera Left Entity", type: "entity", includeDomains: ["camera"] },
      { key: "camera_right_entity", label: "Camera Right Entity", type: "entity", includeDomains: ["camera"] },
      { key: "upper_grill", label: "Upper Grill Entity", type: "entity" },
      { key: "lower_grill", label: "Lower Grill Entity", type: "entity" },
      { key: "model_light_cone_degrees", label: "Light Cone Degrees", type: "number", step: "1" },
      { key: "model_light_distance", label: "Light Distance", type: "number", step: "0.1" },
      { key: "model_light_penumbra", label: "Light Penumbra", type: "number", step: "0.01" },
      { key: "model_light_intensity_boost", label: "Light Intensity Boost", type: "number", step: "0.1" }
    ]
  },
  {
    title: "Display",
    fields: [
      { key: "light_style", label: "Light Style", type: "select", options: [{ value: "studio", label: "Studio" }, { value: "spotlight", label: "Model" }] },
      { key: "show_compass", label: "Show Compass", type: "boolean" },
      { key: "show_floating_metrics", label: "Show Floating Metrics", type: "boolean" },
      { key: "show_clouds", label: "Show Clouds", type: "boolean" },
      { key: "show_forecast", label: "Show Hourly Forecast", type: "boolean" },
      { key: "forecast_hours", label: "Forecast Hours", type: "number", step: "1", min: "1", max: "12" },
      { key: "spin_enabled", label: "Spin Enabled", type: "boolean" },
      { key: "reset_view_on_reload", label: "Reset View On Page Reload", type: "boolean" },
      { key: "debug_time_of_day", label: "Debug Time Of Day (0-1)", type: "number", step: "0.01", min: "0", max: "1" },
      { key: "show_debug_controls", label: "Always Show Debug Panel (long-press weather to toggle)", type: "boolean" },
      { key: "fullscreen", label: "Fullscreen", type: "boolean" },
      { key: "homepage_url", label: "Homepage URL", type: "text" },
      { key: "date_time_scale", label: "Date/Time Scale", type: "number", step: "0.05", min: "0.5", max: "2.5" },
      { key: "metrics_scale", label: "Metrics Scale", type: "number", step: "0.05", min: "0.5", max: "2.5" },
      { key: "weather_scale", label: "Weather Scale", type: "number", step: "0.05", min: "0.5", max: "2.5" }
    ]
  },
  {
    title: "Performance",
    fields: [
      { key: "low_power_mode", label: "Low Power Mode", type: "select", options: [{ value: "auto", label: "Auto (lower quality on Android)" }, { value: "true", label: "Always On" }, { value: "false", label: "Always Off" }] },
      { key: "max_pixel_ratio", label: "Max Pixel Ratio", type: "number", step: "0.1", min: "0.5", max: "2" },
      { key: "fps_limit", label: "FPS Limit", type: "number", step: "1", min: "1", max: "60" }
    ]
  },
  {
    title: "Weather",
    fields: [
      { key: "weather_entity", label: "Weather Entity", type: "entity", includeDomains: ["weather"] },
      { key: "inside_temp_entity", label: "Inside Temperature Entity (Optional)", type: "entity", includeDomains: ["sensor", "input_number", "number"] },
      { key: "media_player_entity", label: "Music Player / Metadata Entity", type: "entity", includeDomains: ["media_player"] },
      { key: "media_volume_entity", label: "Primary Volume Entity (Optional)", type: "entity", includeDomains: ["media_player"] },
      { key: "media_player_secondary_entity", label: "Second Speaker Entity (Optional)", type: "entity", includeDomains: ["media_player"] },
      { key: "media_group_leader_entity", label: "Group Leader Entity (Optional)", type: "entity", includeDomains: ["media_player"] },
      { key: "media_player_filter", label: "Media Player Hide Filter (comma separated)", type: "text" }
    ]
  }
];
