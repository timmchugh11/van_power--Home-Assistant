import { NOW_PLAYING_FALLBACK_ENTITIES } from "./config.js";

// Now-playing tile and the full-screen music player page.
// Mixed into VanPowerCard.prototype; methods run with `this` = the card.
export const mediaMethods = {
  getMediaDisplayEntityId() {
    const configured = String(this._config.media_player_entity || "").trim();
    const candidates = [configured, ...NOW_PLAYING_FALLBACK_ENTITIES];
    return candidates.find((entityId) => ["playing", "paused"].includes(this.lookup(entityId)?.state)) || configured;
  },
  getMediaPlayerText() {
    const entityId = this.getMediaDisplayEntityId();
    if (!entityId) return "";
    const state = this.lookup(entityId);
    if (!state) return "";
    const playbackState = String(state.state || "").trim().toLowerCase();
    if (!playbackState || playbackState === "unknown" || playbackState === "unavailable" || playbackState === "off") return "";
    const attrs = state.attributes || {};
    const title = String(attrs.media_title || attrs.media_content_id || "").trim();
    const artist = String(attrs.media_artist || attrs.media_album_artist || "").trim();
    const appName = String(attrs.app_name || attrs.source || "").trim();
    if (title && artist) return `${artist} - ${title}`;
    if (title) return title;
    if (appName && playbackState === "playing") return `Playing on ${appName}`;
    if (playbackState === "playing") return "Playing";
    if (playbackState === "paused") return "Paused";
    return "";
  },
  getMediaPlayerFilterTerms() {
    const raw = this._config.media_player_filter;
    const list = Array.isArray(raw) ? raw : String(raw || "").split(/[\n,]+/);
    return list.map((term) => String(term || "").trim().toLowerCase()).filter(Boolean);
  },
  getMediaPlayerFilterText() {
    const entityId = this.getMediaDisplayEntityId();
    if (!entityId) return "";
    const state = this.lookup(entityId);
    if (!state) return "";
    const attrs = state.attributes || {};
    return [
      state.state,
      attrs.media_title,
      attrs.media_artist,
      attrs.media_album_artist,
      attrs.media_album_name,
      attrs.app_name,
      attrs.source,
      attrs.media_content_type,
      attrs.media_content_id
    ].map((value) => String(value || "").trim()).filter(Boolean).join(" ").toLowerCase();
  },
  isMediaPlayerFiltered() {
    const terms = this.getMediaPlayerFilterTerms();
    if (!terms.length) return false;
    const haystack = this.getMediaPlayerFilterText();
    if (!haystack) return false;
    return terms.some((term) => haystack.includes(term));
  },
  getMediaPlayerArtworkUrl() {
    const entityId = this.getMediaDisplayEntityId();
    if (!entityId) return "";
    const state = this.lookup(entityId);
    if (!state) return "";
    const attrs = state.attributes || {};
    const rawUrl = String(attrs.entity_picture || attrs.media_image_url || attrs.media_image || "").trim();
    if (!rawUrl || rawUrl === "unknown" || rawUrl === "unavailable") return "";
    if (/^https?:\/\//i.test(rawUrl) || rawUrl.startsWith("data:")) return rawUrl;
    if (rawUrl.startsWith("//")) return `${window.location.protocol}${rawUrl}`;
    if (rawUrl.startsWith("/") && typeof this._hass?.hassUrl === "function") {
      return this._hass.hassUrl(rawUrl);
    }
    return rawUrl;
  },
  handleMediaPlayerClick() {
    const page = this.shadowRoot?.getElementById("music-player-page");
    if (!page) return;
    page.open();
  },
  updateMusicPlayerPage() {
    const page = this.shadowRoot?.getElementById("music-player-page");
    if (!page) return;
    page.config = this._config;
    page.hass = this._hass;
  },
  updateMediaPlayerDisplay() {
    const panel = this.shadowRoot?.getElementById("media-player-panel");
    const textNode = this.shadowRoot?.getElementById("media-player-label");
    const textContentNode = this.shadowRoot?.getElementById("media-player-text");
    const artNode = this.shadowRoot?.getElementById("media-player-art");
    if (!panel || !textNode || !textContentNode || !artNode) return;
    const mediaText = this.getMediaPlayerText();
    if (!mediaText || this.isMediaPlayerFiltered()) {
      panel.classList.add("is-hidden");
      panel.classList.remove("has-art");
      panel.classList.remove("is-scrolling");
      textContentNode.textContent = "";
      if (artNode.dataset.src) {
        artNode.removeAttribute("src");
        artNode.dataset.src = "";
      }
      artNode.classList.add("is-hidden");
      return;
    }
    panel.classList.remove("is-hidden");
    if (textContentNode.textContent !== mediaText) {
      textContentNode.textContent = mediaText;
    }
    const artworkUrl = this.getMediaPlayerArtworkUrl();
    if (artworkUrl) {
      panel.classList.add("has-art");
      if (artNode.dataset.src !== artworkUrl) {
        artNode.dataset.src = artworkUrl;
        artNode.src = artworkUrl;
      }
      artNode.classList.remove("is-hidden");
    } else {
      panel.classList.remove("has-art");
      if (artNode.dataset.src) {
        artNode.removeAttribute("src");
        artNode.dataset.src = "";
      }
      artNode.classList.add("is-hidden");
    }
    requestAnimationFrame(() => this.updateMediaPlayerMarquee());
  },
  updateMediaPlayerMarquee() {
    const panel = this.shadowRoot?.getElementById("media-player-panel");
    const viewport = this.shadowRoot?.getElementById("media-player-label");
    const text = this.shadowRoot?.getElementById("media-player-text");
    if (!panel || !viewport || !text || panel.classList.contains("is-hidden")) return;
    const overflow = text.scrollWidth - viewport.clientWidth;
    if (overflow > 8) {
      const distance = Math.ceil(overflow + 28);
      const duration = Math.max(8, Math.min(22, distance / 18));
      panel.style.setProperty("--media-scroll-distance", `${distance}px`);
      panel.style.setProperty("--media-scroll-duration", `${duration}s`);
      panel.classList.add("is-scrolling");
    } else {
      panel.classList.remove("is-scrolling");
      panel.style.removeProperty("--media-scroll-distance");
      panel.style.removeProperty("--media-scroll-duration");
    }
  }
};
