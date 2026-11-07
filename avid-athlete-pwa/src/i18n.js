// ── i18n AVID Athlete ─────────────────────────────────────────────────────────
// Traduit UNIQUEMENT les textes d'interface. Les valeurs stockées/comparées
// (cat, label de séance, nom d'exercice, sous-types…) ne passent jamais ici.
// Repli : si une clé manque en anglais, on affiche le français ; si elle manque
// partout, on affiche la clé (visible pendant les tests, jamais d'écran vide).

const DICT = {
  fr: {
    // Navigation
    tab_profil: 'Profil',
    tab_programme: 'Programme',
    tab_stats: 'Stats',
    tab_nutrition: 'Nutrition',

    // Header / réglages
    theme_light_title: 'Mode clair',
    theme_dark_title: 'Mode sombre',
    lang_title: 'Langue',
    profile_language: 'LANGUE',

    // Écrans système
    loading: 'CHARGEMENT...',
    err_invalid_link: 'Lien invalide',
    err_invalid_link_sub: 'Demande un nouveau lien à ton coach.',
    err_not_linked: 'Compte non lié',
    err_not_linked_sub: "Ce compte n'est associé à aucun profil athlète. Contacte ton coach.",
    err_not_found: 'Athlète introuvable',
    err_not_found_sub: 'Ce lien ne correspond à aucun profil.',
    err_offline: 'Hors ligne',
    err_offline_sub: 'Vérifie ta connexion et réessaie.',

    // Connexion
    login_title: 'Reconnecte-toi',
    login_intro: 'Ta session a expiré ou tu es sur un nouvel appareil. Entre ton email et ton mot de passe pour retrouver ton programme et ton historique.',
    login_email: 'EMAIL',
    login_email_ph: 'ton@email.com',
    login_password: 'MOT DE PASSE',
    login_password_ph: 'Ton mot de passe',
    login_btn: 'Se connecter',
    login_busy: 'Connexion...',
    login_forgot: 'Mot de passe oublié',
    login_reset_sent: 'Email de réinitialisation envoyé.',
    login_need_email: 'Entre ton email pour recevoir le lien.',
    auth_invalid_email: 'Email invalide.',
    auth_invalid_credential: 'Email ou mot de passe incorrect.',
    auth_user_not_found: 'Aucun compte associé à cet email.',
    auth_wrong_password: 'Mot de passe incorrect.',
    auth_too_many: 'Trop de tentatives, réessaie dans quelques minutes.',
    auth_generic: 'Une erreur est survenue, réessaie.',
  },
  en: {
    tab_profil: 'Profile',
    tab_programme: 'Program',
    tab_stats: 'Stats',
    tab_nutrition: 'Nutrition',

    theme_light_title: 'Light mode',
    theme_dark_title: 'Dark mode',
    lang_title: 'Language',
    profile_language: 'LANGUAGE',

    loading: 'LOADING...',
    err_invalid_link: 'Invalid link',
    err_invalid_link_sub: 'Ask your coach for a new link.',
    err_not_linked: 'Account not linked',
    err_not_linked_sub: "This account isn't linked to any athlete profile. Contact your coach.",
    err_not_found: 'Athlete not found',
    err_not_found_sub: "This link doesn't match any profile.",
    err_offline: 'Offline',
    err_offline_sub: 'Check your connection and try again.',

    login_title: 'Sign back in',
    login_intro: 'Your session has expired or you are on a new device. Enter your email and password to get back to your program and your history.',
    login_email: 'EMAIL',
    login_email_ph: 'you@email.com',
    login_password: 'PASSWORD',
    login_password_ph: 'Your password',
    login_btn: 'Sign in',
    login_busy: 'Signing in...',
    login_forgot: 'Forgot password',
    login_reset_sent: 'Password reset email sent.',
    login_need_email: 'Enter your email to receive the link.',
    auth_invalid_email: 'Invalid email.',
    auth_invalid_credential: 'Incorrect email or password.',
    auth_user_not_found: 'No account is linked to this email.',
    auth_wrong_password: 'Incorrect password.',
    auth_too_many: 'Too many attempts, please try again in a few minutes.',
    auth_generic: 'Something went wrong, please try again.',
  },
}

// Libellés d'AFFICHAGE des catégories (les valeurs stockées restent JAMBES, POUSSEE…).
// Inconnu → on renvoie la valeur brute telle quelle.
const CAT_LABELS = {
  fr: { JAMBES: 'Jambes', POUSSEE: 'Poussée', TIRAGE: 'Tirage', 'FULL BODY': 'Full body', CARDIO: 'Cardio', AUTRES: 'Autres' },
  en: { JAMBES: 'Legs', POUSSEE: 'Push', TIRAGE: 'Pull', 'FULL BODY': 'Full body', CARDIO: 'Cardio', AUTRES: 'Other' },
}

const STORAGE_KEY = 'avid_lang'
let current = 'fr'

export function detectLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'fr' || saved === 'en') return saved
  } catch (e) {}
  try {
    const nav = (navigator.language || 'fr').toLowerCase()
    return nav.startsWith('fr') ? 'fr' : 'en'
  } catch (e) { return 'fr' }
}

export function saveLang(l) {
  try { localStorage.setItem(STORAGE_KEY, l) } catch (e) {}
}

// Appelée par App() à chaque render, avant les enfants (même principe que C pour le thème)
export function setCurrentLang(l) { current = (l === 'en' ? 'en' : 'fr') }
export function getLang() { return current }

export function t(key) {
  const en = DICT[current] && DICT[current][key]
  if (en !== undefined) return en
  const fr = DICT.fr[key]
  return fr !== undefined ? fr : key
}

// Affichage seulement. Ne jamais utiliser le résultat comme valeur stockée ou comparée.
export function catLabel(cat) {
  const map = CAT_LABELS[current] || CAT_LABELS.fr
  return map[cat] !== undefined ? map[cat] : cat
}

export function dateLocale() { return current === 'en' ? 'en-GB' : 'fr-FR' }
