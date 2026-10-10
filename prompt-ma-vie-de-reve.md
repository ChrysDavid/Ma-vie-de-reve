# Projet : « Ma vie de rêve » — Visite 3D photoréaliste d'une villa (Vue.js + Three.js)

Tu as l'autorisation d'accéder à Internet, d'installer des paquets (npm, pip) et de télécharger des assets (modèles 3D, textures, HDRI, sons). Travaille de façon autonome, phase par phase, et vérifie chaque phase avant de passer à la suivante.

## 1. Objectif

Créer une application web nommée **« Ma vie de rêve »** permettant de visiter, à la troisième personne (et en option à la première personne), une **villa contemporaine de luxe** (pas un château) avec piscine, cours avant et arrière, entièrement meublée, au rendu **le plus photoréaliste possible dans un navigateur**. L'utilisateur contrôle un **personnage 3D animé** au clavier et avec un **joystick analogique tactile** sur mobile.

## 2. Stack technique imposée

- Vue 3 + Vite + TypeScript (Composition API), Pinia pour l'état
- Three.js (dernière version) directement, ou TresJS si cela n'empêche aucune fonctionnalité ci-dessous
- Physique et collisions : `@dimforge/rapier3d-compat` (KinematicCharacterController : marches, pentes, escaliers)
- Post-traitement : bibliothèque `postprocessing` (pmndrs) ou `n8ao` pour l'AO
- Joystick mobile : `nipplejs` (ou implémentation maison)
- Compression des assets : glTF/GLB avec Draco ou Meshopt, textures en KTX2 (`gltf-transform` en CLI)
- Optionnel mais recommandé : Blender en mode headless (`bpy` ou binaire Blender) pour modéliser l'architecture par script Python et **précalculer l'éclairage (lightmaps Cycles)**

## 3. Programme architectural de la villa

Style : villa contemporaine tropicale de luxe — lignes horizontales, toits plats débordants, grandes baies vitrées, bois, pierre naturelle, béton lisse, enduit blanc, végétation abondante. Deux niveaux.

