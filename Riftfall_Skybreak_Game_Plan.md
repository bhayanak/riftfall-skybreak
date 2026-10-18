# Riftfall: Skybreak

## Game Vision

A fast, lightweight, visually spectacular **3D action-platform roguelite** designed for desktop and mobile browsers, GitHub Pages and CrazyGames.

The world has shattered into floating islands. The Rift is consuming reality and collapsing the route behind the player. The player must maintain momentum, chain movement abilities, cross spectacular environments and escape through portals before the world disappears.

```text
RUN
  -> JUMP
      -> DASH
          -> WALL-RUN
              -> GRAPPLE
                  -> PORTAL
                      -> UPGRADE
                          -> NEW BIOME
                              -> WORLD EVENT
                                  -> BOSS
```

Core rule:

> Easy to understand, difficult to master, immediately playable, visually memorable and lightweight enough for mobile web.

---

# Technology

```text
PLAYCANVAS
     |
     +-- TypeScript
     +-- Vite
     +-- WebGL2 as compatibility baseline
     +-- WebGPU where appropriate/supported
     +-- glTF / GLB assets
     +-- Physics
     +-- Animation
     +-- Particles / VFX
     +-- HTML/CSS UI
     +-- CrazyGames HTML5 SDK
     |
     v
GITHUB
     |
     +-- Git repository
     +-- GitHub Actions
     +-- GitHub Pages test deployment
```

Production targets:

- CrazyGames
- Desktop browsers
- Mobile browsers
- Chromebook-class hardware
- GitHub Pages for development/test builds

---

# Performance Target

Design around a **sub-20 MB initial playable download** so the first biome can start quickly and the game can target CrazyGames mobile-homepage eligibility.

```text
INITIAL DOWNLOAD
      |
      +-- Player
      +-- Essential animations
      +-- First biome
      +-- Common VFX
      +-- Essential UI
      +-- Core audio
      |
      v
PLAYER STARTS PLAYING
      |
      +-- Stream/cache later biomes
      +-- Boss assets
      +-- Cosmetics
      +-- Additional music/audio
```

Do not download every biome before gameplay starts.

---

# Core Gameplay

```text
Start Run
   |
   v
Traverse Floating Islands
   |
   +-> Run
   +-> Jump
   +-> Dash
   +-> Wall-run
   +-> Grapple
   +-> Slide / Vault
   |
   v
Collect Rift Energy
   |
   v
Build FLOW multiplier
   |
   v
Reach Portal
   |
   v
Choose 1 of 3 upgrades
   |
   v
Enter transformed/new biome
   |
   v
World Event
   |
   v
Boss / Escape Sequence
   |
   v
Rewards + New Run
```

The game is primarily about movement, not complicated combat.

---

# Player

```text
Player
  -> free stylised humanoid base
  -> lightweight skeleton
  -> generated/recoloured costume variations
  -> modular cosmetics
  -> movement animation library

Animations
  -> idle
  -> run
  -> sprint
  -> jump
  -> fall
  -> land
  -> dash
  -> wall-run
  -> grapple
  -> slide
  -> stumble
  -> victory
```

Recommended approach:

```text
Quaternius character
        |
        v
Quaternius / Mixamo animations
        |
        v
Blender optimisation
        |
        v
GLB
        |
        v
PlayCanvas
```

## Player Cosmetics

Use one skeleton rather than many completely different characters.

```text
Base Character
      |
      +-- Head style
      +-- Hair/helmet
      +-- Jacket/armour
      +-- Gloves
      +-- Boots
      +-- Backpack
      +-- Trail colour
      +-- Rift aura
```

This provides progression rewards without multiplying animation work.

---

# Controls

## Desktop

```text
WASD       Move
Mouse      Camera
Space      Jump
Shift      Dash
E          Grapple
```

## Mobile

```text
+---------------------------------------+
|                                       |
|                 GAME                  |
|                                       |
|                        [ GRAPPLE ]    |
|                                       |
|     ( MOVE )             [ JUMP ]     |
|                           [ DASH ]     |
|                                       |
+---------------------------------------+
```

Mobile assistance:

```text
Low obstacle      -> auto-vault
Suitable wall     -> assisted wall-run
Nearby ledge      -> ledge assist
Valid anchor      -> grapple button activates
Near landing edge -> small landing forgiveness
```

Keep the game skill-based, but make touch controls forgiving.

---

# Movement System

