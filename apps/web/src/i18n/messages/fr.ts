import type { MessageCatalog } from './types'

export const frMessages = {
  workspaceCleared: 'Espace local et préférences effacés. L’historique du serveur est conservé.',
  clipboardUnavailable: 'Presse-papiers indisponible ici. Collez manuellement dans Original.',
  textChanged: 'Votre texte a changé. Appuyez à nouveau sur Coller pour le remplacer.',
  clipboardEmpty: 'Le presse-papiers est vide. Votre texte a été conservé.',
  pasted: 'Collé',
  clipboardDenied: 'Accès au presse-papiers refusé. Collez manuellement dans Original.',
  clipboardReadFailed: 'Impossible de lire le presse-papiers. Collez manuellement dans Original.',
  copied: 'Copié',
  clipboardWriteUnavailable:
    'Presse-papiers indisponible ici. Sélectionnez le résultat et copiez-le manuellement.',
  clipboardWriteFailed:
    'Impossible d’accéder au presse-papiers. Sélectionnez le résultat et copiez-le manuellement.',
  workspaceSaveFailed:
    'Impossible d’enregistrer cet espace sur votre appareil. Gardez cet onglet ouvert pour conserver votre texte.',
  workspaceRestored: 'Espace de travail restauré',
  workspaceClearFailed:
    'Impossible d’effacer les données locales. Votre espace actuel a été conservé.',
  correctionSaved: 'Résultat enregistré · aucune nouvelle demande',
  correctionNoChanges: 'Aucune modification.',
  correctionReady: 'Correction terminée.',
  opinionFailed: 'Impossible d’obtenir un autre avis. Vous pouvez réessayer.',
  correctionFailed:
    'Impossible de terminer la correction. Votre texte et vos résultats précédents ont été conservés. Vous pouvez réessayer.',
  historyEntryRemoved: 'Entrée supprimée de l’historique.',
  storageUnavailable:
    'Enregistrement local indisponible. Gardez cet onglet ouvert pour conserver votre texte.',
  workspaceRestoreFailed:
    'Impossible de restaurer l’espace enregistré. Vous pouvez commencer une nouvelle correction.',
  installError:
    'Installation impossible. Utilisez le menu du navigateur pour ajouter Грамика à votre écran d’accueil.',
  explanationUsageNote:
    'Chaque explication générée a sa propre utilisation. Ouvrir une explication enregistrée ne crée aucun nouvel appel.',
  totalsNote:
    'Les totaux incluent cette correction et toutes les demandes d’explication. Le temps de réponse concerne uniquement la correction.',
  totalsUnavailable:
    'Certains totaux sont indisponibles car l’utilisation n’a pas été enregistrée.',
  loadingDetails: 'Chargement des détails de la correction et des explications...',
  metricsLoadFailed: 'Impossible de charger les métriques. Utilisez Réessayer ci-dessous.',
  requestDetails: 'Détails de la demande',
  correctionMetrics: 'Métriques de la demande de correction',
  completed: 'Terminée',
  interrupted: 'Interrompue',
  selectedExpression: 'Expression sélectionnée',
  selectedChange: 'Modification sélectionnée',
  moved: 'Déplacé',
  nothing: '(rien)',
  resultCounter: 'Résultat {current} sur {total}',
  historyRange: '{start}-{end} sur {total} corrections',
  perPage: '{count} par page',
  pageCounter: 'Page {current} sur {total}',
  approximateCosts: 'Coûts approximatifs.',
  correctionsFooter: 'corrections',
} satisfies MessageCatalog
