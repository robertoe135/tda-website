# Editing the homepage

Admin → Globals → **Homepage**. The page is a list of rows, top to bottom. Drag rows to reorder.

## Rows

Each row has a **layout** and one to three **items**:

| Layout | Items | Use it for |
| --- | --- | --- |
| One, full width | 1 | A single wide photograph or video |
| Two, equal | 2 | Two projects side by side |
| Two, wide then narrow | 2 | A video or key photo with a quote or smaller tile beside it |
| Two, narrow then wide | 2 | The same, mirrored |
| Three, equal | 3 | Three projects across |

The admin refuses a row whose item count does not match its layout. On phones, items stack;
a row of three shows one wide tile and two side by side.

## Items

- **Project**: shows the project's main photograph and name, and links to the project.
  Optionally pick another **image** of the project, or a **video** to play instead.
  Unpublished projects are left out of the live page automatically.
- **Quote**: the words exactly as said, without quotation marks, and who said them.

## Videos

Add videos under **Videos** first, then pick them on a project tile.

- MP4 (H.264), about 1920 px wide, no sound, under 15 MB. Aim for 5–8 MB: a 10–15 second
  loop. In Adobe Media Encoder or Premiere: H.264, "Match Source – Adaptive High Bitrate"
  or a target bitrate of about 4 Mbps, audio off. In HandBrake: the "Vimeo YouTube HQ 1080p"
  preset, with Audio removed.
- Why the limit: videos play on their own, so every visitor to the homepage downloads each one
  in full. Smaller loops look the same and keep the hosting bill near zero.
- A **still image** is required: it shows while the video loads, and instead of the video for
  visitors who turn off motion in their device settings.
- Videos play muted on a loop, always, with no pause button.
- The file name is public. Name it after the project, never after a private client.

The old homepage played four videos (PAC NYC, London Mithraeum, MIT Museum, Seeds of Light).
Their Squarespace addresses are in `scripts/migrate/review.csv`; upload the originals.

## Publishing

Save as draft to keep working; **Publish** to put it live. The site updates at once.
