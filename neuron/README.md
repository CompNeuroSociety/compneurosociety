# Neuron morphologies

Allen Institute Cell Types reconstructions, drawn by `js/neuron.js` as the field of neurons
behind every page (they fire as you scroll). All five are mouse primary visual cortex cells
from the same set `AllenInstitute/bmtk` ships in `examples/bio_components/morphologies/`:

| File | Cre line | Specimen |
|---|---|---|
| `Scnn1a_473845048_m.swc` | Scnn1a-Tg3-Cre (L4 pyramidal) | 473845048 |
| `Rorb_325404214_m.swc` | Rorb-IRES2-Cre | 325404214 |
| `Nr5a1_471087815_m.swc` | Nr5a1-Cre | 471087815 |
| `Pvalb_470522102_m.swc` | Pvalb-IRES-Cre | 470522102 |
| `Pvalb_469628681_m.swc` | Pvalb-IRES-Cre | 469628681 |

Allen Institute terms of use apply (https://alleninstitute.org/terms-of-use/); the label at
the bottom-left of every page credits the source and lists the specimen ids.

Format: SWC, one node per line `id type x y z radius parent` (type 1 soma, 2 axon, 3 basal
dendrite, 4 apical dendrite).

**Adding a cell:** on https://celltypes.brain-map.org open a specimen with a reconstruction,
download its morphology (SWC), put the file here, and add a row to `NEURONS` at the top of
`js/neuron.js` (and, if you want it in a new spot, a slot in `LAYOUT`).
