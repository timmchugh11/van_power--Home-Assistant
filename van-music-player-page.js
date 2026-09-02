const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

class VanMusicPlayerPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._config = {};
    this._open = false;
    this._progressTimer = null;
    this.render();
  }

  connectedCallback() {
    if (!this._progressTimer) {
      this._progressTimer = setInterval(() => this.updateProgress(), 1000);
    }
  }

  disconnectedCallback() {
    if (this._progressTimer) clearInterval(this._progressTimer);
    this._progressTimer = null;
  }

  set hass(value) {
    this._hass = value;
    this.update();
  }

  set config(value) {
    this._config = value || {};
    this.update();
  }

  open() {
    this._open = true;
    this.classList.add("is-open");
    this.update();
  }

  close() {
    this._open = false;
    this.classList.remove("is-open");
    this.dispatchEvent(new CustomEvent("music-page-closed", { bubbles: true, composed: true }));
  }

  lookup(entityId) {
    return entityId ? this._hass?.states?.[entityId] : null;
  }

  entityIds() {
    const player = String(this._config.media_player_entity || "media_player.front_music_assistant").trim();
    const volume = String(this._config.media_volume_entity || player).trim();
    const secondary = String(this._config.media_player_secondary_entity || "media_player.front").trim();
    const leader = String(this._config.media_group_leader_entity || volume).trim();
    return { player, volume, secondary, leader };
  }

  activePlayerEntity() {
    const { player } = this.entityIds();
    const candidates = [player, "media_player.front_music_assistant", "media_player.master_room_music_assistant"];
    return candidates.find((entityId) => ["playing", "paused"].includes(this.lookup(entityId)?.state)) || player;
  }

  isAvailable(state) {
    return state && !["unknown", "unavailable"].includes(String(state.state));
  }

  isGrouped() {
    const { volume, secondary } = this.entityIds();
    if (!volume || !secondary || volume === secondary) return false;
    const members = [
      ...(this.lookup(volume)?.attributes?.group_members || []),
      ...(this.lookup(secondary)?.attributes?.group_members || []),
    ];
    return members.includes(volume) && members.includes(secondary);
  }

  artworkUrl(state) {
    const raw = String(
      state?.attributes?.entity_picture ||
      state?.attributes?.media_image_url ||
      state?.attributes?.media_image || ""
    ).trim();
    if (!raw || ["unknown", "unavailable"].includes(raw)) return "";
    if (/^https?:\/\//i.test(raw) || raw.startsWith("data:")) return raw;
    if (raw.startsWith("//")) return `${window.location.protocol}${raw}`;
    if (raw.startsWith("/") && typeof this._hass?.hassUrl === "function") return this._hass.hassUrl(raw);
    return raw;
  }

  formatTime(seconds) {
    const value = Math.max(0, Math.round(Number(seconds) || 0));
    const minutes = Math.floor(value / 60);
    return `${minutes}:${String(value % 60).padStart(2, "0")}`;
  }

  effectivePosition(state) {
    const attrs = state?.attributes || {};
    let position = Number(attrs.media_position);
    if (!Number.isFinite(position)) return null;
    if (state.state === "playing" && attrs.media_position_updated_at) {
      const updated = new Date(attrs.media_position_updated_at).getTime();
      if (Number.isFinite(updated)) position += Math.max(0, (Date.now() - updated) / 1000);
    }
    const duration = Number(attrs.media_duration);
    return Number.isFinite(duration) ? clamp(position, 0, duration) : Math.max(0, position);
  }

  call(service, data = {}, entityId = this.activePlayerEntity()) {
    if (!entityId || !this._hass?.callService) return;
    this._hass.callService("media_player", service, { entity_id: entityId, ...data });
  }

  updateProgress() {
    if (!this._open) return;
    const state = this.lookup(this.activePlayerEntity());
    const duration = Number(state?.attributes?.media_duration);
    const position = this.effectivePosition(state);
    const slider = this.shadowRoot.getElementById("music-progress");
    const elapsed = this.shadowRoot.getElementById("music-elapsed");
    const total = this.shadowRoot.getElementById("music-duration");
    const valid = Number.isFinite(duration) && duration > 0 && Number.isFinite(position);
    if (slider && slider.dataset.dragging !== "true") {
      slider.disabled = !valid;
      slider.max = valid ? String(duration) : "1";
      slider.value = valid ? String(position) : "0";
    }
    if (elapsed) elapsed.textContent = valid ? this.formatTime(position) : "--:--";
    if (total) total.textContent = valid ? this.formatTime(duration) : "--:--";
  }

  updateVolumeRow(prefix, entityId, visible = true) {
    const row = this.shadowRoot.getElementById(`${prefix}-volume-row`);
    if (!row) return;
    row.classList.toggle("is-hidden", !visible);
    if (!visible) return;
    const state = this.lookup(entityId);
    const value = clamp(Number(state?.attributes?.volume_level) || 0);
    const label = row.querySelector("[data-role='label']");
    const number = row.querySelector("[data-role='value']");
    const slider = row.querySelector("input");
    const mute = row.querySelector("button");
    if (label) label.textContent = state?.attributes?.friendly_name || entityId.split(".").pop().replaceAll("_", " ");
    if (number) number.textContent = `${Math.round(value * 100)}%`;
    if (slider && slider.dataset.dragging !== "true") slider.value = String(Math.round(value * 100));
    if (slider) slider.disabled = !this.isAvailable(state);
    if (mute) {
      mute.dataset.entity = entityId;
      mute.classList.toggle("is-active", state?.attributes?.is_volume_muted === true);
      mute.setAttribute("aria-label", state?.attributes?.is_volume_muted ? "Unmute" : "Mute");
    }
    row.dataset.entity = entityId;
  }

  update() {
    if (!this.shadowRoot) return;
    const { volume, secondary } = this.entityIds();
    const player = this.activePlayerEntity();
    const state = this.lookup(player);
    const attrs = state?.attributes || {};
    const available = this.isAvailable(state);
    const grouped = this.isGrouped();
    const art = this.artworkUrl(state);
    const title = String(attrs.media_title || "Nothing playing");
    const artist = String(attrs.media_artist || attrs.media_album_artist || "");
    const album = String(attrs.media_album_name || "");
    const source = String(attrs.source || attrs.app_name || "");
    const status = String(state?.state || "unavailable");

    this.shadowRoot.getElementById("music-title").textContent = title;
    this.shadowRoot.getElementById("music-artist").textContent = artist;
    this.shadowRoot.getElementById("music-album").textContent = album;
    this.shadowRoot.getElementById("music-status").textContent = source ? `${status} · ${source}` : status;
    const artNode = this.shadowRoot.getElementById("music-art");
    const fallback = this.shadowRoot.getElementById("music-art-fallback");
    const backdrop = this.shadowRoot.getElementById("music-backdrop");
    if (art) {
      if (artNode.dataset.src !== art) {
        artNode.dataset.src = art;
        artNode.src = art;
      }
      artNode.classList.remove("is-hidden");
      fallback.classList.add("is-hidden");
      backdrop.style.backgroundImage = `url("${art.replaceAll('"', '%22')}")`;
      this.classList.add("has-art");
    } else {
      artNode.removeAttribute("src");
      artNode.dataset.src = "";
      artNode.classList.add("is-hidden");
      fallback.classList.remove("is-hidden");
      backdrop.style.backgroundImage = "none";
      this.classList.remove("has-art");
    }

    const play = this.shadowRoot.getElementById("music-play");
    play.querySelector("ha-icon").setAttribute("icon", state?.state === "playing" ? "mdi:pause" : "mdi:play");
    play.setAttribute("aria-label", state?.state === "playing" ? "Pause" : "Play");
    this.shadowRoot.getElementById("music-shuffle").classList.toggle("is-active", attrs.shuffle === true);
    this.shadowRoot.getElementById("music-repeat").classList.toggle("is-active", attrs.repeat && attrs.repeat !== "off");
    this.shadowRoot.getElementById("music-repeat").dataset.repeat = attrs.repeat || "off";
    this.shadowRoot.querySelectorAll(".transport button").forEach((button) => button.disabled = !available);

    const groupButton = this.shadowRoot.getElementById("music-group");
    groupButton.classList.toggle("is-active", grouped);
    groupButton.querySelector("span").textContent = grouped ? "Grouped" : "Group speakers";
    groupButton.querySelector("ha-icon").setAttribute("icon", grouped ? "mdi:speaker-multiple" : "mdi:speaker-plus");

    this.updateVolumeRow("primary", volume, true);
    this.updateVolumeRow("secondary", secondary, grouped);

    const sourceSelect = this.shadowRoot.getElementById("music-source");
    const sourceState = this.lookup(volume) || state;
    const sources = Array.isArray(sourceState?.attributes?.source_list) ? sourceState.attributes.source_list : [];
    const currentSource = String(sourceState?.attributes?.source || "");
    const sourceKey = `${currentSource}|${sources.join("|")}`;
    if (sourceSelect.dataset.key !== sourceKey) {
      sourceSelect.dataset.key = sourceKey;
      sourceSelect.innerHTML = sources.map((item) => {
        const option = document.createElement("option");
        option.value = item;
        option.textContent = item;
        option.selected = item === currentSource;
        return option.outerHTML;
      }).join("");
    }
    sourceSelect.disabled = !sources.length;
    this.updateProgress();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host{position:absolute;inset:0;z-index:30;display:none;color:#fff;font-family:Inter,"Segoe UI",sans-serif;overflow:hidden;background:#090b10}
        :host(.is-open){display:block;animation:page-in .34s cubic-bezier(.2,.8,.2,1)}
        @keyframes page-in{from{opacity:0;transform:scale(1.018)}to{opacity:1;transform:scale(1)}}
        *{box-sizing:border-box}
        .backdrop{position:absolute;inset:-42px;background-position:center;background-size:cover;filter:blur(38px) saturate(1.4);opacity:.62;transform:scale(1.08)}
        .wash{position:absolute;inset:0;background:radial-gradient(circle at 18% 42%,rgba(255,255,255,.13),transparent 36%),linear-gradient(110deg,rgba(6,8,13,.42),rgba(5,7,12,.82) 58%,rgba(4,6,10,.95))}
        .page{position:relative;z-index:1;height:100%;min-height:620px;display:grid;grid-template-rows:auto 1fr;padding:34px 46px 40px}
        .topbar{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-inline:38px}
        button,select,input{font:inherit}
        button{border:0;color:#fff;cursor:pointer}
        button:disabled{opacity:.32;cursor:default}
        .glass{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16);box-shadow:inset 0 1px rgba(255,255,255,.13),0 14px 44px rgba(0,0,0,.18);backdrop-filter:blur(24px) saturate(150%);-webkit-backdrop-filter:blur(24px) saturate(150%)}
        .icon-button{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15)}
        .icon-button ha-icon{--mdc-icon-size:24px}
        .group-button{height:46px;padding:0 18px;border-radius:23px;display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);font-weight:700}
        .group-button.is-active{background:rgba(103,232,190,.18);border-color:rgba(103,232,190,.5);color:#9ff4d5}
        .content{min-height:0;display:grid;grid-template-columns:minmax(300px,42%) minmax(390px,1fr);align-items:center;gap:clamp(44px,7vw,110px);max-width:1400px;width:100%;margin:0 auto}
        .art-shell{position:relative;width:min(42vw,560px);aspect-ratio:1;border-radius:32px;overflow:hidden;background:linear-gradient(145deg,#262b38,#11141c);box-shadow:0 38px 90px rgba(0,0,0,.48),0 0 0 1px rgba(255,255,255,.12)}
        .art-shell img{width:100%;height:100%;object-fit:cover;display:block}
        .art-shell img.is-hidden,.art-fallback.is-hidden{display:none}
        .art-fallback{width:100%;height:100%;display:grid;place-items:center;background:radial-gradient(circle at 36% 28%,#526177,#171c27 55%,#090b11)}
        .art-fallback ha-icon{--mdc-icon-size:120px;color:rgba(255,255,255,.68)}
        .details{min-width:0;display:flex;flex-direction:column;gap:24px}
        .eyebrow{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.58);font-weight:800}
        h1{margin:7px 0 0;font-size:clamp(34px,4.2vw,68px);line-height:.98;letter-spacing:-.045em;max-width:780px;text-wrap:balance}
        .artist{font-size:clamp(18px,1.8vw,28px);font-weight:650;color:rgba(255,255,255,.78);margin-top:10px}
        .album{font-size:14px;color:rgba(255,255,255,.48);margin-top:5px}
        .timeline{display:grid;grid-template-columns:48px 1fr 48px;gap:12px;align-items:center;font-size:12px;font-variant-numeric:tabular-nums;color:rgba(255,255,255,.58)}
        input[type=range]{appearance:none;width:100%;height:5px;border-radius:9px;background:rgba(255,255,255,.2);accent-color:#fff;cursor:pointer}
        input[type=range]::-webkit-slider-thumb{appearance:none;width:17px;height:17px;border-radius:50%;background:#fff;box-shadow:0 3px 12px rgba(0,0,0,.35)}
        .transport{display:flex;align-items:center;justify-content:center;gap:clamp(14px,2vw,28px)}
        .transport button{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:transparent}
        .transport button.is-active{color:#76edc3;background:rgba(118,237,195,.1)}
        .transport .play{width:76px;height:76px;background:#fff;color:#080a0e;box-shadow:0 16px 42px rgba(0,0,0,.34)}
        .transport .play ha-icon{--mdc-icon-size:38px}
        .transport button:not(.play) ha-icon{--mdc-icon-size:28px}
        .mixer{border-radius:24px;padding:18px 20px;display:flex;flex-direction:column;gap:15px}
        .volume-row{display:grid;grid-template-columns:32px minmax(90px,140px) 1fr 46px;align-items:center;gap:12px}
        .volume-row.is-hidden{display:none}
        .volume-row button{width:32px;height:32px;border-radius:50%;background:transparent;display:grid;place-items:center}
        .volume-row button.is-active{color:#ff8f9c;background:rgba(255,103,122,.12)}
        .volume-label{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .volume-value{text-align:right;font-size:13px;font-variant-numeric:tabular-nums;color:rgba(255,255,255,.6)}
        .footer-controls{display:flex;align-items:center;gap:12px}
        .source-select{min-width:170px;max-width:240px;height:44px;border-radius:22px;padding:0 38px 0 16px;color:#fff;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15)}
        .source-select option{color:#111;background:#fff}
        @media(max-width:900px){
          .page{padding:18px 20px 24px;min-height:100%}
          .topbar{margin-inline:48px}
          .content{grid-template-columns:1fr;gap:20px;align-content:start;overflow:auto;padding:20px 0}
          .art-shell{width:min(68vw,360px);margin:0 auto;border-radius:24px}
          .details{gap:16px}.track{text-align:center}h1{font-size:clamp(30px,8vw,48px)}
          .volume-row{grid-template-columns:30px 92px 1fr 42px}
          .footer-controls{justify-content:center}
        }
      </style>
      <div class="backdrop" id="music-backdrop"></div><div class="wash"></div>
      <div class="page">
        <div class="topbar">
          <button class="icon-button glass" id="music-close" aria-label="Back"><ha-icon icon="mdi:arrow-left"></ha-icon></button>
          <button class="group-button glass" id="music-group"><ha-icon icon="mdi:speaker-plus"></ha-icon><span>Group speakers</span></button>
        </div>
        <main class="content">
          <div class="art-shell"><img id="music-art" class="is-hidden" alt="Album artwork"><div class="art-fallback" id="music-art-fallback"><ha-icon icon="mdi:music-note"></ha-icon></div></div>
          <section class="details">
            <div class="track"><div class="eyebrow" id="music-status">Unavailable</div><h1 id="music-title">Nothing playing</h1><div class="artist" id="music-artist"></div><div class="album" id="music-album"></div></div>
            <div class="timeline"><span id="music-elapsed">--:--</span><input id="music-progress" type="range" min="0" max="1" value="0" disabled><span id="music-duration">--:--</span></div>
            <div class="transport">
              <button id="music-shuffle" aria-label="Shuffle"><ha-icon icon="mdi:shuffle-variant"></ha-icon></button>
              <button id="music-prev" aria-label="Previous"><ha-icon icon="mdi:skip-previous"></ha-icon></button>
              <button id="music-play" class="play" aria-label="Play"><ha-icon icon="mdi:play"></ha-icon></button>
              <button id="music-next" aria-label="Next"><ha-icon icon="mdi:skip-next"></ha-icon></button>
              <button id="music-repeat" aria-label="Repeat"><ha-icon icon="mdi:repeat"></ha-icon></button>
            </div>
            <div class="mixer glass">
              <div class="volume-row" id="primary-volume-row"><button aria-label="Mute"><ha-icon icon="mdi:volume-high"></ha-icon></button><span class="volume-label" data-role="label"></span><input type="range" min="0" max="100" step="1"><span class="volume-value" data-role="value">0%</span></div>
              <div class="volume-row is-hidden" id="secondary-volume-row"><button aria-label="Mute"><ha-icon icon="mdi:volume-high"></ha-icon></button><span class="volume-label" data-role="label"></span><input type="range" min="0" max="100" step="1"><span class="volume-value" data-role="value">0%</span></div>
            </div>
            <div class="footer-controls"><select class="source-select glass" id="music-source" aria-label="Audio source"></select></div>
          </section>
        </main>
      </div>
    `;

    this.shadowRoot.getElementById("music-close").addEventListener("click", () => this.close());
    this.shadowRoot.getElementById("music-play").addEventListener("click", () => {
      const state = this.lookup(this.activePlayerEntity());
      this.call(state?.state === "playing" ? "media_pause" : "media_play");
    });
    this.shadowRoot.getElementById("music-prev").addEventListener("click", () => this.call("media_previous_track"));
    this.shadowRoot.getElementById("music-next").addEventListener("click", () => this.call("media_next_track"));
    this.shadowRoot.getElementById("music-shuffle").addEventListener("click", () => {
      const state = this.lookup(this.activePlayerEntity());
      this.call("shuffle_set", { shuffle: state?.attributes?.shuffle !== true });
    });
    this.shadowRoot.getElementById("music-repeat").addEventListener("click", (event) => {
      const current = event.currentTarget.dataset.repeat || "off";
      this.call("repeat_set", { repeat: current === "off" ? "all" : current === "all" ? "one" : "off" });
    });
    const progress = this.shadowRoot.getElementById("music-progress");
    progress.addEventListener("pointerdown", () => progress.dataset.dragging = "true");
    progress.addEventListener("input", () => this.shadowRoot.getElementById("music-elapsed").textContent = this.formatTime(progress.value));
    progress.addEventListener("change", () => {
      progress.dataset.dragging = "false";
      this.call("media_seek", { seek_position: Number(progress.value) });
    });
    for (const prefix of ["primary", "secondary"]) {
      const row = this.shadowRoot.getElementById(`${prefix}-volume-row`);
      const slider = row.querySelector("input");
      slider.addEventListener("pointerdown", () => slider.dataset.dragging = "true");
      slider.addEventListener("input", () => row.querySelector("[data-role='value']").textContent = `${slider.value}%`);
      slider.addEventListener("change", () => {
        slider.dataset.dragging = "false";
        this.call("volume_set", { volume_level: Number(slider.value) / 100 }, row.dataset.entity);
      });
      row.querySelector("button").addEventListener("click", (event) => {
        const entityId = event.currentTarget.dataset.entity;
        const muted = this.lookup(entityId)?.attributes?.is_volume_muted === true;
        this.call("volume_mute", { is_volume_muted: !muted }, entityId);
      });
    }
    this.shadowRoot.getElementById("music-source").addEventListener("change", (event) => {
      this.call("select_source", { source: event.target.value }, this.entityIds().volume);
    });
    this.shadowRoot.getElementById("music-group").addEventListener("click", () => {
      const { leader, volume, secondary } = this.entityIds();
      if (this.isGrouped()) {
        const member = secondary === leader ? volume : secondary;
        this.call("unjoin", {}, member);
      } else {
        const member = secondary === leader ? volume : secondary;
        this.call("join", { group_members: [member] }, leader);
      }
    });
  }
}

if (!customElements.get("van-music-player-page")) {
  customElements.define("van-music-player-page", VanMusicPlayerPage);
}
