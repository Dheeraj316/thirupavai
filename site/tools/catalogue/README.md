# Catalogue photos

Every saree has **six photos** (`site/assets/s/pNN-1.webp … pNN-6.webp`), made from **two AI photographs** per saree:

| photo | source | what it shows |
|---|---|---|
| 1 Full view (3:4) | model photo | head-to-toe, in a dark boutique |
| 2 Draped (4:5) | model photo | upper body and pallu |
| 3 Folded (1:1) | flat-lay | the saree laid out |
| 4 Border detail | flat-lay | the richest low-frame area |
| 5 Pallu detail | flat-lay | the richest other area |
| 6 Weave and zari | flat-lay | macro of the weave |

`make_views.py` cuts the six views (it finds the model, and the most finely woven parts of the flat-lay, by itself).
`build.js` writes `site/js/gallery_map.js`; **a saree is listed in the shop only when all six of its photos exist**, so a piece is never shown with another piece's pictures.

```
python make_views.py p13 raw/p13_model.png raw/p13_flat.png ../../assets/s
node build.js
cd ../../../app && npm run build
```

## Prompts used (Seedream 5 Lite, 2560×1440, about 2¢ each)

Model photo: *Photorealistic luxury fashion editorial photograph, wide landscape frame, an elegant Indian woman standing exactly in the centre of the frame with generous empty background space on both sides, full-length head to toe, wearing {SAREE}, pallu draped over the left shoulder, soft warm golden key light, softly blurred plain dark boutique background, shallow depth of field, the saree's colour, border and weave clearly visible, calm confident pose, no text, no watermark*

Flat-lay: *Photorealistic overhead flat-lay product photograph of {SAREE}, the cloth laid out loosely and filling the entire frame edge to edge with no background visible: plain body fabric, the decorative border running diagonally across, and the richly woven pallu end with ornate motifs, soft raking warm light that shows the weave and zari texture, extremely sharp macro detail, no people, no text, no watermark*

`{SAREE}` is a phrase such as *a deep maroon Banarasi katan silk saree with antique-gold zari borders and a richly woven gold pallu*.

The images are AI-generated concept imagery. Replace them with original or licensed photography before the shop opens (see `GO-LIVE.md`); keeping the same six file names is enough.
