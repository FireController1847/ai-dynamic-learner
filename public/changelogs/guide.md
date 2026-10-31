## v2.11.0

<small data-utc="2026-10-31T03:57:17.424Z">October 30, 2026</small>

- **Power Lines:** Added a perspective desert railway with wooden poles, electrical pulses that follow sagging wires, passing trains and cars, and an orbiting sun and moon that do not affect background brightness.
- **Programming:** Added binary registers, hexadecimal memory panels, HUD graphics, network nodes, packet animations, and signal displays.
- **Theming:** Returned the Programming background to the site's light/dark palette.
- **Library:** Added a persistent Reorder footer for moving a selected guide or group between folders and up/down among siblings.
- **AI Maps:** Power Lines is available to generated guides and imported maps.

<details>
<summary>View 1 commit</summary>
<ol><li>Release commit link pending.</li></ol>
</details>

## v2.10.0

<small data-utc="2026-10-31T03:50:49.659Z">October 30, 2026</small>

- **Circuit Board:** New computer-science backdrop with PCB traces, traveling electrical signals, and click-triggered flows that follow the wires.
- **Programming:** New hacker-terminal backdrop with code snippets, animated code rain, and interactive compiler readouts.
- **AI Maps:** AI-generated guides can select the new backgrounds for relevant lessons.
- **Accessibility:** Both themes respect map animation pause and reduced-motion preferences.

<details>
<summary>View 2 commits</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/0b3f8403a0ed614e5c9fed85dcc0f1256b326123">0b3f8403</a> — style(guide): give hacker background a dark scanline terminal surface</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/1f2139b078eaab56648b0834fbc00825a76809b6">1f2139b0</a> — feat(guide): interactive circuit board and hacker backgrounds (v2.10.0)</li>
</ol>
</details>

## v2.9.0

<small data-utc="2026-10-31T03:45:57Z">October 30, 2026</small>

- **AI Maps:** Let the AI choose a background that suits each generated guide, with encouragement to vary between Fireflies, Water, Constellations, Flow, and Contours.
- **Import Preview:** Show the selected background before creating the guide and preserve it when importing; older files retain their existing default.

<details>
<summary>View 1 commit</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/986d9e4ad2c4718f04686c4d1d436c9fa21ed0f9">986d9e4a</a> — feat(guide): AI generated maps select varied ambient backgrounds (v2.9.0)</li>
</ol>
</details>

## v2.8.0

<small data-utc="2026-10-31T03:43:11Z">October 30, 2026 at 9:43 PM MDT</small>

- **Library Organization:** Drag guides and groups to reorder them, nest them in groups, or move them back to the top level, with clear drop indicators.
- **Map Controls:** Kept the pause/play icon behind an open lesson so it no longer covers teaching content.

<details>
<summary>View 1 commit</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/359a408e9e9bee5b0492ca5f9ca42ea54b12add7">359a408e</a> — feat(guide): organize library via drag-and-drop and correct map overlay layering (v2.8.0)</li>
</ol>
</details>

## v2.7.5

<small data-utc="2026-10-31T03:21:00Z">October 30, 2026 at 9:21 PM MDT</small>

- **AI Generation:** Made Teaching Block totals more precise and favored five to seven map stops.
- **Water:** Corrected the wave-highlight drawing helper.

<details>
<summary>View 2 commits</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/e40f94e4b19271337f77383ae7876b5594e99c69">e40f94e4</a> — fix(guide): preserve nonnull canvas context in foam highlight helper</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/1ff6a43850a66a08b6cbc08be146b6f480a924b4">1ff6a438</a> — fix(guide): enforce requested Teaching Block count and prefer 5–7 map stops (v2.7.5)</li>
</ol>
</details>

## v2.7.4

<small data-utc="2026-10-31T02:59:00Z">October 30, 2026 at 8:59 PM MDT</small>

- **Water:** Restored crisp paired wave crests with restrained foam highlights.

<details>
<summary>View 1 commit</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/4d35fb1c6a84a5c70965c51b58a2204a3feb04af">4d35fb1c</a> — fix(guide): restore crisp paired water crests with localized foam (v2.7.4)</li>
</ol>
</details>

## v2.7.3

<small data-utc="2026-10-31T02:55:00Z">October 30, 2026 at 8:55 PM MDT</small>

- **Playback:** Added a subtle pause/play control for decorative map animations.

<details>
<summary>View 1 commit</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/c7504b06370b903a8bb9707ca3535fd3d08f23cf">c7504b06</a> — feat(guide): subtle map animation pause and play toggle (v2.7.3)</li>
</ol>
</details>

## v2.7.2

<small data-utc="2026-10-31T02:51:00Z">October 30, 2026 at 8:51 PM MDT</small>

- **Animation:** Improved ripple smoothness and fading foam effects.
- **Performance:** Improved rendering efficiency for animated maps.

<details>
<summary>View 1 commit</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/f6e51a915dbdceb2246e75e1596b403d40447924">f6e51a91</a> — perf(guide): composited Canvas ripples and fading foam-tipped water (v2.7.2)</li>
</ol>
</details>

## v2.7.1

<small data-utc="2026-10-31T02:45:00Z">October 30, 2026 at 8:45 PM MDT</small>

- **Water:** Added rolling wave crests that appear and fade naturally.
- **Performance:** Reduced unnecessary map background redraws.

<details>
<summary>View 1 commit</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/bc2bd400bb6924d81a0b284a55a54aa1c93da2cb">bc2bd400</a> — perf(guide): cache Canvas scenery and animate rolling water crests (v2.7.1)</li>
</ol>
</details>

## v2.7.0

<small data-utc="2026-10-31T02:41:00Z">October 30, 2026 at 8:41 PM MDT</small>

- **Fireflies:** Added a glowing Fireflies map theme and ambient scenery.
- **Lesson Layout:** Refined interactive lesson presentation and spacing.

<details>
<summary>View 1 commit</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/f5fbaf4e67c8f2308542b1ff173ceecca303c507">f5fbaf4e</a> — feat(guide): ambient worlds, fireflies and cleaner lesson layout (v2.7.0)</li>
</ol>
</details>

## v2.6.2

<small data-utc="2026-10-31T02:36:00Z">October 30, 2026 at 8:36 PM MDT</small>

- **Visual Effects:** Improved distinct background textures and theme-specific arrival effects.

<details>
<summary>View 1 commit</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/1a768b1fb7712a3736d9d003acbf7d3af9ed2d36">1a768b1f</a> — fix(guide): distinct subtle Canvas textures and per-pattern arrival effects (v2.6.2)</li>
</ol>
</details>

## v2.6.1

<small data-utc="2026-10-31T02:32:00Z">October 30, 2026 at 8:32 PM MDT</small>

- **Map Textures:** Refined subtle backgrounds and interactive water ripples.

<details>
<summary>View 1 commit</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/9385d27003ab111ccb6e4c1d8e057e9f7e36f377">9385d270</a> — fix(guide): subtle Canvas pattern textures and interactive map ripples (v2.6.1)</li>
</ol>
</details>

## v2.6.0

<small data-utc="2026-10-31T02:29:00Z">October 30, 2026 at 8:29 PM MDT</small>

- **AI Preview:** Added a pre-import lesson outline and estimated confidence indicators.
- **Coverage:** Displayed potential gaps and subject-coverage information.

<details>
<summary>View 1 commit</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/597470fab569e45a03b3945adf077965221b08cf">597470fa</a> — feat(guide): restore AI preview and Review-style confidence estimates (v2.6.0)</li>
</ol>
</details>

## v2.5.0

<small data-utc="2026-10-31T02:19:00Z">October 30, 2026 at 8:19 PM MDT</small>

- **Map Backgrounds:** Added Water, Contours, Constellations, Flow, and Plain themes.
- **Arrival Effects:** Added theme-aware ripples and visual accents.

<details>
<summary>View 1 commit</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/24cc646ba28978e95ac567721ff80cf627c8a26e">24cc646b</a> — feat(guide): themed mathematical map patterns and arrival ripples (v2.5.0)</li>
</ol>
</details>

