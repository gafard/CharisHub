# ⚠️ Action Requise : Initialiser le Schéma de Backup Cloud

## 📋 État actuel

✅ **Code implémenté** - Le système de backup & sync est complet et prêt  
❌ **Tables SQL manquantes** - Les tables de backup n'existent pas encore dans Supabase

---

## 🚀 Comment créer les tables (2 options)

### Option 1 : Via le Dashboard Supabase (Recommandé)

1. **Ouvrir le dashboard** : https://app.supabase.com
2. **Sélectionner votre projet** CharisHub
3. **Aller dans SQL Editor** (menu gauche)
4. **Cliquer sur "New query"**
5. **Ouvrir le fichier** : `supabase-backup-sync.sql` (à la racine du projet)
6. **Copier TOUT le contenu** du fichier
7. **Coller dans l'éditeur SQL**
8. **Cliquer sur "Run"** (ou Ctrl+Enter)

✅ **Terminé !** Les 11 tables seront créées automatiquement.

---

### Option 2 : Via la page d'initialisation

1. **Démarrez l'app** : `npm run dev`
2. **Ouvrez** : http://localhost:3000/init-backup-schema.html
3. **Suivez les instructions** affichées à l'écran

---

## ✅ Vérifier que tout fonctionne

Après avoir créé les tables :

1. **Redémarrez l'app** (si nécessaire)
2. **Ouvrez** : http://localhost:3000/settings
3. **Section "Sauvegarde & Synchronisation"** :
   - Vous devriez voir le badge vert **"Connecté"**
   - Les boutons de sync sont actifs

4. **Vérifiez le badge en bas à droite** :
   - 🟢 **"Connecté"** = Cloud activé ✅
   - 🟠 **"Mode Local"** = Tables non créées ❌

---

## 📊 Tables à créer (11 au total)

- `user_sync_metadata`
- `user_bible_highlights`
- `user_bible_notes`
- `user_bible_bookmarks`
- `user_pepites`
- `user_reading_progress`
- `user_reading_streak`
- `user_prayer_sessions`
- `user_prayer_journal`
- `user_study_tags`
- `user_data_exports`

---

## 🆘 En cas de problème

### Erreur : "relation does not exist"

**Cause** : Les tables n'ont pas été créées  
**Solution** : Exécutez le schéma SQL (voir Option 1 ci-dessus)

### Le badge affiche toujours "Mode Local"

1. Vérifiez que `.env.local` contient les variables Supabase
2. Redémarrez `npm run dev`
3. Vérifiez la console du navigateur pour les erreurs

### La sync ne fonctionne pas

1. Ouvrez la console du navigateur (F12)
2. Cherchez les messages `[CloudSync]`
3. Si vous voyez "Tables non initialisées", exécutez le SQL

---

## 📚 Documentation complète

Pour plus de détails, voir : `BACKUP-SYNC-GUIDE.md`