Movement is the main source of fun.

```text
SPRINT
  |
  v
JUMP
  |
  v
WALL-RUN
  |
  v
LEAP
  |
  v
GRAPPLE
  |
  v
SWING
  |
  v
AIR DASH
  |
  v
PERFECT LANDING
  |
  v
PORTAL
```

Unlockable movement abilities:

- Double Jump
- Extra Dash
- Air Dash
- Long Grapple
- Grapple Boost
- Wall Boost
- Longer Wall Run
- Fall Recovery
- Rift Blink

---

# FLOW System

Reward uninterrupted stylish movement.

```text
Normal movement                  FLOW x1
Wall-run -> Jump                 FLOW x2
Wall-run -> Jump -> Grapple      FLOW x3
Grapple -> Dash -> Wall-run      FLOW x4
Long uninterrupted chain        FLOW x5
```

Higher FLOW increases:

- Rift Energy reward
- Score multiplier
- Player trail intensity
- Particle intensity
- Music layers
- Portal energy
- Subtle camera/FOV effects

Great play should literally make the game look and sound better.

---

# World

```text
World
  -> modular floating islands
  -> modular ruins/buildings
  -> ancient pathways
  -> generated/custom hero landmarks
  -> floating rocks
  -> waterfalls falling into the void
  -> distant creatures
  -> portal structures
  -> free PBR terrain materials
  -> procedural arrangement of handcrafted chunks
```

Do not generate arbitrary geometry procedurally.

Build good handcrafted chunks and procedurally arrange them.

```text
Chunk Library
  |
  +-- Straight Run
  +-- Broken Bridge
  +-- Wall-run Canyon
  +-- Grapple Gap
  +-- Ruined Temple
  +-- Waterfall Islands
  +-- Vertical Tower
  +-- Rotating Ruins
  +-- Collapsing Bridge
  +-- Crystal Cave
  +-- Portal Chamber
  +-- Event Arena
  +-- Boss Escape Route
```

Generation:

```text
START
  |
Chunk A
  |
valid connector
  |
Chunk G
  |
Chunk C
  |
WORLD EVENT
  |
Chunk J
  |
PORTAL
```

---

# Biomes

Start with only three polished biomes.

## 1. Sky Ruins

```text
Blue sky
White moving clouds
Green floating islands
Ancient stone ruins
Golden sunlight
Huge waterfalls
Blue Rift energy
Flying creatures in distance
```

## 2. Fire Rift

```text
Dark red sky
Volcanic floating rocks
Lava falls
Ash particles
Broken ruins
Orange portals
Meteor showers
Cracking platforms
```

## 3. Void

```text
Purple/black sky
Floating crystals
Impossible architecture
Reversed waterfalls
Gravity anomalies
Glowing plants
Huge moon/planet
Purple Rift energy
```

Future biome candidates:

- Frozen Rift
- Storm Realm
- Neon/Cyber Rift
- Ancient Jungle
- Ocean Skyworld
- Crystal Realm

---

# Visual Wow

The game should not chase photorealism.

Aim for **stylised geometry + excellent composition + motion + lighting + VFX**.

```text
Visual Wow
  -> enormous skies
  -> layered moving clouds
  -> floating ruins
  -> glowing portals
  -> waterfalls falling into sky/void
  -> mist
  -> particle trails
  -> Rift lightning
  -> collapsing terrain
  -> rotating islands
  -> glowing crystals
  -> wind/debris particles
  -> distant flying creatures
  -> strong sunrise/sunset lighting
  -> biome colour grading
  -> speed-responsive camera
```

## Cheap Visual Tricks

### Waterfall

```text
Scrolling translucent mesh
        +
small particle emitter
        +
mist billboard
```

Avoid real fluid simulation.

### Portal

```text
Ring mesh
   +
emissive material
   +
scrolling/rotating UV
   +
small particles
   +
light/glow
```

### Clouds

```text
Layered billboard/card meshes
          +
slow movement
          +
depth/parallax
```

### Fog

Use lightweight distance/height fog. Avoid expensive true volumetric fog on mobile.

### Giant Distant Creature

```text
Very low-poly silhouette
        +
slow looping animation
        +
large scale
        +
far distance
```

Perceived spectacle is huge while rendering cost can remain modest.

---

# Signature World Events

Every run should have memorable surprises.

## Gravity Shift

```text
GRAVITY SHIFT
       |
world rotates
       |
wall becomes floor
       |
new traversal route
```

