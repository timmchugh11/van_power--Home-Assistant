// Van Power card entrypoint. Bundled to ../van-power-card.js by `npm run build`.
import "./platform/image-bitmap.js";
import "./music/player-page.js";
import { VanPowerCard } from "./card/van-power-card.js";
import { VanPowerCardEditor } from "./editor/van-power-card-editor.js";
import { createVanScene } from "./scene/van-scene.js";

customElements.define("van-power-card", VanPowerCard);
if (!customElements.get("van-power-card-editor")) {
  customElements.define("van-power-card-editor", VanPowerCardEditor);
}
window.customCards = window.customCards || [];
window.customCards.push({
  type: "van-power-card",
  name: "Van Power Card",
  description: "3D van power dashboard card"
});

export { createVanScene };