## v2.4.0

<small data-utc="2026-10-31T02:14:00Z">October 30, 2026 at 8:14 PM MDT</small>

- **Guided Practice:** Added optional hints, supported exercises, and reflective prompts.
- **Learning Journey:** Improved teaching-first progression and revisiting earlier ideas.

<details>
<summary>View 1 commit</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/e5bfb9dc807f2d8e07a06f4507459d48d2faf71b">e5bfb9dc</a> — feat(guide): scaffold learning with supported practice, fading hints, and distributed revisits (v2.4.0)</li>
</ol>
</details>

## v2.3.0

<small data-utc="2026-10-31T02:09:00Z">October 30, 2026 at 8:09 PM MDT</small>

- **Algorithms:** Added interactive, step-by-step walkthroughs and trace exploration.
- **Examples:** Enabled Guide examples to reuse Review's computational solvers.

<details>
<summary>View 4 commits</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/94e1b0a11fbd9dc4fdd25de083cfebc2d4a0b875">94e1b0a1</a> — test(guide): assert Guide 2.2.0 release version</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/249d0be00ef5a848dfeae8eebd6573146e4a571c">249d0be0</a> — docs(guide): describe 2.2.0 auto-open, Explore tabs and numeric parameterization priorities</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/edd09c2a42970747178295db9bec669c3bbd0d8a">edd09c2a</a> — chore(guide): remove unrequested Guide automated tests and CI invocation</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/fdd320dcce089bdea793a6d64ca43858a5a5bbca">fdd320dc</a> — feat(guide): teach algorithms with Review solvers and interactive trace labs (2.3.0)</li>
</ol>
</details>

## v2.2.0

<small data-utc="2026-10-31T02:00:00Z">October 30, 2026 at 8:00 PM MDT</small>

- **Navigation:** Automatically opens a lesson after arriving at a map stop.
- **Exploration:** Replaced quiz-like choices with clearer browsing tabs.
- **AI Output:** Requested downloadable Guide files for List and Map generation.

<details>
<summary>View 19 commits</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/8c3f5cfc93804d9eb5d10a46bbeb4bf499f860ff">8c3f5cfc</a> — test(guide): verify 2.1.0 parameterized teaching release</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/5a530743a48d3ca94178bf9f5e94f075eeb3564b">5a530743</a> — docs(guide): document parameterized teaching examples and the Guide 2.1.0 release</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/157062533823c509859281e1112a09504226c0f6">15706253</a> — polish(guide): reveal generated solutions without regeneration and expose reproducible seed</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/b438b2e616b07e74018458aebba0330bceb94540">b438b2e6</a> — prompt(guide): illustrate valid seeded parameter rules for AI lesson authoring</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/54a6a24221f96795a499765a73447cf2cad58135">54a6a242</a> — feat(guide): share downloadable JSON output instructions across AI map and list modes</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/b383ac23e329c2f49ea8394d94041a8e2a9fe086">b383ac23</a> — fix(guide): request downloadable map JSON attachment instead of chat code block</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/6ab07920a7b45e96a7577fb680e933e4c9e7fc69">6ab07920</a> — fix(guide): request downloadable list JSON attachment instead of chat code block</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/35ed343bd26ee0c3683496995c820a170419067f">35ed343b</a> — test(guide): enforce downloadable JSON file output in both AI creation modes</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/07b4d665e20fe7522050a144ef90ce72a39cfd25">07b4d665</a> — docs(guide): document downloadable JSON file output for map and list AI generation</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/2cde57742ab88520a6fc75f914e5977a22030b67">2cde5774</a> — feat(guide): auto-open continued map stop after an arrival pause</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/8ec5549e5230f7620e8f1e5750797a2dc72c1840">8ec5549e</a> — feat(guide): present Explore as accessible browseable tabs instead of quiz answers</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/09a99c5fb621638c339945915c2fef42503c96fb">09a99c5f</a> — style(guide): distinguish Explore tabs from Check your understanding cards</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/6e346dc28c4a3f86c7eed3a0454f591aad9ebb7c">6e346dc2</a> — prompt(guide): strongly prioritize Review-style parameterization, especially for numerics focus</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/77f53a50f6ad02f0ab3c29e2a31efce0b641b8cd">77f53a50</a> — refactor(guide): isolate delayed continuation safeguards for regression coverage</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/67b265877a3d031a9f082db0cd95baad6dfdeb7b">67b26587</a> — refactor(guide): use testable arrival timing guard for auto-open continuation</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/d3052d2e2fe7710867870df49588e6b7d89f6c19">d3052d2e</a> — prompt(guide): make Numerics focus explicitly prefer reusable parameterized lessons</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/43fd88501c388565f2c68893897d17e48023dd63">43fd8850</a> — test(guide): cover delayed stop arrival and numerics parameterization priorities</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/624fa1323992d6693930fdb34cbf3f5e19c9ab43">624fa132</a> — test(guide): match fixed-fact safety wording in generation prompt</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/68f8f4f5f3e196e5fba3306274efa049d8f5c909">68f8f4f5</a> — chore(guide): release 2.2.0 for automatic route progression and exploratory tabs</li>
</ol>
</details>

## v2.1.0

<small data-utc="2026-10-31T01:44:00Z">October 30, 2026 at 7:44 PM MDT</small>

- **Generated Examples:** Added adjustable practice examples with revealable worked solutions.
- **AI Teaching:** Improved focus choices and generation of reusable numerical examples.

<details>
<summary>View 20 commits</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/4ee1e9a909ec0cf73f43da96b66e19aa56e5b979">4ee1e9a9</a> — refactor(ai): extract shared AI focus selection cards for Guide and Review</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/aa6081dcd0e4c6aeda379d81cb4b8962cdf4df99">aa6081dc</a> — refactor(review): reuse shared AI focus choice cards without changing prompt behavior</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/8d69bf61faf0d127206af6df8dbcaf7abb1bb290">8d69bf61</a> — feat(guide): add pedagogical AI focus priorities for generated lessons</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/cddaf9ecee7d782e3fb684af1f75d7459bb92514">cddaf9ec</a> — feat(guide): offer Review-style Focus on choices under Let AI choose</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/36452b057cd325839b37fc3ceb774aad073028e8">36452b05</a> — feat(guide): apply qualitative teaching focus to AI-generated map instructions</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/f648b40ed681197eef9c401c4ec62f5df06dd0e8">f648b40e</a> — test(guide): verify v2 release and Review-style AI focus prompt behavior</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/37d4839e1e1d94bf69982e64b79cc7390f18e74e">37d4839e</a> — docs(guide): record v2.0.0 release and new AI teaching focus selections</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/b19a0205a3b4d244bd9bf05fb94a2c91816298b3">b19a0205</a> — feat(guide): reuse parameterized generator for teaching examples and persisted state</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/d40283809b7c543dc4a3fdc06c27b709fe05f850">d4028380</a> — feat(guide): validate parameterized Teaching Blocks using Review's generation rules</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/2ae37070a538228b1b4b61e7be89d1f371755731">2ae37070</a> — feat(guide): interactive generated examples with variable controls and revealable solutions</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/b711dabb294aa109e57b3815623079850ed6dca2">b711dabb</a> — feat(guide): add Parameterized example to Teaching Block selection and templates</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/c6010655fa69d7caf8854a40d2b2508984a0dcbc">c6010655</a> — feat(guide): render generated teaching examples in lesson and live preview</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/6a98b5a626c5bc7d7a0c5a0f1976f37c014bca64">6a98b5a6</a> — feat(guide): author parameterized variables, constraints, answers and guided steps</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/ae0b0d7a52825786f5860dc1bb038d61bdef5e0c">ae0b0d7a</a> — feat(guide): accept validated parameterized Teaching Blocks from AI without executable packages</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/8bdb98d9816fd48cc885c04b1666f3312b67bccb">8bdb98d9</a> — feat(guide): include parameterized examples in AI teaching mixes</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/537a4471b3ce9e035f7341e51bbc4d4b50924de7">537a4471</a> — prompt(guide): teach AI how to generate safe parameterized worked-example blocks</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/e2f442240d9a879cd90b3de548cd67a531924472">e2f44224</a> — fix(guide): safely store bounded generated teaching example controls and reveal state</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/648bd791f28d93eaf847e400f0b91560638d6d0b">648bd791</a> — style(guide): responsive parameterized example controls and shared rule editors</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/31c58770db86695d94c28853c3636470127b24c5">31c58770</a> — test(guide): cover seeded generated teaching examples, saved state and AI imports</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/d287794a54bee70779a83bb476dab139200b45f1">d287794a</a> — chore(guide): bump to 2.1.0 for parameterized teaching examples</li>
</ol>
</details>

