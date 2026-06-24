# TODO — Protection d’accès (localStorage)

- [x] Étape 1 : Ajouter une lecture `localStorage.isLoggedIn` et une protection par redirection vers `auth.html` sur pages protégées.
- [x] Étape 2 : Lancer la protection au démarrage (`bootstrap`) avant l’init des pages.

- [ ] Étape 3 : S’assurer que `index.html` et `auth.html` restent accessibles.
- [x] Étape 4 : Mettre en place la mise à jour `localStorage.setItem("isLoggedIn","true")` après connexion réussie (via points fiables dans le DOM/événements côté `auth.html`).
- [x] Étape 5 : Valider que la déconnexion supprime bien la clé (déjà partiellement implémenté).

- [ ] Étape 6 : Tester manuellement :
  - [ ] ouvrir tasks/analyses/IA/focus sans connexion → redirection auth.html
  - [ ] se connecter → accès débloqué
  - [ ] bouton Déconnexion → suppression clé + retour index

