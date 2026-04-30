# CharisHub — Formation des Huios 🔷💎

**CharisHub** est une plateforme spirituelle premium conçue pour connecter le Corps de Christ autour de la **Grâce** et de l'**Identité**. Plus qu'une application d'étude biblique, c'est un hub vivant où la révélation de la Parole circule, enseigne et transforme.

> "Connectés par la grâce"

---

## 🚀 Innovations Clés

### 📖 Sanctuaire de la Parole (Bible Immersive)
Un lecteur biblique conçu pour la méditation profonde, inspiré des meilleurs standards (YouVersion), avec une typographie sereine et des outils d'étude avancés.

### ✨ Vision Charis (Assistant IA)
Un assistant spirituel "Grâce-First" qui analyse les versets sous l'angle de votre identité royale et de l'œuvre finie de Christ.

### 🎙️ Flux de Grâce (Communion Synchrone)
Des outils d'appels de groupe avec synchronisation en temps réel :
- **Bible Overlay** : Projetez des versets directement sur le flux vidéo.
- **Guided Prayer Flow** : Synchronisez vos étapes d'intercession entre tous les participants.

### 💎 Trésors d'Identité
Une bibliothèque personnelle pour conserver vos pépites, révélations et découvertes spirituelles capturées au cours de vos études.

---

## 🛠️ Architecture Technique

- **Framework** : Next.js 14+ (App Router)
- **Design System** : Ésthétique "Glow Digital" basée sur Tailwind CSS et des variables CSS personnalisées.
- **Temps Réel** : Supabase Realtime (Presence & Broadcast) pour la synchronisation des appels et de la prière.
- **Étude Biblique** : Moteur local SQLite (Strong, Treasury, Nave, Matthew Henry).
- **Intelligence Artificielle** : Intégration GPT-4 / Gemini pour l'assistant "Vision Charis".

---

## 📦 Installation & Démarrage

```bash
# Entrer dans le dossier du projet
cd formation-biblique-app

# Installer les dépendances
npm install

# Lancer en mode développement
npm run dev
```

## 🔐 Configuration Env

Le projet nécessite les clés suivantes dans `.env.local` :
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY` (ou Google Generative AI)
- `NEXT_PUBLIC_WEBRTC_TURN_URLS` (pour la vidéo en réseau strict)
- `SUPABASE_SERVICE_ROLE_KEY` (routes serveur/admin)
- `ADMIN_API_KEY` ou `CHARISHUB_ADMIN_KEY` (accès aux routes `/api/admin/*` via `x-admin-key`)
- `ADMIN_USER_IDS` / `ADMIN_EMAILS` (liste séparée par des virgules pour les admins authentifiés)
- `AI_RATE_LIMIT_PER_WINDOW` (optionnel, défaut : 30 requêtes / 10 minutes / IP)

---

## 📜 Vision spirituelle
CharisHub a pour mission d'équiper les **Huios** (fils matures) en leur fournissant un environnement technologique qui honore la majesté de la Parole et la profondeur de la communion fraternelle.
