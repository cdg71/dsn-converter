# Convertisseur DSN

Ce script permet de convertir les fichiers [DSN](https://www.net-entreprises.fr/declaration/dsn-info/) multi organisations contenus dans un dossier en autant de fichiers DSN que d'organisations identifiées. Pour chaque organisation, les fichiers DSN mensuels sont nommés avec le format `SIRET_YYYY-MM.dsn` et regroupés dans une archive au format `SIRET.zip`.

## Pré-requis

Vous devez disposer de l'environnement d'exécution `node.js` et de son gestionnaire de paquets `npm` sur l'ordinateur de travail.

Pour la prise en charge des caractères spéciaux, le script assume le fichier d'entrée est encodé au format Unicode (`ISO-8859-1`). Cet encodage est également appliqué aux fichiers générés. Normalement, vous n'avez rien de spécial à faire si le fichier N4DS a été généré à partir d'un ordinateur configuré en français.

## installation

Clonez le dépôt git, ou téléchargez-le au format zip puis décompressez-le.

## Usage

Dans le dossier d'installation, exécutez la commande suivante:

```shell
npm start "chemin/du/dossier/DSN_multi_organisation" "chemin/du/dossier/de/sortie"
```

Exemple, avec le dossier source `rsu2022` dans un dossier `./test` placé dans le dossier d'installation, et un nom de dossier de sortie généré à la date d'exécution dans le même dossier `./test`.

Avec powershell:

```shell
Invoke-Expression "npm start -- './test/rsu2022' './test/$(get-date -f "yyyyMMdd-HHmmss")'"
```

Avec linux bash:

```shell
npm start -- './test/rsu2022' './test/$(date +"%Y%m%d-%H%M%S")'
```
