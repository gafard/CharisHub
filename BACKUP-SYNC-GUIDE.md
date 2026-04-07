# 📦 Guide : Sauvegarde & Synchronisation Cloud

## Vue d'ensemble

CharisHub dispose désormais d'un **système complet de sauvegarde et synchronisation cloud** qui résout les deux limitations majeures de l'architecture initiale :

1. ✅ **Protection contre la perte de données** (nettoyage navigateur)
2. ✅ **Synchronisation multi-appareils** via Supabase
3. ✅ **Export/Import manuel** de données (JSON)
4. ✅ **Indicateur visuel clair** du mode de connexion (local vs cloud)

---

## 🎯 Fonctionnalités implémentées

### 1. **Backup Cloud Automatique**
- **Fréquence** : Toutes les 5 minutes automatiquement
- **Données sauvegardées** :
  - ✅ Surlignages Bible (couleurs, notes)
  - ✅ Notes de chapitres/versets
  - ✅ Bookmarks
  - ✅ Pépites (trésors d'identité & grâce)
  - ✅ Progression des plans de lecture
  - ✅ Série de lecture (streak)
  - ✅ Sessions de prière (PRIAM)
  - ✅ Journal de prière

### 2. **Sync Intelligente avec Merge**
- **Stratégie** : Dernière modification gagne (par timestamp)
- **Direction** : Bidirectionnelle
  - **Cloud → Local** : Au démarrage de l'app (3s après chargement)
  - **Local → Cloud** : Après chaque modification (debounce 2s) + backup périodique (5min)

### 3. **Export/Import Manuel**
- **Export** : Télécharge un fichier JSON avec toutes vos données
- **Import** : Restaure depuis un fichier JSON exporté
- **Usage** : Backup de sécurité ou migration manuelle

### 4. **Indicateur de Mode (Badge)**
- **Position** : Coin bas droit de l'écran
- **Connecté** : Badge vert avec icône cloud ☁️
- **Local** : Badge orange avec icône cloud off ☁️❌
- **Clic** : Ouvre le menu de synchronisation

### 5. **Onboarding Supabase**
- **Modal guidé** en 4 étapes dans Settings
- **Explications claires** : Pourquoi, Comment, Où trouver les clés
- **Lien direct** vers supabase.com

---

## 📋 Fichiers créés/modifiés

### Nouveaux fichiers

| Fichier | Rôle |
|---------|------|
| `supabase-backup-sync.sql` | Schéma SQL pour 11 tables de backup cloud |
| `src/lib/cloudSync.ts` | Service de sync (fetch, merge, export, import) |
| `src/contexts/CloudSyncContext.tsx` | Context React (état, sync auto, API) |
| `src/components/ConnectionModeIndicator.tsx` | Badge mode + menu sync |
| `src/components/SupabaseOnboardingModal.tsx` | Modal guide configuration |
| `scripts/delete-all-groups.ts` | Script CLI pour supprimer les groupes |

### Fichiers modifiés

| Fichier | Modification |
|---------|--------------|
| `src/app/layout.tsx` | Ajout de `CloudSyncProvider` + `ConnectionModeIndicator` |
| `src/components/StudyUserPanel.tsx` | Section Backup & Sync complète |
| `src/lib/bibleStreak.ts` | Export de l'interface `StreakData` |

---

## 🚀 Comment utiliser

### Pour l'utilisateur final

#### **A. Sauvegarde automatique (si Supabase configuré)**
1. Configurez Supabase (voir section ci-dessous)
2. Redémarrez l'application
3. ✅ Vos données sont automatiquement sauvegardées toutes les 5 minutes

#### **B. Export manuel de vos données**
1. Allez dans **Settings** (Profil)
2. Section **Sauvegarde & Synchronisation**
3. Cliquez sur **Exporter JSON**
4. 💾 Le fichier est téléchargé

#### **C. Import/Restauration**
1. Allez dans **Settings**
2. Cliquez sur **Importer JSON**
3. Sélectionnez votre fichier d'export
4. ✅ Vos données sont restaurées

#### **D. Synchronisation manuelle**
1. Cliquez sur le **badge en bas à droite**
2. Choisissez :
   - **Récupérer cloud** : Fusionne cloud → local
   - **Sauvegarder** : Envoie local → cloud

---

### Pour le développeur : Configurer Supabase

#### **Étape 1 : Créer un projet Supabase**
1. Rendez-vous sur https://supabase.com
2. Créez un compte gratuit
3. Créez un nouveau projet nommé "charishub"

#### **Étape 2 : Récupérer les clés API**
1. Allez dans **Settings → API**
2. Copiez :
   - **Project URL** : `https://xxxxx.supabase.co`
   - **anon public key** : `eyJhbGci...`

#### **Étape 3 : Configurer .env.local**

Créez ou modifiez le fichier `.env.local` à la racine du projet :

```env
# --- SUPABASE ---
NEXT_PUBLIC_SUPABASE_URL="https://kcseueoxjzqhwwjevcge.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGci..."

# (Optionnel) Clés serveur
SUPABASE_URL="https://kcseueoxjzqhwwjevcge.supabase.co"
SUPABASE_ANON_KEY="eyJhbGci..."
```

#### **Étape 4 : Exécuter les schémas SQL**

Dans le dashboard Supabase, allez dans **SQL Editor** et exécutez :

1. **Schéma principal** : `supabase-schema.sql` (tables communautaires)
2. **Schéma backup** : `supabase-backup-sync.sql` (tables de sync)

#### **Étape 5 : Redémarrer l'application**

```bash
# Arrêter le serveur (Ctrl+C)
npm run dev
```

Vous verrez le badge **"Connecté"** vert en bas à droite 🎉

---

## 🏗️ Architecture technique

### Schéma de données Supabase (11 tables)

```
user_sync_metadata          ← Métadonnées de sync par appareil
user_bible_highlights       ← Surlignages Bible
user_bible_notes            ← Notes de chapitres/versets
user_bible_bookmarks        ← Bookmarks Bible
user_pepites                ← Pépites spirituelles
user_reading_progress       ← Progression plans de lecture
user_reading_streak         ← Série de lecture
user_prayer_sessions        ← Sessions de prière
user_prayer_journal         ← Journal de prière
user_study_tags             ← Tags d'étude
user_data_exports           ← Historique des exports
```

### Flux de synchronisation

```
┌─────────────────┐
│  Démarrage App  │
└────────┬────────┘
         │ (3s delay)
         ▼
┌─────────────────────┐
│  Sync Cloud → Local │ (fetch + merge)
└────────┬────────────┘
         │
         ▼
┌─────────────────┐
│  App fonctionne │
│  (modifications)│
└────────┬────────┘
         │ (debounce 2s)
         ▼
┌─────────────────────┐
│  Sync Local → Cloud │ (upsert)
└────────┬────────────┘
         │ (toutes les 5 min)
         ▼
┌─────────────────────┐
│  Backup automatique │
└─────────────────────┘
```

### Résolution de conflits

**Stratégie** : *Last write wins* (dernière modification gagne)

```typescript
// Exemple pour les highlights
if (!local[key] || cloud.updatedAt > local.updatedAt) {
  // Cloud gagne car plus récent
  useCloud(cloud);
} else {
  // Local gagne car plus récent
  useLocal(local);
}
```

---

## 📊 Comparaison avant/après

| Fonctionnalité | Avant | Après |
|----------------|-------|-------|
| **Stockage** | 100% localStorage | localStorage + Supabase cloud |
| **Perte de données** | Risque élevé | Protégé (cloud + export) |
| **Multi-appareils** | ❌ Non | ✅ Oui (sync cloud) |
| **Backup** | ❌ Aucun | ✅ Auto (5min) + Manuel (JSON) |
| **Indicateur mode** | ❌ Aucun | ✅ Badge clair (vert/orange) |
| **Configuration** | Floue | Guide onboardig 4 étapes |
| **Résilience** | Faible | Forte (3 couches de protection) |

---

## 🎨 UX/UI

### Badge de statut (ConnectionModeIndicator)

**Mode Connecté** :
```
┌──────────────────┐
│ ☁️ Connecté       │  ← Vert, tooltip avec dernière sync
└──────────────────┘
```

**Mode Local** :
```
┌──────────────────┐
│ ☁️❌ Mode Local   │  ← Orange, warning tooltip
└──────────────────┘
```

### Menu de synchronisation (clic sur badge)

```
┌────────────────────────────────┐
│  🔶 Synchronisation             │
│  Cloud activé • Sync auto 5min │
├────────────────────────────────┤
│  ⬇️ Récupérer depuis le cloud  │
│  ⬆️ Sauvegarder vers le cloud  │
│  📥 Exporter mes données (JSON)│
├────────────────────────────────┤
│  ℹ️ Info: Sync auto toutes     │
│  les 5 minutes...              │
└────────────────────────────────┘
```

---

## 🧪 Tests recommandés

### Test 1 : Export/Import
1. Créer des surlignages, notes, pépites
2. Exporter les données (JSON)
3. Nettoyer le localStorage du navigateur
4. Importer le fichier JSON
5. ✅ Vérifier que tout est restauré

### Test 2 : Sync Cloud
1. Configurer Supabase
2. Créer des données sur Appareil A
3. Attendre 5 minutes (ou sync manuelle)
4. Ouvrir sur Appareil B
5. ✅ Vérifier que les données sont présentes

### Test 3 : Résolution de conflits
1. Modifier un surlignage sur Appareil A (temps T1)
2. Modifier le même surlignage sur Appareil B (temps T2 > T1)
3. Sync les deux appareils
4. ✅ La version de B doit gagner (plus récente)

---

## 🔐 Sécurité

- **RLS (Row Level Security)** : Chaque appareil ne voit que ses propres données
- **Authentification** : Basée sur `device_id` (UUID dans localStorage)
- **Clés API** : Stockées uniquement dans `.env.local` (jamais dans le code)
- **Export JSON** : Fichier local, non envoyé à un serveur tiers

---

## 🐛 Dépannage

### "Mode Local" affiché alors que Supabase est configuré
- Vérifiez que `.env.local` contient les variables `NEXT_PUBLIC_SUPABASE_*`
- Redémarrez le serveur de dev (`npm run dev`)
- Vérifiez la console du navigateur pour des erreurs Supabase

### La sync ne fonctionne pas
- Vérifiez que les tables Supabase existent (exécutez le schéma SQL)
- Vérifiez les policies RLS dans Supabase dashboard
- Consultez la console du navigateur : `[CloudSync] ...`

### Données perdues après nettoyage du navigateur
- Si Supabase était configuré : Sync au redémarrage récupère les données cloud
- Si pas de Supabase : Importez votre fichier JSON d'export (si disponible)

---

## 📝 Notes

- **Limitation gratuite Supabase** : 500 MB (largement suffisant pour CharisHub)
- **Fréquence de sync** : 5 minutes (configurable dans `CloudSyncContext.tsx`)
- **Données non synchronisées** : Paramètres UI (thème, police), car spécifiques à l'appareil

---

**✅ Vos données sont maintenant protégées à 3 niveaux :**
1. Cloud automatique (toutes les 5 min)
2. Export manuel JSON (à la demande)
3. localStorage local (fonctionnement normal)
