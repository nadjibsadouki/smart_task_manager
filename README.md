# Smart Task Manager

Smart Task Manager est une application web de gestion de tâches, de concentration, d’analyse de productivité et d’assistance IA.
Ce projet a été développé comme mon premier vrai projet complet afin d’améliorer mes connaissances en développement web, en organisation de code, en JavaScript, en logique d’application, en gestion de données locales et en intégration d’une intelligence artificielle locale.

## Objectif du projet

L’objectif principal de Smart Task Manager est d’aider l’utilisateur à organiser ses tâches de manière simple, moderne et intelligente.

L’application permet de :

* créer des tâches ;
* définir une priorité ;
* ajouter une date limite ;
* classer les tâches par catégorie ;
* suivre les tâches terminées et restantes ;
* analyser la productivité ;
* utiliser un mode Focus pour travailler sans distraction ;
* obtenir des recommandations via une IA locale connectée à Ollama.

Ce projet m’a aussi permis d’apprendre progressivement comment construire une application structurée, avec plusieurs pages, du JavaScript dynamique, du stockage local, puis une première connexion vers une IA locale.

## Technologies utilisées

* HTML5
* CSS3
* JavaScript Vanilla
* LocalStorage
* Python
* Flask
* Flask-CORS
* Requests
* Ollama
* Llama 3.2
* Git
* GitHub
* VS Code

## Structure du projet

```text
SMART_TASK_MANAGER/
│
├── index.html
├── tache.html
├── analyses.html
├── IA.html
├── focus.html
├── auth.html
├── style.css
├── script.js
├── README.md
│
└── backend/
    ├── app.py
    └── requirements.txt
```

## Pages du projet

### 1. Page Accueil

La page d’accueil présente le projet Smart Task Manager.
Elle explique le but de l’application et donne accès aux principales fonctionnalités :

* gestion des tâches ;
* assistant IA ;
* analyses ;
* mode Focus ;
* authentification.

Elle sert de page d’entrée principale avec une interface moderne en dark mode.

### 2. Page Tâches

La page Tâches est le cœur de l’application.

Elle permet de :

* ajouter une tâche ;
* choisir une priorité : faible, moyenne ou haute ;
* choisir une catégorie ;
* définir une date limite ;
* bloquer l’ajout d’une tâche si la date est passée ;
* afficher les tâches ;
* filtrer les tâches ;
* marquer une tâche comme terminée ;
* supprimer une tâche ;
* sauvegarder les données dans LocalStorage.

Les tâches sont stockées localement avec la clé :

```text
smartTasks
```

### 3. Page Analyses

La page Analyses transforme les tâches en indicateurs visuels.

Elle permet d’afficher :

* le nombre total de tâches ;
* les tâches terminées ;
* les tâches restantes ;
* le taux de réussite ;
* les priorités hautes ;
* la productivité hebdomadaire ;
* un historique des actions ;
* des recommandations intelligentes selon l’état des tâches.

Cette page aide l’utilisateur à comprendre son avancement et à améliorer son organisation.

### 4. Page IA

La page IA permet à l’utilisateur d’écrire une phrase ou une demande libre.

Exemple :

```text
J’ai des exercices à faire pour demain.
```

L’application envoie cette demande au backend Flask, puis le backend communique avec Ollama localement.

L’IA retourne une réponse structurée contenant :

* une priorité ;
* un niveau d’urgence ;
* un conseil ;
* une prochaine action ;
* un risque à éviter ;
* un résumé du jour ;
* une note IA ;
* une remarque d’organisation.

Cette partie représente une première intégration d’intelligence artificielle locale dans le projet.

### 5. Page Focus

La page Focus sert à travailler sur une tâche sans distraction.

Elle permet de :

* afficher les tâches non terminées ;
* sélectionner une tâche ;
* choisir une durée de session ;
* démarrer un minuteur ;
* mettre en pause ;
* réinitialiser ;
* terminer une session ;
* marquer la tâche comme terminée ;
* suivre les statistiques de concentration.

Le but est d’aider l’utilisateur à passer de la planification à l’action.

### 6. Page Authentification

La page Auth permet de simuler une connexion et une inscription.

Elle comprend :

* formulaire de connexion ;
* formulaire d’inscription ;
* bouton de connexion ;
* simulation d’état connecté avec LocalStorage ;
* affichage dynamique du bouton Connexion / Déconnexion.

L’authentification est encore visuelle et locale. Elle pourra être améliorée plus tard avec une vraie base de données.

## Backend IA

Le dossier `backend` contient un petit serveur Flask.

Son rôle est de faire le lien entre la page IA et Ollama.

Flux de fonctionnement :

```text
IA.html
↓
script.js
↓
Flask backend
↓
Ollama local
↓
Réponse IA
↓
Affichage dans la page IA
```

Le backend expose une route :

```text
POST /api/ai/analyze
```

Cette route reçoit le texte de l’utilisateur, l’envoie à Ollama, puis retourne une réponse structurée au frontend.

## Intelligence artificielle locale

Le projet utilise Ollama pour faire fonctionner une IA localement sur l’ordinateur.

Modèle utilisé :

```text
llama3.2:1b
```

Avantages :

* gratuit ;
* local ;
* pas besoin d’API payante ;
* pas besoin de compte externe ;
* fonctionne directement sur le PC.

## Installation du backend

Dans le dossier backend :

```bash
pip install flask flask-cors requests
```

Puis lancer le serveur :

```bash
python app.py
```

ou sous Windows :

```bash
py app.py
```

Le backend sera disponible ici :

```text
http://127.0.0.1:5000
```

## Installation d’Ollama

Télécharger Ollama depuis le site officiel :

```text
https://ollama.com
```

Installer le modèle :

```bash
ollama pull llama3.2:1b
```

Lancer le modèle :

```bash
ollama run llama3.2:1b
```

## Fonctionnement général

L’application fonctionne principalement avec :

* HTML pour la structure ;
* CSS pour le design ;
* JavaScript pour l’interaction ;
* LocalStorage pour stocker les tâches ;
* Flask pour connecter l’IA ;
* Ollama pour générer les réponses intelligentes.

## Points appris grâce au projet

Ce projet m’a permis d’apprendre :

* la structure d’un site multipage ;
* la création de formulaires ;
* la validation des données ;
* la manipulation du DOM ;
* l’utilisation de LocalStorage ;
* la gestion des événements JavaScript ;
* la création d’un tableau de bord ;
* la logique de filtrage ;
* la gestion d’un minuteur ;
* la connexion frontend/backend ;
* les bases de Flask ;
* l’utilisation d’une IA locale avec Ollama ;
* l’organisation d’un projet sur GitHub.

## Améliorations futures

Les prochaines améliorations possibles sont :

* ajouter une vraie authentification ;
* ajouter une base de données ;
* créer des comptes utilisateurs ;
* améliorer l’historique des tâches ;
* ajouter des notifications ;
* améliorer l’IA ;
* ajouter un mode calendrier ;
* permettre l’export des tâches ;
* rendre l’application responsive à 100 % ;
* déployer le projet en ligne.

## Statut du projet

Le projet est en cours d’amélioration.

Version actuelle :

```text
Version 1.0
```

Cette version représente mon premier projet complet pour progresser en développement web et renforcer mes compétences techniques étape par étape.

## Auteur

Projet réalisé par :

```text
Nadjib Sadouki
```

## Licence

Projet personnel réalisé dans un but d’apprentissage.