## Rift Storm

Lightning begins destroying upcoming platforms.

## Island Fracture

The environment breaks apart behind the player, forcing forward movement.

## Sky Whale

A gigantic creature passes beneath the islands and temporarily changes the route.

## Portal Collapse

The portal starts closing, creating a short high-speed escape sequence.

## Meteor Rain

Meteor impacts dynamically block or destroy selected paths.

---

# Upgrades

At each major portal, present three cards.

```text
+----------------+
|  DOUBLE DASH   |
+----------------+

+----------------+
| LONG GRAPPLE   |
+----------------+

+----------------+
|    AIR JUMP    |
+----------------+
```

## Movement

- Double Jump
- Triple Jump
- Extra Dash
- Air Dash
- Longer Grapple
- Faster Grapple
- Wall Boost
- Longer Wall Run

## Survival

- Rift Shield
- Second Chance
- Fall Recovery
- Damage/Fall Immunity Window

## FLOW

- Energy Magnet
- Slow-Motion Perfect Dodge
- Portal Bonus
- FLOW Booster
- FLOW Decays More Slowly

---

# Boss Design

Bosses should attack the route rather than turn the game into a traditional combat system.

## Rift Titan

```text
          GIANT TITAN
               |
               v
      destroys platform

PLAYER -> RUN -> JUMP -> GRAPPLE -> ESCAPE
```

Other bosses:

### Sky Serpent
Destroys paths and flies through upcoming islands.

### Rift Eye
Sweeps laser beams across traversal routes.

### Storm Giant
Changes wind and gravity direction.

### Void Whale
Consumes sections of the route, forcing alternative paths.

This keeps the game's movement identity consistent.

---

# Asset Sources

## Quaternius

https://quaternius.com/

Best source for the core stylised look.

Look for:

- characters
- monsters
- animation libraries
- modular ruins
- sci-fi kits
- fantasy props
- nature packs
- rocks
- buildings

Especially investigate:

- Universal Animation Library
- Ultimate Animated Character Pack
- Ultimate Modular Ruins Pack
- Ultimate Stylized Nature Pack
- Ultimate Modular Sci-Fi Pack
- Sci-Fi Essentials Kit
- Fantasy Props MegaKit

Quaternius assets are particularly useful because a consistent source reduces the mismatched "asset-store game" appearance.

---

## Kenney

https://kenney.nl/assets

Use primarily for:

- UI
- icons
- input prompts
- simple props
- prototype geometry
- lightweight environment pieces

Useful packs include the Prototype Kit and various 3D environment collections.

---

## Adobe Mixamo

https://www.mixamo.com/

Use for humanoid animation gaps such as:

- running
- jumping
- landing
- falling
- climbing
- dodging
- celebrations

Use a shared humanoid rig whenever possible so one animation sequence can support several cosmetic character variants.

---

## Poly Haven

https://polyhaven.com/

Use carefully for:

- HDRI skies/lighting references
- selected textures
- occasional hero models

Do not ship enormous source files unchanged. Optimise them first.

---

## ambientCG

https://ambientcg.com/

Use for lightweight versions of:

- stone
- cliffs
- ground
- sand
- rock
- metal
- ice
- ruins
- lava-like surfaces

Prefer 512 px / 1K working textures for most game assets after optimisation rather than downloading/shipping huge 4K/8K textures.

---

# Asset Strategy

Do not collect thousands of models.

Create a compact reusable visual kit.

```text
PLAYER
1 base rig
4-6 cosmetic looks

WORLD
15-20 rocks
10-15 platforms
10-15 ruins
6-10 trees/plants
8-10 crystals
6-8 portal components
15-20 props

VFX
portal
rift trail
dash
jump
energy pickup
lightning
dust
mist
sparks
collapse

BIOMES
Sky
Fire
Void
```

Then generate variation using:

```text
rotation
scale
colour
material
lighting
fog
decals
prop combinations
```

A small, coherent library is better than hundreds of unrelated assets.

---

# Asset Pipeline

```text
SOURCE ASSET
Quaternius / Kenney / Mixamo / Poly Haven / ambientCG / Generated
        |
        v
      BLENDER
        |
        +-- remove unseen geometry
        +-- simplify geometry where needed
        +-- create simple collision mesh
        +-- reduce material count
        +-- resize textures
        +-- atlas when worthwhile
        +-- remove unused animation tracks
        +-- verify origin/scale
        |
        v
       GLB
        |
        v
 Model/Texture Compression
        |
        v
    PLAYCANVAS
```

