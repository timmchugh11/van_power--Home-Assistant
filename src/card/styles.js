export const cardStyles = `
  *{box-sizing:border-box}
  :host{
    display:block;
    height:100%;
    min-height:100%;
    overflow:hidden;
  }
  ha-card{
    height:100%;
    min-height:calc(100vh - 32px);
    display:flex;
    flex-direction:column;
    overflow:hidden;
    border-radius:20px;
    --day-card-top:#b5cde4;
    --day-card-mid:#6a87a4;
    --day-card-bottom:#2a3b4d;
    background:linear-gradient(180deg, var(--day-card-top) 0%, var(--day-card-mid) 48%, var(--day-card-bottom) 100%);
    box-shadow:none;
    color:#f5f7fa;
  }
  ha-card.is-night{
    background:linear-gradient(180deg, #020304 0%, #020304 65%, #010203 100%);
    border:none !important;
    outline:none !important;
    box-shadow:none !important;
    --ha-card-border-width:0;
    --ha-card-box-shadow:none;
  }
  .wrap{
    padding:0;
    flex:1;
    display:flex;
    min-height:0;
  }
  .stage{
    position:relative;
    flex:1;
    min-height:620px;
    height:100%;
    width:100%;
    border:none;
    border-radius:18px;
    overflow:hidden;
    --day-stage-top:rgba(151, 192, 236, 0.28);
    --day-stage-mid:rgba(73, 111, 156, 0.16);
    --day-stage-low:rgba(16, 30, 48, 0.06);
    background:radial-gradient(120% 95% at 50% 8%, var(--day-stage-top) 0%, var(--day-stage-mid) 35%, var(--day-stage-low) 70%, rgba(6, 12, 22, 0) 100%);
  }
  .stage.is-night{
    background:radial-gradient(120% 95% at 50% 10%, rgba(24, 28, 36, 0.18) 0%, rgba(10, 13, 18, 0.34) 40%, rgba(4, 6, 9, 0.72) 75%, rgba(2, 3, 4, 0.92) 100%);
  }
  .canvas{position:absolute;inset:0;touch-action:none}
  .canvas canvas{width:100%;height:100%;display:block}
  .overlay{
    position:absolute;
    top:14px;
    right:14px;
    display:flex;
    flex-direction:column;
    gap:8px;
    pointer-events:none;
    align-items:flex-end;
  }
  .date-time-overlay{
    position:absolute;
    top:70px;
    left:70px;
    z-index:3;
    pointer-events:none;
    display:flex;
    flex-direction:column;
    gap:4px;
    align-items:center;
    text-align:center;
  }
  .date-time-time{
    color:#f4f8ff;
    font:600 72px/0.9 "Bahnschrift", "DIN Alternate", "Arial Narrow", "Segoe UI", sans-serif;
    letter-spacing:0.01em;
    text-shadow:0 8px 34px rgba(0,0,0,0.55);
    pointer-events:auto;
    cursor:pointer;
  }
  .date-time-date{
    color:rgba(220,232,247,0.9);
    font:600 16px/1 "Rajdhani", "Segoe UI", sans-serif;
    letter-spacing:0.08em;
    text-transform:uppercase;
    text-shadow:0 6px 24px rgba(0,0,0,0.45);
    pointer-events:auto;
    cursor:pointer;
  }
  .metric-panel{
    position:absolute;
    left:46px;
    bottom:80px;
    width:min(420px, calc(100% - 32px));
    display:grid;
    grid-template-columns:repeat(2, minmax(0, 120px));
    gap:10px;
    pointer-events:none;
    z-index:2;
  }
  .weather-panel{
    position:absolute;
    right:46px;
    bottom:80px;
    width:400px;
    display:flex;
    flex-direction:column;
    align-items:flex-end;
    gap:6px;
    z-index:2;
    pointer-events:auto;
    cursor:pointer;
  }
  .weather-panel.is-hidden{
    display:none;
  }
  .media-player-panel{
    position:absolute;
    left:50%;
    bottom:80px;
    width:clamp(240px, 24vw, 360px);
    min-height:50px;
    padding:9px 16px;
    transform:translateX(-50%);
    z-index:2;
    pointer-events:auto;
    cursor:pointer;
    text-align:center;
    display:flex;
    align-items:center;
    justify-content:center;
    border:1px solid rgba(255, 255, 255, 0.42);
    border-radius:16px;
    background:linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.07));
    box-shadow:0 14px 34px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.52), inset 0 -1px 0 rgba(255,255,255,0.06);
    backdrop-filter:blur(30px) saturate(190%) brightness(1.08);
    -webkit-backdrop-filter:blur(30px) saturate(190%) brightness(1.08);
  }
  .media-player-panel.is-hidden{
    display:none;
  }
  .media-player-panel.has-art{
    padding-left:86px;
  }
  .media-player-art{
    position:absolute;
    left:14px;
    top:-31px;
    width:62px;
    height:62px;
    border-radius:12px;
    object-fit:cover;
    border:1px solid rgba(255, 255, 255, 0.46);
    box-shadow:0 14px 28px rgba(0,0,0,0.26);
    background:rgba(255, 255, 255, 0.12);
  }
  .media-player-art.is-hidden{
    display:none;
  }
  .media-player-label{
    color:rgba(247, 250, 255, 0.92);
    width:100%;
    font:700 16px/1.15 "Rajdhani", "Segoe UI", sans-serif;
    letter-spacing:0;
    text-shadow:0 2px 10px rgba(0,0,0,0.36);
    overflow:hidden;
    white-space:nowrap;
    min-width:0;
  }
  .media-player-text{
    display:inline-block;
    max-width:none;
    will-change:transform;
  }
  .media-player-panel.is-scrolling .media-player-text{
    animation:media-player-marquee var(--media-scroll-duration, 12s) ease-in-out infinite;
  }
  @keyframes media-player-marquee{
    0%, 14%{transform:translateX(0)}
    78%, 88%{transform:translateX(calc(-1 * var(--media-scroll-distance, 0px)))}
    100%{transform:translateX(0)}
  }
  .moon-panel{
    position:absolute;
    top:70px;
    right:70px;
    width:260px;
    height:260px;
    z-index:2;
    pointer-events:none;
    display:flex;
    flex-direction:column;
    align-items:flex-end;
    gap:6px;
  }
  .moon-panel.is-hidden{
    display:none;
  }
  .moon-label{
    color:rgba(198, 206, 217, 0.72);
    font:700 11px/1 Inter, "Rajdhani", "Segoe UI", sans-serif;
    letter-spacing:0.08em;
    text-transform:uppercase;
    text-align:right;
    width:100%;
  }
  .moon-icon{
    width:100%;
    height:100%;
  }
  .moon-icon canvas{
    width:100%;
    height:100%;
    display:block;
  }
  .water-heater-display{
    display:none;
    width:100%;
    height:100%;
    border:1px solid rgba(111, 205, 255, 0.3);
    border-radius:50%;
    background:radial-gradient(circle at 50% 42%, rgba(22, 74, 103, 0.8), rgba(7, 20, 32, 0.88) 68%, rgba(3, 10, 17, 0.94));
    box-shadow:0 0 42px rgba(47, 171, 235, 0.18), inset 0 0 30px rgba(75, 190, 246, 0.08);
    color:#f3fbff;
    align-items:center;
    justify-content:center;
    flex-direction:column;
    text-align:center;
    text-shadow:0 2px 16px rgba(0, 0, 0, 0.72);
  }
  .moon-panel.is-water-heating .moon-label,
  .moon-panel.is-water-heating .moon-icon{
    display:none;
  }
  .moon-panel.is-water-heating .water-heater-display{
    display:flex;
  }
  .water-heater-heading{
    color:rgba(184, 226, 248, 0.78);
    font:700 12px/1 Inter, "Rajdhani", "Segoe UI", sans-serif;
    letter-spacing:0.16em;
    text-transform:uppercase;
    margin-bottom:10px;
  }
  .water-heater-temperature{
    font:700 68px/0.92 Inter, "Rajdhani", "Segoe UI", sans-serif;
    letter-spacing:-0.06em;
  }
  .water-heater-temperature span{
    display:inline-block;
    margin-left:5px;
    color:rgba(211, 239, 253, 0.82);
    font-size:27px;
    letter-spacing:-0.02em;
    vertical-align:top;
    transform:translateY(7px);
  }
  .water-heater-target{
    color:rgba(184, 226, 248, 0.72);
    font:700 11px/1.2 Inter, "Rajdhani", "Segoe UI", sans-serif;
    letter-spacing:0.1em;
    margin-top:14px;
  }
  .starlink-panel{
    position:absolute;
    left:14px;
    top:14px;
    width:min(420px, calc(100% - 28px));
    height:min(300px, 45%);
    border:1px solid rgba(198, 206, 217, 0.35);
    border-radius:14px;
    background:#000;
    box-shadow:0 16px 32px rgba(0,0,0,0.45);
    z-index:4;
    overflow:hidden;
    pointer-events:auto;
  }
  .starlink-panel.is-hidden{
    display:none;
  }
  .starlink-close{
    position:absolute;
    top:8px;
    right:8px;
    width:28px;
    height:28px;
    border:1px solid rgba(198, 206, 217, 0.35);
    border-radius:999px;
    background:rgba(9, 14, 24, 0.7);
    color:#e6eef8;
    font:700 16px/1 "Segoe UI", sans-serif;
    cursor:pointer;
    z-index:2;
  }
  .starlink-frame{
    width:100%;
    height:100%;
    border:none;
    background:#000;
  }
  .starlink-frame.is-hidden,
  .starlink-card-host.is-hidden{
    display:none;
  }
  .starlink-card-host{
    width:100%;
    height:100%;
    overflow:auto;
    padding:10px;
    background:var(--card-background-color, #000);
    color:var(--primary-text-color, #e6eef8);
  }
  .starlink-card-host > *{
    display:block;
    width:100%;
  }
  .weather-label{
    text-shadow:0 1px 8px rgba(0, 0, 0, 0.45);
    color:rgba(198, 206, 217, 0.72);
    font:600 30px/1 "Rajdhani", "Segoe UI", sans-serif;
    letter-spacing:0.08em;
    text-transform:uppercase;
  }
  .weather-inside-label.is-hidden{
    display:none;
  }
  .weather-panel.is-night .weather-label{
    color:rgba(198, 206, 217, 0.72);
  }
  .scene-debug-controls{
    position:absolute;
    top:14px;
    left:14px;
    z-index:5;
    display:none;
    flex-direction:column;
    gap:6px;
    max-height:calc(100% - 28px);
    overflow:auto;
    padding:8px 10px 10px;
    border-radius:12px;
    border:1px solid rgba(198, 206, 217, 0.32);
    background:rgba(9, 14, 24, 0.82);
    backdrop-filter:blur(6px);
    pointer-events:auto;
    cursor:default;
  }
  .scene-debug-controls.is-open{
    display:flex;
  }
  .scene-debug-controls .debug-header{
    display:flex;
    align-items:center;
    gap:8px;
    margin-bottom:2px;
  }
  .scene-debug-controls .debug-title{
    flex:1;
    color:#dce7f4;
    font:700 12px/1 "Rajdhani", "Segoe UI", sans-serif;
    letter-spacing:0.16em;
    text-transform:uppercase;
  }
  .scene-debug-controls .debug-button{
    height:24px;
    min-width:24px;
    padding:0 8px;
    border-radius:7px;
    border:1px solid rgba(198, 206, 217, 0.38);
    background:rgba(9, 14, 24, 0.95);
    color:#dce7f4;
    font:600 11px/1 "Rajdhani", "Segoe UI", sans-serif;
    letter-spacing:0.08em;
    text-transform:uppercase;
    cursor:pointer;
  }
  .scene-debug-controls .debug-row{
    display:flex;
    align-items:center;
    gap:8px;
  }
  #debug-weather-rows{
    display:flex;
    flex-direction:column;
    gap:6px;
  }
  .scene-debug-controls label{
    width:84px;
    flex:none;
    color:rgba(224, 234, 246, 0.88);
    font:600 10px/1 "Rajdhani", "Segoe UI", sans-serif;
    letter-spacing:0.12em;
    text-transform:uppercase;
    white-space:nowrap;
  }
  .scene-debug-controls select{
    width:160px;
    height:28px;
    border-radius:8px;
    border:1px solid rgba(198, 206, 217, 0.38);
    background:rgba(9, 14, 24, 0.95);
    color:#dce7f4;
    font:600 12px/1 "Rajdhani", "Segoe UI", sans-serif;
    letter-spacing:0.04em;
    padding:2px 8px;
  }
  .scene-debug-controls input[type="range"]{
    width:160px;
    flex:none;
    accent-color:#dce7f4;
  }
  .scene-debug-controls .debug-value{
    min-width:118px;
    padding:3px 6px;
    border:0;
    border-radius:6px;
    background:transparent;
    color:rgba(220,231,244,0.62);
    font:700 11px/1 "Rajdhani", "Segoe UI", sans-serif;
    letter-spacing:0.06em;
    text-align:right;
    white-space:nowrap;
    cursor:pointer;
  }
  .scene-debug-controls .debug-value.is-override{
    color:#ffd27a;
    background:rgba(255, 210, 122, 0.1);
  }
  .scene-debug-controls .debug-meta{
    color:rgba(198, 206, 217, 0.86);
    font:600 10px/1.35 "Rajdhani", "Segoe UI", sans-serif;
    letter-spacing:0.04em;
    white-space:pre;
    margin-top:2px;
  }
  .weather-forecast{
    display:flex;
    gap:14px;
    margin-bottom:6px;
  }
  .weather-forecast.is-hidden{
    display:none;
  }
  .forecast-hour{
    text-shadow:0 1px 8px rgba(0, 0, 0, 0.45);
    display:flex;
    flex-direction:column;
    align-items:center;
    gap:3px;
    min-width:44px;
    color:rgba(198, 206, 217, 0.72);
    font:600 15px/1 "Rajdhani", "Segoe UI", sans-serif;
    letter-spacing:0.06em;
  }
  .forecast-time{
    font-size:12px;
    opacity:0.8;
  }
  .forecast-icon{
    --mdc-icon-size:26px;
    color:rgba(220, 231, 244, 0.82);
  }
  .forecast-temp{
    font-size:18px;
  }
  .forecast-rain{
    min-height:12px;
    font-size:12px;
    color:rgba(150, 196, 240, 0.9);
  }
  .metric-tile{
    border-radius:14px;
    padding:10px 12px 11px;
    min-height:82px;
    display:flex;
    flex-direction:column;
    justify-content:space-between;
  }
  .metric-title{
    text-shadow:0 1px 8px rgba(0, 0, 0, 0.45);
    color:rgba(202, 216, 233, 0.76);
    font:600 10px/1 "Rajdhani", "Segoe UI", sans-serif;
    letter-spacing:0.16em;
    text-transform:uppercase;
  }
  .metric-primary{
    text-shadow:0 1px 8px rgba(0, 0, 0, 0.45);
    color:#f3f8ff;
    font:700 26px/1 "Rajdhani", "Segoe UI", sans-serif;
    letter-spacing:0.02em;
    margin-top:4px;
  }
  .metric-detail{
    text-shadow:0 1px 8px rgba(0, 0, 0, 0.45);
    color:rgba(198, 206, 217, 0.72);
    font:600 11px/1 "Rajdhani", "Segoe UI", sans-serif;
    letter-spacing:0.08em;
    text-transform:uppercase;
    margin-top:5px;
  }
  @media (max-width: 900px){
    ha-card{min-height:70vh}
    .stage{
      min-height:0;
      display:flex;
      flex-direction:column;
      gap:10px;
      padding:10px;
    }
    .canvas{
      position:relative;
      inset:auto;
      width:100%;
      height:52vh;
      min-height:320px;
      max-height:580px;
      border-radius:12px;
      overflow:hidden;
      order:1;
    }
    .date-time-overlay{
      top:12px;
      left:12px;
    }
    .date-time-time{
      font-size:44px;
    }
    .date-time-date{
      font-size:12px;
      letter-spacing:0.08em;
    }
    .weather-panel{
      position:static;
      width:100%;
      display:flex;
      align-items:center;
      justify-content:center;
      text-align:center;
      gap:6px;
      order:2;
      pointer-events:auto;
    }
    .weather-panel{
      display:none !important;
    }
    .weather-label{
      font-size:24px;
    }
    .media-player-panel{
      position:static;
      left:auto;
      bottom:auto;
      width:min(320px, 100%);
      min-height:48px;
      padding:9px 14px;
      transform:none;
      order:3;
      align-self:center;
      text-align:center;
    }
    .media-player-panel.has-art{
      padding-left:76px;
    }
    .media-player-art{
      left:12px;
      top:-27px;
      width:54px;
      height:54px;
      border-radius:10px;
    }
    .media-player-label{
      font-size:15px;
      white-space:nowrap;
    }
    .metric-panel{
      position:static;
      left:auto;
      right:auto;
      bottom:auto;
      width:100%;
      gap:8px;
      order:4;
      grid-template-columns:repeat(2, minmax(0, 1fr));
    }
    .metric-tile{
      min-height:74px;
      padding:9px 10px;
    }
    .metric-primary{
      font-size:22px;
    }
    .metric-detail{
      font-size:10px;
    }
    .moon-panel{
      display:none !important;
    }
    .scene-debug-controls{
      top:10px;
      left:10px;
      padding:7px 8px;
    }
    .scene-debug-controls select,
    .scene-debug-controls input[type="range"]{
      width:120px;
    }
    .scene-debug-controls select{
      height:26px;
      font-size:11px;
    }
  }
`;
