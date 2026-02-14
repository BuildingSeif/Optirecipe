export const fr = {
  // Navigation
  dashboard: "Tableau de bord",
  cookbooks: "Livres de cuisine",
  recipes: "Recettes",
  upload: "Uploader un livre",
  export: "Exporter",

  // Actions
  approve: "Approuver",
  reject: "Rejeter",
  save: "Enregistrer",
  cancel: "Annuler",
  delete: "Supprimer",
  search: "Rechercher",
  filter: "Filtrer",
  edit: "Modifier",
  back: "Retour",
  close: "Fermer",
  retry: "Reessayer",
  download: "Telecharger",
  generate: "Generer",
  select_all: "Tout selectionner",
  deselect_all: "Tout deselectionner",

  // Status
  status: {
    pending: "En attente",
    approved: "Approuve",
    rejected: "Rejete",
    processing: "En cours",
    completed: "Termine",
    failed: "Echoue",
    cancelled: "Annule",
    paused: "En pause",
    needs_review: "A revoir",
  },

  // Types
  type: {
    prive: "Prive",
    collectivite: "Collectivite",
    both: "Les deux",
  },

  // Difficulty
  difficulty: {
    facile: "Facile",
    moyen: "Moyen",
    difficile: "Difficile",
  },

  // Dietary
  dietary: {
    vegetarian: "Vegetarien",
    vegan: "Vegan",
    gluten_free: "Sans gluten",
    lactose_free: "Sans lactose",
    halal: "Halal",
  },

  // Recipe fields
  recipe: {
    title: "Titre",
    description: "Description",
    category: "Categorie",
    sub_category: "Sous-categorie",
    ingredients: "Ingredients",
    instructions: "Instructions",
    servings: "Portions",
    prep_time: "Temps de preparation",
    cook_time: "Temps de cuisson",
    difficulty: "Difficulte",
    country: "Pays",
    region: "Region",
    season: "Saison",
    tips: "Conseils du chef",
    image: "Image",
    source_page: "Page source",
  },

  // Messages
  messages: {
    upload_success: "Livre uploade avec succes",
    extraction_complete: "Extraction terminee",
    recipes_found: "recettes trouvees",
    save_success: "Modifications enregistrees",
    delete_confirm: "Etes-vous sur de vouloir supprimer ?",
    error_generic: "Une erreur est survenue. Veuillez reessayer.",
    no_results: "Aucun resultat",
    loading: "Chargement...",
    no_recipes: "Aucune recette",
    no_cookbooks: "Aucun livre",
    bulk_approve_confirm: "Approuver les recettes selectionnees ?",
    bulk_reject_confirm: "Rejeter les recettes selectionnees ?",
    bulk_delete_confirm: "Supprimer les recettes selectionnees ? Cette action est irreversible.",
    approve_all_cookbook: "Approuver toutes les recettes de ce livre ?",
    delete_cookbook_confirm: "Supprimer ce livre et toutes ses recettes ? Cette action est irreversible.",
  },

  // Seasons
  season: {
    printemps: "Printemps",
    ete: "Ete",
    automne: "Automne",
    hiver: "Hiver",
    toutes: "Toutes saisons",
  },

  // Units
  units: {
    minutes: "min",
    grams: "g",
    milliliters: "ml",
    celsius: "°C",
    fahrenheit: "°F",
  },

  // Export
  export_page: {
    select_recipes: "Selectionner les recettes",
    choose_format: "Choisir le format",
    all_filtered: "Toutes les recettes filtrees",
    manual_selection: "Selection manuelle",
    generate_export: "Generer l'export",
    generating: "Generation en cours...",
    download_json: "Telecharger le fichier JSON",
    download_pdf: "Generer et imprimer le PDF",
  },

  // Dashboard
  dashboard_page: {
    total_books: "Total Livres",
    total_recipes: "Total Recettes",
    pending_recipes: "En attente",
    approved_recipes: "Approuvees",
    upload_book: "Uploader un livre",
    validate_recipes: "Valider les recettes",
    recent_activity: "Activite recente",
    recent_recipes: "Dernieres recettes",
    view_all: "Voir tout",
  },

  // Cookbook
  cookbook: {
    total_recipes: "Total recettes",
    pending: "En attente",
    approved: "Approuvees",
    rejected: "Rejetees",
    approve_all: "Approuver toutes les recettes",
    export_cookbook: "Exporter ce livre",
    delete_cookbook: "Supprimer ce livre",
    reprocess: "Relancer le traitement",
  },

  // Bulk
  bulk: {
    selected: "selectionnee(s)",
    approve_all: "Approuver tout",
    reject_all: "Rejeter tout",
    delete_selected: "Supprimer",
  },
};

export type Translations = typeof fr;