Suggested design budgets rather than hard limits:

```text
Hero character       ~10K-25K triangles
Common enemy/creature ~3K-10K
Normal prop           ~200-5K
Hero landmark          ~5K-30K
```

Prefer shared materials aggressively.

```text
1 reusable material x 20 objects
```

is preferable to:

```text
20 almost-identical materials
```

---

# Texture Strategy

Suggested starting budget:

```text
Tiny prop             256 px
Normal prop            512 px
Normal environment     512 px
Important asset       1024 px
Hero character        1024 px
Rare hero landmark 1024-2048 px
```

Use compressed textures for production builds when practical.

Do not ship giant source PBR texture sets unchanged.

---

# Mobile / Desktop Quality Profiles

## Mobile Low

```text
WebGL2
lower internal render scale
simple shadow setup
cheap fog
low particle density
few dynamic lights
small textures
no expensive post processing
```

## Mobile High

```text
higher render scale
moderate shadows
small amount of bloom
more particles
better portal VFX
```

## Desktop

```text
higher render scale
better shadows
bloom
more environmental particles
stronger portal effects
higher environment detail
```

Gameplay should remain identical across profiles.

---

# Performance Rules

Avoid:

- Hundreds of dynamic lights
- Huge transparent particle systems
- 4K/8K gameplay textures
- Expensive full-screen effects everywhere
- Complex collision meshes
- Physics on decorative objects
- High-poly distant scenery
- Loading every biome before gameplay

Prefer:

- Hardware instancing
- Object pooling
- LODs
- Shared materials
- Simple collision geometry
- Compressed GLB/glTF assets
- Compressed textures
- Chunk streaming
- Lazy loading
- Baked/stylised lighting
- Distance culling

---

# Camera

```text
        CAMERA
           \
            \
             PLAYER -------> direction of travel
                 \
                  \ platform
```

Camera effects:

- subtle speed FOV increase
- small landing bump
- dash FOV pulse
- grapple speed response
- portal distortion
- limited screen shake

Reduce shake and intense effects on mobile.

---

# Audio

```text
Wind ambience
      +
Footsteps
      +
Movement whoosh
      +
Dash impact
      +
Grapple sound
      +
Portal energy
      +
World ambience
      +
Adaptive music
```

FLOW-driven music:

```text
FLOW 1 -> ambience
FLOW 2 -> percussion
FLOW 3 -> bass
FLOW 4 -> melody
FLOW 5 -> full music + stronger VFX
```

---

# UI

Keep HUD extremely clean.

```text
+------------------------------------------------+
| FLOW x4                              ENERGY 284 |
| =========                                      |
|                                                |
|                                                |
|                    PLAYER                      |
|                                                |
|                                                |
| REACH THE RIFT                                 |
+------------------------------------------------+
```

Mobile:

```text
+---------------------------------------+
| FLOW x3                    ENERGY 190 |
|                                       |
|                  PLAYER               |
|                                       |
|                                       |
|    (MOVE)                    (ACTION) |
|                              (DASH)   |
+---------------------------------------+
```

---

# First 60 Seconds

The start must reach gameplay immediately.

```text
0s
Player appears
   |
   v
RUN
   |
   v
Easy Jump
   |
   v
Huge Waterfall Reveal
   |
   v
Dash Introduction
   |
   v
First Collapsing Platform
   |
   v
Grapple Across Huge Gap
   |
   v
Rift Portal
   |
   v
Choose Upgrade
   |
   v
Portal Explodes
   |
   v
NEW BIOME / BIG REVEAL
```

Avoid long:

- logos
- cinematics
- story exposition
- menus
- character selection
- tutorial dialogue
- loading sequences

Let the player play first.

---

# Repository Structure

