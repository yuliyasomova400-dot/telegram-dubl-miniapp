# Animal card artwork

Created with the built-in image generator using the approved animal-card concept as a style reference. The game uses `animals-atlas-v1.png` as a sprite atlas, not a static card screenshot. Each card randomly displays six independently clickable animals.

## Generation prompt

Use case: stylized-concept. Production game sprite atlas, ONE square transparent PNG, precise 4 columns by 4 rows of equal square cells. Use the attached picture ONLY as animal character/style reference. Recreate its adorable premium 3D soft clay toy animals as isolated sprites, not cards. Remove all circular borders, cards, scenery and backgrounds. Genuine alpha transparency throughout empty space. No text, no grid lines, no labels.

Each animal MUST be centered at the exact center of its cell (centers at 12.5%,37.5%,62.5%,87.5% on both axes). Keep the entire animal including ears, wings and tails inside the middle 72% of its cell, leaving transparent padding on every side. All animals similarly large, full body, recognizable silhouettes, crisp details, friendly eyes, consistent soft lighting.

EXACT ORDER, left to right:
Row 1: yellow-black bee, pink starfish, brown puppy, gray elephant.
Row 2: brown monkey, black-white penguin, gray seal, gray koala.
Row 3: black-white cow, orange tiger, colorful tropical fish, green crocodile.
Row 4: brown owl, blue macaw parrot, green sea turtle, white rabbit.

Exactly sixteen distinct sprites, no duplicates, no extra objects. No cast shadows extending out of cells. This atlas will be displayed using CSS background-position at fixed 4x4 grid coordinates, so strict equal spacing and isolation are essential.

## Final correction prompt

Change ONLY the background of this exact 4x4 animal sprite atlas. Remove EVERY gray checkerboard square and replace all background with uniformly PURE WHITE #FFFFFF. No checkerboard, no transparency preview pattern, no floor, no gradient, no decorations. Preserve all sixteen animals in their EXACT positions, dimensions, shapes, order, colors and style, do not move or rearrange them. Square canvas, each animal remains isolated within its existing equal grid cell. Remove the three detached bubbles next to the tropical fish so they cannot cross a cell boundary. Keep white margins between every animal. Production clean sprite sheet on pure white.

## Integration

The first output had a baked checkerboard. The final output uses a white background and CSS multiply blending on ivory cards. Individually calibrated display regions keep ears and tails visible and exclude neighboring animals. No official character artwork or third-party sprite library is used.
