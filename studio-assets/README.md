# Drop your real school assets here

Place the actual files in this folder using the names below. Every field is
**optional** — if a file is missing, the poster omits that component gracefully
(no empty placeholder). The engine never invents an image.

## Images (PNG or JPG)

| Filename                | Purpose                          | Ideal size / notes                        |
|-------------------------|----------------------------------|-------------------------------------------|
| `school-logo.png`       | School emblem (header)           | Transparent PNG, square-ish, ≥ 300 px     |
| `lead-logo.png`         | LEAD partner mark (footer)       | Transparent PNG, wordmark                  |
| `hero.jpg`              | Main event/assembly/campus photo | Landscape ≥ 1600 px wide preferred        |
| `hero-portrait.jpg`     | (optional) a portrait hero       | Portrait orientation, for test case       |
| `chairman.jpg`          | Chairman portrait                | Face centered, ≥ 500 px                    |
| `principal.jpg`         | Principal portrait               | Face centered, ≥ 500 px                    |
| `correspondent.jpg`     | Correspondent/management portrait| Face centered, ≥ 500 px                    |
| `student1.jpg` …        | Student photos (collage family)  | Any orientation                           |
| `campus.jpg`            | Campus photo (admissions)        | Landscape                                 |

You can add extra photos as `photo1.jpg`, `photo2.jpg`, … for the collage family.

## School information

Edit `studio-input.json` (copy from `studio-input.example.json`) with your real
school name, branch, address, phone, academic year, and the event content.
Nothing about the school is hard-coded in the design engine — it all comes from
this file, so the same engine works for any school/branch.

Once files are dropped and `studio-input.json` is filled in, tell me and I'll run
the full acceptance set against your real assets.