## v2.0.0

<small data-utc="2026-10-31T01:36:00Z">October 30, 2026 at 7:36 PM MDT</small>

- **Teaching Blocks:** Replaced basic map notes with interactive explanations, examples, diagrams, and tables.
- **Lesson Editor:** Added live previews, richer formatting, and mathematical expressions.
- **AI Maps:** Added customizable teaching mixes, subject categories, and organic branching layouts.
- **Compatibility:** Preserved older guides and existing study progress.

<details>
<summary>View 99 commits</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/4654a058aa7b205456af646e6936b3ed55950aba">4654a058</a> — Make Review knowledge-set imports a guided three-step flow</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/ccb39842ec928344b103a4cec7b33dce7679cc69">ccb39842</a> — feat(guide): define validated teaching block lesson schema</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/27c3fae021d0ead11cfdc579d63745f47bf39814">27c3fae0</a> — feat(guide): render interactive, accessible teaching blocks</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/451b1a732c9478bc2a5cdc74cf8abad059532dac">451b1a73</a> — feat(guide): seed debug map demonstrating all teaching blocks</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/e3ba8cb4917ee5614ee46addb9607988686774b2">e3ba8cb4</a> — feat(guide): validate and persist versioned map lesson content</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/227685f02a0bb76b70dc31de3007e87a61fad8a8">227685f0</a> — feat(guide): replace one-bullet reveal with teaching lesson journey</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/b5c512f306038a5cffaa2ae77c0a78a3bd0bf15c">b5c512f3</a> — style(guide): add responsive lesson and interaction visuals</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/20e29f66158e1561d607eb700514a2137b8a5b7f">20e29f66</a> — feat(guide): integrate Teaching Blocks demo, editor and disabled AI import</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/3559706a533a898ad30d2c21ae12e9a749348ab0">3559706a</a> — feat(guide): integrate Teaching Blocks demo, editor and disabled AI import</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/69115cfb7a8fb3e64dfd3505af8241a10f1d5210">69115cfb</a> — feat(guide): integrate Teaching Blocks demo, editor and disabled AI import</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/81cb848a81c353ebade4b39378ae9cd984c6256f">81cb848a</a> — feat(guide): integrate Teaching Blocks demo, editor and disabled AI import</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/dae4a187619852fa5fabf3f046a8fb471f67acaf">dae4a187</a> — fix(guide): tighten legacy session compatibility and lesson messaging</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/ac2b036e341d388006e8f73cd3f5c18fdd9d6601">ac2b036e</a> — fix(guide): tighten legacy session compatibility and lesson messaging</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/2f73ba0ff08ed7ca95b1bb952934679583b2c161">2f73ba0f</a> — test(guide): cover teaching demo, legacy notes, validation and session state</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/38d6fa8ebb7b53a87c816836c48cb322bbb27d73">38d6fa8e</a> — test(guide): run lesson schema tests in build verification</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/19bda0f4902bcd11e303a2765d0e504ffe391948">19bda0f4</a> — test(guide): run lesson schema tests in build verification</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/8f6b5b280298c220db275be9343a22ff9e132dbe">8f6b5b28</a> — docs(guide): specify Teaching Blocks schema and compatibility contract</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/d3da44ff15085b8b74d4ee13b08e03294751462b">d3da44ff</a> — fix(guide): allow conditional teaching block children in Vue render</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/fe9c6c7845f31791a9f8ee4e1cb30fbee186a0f3">fe9c6c78</a> — style(guide): give demo launcher its own library row on narrow panels</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/17c1986beb64ab4753106b43052d8a965b5bd9e9">17c1986b</a> — style(guide): make debug launcher responsive in library panel</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/db3832f5981b36d5972665ee7fedf9aef23c464f">db3832f5</a> — fix(guide): retain validated topic types while pruning saved responses</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/28c65e6e19d9ccc64fe4583e03c8fcacbaeccf8d">28c65e6e</a> — feat(guide): add valid initial templates for every teaching block</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/906847dd0386c5e9ab2ccf72c9540cdfa2bc2d9c">906847dd</a> — feat(guide): interactive Teaching Blocks authoring with validated drafts and preview</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/efb000113fde772b5f55a733717631a5570b4397">efb00011</a> — feat(guide): embed teaching authoring in map-stop editor</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/bb8dd003f434e31c44ecaa90c6af414dd58311dc">bb8dd003</a> — style(guide): add compact responsive Teaching Blocks authoring controls</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/8deda3717b9b5e3eedd972c6946d906762daac96">8deda371</a> — feat(workspace): dismiss compatibility notice while preserving safety modes</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/733c8824f2b7eaec38f6a885513bc04e6becbbdb">733c8824</a> — style(workspace): responsive compatibility notice controls and collapsed status</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/6a81b5d9709bc5188064ec3b8416c3823bd07a9b">6a81b5d9</a> — test(guide): verify authoring templates and staged invalid drafts</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/9996efca7533a94be9066c1e318ad189b76e1021">9996efca</a> — docs(guide): document teaching editor and dismissible compatibility notices</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/954ac5018baf33e0f44c8739f6a3e093e4475ec3">954ac501</a> — fix(guide): copy reactive teaching blocks without structuredClone errors</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/cd201ddf251b5a63bd20bb441d6261c536504db0">cd201ddf</a> — fix(guide): avoid DataCloneError opening and saving reactive lesson drafts</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/1745e6c6ca4b07688f89dc7363bb103ac2689ea4">1745e6c6</a> — style(workspace): remove redundant dismiss control, retain X and ignore</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/976649136d6e1bf13b94a2436ac789d95ff9cb57">97664913</a> — test(guide): guard editing and saving reactive block proxies</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/8262cb3080462b3612fba7db1ef6e7a36ed3fe9e">8262cb30</a> — feat(guide): move teaching block editing and preview into spacious centered dialogs</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/052a370f4bca1a328bed19ace3f18063b106a2ce">052a370f</a> — style(guide): spacious responsive centered editing and preview dialogs</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/aed097657b826e105acf409a5febefd101cca191">aed09765</a> — polish(guide): keep lesson preview visible above block outline</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/9b322f0e457fdfdeb54e1ada66179f9c1e4bcf64">9b322f0e</a> — docs(guide): describe centered teaching editor and lesson preview</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/c993367042e14f1056ae69a28b455ee4b9e4eaf5">c9933670</a> — feat(guide): split live block editor preview and explicit pencil controls</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/2ed054e42fb314859ea6c61d5ceb193842f1c2d6">2ed054e4</a> — style(guide): independent edit-preview panes and fixed dialog footer</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/81f1f02c1834f46c3f225faefdd6744518aa8af5">81f1f02c</a> — docs(guide): document split live authoring and explicit edit controls</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/5ddc6f0b06d79b3115ce193904020dd0cd9d3c00">5ddc6f0b</a> — fix(guide): use compact input fields for short key ideas and points</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/b95c637d0bbe8020bfbb7383f0590426649033f0">b95c637d</a> — style(guide): align compact inputs and remove buttons in teaching editor</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/b8aa03ddf6eb724ab2f9e6205397ff7c4ec24be4">b8aa03dd</a> — feat(guide): add safe Markdown and LaTeX rendering for teaching content</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/697495cec580bbaa8c0caec44cd4d33b7ebfb767">697495ce</a> — feat(guide): render Markdown in teaching prose and LaTeX across every text field</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/3be4c27a09ad9dce493386ca225d8b2ed8b8486a">3be4c27a</a> — feat(guide): expose Markdown and LaTeX authoring guidance in live editor</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/0233045b656247ce06ad59b16be655703a8ee015">0233045b</a> — polish(guide): keep formatting guidance in toolbar instead of repeating per field</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/e5b6d86bc014e7ba8a586090987f7659a06c99cb">e5b6d86b</a> — style(guide): format Markdown prose and safely typeset math across blocks</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/7c3a35ea4c295041cab117b4a70e5b6da608cc15">7c3a35ea</a> — test(guide): cover math delimiters, preserved punctuation and safe fallbacks</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/03ce4049ede310b59543496491a5fff08e74a13b">03ce4049</a> — fix(test): preserve literal TypeScript template delimiters in math cases</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/e0aec008c562b2ff160daa3ee9f34a5bce017b66">e0aec008</a> — docs(guide): clarify safe formatted teaching block content contract</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/2fc64f618152c5f22f6c86b07f7e014222eb1960">2fc64f61</a> — docs(guide): document safe Markdown and LaTeX authoring across lesson fields</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/d7be671efc9fa6afaa48a3f7d40d02b5fc13ae09">d7be671e</a> — docs(guide): correct inline code formatting in LaTeX examples</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/0ce06ac2ec5ea163aaa329da45ef609eece43918">0ce06ac2</a> — fix(guide): keep malformed draft markup from crashing lesson preview</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/7a22b5b79c10f9e309940aff634865aaa00789e5">7a22b5b7</a> — docs(guide): describe sanitized markup support accurately</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/cdd73426115cde40350ef8d538b26e1979cb0380">cdd73426</a> — test(guide): demonstrate Markdown and inline LaTeX in debug lessons</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/709ad8aedff2d9d08c9057ba87bed9b8a1bf7b99">709ad8ae</a> — feat(guide): validate bounded, backward-compatible table teaching blocks</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/55fe2f199d81b43e9f6f7dff77b1579861fd5364">55fe2f19</a> — feat(guide): offer a ready-to-edit table teaching block template</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/7bbacfafa5332f04c906e640e7eff8f36b215542">7bbacfaf</a> — feat(guide): render semantic accessible tables with Markdown and LaTeX cells</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/dd57cdcac78e3d657db54f0287e23cb4b5b73aa6">dd57cdca</a> — feat(guide): add table editing controls with row/column management</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/5ca6efb42ad7e0f25308a32ba2cb9c86600ec973">5ca6efb4</a> — style(guide): responsive table teaching block and editing grid</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/dabbb8c33d6db93064170e26fcb3f62b09358b06">dabbb8c3</a> — feat(guide): add dedicated Markdown, LaTeX, and table showcase map stop</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/53fb52a0a431ae924c84493a3ab5225c3f3ad550">53fb52a0</a> — test(guide): cover nine teaching types, formatting stop and bounded tables</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/d1e725d52321ce2b849e39dd6b47fa8da13da2cd">d1e725d5</a> — docs(guide): describe Table blocks and the dedicated formatting demo stop</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/30ad0df7485e7ed7751dd1f28c0a5f3a386596e7">30ad0df7</a> — fix(guide): close nested Vue table renderer expression</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/e84afa869840503813c8d085f938d37dd7ae9450">e84afa86</a> — fix(guide): retain narrowed table header count in row validation</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/2bb8ea3a71577b12b2da26e25ed9da266a5d5346">2bb8ea3a</a> — Merge main into feature/guide-teaching-blocks</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/65c53ea917ad1b8efeac8dcb857bd9e23ed12e26">65c53ea9</a> — fix(guide): keep showcase map a cycle-free branching tree</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/1c95fa681cb783e66a02590a01997f28a190356d">1c95fa68</a> — fix(guide): align demo tests and docs with the cycle-free map</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/d1bf206b0655f12272e9603e315b7722f3dc6e1e">d1bf206b</a> — fix(guide): align demo tests and docs with the cycle-free map</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/c544a5ec4e1297958f941515ff9c3975aed769ac">c544a5ec</a> — feat(guide): restore AI entry and hide demo launcher without removing generator</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/25cc8a1cbfe02e6bb74345ea2f9ad320509f6e58">25cc8a1c</a> — feat(guide): validate AI teaching block imports and assign local IDs safely</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/c171a99519f9614a1ca88ef49397c2956b6ee67c">c171a995</a> — feat(guide): add Review-style AI/custom teaching type weighting</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/e15459b852d32e48fedef7a288c11b33c710c5be">e15459b8</a> — feat(guide): enforce 64px separation between AI map stops with safe re-layout</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/d35a6321a9a0cf9ad040b82f2d98a73cc544d509">d35a6321</a> — feat(guide): parse Teaching Blocks v2 while preserving legacy Guide JSON</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/f829e3be7f5bf1fbd774d24e38da301d912441af">f829e3be</a> — feat(guide): add teaching-first AI prompt and creative separated map instructions</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/22a6fa85840dfdbd31392088a4c3fd49cab7f79d">22a6fa85</a> — feat(guide): persist imported Teaching Blocks and apply spaced map layout</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/63da82838ccf8c473c851805c2271d350ec85575">63da8283</a> — feat(guide): add Review-style AI/custom weighted block mix, JSON upload and coverage preview</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/e266c52be7080d72d3635e1fd060ddb45e847d32">e266c52b</a> — style(guide): responsive Review-style AI teaching mix controls</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/adf9736c63fe313d69cd834d37af8936c4aa5443">adf9736c</a> — test(guide): verify v2 AI lessons, creative map spacing and weighted mixes</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/de4d5e40f3d9254d53ed88f21bfd23ce4547b242">de4d5e40</a> — fix(guide): preserve large legacy map imports while spacing new AI maps</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/46ddc28fa9dbbf4e8b8b09a7900b676417d635f8">46ddc28f</a> — test(guide): cover Teaching Blocks AI prompt and legacy v1 map parsing</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/a7fcea10156199fe179380cf65aaf8fbc69f27a8">a7fcea10</a> — docs(guide): update AI Guide Teaching Blocks workflow and spaced map policy</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/bf661c16d2f17639d82beb325b867b869634b3a1">bf661c16</a> — fix(guide): place compact AI import shortcut alongside builder actions</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/9722b26063fbd05b3d684d5346adf273d07e2e8e">9722b260</a> — fix(guide): align compact AI import shortcut with builder actions</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/e4141bce99e0592bf89cfcb68363ceaac2a750e4">e4141bce</a> — feat(guide): reuse Review's shared overall/category selection and scoped prompts</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/01990da4f02df52ac0643fa4a628448262697619">01990da4</a> — style(guide): keep AI import shortcut compact just like Review</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/710bf60b2908156f3fa84112fbdb61c5b77bce8c">710bf60b</a> — test(guide): validate shared Review category-scoping prompt</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/47476772ea00990fac7cdfb97b10f48ad57a28bb">47476772</a> — polish(guide): skip duplicate source step for category-scoped generation</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/bcdfe34e04ac1444319cf69d70b738ce087a45b0">bcdfe34e</a> — refactor(guide): avoid redundant map layout calls during legacy imports</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/585341c758230d6c4e9797ee0649802992845d77">585341c7</a> — docs(guide): document shared Review scope/category selection and compact import shortcut</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/7a92f72f41b356b01d694a6b3f43951053bed944">7a92f72f</a> — fix(guide): preserve Back navigation for direct AI response imports</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/96bcee6ed826ed76ed3bee287300342181fc7c40">96bcee6e</a> — feat(guide): import valid AI JSON directly without a second comparison approval step</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/8244be7e173cc2f6f3663823f59e83ce0ebca416">8244be7e</a> — feat(guide): compose organic branch-following AI maps instead of rigid rectangular grids</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/3ce6efa0081addddb57c8d4913e4eaf7a650e762">3ce6efa0</a> — prompt(guide): discourage grid maps, prioritize meaningful stops and creative branching trails</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/c11ef9a324e66426fd9a22b532a1d43f6f21b464">c11ef9a3</a> — style(guide): match Review's AI button placement and refine responsive Guide AI controls</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/10350467df77cf35cf3ddb5f1238740724560702">10350467</a> — test(guide): guard 64px clearance and organic connected trails on dense AI maps</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/1abdf42196bb372fdf936d8ccd681c32d1236cfb">1abdf421</a> — docs(guide): document direct AI import, Review-aligned controls, and organic stop placement</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/7434a20c87f35e9268deae55744a38ae598218f4">7434a20c</a> — feat(guide): launch Teaching Blocks and AI-guided maps (#29)</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/d9d6e352824274714a19670c2eca884e0ebe7cd1">d9d6e352</a> — chore(guide): release Guide 2.0.0 after Teaching Blocks overhaul</li>
</ol>
</details>

## v1.12.1

<small data-utc="2026-10-26T05:10:00Z">October 25, 2026 at 11:10 PM MDT</small>

- **Layout:** Reduced excessive app and workspace header spacing.

<details>
<summary>View 1 commit</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/705179431dd0d8a1710e2c0e1af4ffbd24539d66">70517943</a> — Trim app and workspace header vertical chrome</li>
</ol>
</details>

## v1.12.0

<small data-utc="2026-10-24T01:41:00Z">October 23, 2026 at 7:41 PM MDT</small>

- **Coverage:** Added a fuller subject-coverage review before importing AI material.

<details>
<summary>View 4 commits</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/a33580ff0eeeda0dc82f3f8bb153bab31188491d">a33580ff</a> — Focus guided AI stage headings and clarify question coverage conditions</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/060af34ed99fbbd4bd473d009e2f574384e7e136">060af34e</a> — Polish source coverage review and preserve all topics across categories</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/772865d9added3fccf10664a5681033f0cb2192f">772865d9</a> — Add Guide full-topic coverage inventory and confirmation before import</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/3c8fdfe1c5cfc970a7cc665a4cf70c82cb149a9b">3c8fdfe1</a> — Bump Index Cards, Word Search, Crossword, and Guide for source coverage review</li>
</ol>
</details>

## v1.11.0

<small data-utc="2026-10-23T00:57:00Z">October 22, 2026 at 6:57 PM MDT</small>

- **AI Guidance:** Improved explanations around generation counts and source coverage.

<details>
<summary>View 3 commits</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/dec0380b09f384cbdbe981d194ccbf95c2b01f28">dec0380b</a> — Put source sharing before category selection without repeating it</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/ff0310487921b5baad5bc640626bf3fca53fc154">ff031048</a> — Guide learners through opening an AI chat, copying, sending and checking replies</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/83e81519bbf6401748042f450f1b3191cbb500e2">83e81519</a> — Explain AI count mismatches and Review question sampling visually</li>
</ol>
</details>

## v1.10.0

<small data-utc="2026-10-22T20:17:00Z">October 22, 2026 at 2:17 PM MDT</small>

- **AI Workflow:** Separated source sharing, generation settings, and importing into clearer steps.

<details>
<summary>View 1 commit</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/244100c502a416b1951257644b9ba26ef0c1fd6d">244100c5</a> — Restructure AI UX into distinct source, settings, and import steps</li>
</ol>
</details>

## v1.9.1

<small data-utc="2026-10-22T20:09:00Z">October 22, 2026 at 2:09 PM MDT</small>

- **Source Sharing:** Added clearer guidance for providing study material to AI.

<details>
<summary>View 1 commit</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/542b3707eb15abe0adf23bc09e406bbe8e7d4245">542b3707</a> — Show how to share study sources before AI instructions</li>
</ol>
</details>

## v1.9.0

<small data-utc="2026-10-22T20:02:00Z">October 22, 2026 at 2:02 PM MDT</small>

- **AI Creation:** Simplified source selection, category browsing, and response import.
- **Accessibility:** Improved responsive AI screens and keyboard navigation.

<details>
<summary>View 7 commits</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/7c4da940a0e2ff1b9f396ee6df8e26a82ef881ce">7c4da940</a> — Rebuild shared AI import as focused two-stage interaction</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/d808e33af0cf2292753fa55a381796ac036fa293">d808e33a</a> — Replace crowded category screen with choose, browse and generate views</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/ad87e1eb998d4a8e23e9159dfe4c70d16055cb3e">ad87e1eb</a> — Polish guided AI screens with compact shared layout, focus and supported icons</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/c2b5c02bc1360119cfbc4b9eb493a7f523ef1b45">c2b5c02b</a> — Integrate staged AI workflow across features; keep familiar scope labels</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/378a31bb628c346746ea4fc2cf823c95179fc568">378a31bb</a> — Consolidate compact AI scope option layout without changing familiar titles</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/5f6227134db478ddad7720accfcc469ff63ad3cb">5f622713</a> — Clarify continuation controls and document guided AI navigation</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/b9b0b9e1507b1293ef15fd7f827ea499907252d6">b9b0b9e1</a> — Redesign guided AI creation and category selection (#27)</li>
</ol>
</details>

## v1.8.0

<small data-utc="2026-10-20T02:38:00Z">October 19, 2026 at 8:38 PM MDT</small>

- **AI Import:** Added direct JSON import options for both List and Map guides.

<details>
<summary>View 3 commits</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/78cd67dbe3990d7b2a17492d831a80001de2125f">78cd67db</a> — Enable direct JSON import for both Guide formats</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/46d55cf35d9f719dd1e52e2a087dd454c5a37fa8">46d55cf3</a> — Expose direct List/Map JSON import on Guide AI selection</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/511088e2a40fdcbd04c61cf10fc459ef09a7aeae">511088e2</a> — Bump AI import workflow app versions (Index Cards, Word Search, Crossword, Guide, Review)</li>
</ol>
</details>

## v1.7.5

<small data-utc="2026-10-19T21:02:00Z">October 19, 2026 at 3:02 PM MDT</small>

- **Artwork:** Refined Guide icon assets and sharing imagery.

<details>
<summary>View 1 commit</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/8e85b1cd8a367fe8f4ee435987eeb9ebf4990a66">8e85b1cd</a> — Refresh app artwork and social metadata</li>
</ol>
</details>

## v1.7.4

<small data-utc="2026-10-19T20:40:00Z">October 19, 2026 at 2:40 PM MDT</small>

- **Icons:** Unified app artwork colors and visual proportions.

<details>
<summary>View 1 commit</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/c4b9c3747c8ea3f26be02482ede61e1631d777b2">c4b9c374</a> — Unify app artwork palette and optical sizing</li>
</ol>
</details>

## v1.7.3

<small data-utc="2026-10-19T20:06:00Z">October 19, 2026 at 2:06 PM MDT</small>

- **Branding:** Updated Guide's application artwork and presentation metadata.

<details>
<summary>View 1 commit</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/72dd1e737ea86a57df4e85baaa825f3c89a17e7f">72dd1e73</a> — Refresh app branding assets and metadata</li>
</ol>
</details>

## v1.7.2

<small data-utc="2026-10-12T20:11:00Z">October 12, 2026 at 2:11 PM MDT</small>

- **AI Formatting:** Clarified Markdown and mathematical notation support in generation prompts.

<details>
<summary>View 2 commits</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/bc402d074d64685ff733d65516bfa477938ad9d2">bc402d07</a> — Enable shared LaTeX in every Markdown preview</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/5e454cd464e611ddfa8ab68e0030fa6ed0a11935">5e454cd4</a> — Clarify Markdown and KaTeX capabilities across all AI prompts</li>
</ol>
</details>

## v1.7.1

<small data-utc="2026-10-12T16:00:00Z">October 12, 2026 at 10:00 AM MDT</small>

- **Responsive Layout:** Improved Guide usability in narrow windows and on smaller screens.

<details>
<summary>View 2 commits</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/37cab1c4885e2a03217ab3c5758f75ec22f3306a">37cab1c4</a> — Allow reset after skipping a Guide stop</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/0da7c2ab379e1bc2207e7ac972e90abe8597bd52">0da7c2ab</a> — Improve narrow-pane responsiveness across learning apps</li>
</ol>
</details>

## v1.7.0

<small data-utc="2026-10-09T21:33:00Z">October 9, 2026 at 3:33 PM MDT</small>

- **Study Controls:** Added the ability to reset revealed points without unvisiting a stop.

<details>
<summary>View 2 commits</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/8b24e775c074ca9484bfffea0256273c02060927">8b24e775</a> — Revert non-Guide AI features (#25)</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/0b91285d879bd54316bab72be4ecd10f49680abc">0b91285d</a> — Add Guide map point reveal reset</li>
</ol>
</details>

## v1.6.0

<small data-utc="2026-10-09T02:49:00Z">October 8, 2026 at 8:49 PM MDT</small>

- **Statistics:** Added Guide activity tracking and learning-progress information.

<details>
<summary>View 1 commit</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/a150f4bf9c1d5267fa2ef7419dfe44a4ab415a1a">a150f4bf</a> — Add workspace statistics and inline learning progress</li>
</ol>
</details>

## v1.5.4

<small data-utc="2026-10-08T19:20:00Z">October 8, 2026 at 1:20 PM MDT</small>

- **AI Workflow:** Aligned Guide's prompt and import experience with shared AI controls.

<details>
<summary>View 1 commit</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/b68709d8d2ac84dd6e11a94acb71fb29c4e36edf">b68709d8</a> — Add AI creation for Index Cards and Review</li>
</ol>
</details>

## v1.5.3

<small data-utc="2026-10-08T03:40:00Z">October 7, 2026 at 9:40 PM MDT</small>

- **Session Flow:** Corrected how unopened adventures return to the starting screen.

<details>
<summary>View 2 commits</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/ac46678b86eef4b1d24f675d2d6598090ea7c5ec">ac46678b</a> — Bump Guide to 1.5.3 for unopened adventure exit fix</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/d9a7d8ae1eae6b4d1c10a052ed055c67c41cb9e9">d9a7d8ae</a> — Guide: AI map import, resumable adventures and UI polish (#21)</li>
</ol>
</details>

## v1.5.2

<small data-utc="2026-10-08T03:40:00Z">October 7, 2026 at 9:40 PM MDT</small>

- **Restarting:** Restored the opening animation when restarting an adventure.

<details>
<summary>View 2 commits</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/ae921876aa5d832db9080f5de95d3966af08833d">ae921876</a> — Bump Guide to 1.5.2 for restart animation fix</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/ebce4e08e5b5defd9c1f20c3f1ce40e7279bce75">ebce4e08</a> — Return unopened Guide adventures to the initial start screen</li>
</ol>
</details>

## v1.5.1

<small data-utc="2026-10-08T03:37:00Z">October 7, 2026 at 9:37 PM MDT</small>

- **Starting Point:** Improved the persistent start marker and its subtle animation.

<details>
<summary>View 7 commits</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/ebb2e112394a0590628f9bd0d7f7b131800cfedb">ebb2e112</a> — Keep skipped Guide map stops visually distinct</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/732f9bcbe3f593e90577a4e2990b65d4260a6dd6">732f9bcb</a> — Update Guide Map tips for clickable resumable stops</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/8efaeafb9fbe892cfacee582407424b1db3044be">8efaeafb</a> — Keep Guide first-stop invitation until opened</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/96c78389367e6357508327804667fcd037cc72ed">96c78389</a> — Give Guide start marker a continuous gentle pulse</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/ef0bfd8663dbf514130e7660dfe50155e60477f8">ef0bfd86</a> — Make Guide start invitation accessible and respect fallback start</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/39828fed9ffda2828a5e13b3b61e054126d351ff">39828fed</a> — Bump Guide to 1.5.1 for persistent start highlight</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/1f09c4d9e7c038dcb36f18932e33996712ea6fca">1f09c4d9</a> — Replay Guide cinematic when restarting an adventure</li>
</ol>
</details>

## v1.5.0

<small data-utc="2026-10-08T03:32:00Z">October 7, 2026 at 9:32 PM MDT</small>

- **Saved Progress:** Added resumable map adventures and direct stop exploration.
- **Navigation:** Distinguished completed, skipped, and unavailable destinations.

<details>
<summary>View 8 commits</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/3e903caf57dad6fe1972d7f223d93e3169f2122f">3e903caf</a> — Persist Guide adventures and decouple map navigation from notes</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/e7cce3686d7ec94a2c8eebb5ba4e66944aee678e">e7cce368</a> — Make Guide map stops directly explorable and resumable</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/78ae8eb89d707800b770a486420591835128d984">78ae8eb8</a> — Distinguish clickable, completed and locked Guide map stops</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/c235ff8bdc65f74c48a2b65dae0e3f3371a86b88">c235ff8b</a> — Document resumable Guide Map adventures in backups</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/9d306e049277d26815e9b101d15300b522506c0e">9d306e04</a> — Fix strict typing in Guide map session normalization</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/16884dcf888f024eae7a5466847dcb61265d3d67">16884dcf</a> — Reserve map intro animation for Start adventure</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/d3a1626cfff89e955967f9de4579818885d9ed79">d3a1626c</a> — Bump Guide to 1.5.0 for saved map exploration</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/533d5e1aeac0f5f46f3bf628a09a837dd18913a8">533d5e1a</a> — Clarify that leaving Guide adventures saves progress</li>
</ol>
</details>

## v1.4.1

<small data-utc="2026-10-08T03:28:00Z">October 7, 2026 at 9:28 PM MDT</small>

- **Camera:** Added a cinematic arrival animation and starting-point highlight.

<details>
<summary>View 3 commits</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/4d2bd31e199430f25adb80fdeb3f76bdc318773a">4d2bd31e</a> — Animate opening map zoom and starting-point highlight</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/e24c9da4f44d5fc32efd4b131fca17cbc6ba37b6">e24c9da4</a> — Bump Guide to 1.4.1 for cinematic arrival polish</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/b80fe6cebeba360ca5a953ad46fe96d185378ad8">b80fe6ce</a> — Persist and validate individual Guide map adventures</li>
</ol>
</details>

## v1.4.0

<small data-utc="2026-10-08T03:23:00Z">October 7, 2026 at 9:23 PM MDT</small>

- **Map Study:** Added optional section skipping and a pause before opening each stop.

<details>
<summary>View 3 commits</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/ec5d4fbfb26308f2d76ac439fe17a236bbd52cf6">ec5d4fbf</a> — Unify Guide Map reveal and route buttons</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/ace304ea45f727f8b7586d25d06aed8ce3d9d73e">ace304ea</a> — Bump Guide to 1.4.0 for skippable map stops</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/0c4adc94daf282c1af4c949dca8bf2c636fb1058">0c4adc94</a> — Add cinematic Guide map arrival camera</li>
</ol>
</details>

## v1.3.0

<small data-utc="2026-10-08T03:09:00Z">October 7, 2026 at 9:09 PM MDT</small>

- **Renaming:** Renamed Study Guide to Guide and updated its navigation.
- **Compatibility:** Preserved old guides and redirected previous bookmarks.

<details>
<summary>View 2 commits</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/744b1ae6fd5bdea94e83397d35bce14052ac9e8f">744b1ae6</a> — Complete Guide rename across app, navigation and persistence</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/acb579b857f00b353903dcaf0e7caee8bb040ccc">acb579b8</a> — Add Guide Map arrival pause and Skip section navigation</li>
</ol>
</details>

## v1.2.0

<small data-utc="2026-10-07T20:36:00Z">October 7, 2026 at 2:36 PM MDT</small>

- **AI Maps:** Added AI-generated connected maps and more natural branching routes.
- **Study Flow:** Introduced immersive map travel, lesson sheets, and guided reveals.

<details>
<summary>View 34 commits</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/3ddb4200803b507c73610947266db75fb3f25227">3ddb4200</a> — Add deterministic Study Guide map auto-layout</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/e06f2eabc1d5c56ccc00cb70ef93887dc40a57ad">e06f2eab</a> — Add Map-mode AI prompt and JSON contract</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/410c6796916279d5d4c9e30cbe9a335ceece8b14">410c6796</a> — Wire AI-created maps into Study Guide</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/550f5256ca6974f188dc9dd6ba70925e08b51d03">550f5256</a> — Bump Study Guide to 1.2.0</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/018a27bd058e01db810e7e5a2d7820cd68292c85">018a27bd</a> — Polish shared Study Guide import validation wording</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/c617ca10fa0e4558d745d3fb80fbb1bc5c874faa">c617ca10</a> — Preserve existing List-mode AI prompt wording</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/15c5cee3a4c142c5e617fee345ac9f08c1864a7b">15c5cee3</a> — Prevent AI citation artifacts in Study Guide imports</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/a5b03a502179e3fe972bb6cfa9aa142c9ab7c6db">a5b03a50</a> — Make Study Guide AI maps path-first</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/354651d635f206b576cf9d671b49676ecb9672f3">354651d6</a> — Guide users from prompt copy to JSON import</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/afe9c05b4ae7c8d621ad02e008f0427e734e536a">afe9c05b</a> — Polish Study Guide AI handoff flow</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/60a0956218978503487cd9d5a5a7ad2572d4b6b1">60a09562</a> — Make Study Guide map prompts adventurous</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/b01ab33cac52ef2117bf3940b8d737038cff4bba">b01ab33c</a> — Validate AI-suggested Study Guide map positions</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/4ffb38b3fe504293f472da69992481af06b174a4">4ffb38b3</a> — Use validated AI Study Guide map positions</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/da0ea5a256e9ef454b13f57713698b9abf3054ac">da0ea5a2</a> — Make Study Guide fallback layout horizontal</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/f2f8b7f965d0d63a63b94047b1cf59ecfb8c3f45">f2f8b7f9</a> — Make Map overview the default Study Guide destination</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/f0e744df2ede71c9c8284794b8d176ef461b6fb6">f0e744df</a> — Make map study an immersive destination-to-destination journey</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/ab28a3121b998ead78e4ba269d277c343f0e9a52">ab28a312</a> — Animate immersive Study Guide topic overlays</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/72e507142854600cdc7c963144e3ab04e3b7cec3">72e50714</a> — Focus topic headings on arrival and return</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/801bc9b2d639002538b280485445c1a63c113711">801bc9b2</a> — Animate Study Guide AI prompt to import tab transitions</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/d2572cac310dc303d1394969b885e3761bb866f5">d2572cac</a> — Style smooth bidirectional Study Guide AI tab swaps</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/2883bc1670f8b8b02e7faaa7782e91fa4d85f8b8">2883bc16</a> — Soften Study Guide AI tab selection state changes</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/0a56a97e2c198c4034cdde9a16e2ce25c008eb93">0a56a97e</a> — Add optional descriptions to Study Guide map topics</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/d0a12c52f2896c3071c6611d12104d50417e741b">d0a12c52</a> — Prompt AI for contextual Map stop descriptions</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/0d4796c74b6ee4b670e5b0764bb55daf61f6846e">0d4796c7</a> — Persist imported Map topic descriptions</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/dbcbdcbf7804a9bc6bcada38ee873f14419c84e1">dbcbdcbf</a> — Edit optional Study Guide Map stop descriptions</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/4fe569880ee4dfe2740a58ec3da54d4292b3795a">4fe56988</a> — Introduce each Map stop before revealing its points</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/19c53b6d0d5fcf707f77467c7dfd2e2d4dc8ef85">19c53b6d</a> — Polish Map stop descriptions and reveal button contrast</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/3b934bcaa6d0bf8ac3ce4d665bbb46609f856cee">3b934bca</a> — Smooth Study Guide AI response-ready scroll</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/a4d34281306b56e2a624121f841273424aa13029">a4d34281</a> — Scroll AI response handoff within its actual workspace</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/266c8da273f6ecdcd044f004b591052c4bc550d2">266c8da2</a> — Follow Map study point reveals with smooth panel scrolling</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/7d5bfeccf7f9dd6a9beef2b548c311b357c47ae6">7d5bfecc</a> — Add pinned close action to Map study topic overlay</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/c396f3f56f1910cf1c2f2a7a2ffff0e3d5a0f66a">c396f3f5</a> — Keep Map study close button pinned above scrolling points</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/b6e7fc19f25c620a3a4938670d0bd129e7be35d4">b6e7fc19</a> — Automatically continue after backtracking to a single new Map stop</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/78bc08615b52b52f5cbfe02e4eee91213a068cae">78bc0861</a> — Rename Guide feature internals, UI and artwork</li>
</ol>
</details>

## v1.1.1

<small data-utc="2026-10-07T16:49:00Z">October 7, 2026 at 10:49 AM MDT</small>

- **Accessibility:** Improved keyboard and screen-reader support for list editing.

<details>
<summary>View 1 commit</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/925ea1f5b1a42f1c51f65ec3f3c3c9ee246d47f8">925ea1f5</a> — Improve Study Guide list accessibility</li>
</ol>
</details>

## v1.1.0

<small data-utc="2026-10-07T01:03:00Z">October 6, 2026 at 7:03 PM MDT</small>

- **AI Creation:** Introduced source-based AI generation and JSON imports for List guides.
- **Lists:** Added nested notes and improved editing shortcuts.
- **Customization:** Added controls for detail, coverage, and writing style.

<details>
<summary>View 42 commits</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/da7feaa4098c350e75c38286c0855902e39ae0f7">da7feaa4</a> — Improve Study Guide list keyboard editing</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/27f7f39f781739ed27939a2189e3a8904535f59c">27f7f39f</a> — Add Study Guide AI import contract</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/7caef626741133af9c1cb02487e876a0f2478d78">7caef626</a> — Add Study Guide AI toolbar action</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/29774a75dc4d881433abbfd5ed3a2af6b5f380f3">29774a75</a> — Wire simple AI imports into Study Guide</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/8a52053779e21b27f5ba553cf95a9435521bc576">8a520537</a> — Add shared AI sparkle icon</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/e50cc04e8b5ef94dbd643965cb4160c607af867e">e50cc04e</a> — Bump Study Guide for AI import workflow</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/4b85e08acd99e6b2bca894fc1c1968c6837c1740">4b85e08a</a> — Route Study Guide AI import changes</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/51f794aaf1a67bdeeb84d2796c0d3a99a93b5bc9">51f794aa</a> — Add Study Guide AI prompt options</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/7c0c9c88afee55778e0fea1fc7b836512a0fc51b">7c0c9c88</a> — Clarify AI prompt source order</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/92160b41bc69d7488b5a32c8574b160a6b886d79">92160b41</a> — Keep AI prompt copy current with options</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/cbf69e1ce9a3f826cf842d3205c3a14d590e46ea">cbf69e1c</a> — Collapse AI prompt behind copy controls</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/4e8aafce8441946b534beea394e3849d2e07487d">4e8aafce</a> — Keep Study Guide AI routing concise</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/687ef97505f919741b8fad7dd348ca11eb40bf30">687ef975</a> — Refine AI prompt fallback disclosure</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/bff927e8686577fb503d7ada9c31f061110ce7e3">bff927e8</a> — Keep AI prompt fallback compact</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/9724d21e319fbc95ab4260786b458d3086787cc4">9724d21e</a> — Retain compact AI prompt fallback</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/8f8da36acc673f0bea1a26841bb5c693bfb11434">8f8da36a</a> — Preserve compact prompt disclosure behavior</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/1be522eea351d5b9d2b5e08daacda363677e6413">1be522ee</a> — Preserve compact prompt disclosure behavior</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/6515b06ef84983879a07b2270d6c921046a577c3">6515b06e</a> — Cycle Study Guide bullet markers by depth</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/fdcd81ad03d4f701395a7ebe049e5de1f6f2ca46">fdcd81ad</a> — Support hierarchical AI Study Guide imports</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/3926bf821753cb04f313fee90506680493e5b8fb">3926bf82</a> — Import AI Study Guide sections and nested bullets</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/501b030bfc1b787de2370576fd6ab0e7715c4371">501b030b</a> — Tone down Study Guide bullet markers</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/4ffc768be4f9d42b3402966bec1cf24caa1129d6">4ffc768b</a> — Size Study Guide bullet markers subtly</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/e51983c364775562969fcad899aa991d30d899a4">e51983c3</a> — Normalize Study Guide bullet marker geometry</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/0d42bc651c5fe4c3ac0ce00a40c179e048a5077e">0d42bc65</a> — Keep Study Guide bullet markers optically consistent</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/cb806f79c283c652d1085c752e84309cb804927c">cb806f79</a> — Fine tune Study Guide bullet marker sizes</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/def6f3167bd0629eb13f243af781b5b85b3cd217">def6f316</a> — Fine tune Study Guide square and light asterisk markers</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/fd7d02c9f193d1f104924fadb50af205e9fdf383">fd7d02c9</a> — Shrink Study Guide bullet markers uniformly</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/4adcf933dd6a10a7989d2db8fb53161daaa84ac7">4adcf933</a> — Shrink Study Guide bullet markers again</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/a45100877875dabb20593dbcb9a3f3bc113af489">a4510087</a> — Refine Study Guide bullet marker alignment and contrast</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/95d1ce78b448c886623247f41c3acc48ed2ff6d1">95d1ce78</a> — Refine AI Study Guide prompt prioritization</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/89b998b74447967dca91a5ff466a9d6e9b7892e8">89b998b7</a> — Close AI prompt JSON example fence</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/016b3b3b4e0863d73be0153d0fca9cc9b4891653">016b3b3b</a> — Simplify AI Study Guide note style prompt</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/acf7cb3924d2d75d12748797abdb887103333106">acf7cb39</a> — Clarify Study Guide bullet style semantics</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/54812381e802df19129bbd680a563bc40760fc33">54812381</a> — Keep complete-thought Study Guide bullets short</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/3e96b2b62da53aab847756aafea04075dd35b6d8">3e96b2b6</a> — Default Study Guide AI prompt to complete thoughts</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/8df6aa85e13c49a44dfbebc4a72a28c9019b57ae">8df6aa85</a> — Support unavailable Study Guide modes in type picker</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/e60f380b95f5d991f237a42c67e60a64b273c74d">e60f380b</a> — Move Study Guide AI import into workspace</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/5e6da8afff545f51375e67e40199d535f8c0ed24">5e6da8af</a> — Route Study Guide AI creation through type chooser</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/039ac187507076aac585342a63d2644a4a058bf5">039ac187</a> — Style full workspace AI Study Guide flow</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/3318bfc4e4fc76157047601c4acadf01e66ec8b7">3318bfc4</a> — Rename Study Guide AI library action</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/d190c4a213758469b200cc6c7cc409399bab8c2a">d190c4a2</a> — Merge main into Study Guide AI import</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/fb0312980dd6aaf609de3d67f7c31e4c36862912">fb031298</a> — Add Study Guide AI/JSON import and keyboard editing (#20)</li>
</ol>
</details>

## v1.0.0

<small data-utc="2026-10-06T01:02:00Z">October 5, 2026 at 7:02 PM MDT</small>

- **Stable Release:** Completed List and Map creation, saving, and guided study.
- **Navigation:** Improved route selection, progress, and map connections.
- **Tips:** Added introductory guidance for the Study Guide.

<details>
<summary>View 12 commits</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/24cc39d451b1ad24198baf02fa25c1ea85b6d4e4">24cc39d4</a> — Fix Study Guide backtrack narrowing</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/ef787d102cb911acae823f3b563913ece14a30f2">ef787d10</a> — Prevent Study Guide connection loops</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/2b0bf434cc3a1ba9016373f0491a992d46ef88f5">2b0bf434</a> — Polish Study Guide connection editing</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/a93a62df4fdd85559cfe7cec0439dd9bff078992">a93a62df</a> — Merge main and document Study Guide loop guard</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/9c936b1b49379fe520a9a63559312cd2f1208a75">9c936b1b</a> — Keep connection source selected after rejection</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/f38737b8f9fe9f75fef45613505e12faa20506c7">f38737b8</a> — Merge latest main into Study Guide loop fix</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/a424a65e5deb7d80bbb2891f9d0258e9f06df055">a424a65e</a> — Default ready maps to Study overview</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/e870bafa4cde91a25482c37ba9a49220b6a13c1f">e870bafa</a> — Merge latest main into Study Guide release</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/cb2c5b58e9c0c21c4254b193fbbe1e1f6e9e143d">cb2c5b58</a> — Preserve latest main scoring changes</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/1b9ec4be84facfc3f9bb605fcba6229bf06e89e6">1b9ec4be</a> — Fix Study Guide Tips registration</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/24da693f0038cc25048fec35b4919f203611d34a">24da693f</a> — Release Study Guide 1.0.0</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/a37c17d727d123aa692730e0d12575bc0ed1b56f">a37c17d7</a> — Release Study Guide 1.0.0</li>
</ol>
</details>

## v0.3.0

<small data-utc="2026-10-06T00:21:00Z">October 5, 2026 at 6:21 PM MDT</small>

- **Map Connections:** Added branching routes, connected topics, and guided map study.

<details>
<summary>View 12 commits</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/9b9ce21a3aaac43e63ec94273c62d33ef0bdcd2b">9b9ce21a</a> — Document Study Guide v0.2.0</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/43a0f0ce6a5bf18671cd5785f7a9db9b9de42bc3">43a0f0ce</a> — Document Study Guide persistence</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/da07ad82079822ffb5f8c29132257fc57ad6c4dc">da07ad82</a> — Merge main into Study Guide build</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/59f0992df5707516b8cbbcbb31bdc933dfcc02b5">59f0992d</a> — Merge latest main into Study Guide build</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/694fa0f3098b01fb0efb6dcd52a5aa7f1ce0d588">694fa0f3</a> — Tighten Study Guide editor bounds</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/28cd9f3e45135545fd855810873e042c3242f129">28cd9f3e</a> — Fix Study Guide map constant imports</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/83ceb1632fe26dff846fcdfdfec31c57ed8fb86b">83ceb163</a> — Enforce snapped Study Guide map bounds</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/fae278dc131add684ae213a2b98110ada927b3f0">fae278dc</a> — Add explicit Study Guide map graph model</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/631e28f04423271254d7d6f8eef30064f8b51905">631e28f0</a> — Add manual Study Guide map connections</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/f86aced99c646f378e5f2fa4485db8b918d516e3">f86aced9</a> — Add guided Study Guide map sessions</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/aa114bc6e09f7d5fe5c250063e9a100286f33c2b">aa114bc6</a> — Merge latest main into Study Guide work</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/a9b3791adaece6cc15bfcf60f3045b2ac4dd00b7">a9b3791a</a> — Document Study Guide graph study v0.3.0</li>
</ol>
</details>

## v0.2.0

<small data-utc="2026-10-05T23:34:00Z">October 5, 2026 at 5:34 PM MDT</small>

- **Guide Modes:** Added editable lists and connected topic maps.
- **Library:** Added saved guides with organized study content.

<details>
<summary>View 3 commits</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/cfc26d87f0c0e81d34df7132bed33c67d62be324">cfc26d87</a> — Merge main into Study Guide scaffold</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/9e15f83ff18a8e7fd38b051655a974f4544c021d">9e15f83f</a> — Add Study Guide artwork and metadata</li>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/02615fea0ea006ba432c9ca372536bb69548b213">02615fea</a> — Build Study Guide list and map modes</li>
</ol>
</details>

## v0.1.0

<small data-utc="2026-10-05T23:13:00Z">October 5, 2026 at 5:13 PM MDT</small>

- **Launch:** Introduced the Study Guide foundation and application entry.

<details>
<summary>View 1 commit</summary>
<ol>
<li><a href="https://github.com/FireController1847/ai-dynamic-learner/commit/82e83bd4c9542fa5f066ec63d7e961c53bdd901d">82e83bd4</a> — Add Study Guide app scaffold</li>
</ol>
</details>

