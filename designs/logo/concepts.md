# relatinator concepts

- Shared tile: two document corners frame one shared term, which explains why the documents relate.
- Shared crossbar: the adjacent t and i share one bar, just as related documents share a term.
- Ranked r: two stepped document edges make one lowercase r, with the closer match at the front.
- Equal passages: two equal text bars inside opposing brackets show the evidence behind a similarity score.
- Ranked tabs: three staggered page tabs place the strongest related document first.
- Common margin: two document margins share one spine to show the terms that connect them.
- Term window: one square opening spans two pages to isolate their common text.
- Result fold: one folded page corner points toward the next related document.
- Shared counter: matching counters in both a letters echo repeated terms across a collection.
- Nearest passage: two offset text blocks align at one edge to show their closest match.

## Selected directions

A / Shared tile: a symbol and lowercase wordmark pair document corners with a shared central term.
B / Shared crossbar: one drawn bar joins the first t stem to the i dot. Its favicon repeats the bar.
C / Ranked r: two offset document edges form one stepped lowercase r.

## Brief and assumptions

The library ranks related documents and explains their shared terms. The audience uses JavaScript and Astro.
The concepts prioritize a clear 16px silhouette and a 28px header. They avoid nodes, spokes, and rings.
The palette remains provisional. Black defines the shapes before the ink and cobalt pass.
The user will choose one direction before any identity kit.

## Recommendation and tradeoffs

Recommend A. Its shared tile remains distinct at 16px, and the lockup keeps the library name visible.

A can suggest code blocks rather than documents without product context.
B needs horizontal space, and its shared detail becomes subtle at 28px.
C has a clear initial, but its stepped shoulder does not explain the library name.

## Observed checks

The SVG audit checked all ten black and color masters. It found no FAIL or WARN results.
The symbols scored 100. The wordmark and lockup scored 98, with INFO findings for anchor count and width.
The wordmark and lockup contain 231 and 254 anchors, respectively. Their outlined lettering accounts for most anchors.
Standalone marks address the wide-wordmark finding. A stacked lockup remains outside this concept scope.

CairoSVG rendered all ten masters at 16, 28, 32, 64, and 256px heights on light and dark backgrounds.
The renders folder contains 100 PNG samples. Dark samples reverse black and ink to paper, with cobalt unchanged.
The overview shows actual-size favicon samples and 28px header samples.
I inspected overview.png after the final render. I also inspected selected 16px, 28px, and 256px PNG samples.
I replaced the B favicon overlap with one contour after the first overview showed a small terminal seam.
I also separated the dark sample labels after the first overview compressed their spaces.

The masters contain filled paths, not live text, strokes, raster images, scripts, or external references.
The overview uses ordinary live text for labels. That text is not part of a master.
Its C header wordmark shows site context, not an additional C lockup.

## Color and lettering

Ink converts to #192029, RGB 25 32 41. Cobalt converts to #0076ed, RGB 0 118 237.
Graphite converts to #161b22 for the preview background. Paper uses #f8fafc.
Cobalt falls slightly outside sRGB. The conversion clips its negative red channel to zero before 8-bit rounding.
The palette.json file records the original OKLCH values, intermediate channels, and conversion method.

The wordmarks use locally available Space Grotesk at weight 600, outlined as paths.
Space Grotesk uses SIL Open Font License 1.1. The local font names the OFL URL in its metadata.
The lettering-source.json file names the local font file. The build.py file preserves editable construction instructions.
The B favicon and C monogram use custom geometry. The overview labels use the locally available Cantarell font.

All requested checks ran. Trademark clearance, print proofs, and independent reader tests remain outside this local concept review.
