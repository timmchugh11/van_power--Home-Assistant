// Texture-decode workarounds, applied once when the card module loads.
//
// Android: some Samsung/Android WebViews intermittently fail texture decode via
// createImageBitmap, so it is removed entirely. three.js GLTFLoader then falls
// back to its ImageLoader path.
//
// Everywhere else: cap concurrent createImageBitmap calls at 3 so loading the
// model and ground textures does not spike memory on the wall tablet.
const MAX_CONCURRENT_DECODES = 3;

if (typeof window !== "undefined" && typeof window.createImageBitmap === "function") {
  if (/Android/i.test(navigator?.userAgent || "")) {
    window.__vanPowerOriginalCreateImageBitmap = window.createImageBitmap;
    window.createImageBitmap = undefined;
  } else {
    const originalCreateImageBitmap = window.createImageBitmap;
    const queue = [];
    let active = 0;
    const drain = () => {
      while (active < MAX_CONCURRENT_DECODES && queue.length) queue.shift()();
    };
    window.createImageBitmap = function (...args) {
      return new Promise((resolve, reject) => {
        const run = () => {
          active++;
          originalCreateImageBitmap.apply(window, args).then(
            (result) => { active--; drain(); resolve(result); },
            (error) => { active--; drain(); reject(error); }
          );
        };
        if (active < MAX_CONCURRENT_DECODES) run();
        else queue.push(run);
      });
    };
  }
}