```text
riftfall/
|
+-- src/
|   +-- core/
|   |   +-- Game.ts
|   |   +-- Input.ts
|   |   +-- Device.ts
|   |
|   +-- player/
|   |   +-- Player.ts
|   |   +-- Movement.ts
|   |   +-- Grapple.ts
|   |   +-- WallRun.ts
|   |   +-- PlayerAnimation.ts
|   |
|   +-- world/
|   |   +-- Chunk.ts
|   |   +-- WorldGenerator.ts
|   |   +-- Portal.ts
|   |   +-- WorldEvents.ts
|   |
|   +-- progression/
|   |   +-- Upgrade.ts
|   |   +-- FlowSystem.ts
|   |
|   +-- graphics/
|   |   +-- Quality.ts
|   |   +-- VFX.ts
|   |   +-- Environment.ts
|   |
|   +-- ui/
|   +-- audio/
|   +-- crazygames/
|
+-- public/
|
+-- assets/
|   +-- characters/
|   +-- animations/
|   +-- environments/
|   +-- props/
|   +-- textures/
|   +-- vfx/
|   +-- audio/
|
+-- index.html
+-- package.json
+-- tsconfig.json
+-- vite.config.ts
|
+-- .github/
    +-- workflows/
        +-- deploy.yml
```

---

# Development Pipeline

```text
VS Code
   |
TypeScript
   |
Vite
   |
PlayCanvas
   |
Local Browser
   |
git push
   |
GitHub Actions
   |
Production Build
   |
GitHub Pages
   |
Playable Test URL
```

Release path:

```text
Optimised Production Build
           |
           v
      CrazyGames QA
           |
           v
       Basic Launch
           |
           v
 Real-world player metrics
           |
           v
       Full Launch
```

---

# Development Phases

## Phase 1 - Movement Prototype

Use primitive grey geometry only.

Implement:

- Run
- Jump
- Dash
- Camera
- Basic collision
- Mobile joystick/buttons

Goal: **movement must already be fun without artwork**.

---

## Phase 2 - Movement Vertical Slice

Add:

- Grapple
- Wall-run
- Slide/vault
- FLOW
- 10 traversal chunks
- Portal
- Upgrade selection

---

## Phase 3 - Visual Vertical Slice

Add:

- Final/stylised player
- Sky Ruins biome
- Clouds
- Waterfalls
- Ruins
- Portal VFX
- Player trail
- Fog
- Lighting
- Animations
- Audio

This build should already be good enough to show publicly.

---

## Phase 4 - Procedural Runs

Expand to:

- 30+ chunks
- Chunk connection rules
- Difficulty progression
- Randomisation
- World events
- Additional upgrades

---

## Phase 5 - Content

Add:

- Fire Rift
- Void Rift
- First boss
- More upgrades
- Cosmetics
- Adaptive music

---

## Phase 6 - Web Optimisation

Measure and optimise:

- initial download
- time to playable
- draw calls
- GPU load
- memory
- GLB size
- texture size
- audio size
- mobile render scale
- physics cost
- active particles
- network request count

Target initial playable download: **under 20 MB**.

---

# MVP

The first proper release does NOT require everything in this document.

MVP:

```text
1 Player
    +
Run + Jump + Dash + Wall-run + Grapple
    +
1 spectacular biome
    +
15-20 polished chunks
    +
FLOW system
    +
1 world event
    +
1 portal
    +
10 upgrades
    +
mobile controls
    +
desktop controls
    +
CrazyGames integration
```

Once players enjoy this, build additional biomes/content.

---

# Final Design Philosophy

Every new feature must answer:

```text
Is it FUN?

Is it understandable on MOBILE?

Does it improve MOVEMENT?

Does it create a good screenshot/video?

Can it run smoothly in a BROWSER?

Does it significantly increase download size?
```

If a feature creates complexity but does not noticeably improve fun, movement or spectacle, remove it.

The game's identity should come from:

```text
Movement
   +
Floating-world composition
   +
Rift portals
   +
Changing biomes
   +
FLOW audiovisual feedback
   +
Huge environmental events
```

rather than expensive realism.

---

# Final Product Identity

```text
             RIFTFALL
              SKYBREAK

          FLOATING WORLDS
                 |
                 v
             MOVE FAST
                 |
                 v
          MASTER THE FLOW
                 |
                 v
           ESCAPE THE RIFT
```

Genre:

```text
High-speed parkour
        +
Roguelite upgrades
        +
Procedural obstacle routes
        +
Spectacular floating environments
        +
Short browser-friendly sessions
```

Technology goal:

```text
PlayCanvas
TypeScript
Vite
GitHub
GitHub Pages
CrazyGames
GLB/glTF
Stylised 3D
Desktop + Mobile
```

Core production rule:

> Create the small set of hero assets that define Riftfall's identity, use coherent free/modular assets for the rest, and let movement, composition, lighting, VFX and sound make the game feel unique.
