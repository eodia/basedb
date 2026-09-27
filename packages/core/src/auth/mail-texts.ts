import { type Locale, acceptedLanguages, isLocale, matchLocale } from '@basedb/contracts'

/**
 * What the product writes in a mail, in the recipient's language — chapter 11 §10.
 *
 * The language is the account's choice; with none, the one the request came with — the
 * person asking for a reset, or changing their address, is the one who reads the mail.
 */

interface MailTexts {
  readonly resetSubject: string
  readonly emailChangedSubject: string
  readonly emailChanged: (email: string) => string
}

const TEXTS: Readonly<Record<Locale, MailTexts>> = {
  fr: {
    resetSubject: 'basedb — réinitialisation de votre mot de passe',
    emailChangedSubject: 'basedb — votre adresse de connexion a changé',
    emailChanged: (email) =>
      `Votre compte basedb se connecte désormais avec l’adresse ${email}. Si vous n’êtes pas à l’origine de ce changement, prévenez sans attendre un administrateur.`,
  },
  en: {
    resetSubject: 'basedb — reset your password',
    emailChangedSubject: 'basedb — your sign-in address has changed',
    emailChanged: (email) =>
      `Your basedb account now signs in with the address ${email}. If you did not make this change, tell an administrator right away.`,
  },
  de: {
    resetSubject: 'basedb — Passwort zurücksetzen',
    emailChangedSubject: 'basedb — Ihre Anmeldeadresse wurde geändert',
    emailChanged: (email) =>
      `Ihr basedb-Konto meldet sich jetzt mit der Adresse ${email} an. Wenn Sie diese Änderung nicht vorgenommen haben, informieren Sie umgehend einen Administrator.`,
  },
  es: {
    resetSubject: 'basedb — restablecer tu contraseña',
    emailChangedSubject: 'basedb — tu dirección de inicio de sesión ha cambiado',
    emailChanged: (email) =>
      `Tu cuenta de basedb ahora inicia sesión con la dirección ${email}. Si no hiciste este cambio, avisa de inmediato a un administrador.`,
  },
  it: {
    resetSubject: 'basedb — reimposta la password',
    emailChangedSubject: 'basedb — il tuo indirizzo di accesso è cambiato',
    emailChanged: (email) =>
      `Il tuo account basedb ora accede con l’indirizzo ${email}. Se non hai effettuato tu questa modifica, avvisa subito un amministratore.`,
  },
  'pt-BR': {
    resetSubject: 'basedb — redefinição de senha',
    emailChangedSubject: 'basedb — seu endereço de login foi alterado',
    emailChanged: (email) =>
      `Sua conta do basedb agora entra com o endereço ${email}. Se você não fez essa alteração, avise um administrador imediatamente.`,
  },
  nl: {
    resetSubject: 'basedb — je wachtwoord opnieuw instellen',
    emailChangedSubject: 'basedb — je aanmeldadres is gewijzigd',
    emailChanged: (email) =>
      `Je basedb-account meldt zich nu aan met het adres ${email}. Heb je deze wijziging niet zelf gedaan, laat het dan meteen een beheerder weten.`,
  },
  pl: {
    resetSubject: 'basedb — resetowanie hasła',
    emailChangedSubject: 'basedb — zmieniono adres logowania',
    emailChanged: (email) =>
      `Twoje konto basedb loguje się teraz adresem ${email}. Jeśli ta zmiana nie pochodzi od Ciebie, natychmiast powiadom administratora.`,
  },
  cs: {
    resetSubject: 'basedb — obnovení hesla',
    emailChangedSubject: 'basedb — vaše přihlašovací adresa se změnila',
    emailChanged: (email) =>
      `Váš účet basedb se nyní přihlašuje adresou ${email}. Pokud jste tuto změnu neprovedli vy, ihned informujte správce.`,
  },
  sv: {
    resetSubject: 'basedb — återställ ditt lösenord',
    emailChangedSubject: 'basedb — din inloggningsadress har ändrats',
    emailChanged: (email) =>
      `Ditt basedb-konto loggar nu in med adressen ${email}. Om du inte gjorde ändringen, kontakta en administratör direkt.`,
  },
  da: {
    resetSubject: 'basedb — nulstil din adgangskode',
    emailChangedSubject: 'basedb — din loginadresse er ændret',
    emailChanged: (email) =>
      `Din basedb-konto logger nu ind med adressen ${email}. Hvis du ikke selv har foretaget ændringen, så kontakt straks en administrator.`,
  },
  nb: {
    resetSubject: 'basedb — tilbakestill passordet ditt',
    emailChangedSubject: 'basedb — påloggingsadressen din er endret',
    emailChanged: (email) =>
      `basedb-kontoen din logger nå på med adressen ${email}. Hvis du ikke gjorde denne endringen selv, må du straks si fra til en administrator.`,
  },
  fi: {
    resetSubject: 'basedb — salasanan palautus',
    emailChangedSubject: 'basedb — kirjautumisosoitteesi on muuttunut',
    emailChanged: (email) =>
      `basedb-tilisi kirjautuu nyt osoitteella ${email}. Jos et tehnyt muutosta itse, ilmoita siitä heti ylläpitäjälle.`,
  },
  ro: {
    resetSubject: 'basedb — resetarea parolei',
    emailChangedSubject: 'basedb — adresa de autentificare s-a schimbat',
    emailChanged: (email) =>
      `Contul dumneavoastră basedb se autentifică acum cu adresa ${email}. Dacă nu ați făcut dumneavoastră această modificare, anunțați imediat un administrator.`,
  },
  hu: {
    resetSubject: 'basedb — jelszó visszaállítása',
    emailChangedSubject: 'basedb — megváltozott a bejelentkezési címe',
    emailChanged: (email) =>
      `A basedb-fiókja mostantól a(z) ${email} címmel jelentkezik be. Ha nem Ön végezte a módosítást, azonnal értesítsen egy adminisztrátort.`,
  },
  tr: {
    resetSubject: 'basedb — parolanızı sıfırlayın',
    emailChangedSubject: 'basedb — oturum açma adresiniz değişti',
    emailChanged: (email) =>
      `basedb hesabınız artık ${email} adresiyle oturum açıyor. Bu değişikliği siz yapmadıysanız hemen bir yöneticiye haber verin.`,
  },
  uk: {
    resetSubject: 'basedb — скидання пароля',
    emailChangedSubject: 'basedb — вашу адресу для входу змінено',
    emailChanged: (email) =>
      `Ваш обліковий запис basedb тепер входить з адресою ${email}. Якщо ви не робили цієї зміни, негайно повідомте адміністратора.`,
  },
  ja: {
    resetSubject: 'basedb — パスワードの再設定',
    emailChangedSubject: 'basedb — サインイン用のメールアドレスが変更されました',
    emailChanged: (email) =>
      `basedb アカウントのサインインには今後 ${email} を使用します。この変更に心当たりがない場合は、すぐに管理者に連絡してください。`,
  },
  'zh-CN': {
    resetSubject: 'basedb — 重置密码',
    emailChangedSubject: 'basedb — 您的登录地址已更改',
    emailChanged: (email) =>
      `您的 basedb 账户现在使用地址 ${email} 登录。如果这不是您本人所做的更改，请立即通知管理员。`,
  },
  ko: {
    resetSubject: 'basedb — 비밀번호 재설정',
    emailChangedSubject: 'basedb — 로그인 주소가 변경되었습니다',
    emailChanged: (email) =>
      `basedb 계정은 이제 ${email} 주소로 로그인합니다. 직접 변경하지 않았다면 즉시 관리자에게 알리세요.`,
  },
}

/** The account's language, else the request's `Accept-Language`, else English. */
export function mailTexts(chosen: string | null, acceptLanguage?: string | null): MailTexts {
  const locale = isLocale(chosen) ? chosen : matchLocale(acceptedLanguages(acceptLanguage))
  return TEXTS[locale]
}