### Rez-de-chaussée
- Hall d'entrée double hauteur avec grande porte pivotante en bois, sculpture décorative, escalier design (marches suspendues + garde-corps en verre)
- **Salon principal (bas)** avec grand canapé d'angle, table basse, tapis, cheminée ou mur TV, baies vitrées coulissantes ouvrant sur la piscine
- **Cuisine ouverte sur le salon** : îlot central en marbre, tabourets, électroménager intégré, suspensions lumineuses
- Salle à manger (table 8 places)
- **Chambre 4 (chambre d'amis)** avec salle de douche privative
- **Douche / toilettes invités** séparée
- Bureau, buanderie, cellier

### Étage
- **Salon du haut** (espace détente/cinéma) avec accès à la terrasse
- **Suite parentale** : grand lit, dressing, salle de bain avec douche à l'italienne + baignoire îlot, accès balcon vue piscine
- **Chambres 2 et 3**, chacune avec salle de douche privative
- **Grande terrasse** couverte en partie (pergola), mobilier lounge, jardinières

### Cour avant
- Portail coulissant motorisé, mur de clôture, allée pavée, éclairage de sol
- Parking/carport avec **3 voitures garées** (berline de luxe, SUV, sportive)
- Pelouse, palmiers, massifs fleuris, fontaine ou sculpture d'accueil

### Cour arrière
- **Piscine à débordement** avec eau réaliste, plage en pierre/bois, transats, parasols
- **Cuisine extérieure** sous pergola : plan de travail, barbecue, évier, bar avec tabourets, table à manger extérieure
- **Beau jardin** : pelouse, palmiers, arbres, haies, fleurs, allées en pas japonais, éclairage paysager
- Coin feu (fire pit) avec banquettes, petit pool house

### Décoration
- **Sculptures décoratives** réparties comme éléments de mobilier (entrée, salon, jardin, terrasse)
- Tableaux, plantes d'intérieur, luminaires design, rideaux, coussins, livres, vaisselle, serviettes dans les salles de bain, miroirs
- Chaque pièce doit sembler habitée et cohérente, sans vide

## 4. Exigences de réalisme (priorité absolue)

- **Rendu physique (PBR)** : `MeshStandardMaterial`/`MeshPhysicalMaterial`, textures albedo + normal + roughness + AO (+ displacement si pertinent), espace colorimétrique sRGB, tone mapping AgX ou ACES Filmic, exposition calibrée
- **Éclairage** : HDRI de ciel en environnement + soleil directionnel avec ombres douces (Cascaded Shadow Maps), lumières intérieures (RectAreaLight, spots), **lightmaps précalculées** pour l'intérieur si le pipeline Blender est disponible, light probes
- **Reflets** : vitres en verre physique (transmission, IOR), miroirs réels (`Reflector`), sols brillants avec reflets (SSR), peinture carrosserie avec clearcoat, chromes
- **Eau de piscine** : réflexion + réfraction, normal maps animées, caustiques au fond, légère brillance du soleil
- **Végétation animée** : feuilles et palmes qui bougent avec le vent (vertex shader via `onBeforeCompile`, amplitude variable selon la hauteur), herbe instanciée qui ondule, rideaux légèrement animés près des baies ouvertes
- **Post-traitement** : ambient occlusion (GTAO/N8AO), bloom léger, SSR, profondeur de champ subtile optionnelle, vignette légère, anti-aliasing (SMAA/TAA)
- **Détails** : plinthes, joints de carrelage, interrupteurs, prises, poignées de porte, bordures, gouttières ; aucune surface plate sans texture
- **Ambiance sonore** : oiseaux et vent dans le jardin, clapotis près de la piscine, son des pas selon la surface (carrelage, bois, herbe), atténué à l'intérieur
- Option **cycle jour/nuit** (au minimum un mode « coucher de soleil » et un mode « nuit » avec éclairages paysagers et piscine allumée)

## 5. Personnage et contrôles

- Personnage humain réaliste en glTF avec animations : idle, marche, course, montée d'escalier si possible
- Caméra à la troisième personne qui suit en douceur, **ne traverse jamais les murs** (raycast de collision caméra), zoom molette/pincement, rotation souris/glisser
- Bascule **première personne / troisième personne**
- Contrôles PC : ZQSD **et** WASD, Shift pour courir, E pour interagir, souris pour la caméra
- Contrôles mobile : **joystick analogique** à gauche (vitesse proportionnelle à l'inclinaison), glisser à droite pour la caméra, bouton d'interaction
- Collisions avec murs et meubles, escaliers praticables, impossible de tomber hors de la carte
- **Portes interactives** qui s'ouvrent/se ferment avec animation ; portail et baies coulissantes ouvrables

## 6. Interface Vue

- Écran d'accueil « Ma vie de rêve » élégant (vue cinématique de la villa en arrière-plan, bouton « Visiter »)
- Écran de chargement avec barre de progression réelle
- HUD discret : nom de la pièce actuelle, mini-carte du plan avec position du joueur, menu de téléportation vers chaque pièce
- Panneau de paramètres : qualité graphique (Bas / Moyen / Ultra) adaptée automatiquement à l'appareil, son, sensibilité, jour/nuit
- Mode « visite guidée » automatique optionnel (caméra cinématique qui parcourt les pièces)

## 7. Sources d'assets (privilégier CC0 / licences permissives)

- Textures et HDRI : Poly Haven (polyhaven.com, API publique), ambientCG
- Modèles 3D : Poly Haven (meubles, plantes, objets), Quaternius, Kenney, Poly Pizza, exemples officiels Three.js, modèles CC0/CC-BY de Sketchfab si téléchargeables
- Personnage : modèles CC0 (Quaternius, exemples Three.js) ; Mixamo nécessite une connexion — si tu ne peux pas y accéder, utilise une alternative et indique-le
- Sons : sources CC0
- **Tiens un fichier `CREDITS.md`** listant chaque asset, son auteur, son lien et sa licence ; n'utilise aucun asset sans licence claire

## 8. Performance

- Objectif : 60 FPS sur PC correct en « Ultra », 30 FPS fluide sur mobile récent en « Bas »
- Instancing pour l'herbe, les plantes et les objets répétés ; LOD pour la végétation et les voitures
- Compression Draco/Meshopt + KTX2, chargement progressif (extérieur d'abord, intérieur ensuite)
- Frustum culling, occlusion par zones (intérieur/extérieur), ombres limitées aux objets utiles
- Budget mémoire GPU raisonnable ; mesurer avec `stats.js` et `renderer.info`

## 9. Architecture du code

```
ma-vie-de-reve/
├─ public/assets/        (models, textures, hdri, audio)
├─ scripts/              (téléchargement des assets, compression, script Blender)
├─ src/
│  ├─ components/        (UI Vue : accueil, HUD, joystick, paramètres, minimap)
│  ├─ engine/            (renderer, scène, post-processing, qualité)
│  ├─ world/             (architecture, intérieurs, extérieurs, piscine, végétation, voitures)
│  ├─ player/            (personnage, contrôleur, caméra, inputs)
│  ├─ physics/           (Rapier, colliders)
│  ├─ audio/
│  ├─ data/floorplan.ts  (plan de la villa en données : pièces, murs, ouvertures, cotes)
│  └─ stores/
└─ CREDITS.md
```

Le plan de la villa doit être **piloté par des données** (dimensions réalistes en mètres : hauteur sous plafond ~3 m, portes 0,9 × 2,1 m, etc.) pour pouvoir le modifier facilement.

## 10. Méthode de travail

1. **Phase 1** — Initialisation du projet, moteur de rendu, HDRI, terrain, personnage jouable avec joystick et collisions sur un sol de test
2. **Phase 2** — Gros œuvre : plan, murs, sols, plafonds, escalier, ouvertures, toiture, terrasse (avec textures PBR)
3. **Phase 3** — Extérieurs : piscine avec eau réaliste, cours avant/arrière, jardin, végétation animée par le vent, voitures, cuisine extérieure
4. **Phase 4** — Intérieurs : ameublement complet pièce par pièce, salles de bain, décoration, sculptures
5. **Phase 5** — Éclairage avancé, lightmaps, reflets, post-traitement, jour/nuit
6. **Phase 6** — Interactions (portes), sons, UI complète, mini-carte, téléportation, visite guidée
7. **Phase 7** — Optimisation, réglages qualité, tests mobile, `README.md` (installation, lancement, contrôles)

À la fin de chaque phase : lance le projet, **fais des captures d'écran** (navigateur headless type Playwright) depuis plusieurs points de vue, examine-les d'un œil critique (réalisme, éclairage, proportions, objets qui flottent ou se chevauchent, textures étirées) et corrige avant de continuer.

## 11. Critères d'acceptation

- `npm install && npm run dev` lance le projet sans erreur
- Toutes les pièces listées existent, sont meublées et accessibles à pied
- 4 chambres, chacune avec douche privative ; douche invités ; 2 salons ; 2 cuisines ; terrasse ; piscine ; 3 voitures ; jardin
- Joystick fonctionnel sur mobile, clavier/souris sur PC
- Reflets visibles (vitres, miroirs, eau, sols), feuillage qui bouge au vent, ombres douces
- Aucune traversée de mur par le joueur ni par la caméra
- `CREDITS.md` complet
