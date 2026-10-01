# Vendored libraries

- `three.module.min.js` + `addons/` — three.js r160 (0.160.0), MIT, copied verbatim from the
  `three` npm package (`build/three.module.min.js`, `examples/jsm/...`). Vendored instead of
  loaded from a CDN so the home-page brain and the neuron gutter keep working if unpkg is
  slow or blocked. To upgrade: `npm pack three@<version>`, copy the same files, update the
  version here and in `brain-viz.html`'s import map + `js/neuron.js`.
