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
  return TEXTS[mailLocale(chosen, acceptLanguage)]
}

/** The language a mail is written in: the account's, else the request's. */
export function mailLocale(chosen: string | null, acceptLanguage?: string | null): Locale {
  return isLocale(chosen) ? chosen : matchLocale(acceptedLanguages(acceptLanguage))
}

/**
 * The body of a reset mail — chapter 13 §2.3: a link to the interface when the operator
 * said where it is (`BASEDB_PUBLIC_URL`), the code alone otherwise, to paste into « Mot de
 * passe oublié ». Never a link built from the request's `Host`: a caller would choose
 * where the secret goes.
 */
export interface ResetTexts {
  readonly withLink: (link: string) => string
  readonly withCode: (code: string) => string
}

export const RESET_TEXTS: Record<Locale, ResetTexts> = {
  fr: {
    withLink: (link) =>
      `Pour choisir un nouveau mot de passe basedb, ouvrez ce lien dans les 30 minutes :\n\n${link}\n\nSi vous n’avez rien demandé, ignorez ce courriel : votre mot de passe ne change pas.`,
    withCode: (code) =>
      `Pour choisir un nouveau mot de passe basedb, saisissez ce code dans « Mot de passe oublié », dans les 30 minutes :\n\n${code}\n\nSi vous n’avez rien demandé, ignorez ce courriel : votre mot de passe ne change pas.`,
  },
  en: {
    withLink: (link) =>
      `To choose a new basedb password, open this link within 30 minutes:\n\n${link}\n\nIf you did not ask for this, ignore this email: your password does not change.`,
    withCode: (code) =>
      `To choose a new basedb password, enter this code under “Forgot password”, within 30 minutes:\n\n${code}\n\nIf you did not ask for this, ignore this email: your password does not change.`,
  },
  de: {
    withLink: (link) =>
      `Um ein neues basedb-Passwort zu wählen, öffnen Sie diesen Link innerhalb von 30 Minuten:\n\n${link}\n\nWenn Sie dies nicht angefordert haben, ignorieren Sie diese E-Mail: Ihr Passwort ändert sich nicht.`,
    withCode: (code) =>
      `Um ein neues basedb-Passwort zu wählen, geben Sie diesen Code unter „Passwort vergessen“ ein, innerhalb von 30 Minuten:\n\n${code}\n\nWenn Sie dies nicht angefordert haben, ignorieren Sie diese E-Mail: Ihr Passwort ändert sich nicht.`,
  },
  es: {
    withLink: (link) =>
      `Para elegir una nueva contraseña de basedb, abre este enlace en los próximos 30 minutos:\n\n${link}\n\nSi no has pedido esto, ignora este correo: tu contraseña no cambia.`,
    withCode: (code) =>
      `Para elegir una nueva contraseña de basedb, introduce este código en «Contraseña olvidada», en los próximos 30 minutos:\n\n${code}\n\nSi no has pedido esto, ignora este correo: tu contraseña no cambia.`,
  },
  it: {
    withLink: (link) =>
      `Per scegliere una nuova password basedb, apri questo link entro 30 minuti:\n\n${link}\n\nSe non hai richiesto tu questo, ignora questa e-mail: la tua password non cambia.`,
    withCode: (code) =>
      `Per scegliere una nuova password basedb, inserisci questo codice in «Password dimenticata», entro 30 minuti:\n\n${code}\n\nSe non hai richiesto tu questo, ignora questa e-mail: la tua password non cambia.`,
  },
  'pt-BR': {
    withLink: (link) =>
      `Para escolher uma nova senha do basedb, abra este link em até 30 minutos:\n\n${link}\n\nSe você não pediu isso, ignore este e-mail: sua senha não muda.`,
    withCode: (code) =>
      `Para escolher uma nova senha do basedb, digite este código em “Senha esquecida”, em até 30 minutos:\n\n${code}\n\nSe você não pediu isso, ignore este e-mail: sua senha não muda.`,
  },
  nl: {
    withLink: (link) =>
      `Om een nieuw basedb-wachtwoord te kiezen, open je deze link binnen 30 minuten:\n\n${link}\n\nHeb je dit niet aangevraagd, negeer dan deze e-mail: je wachtwoord verandert niet.`,
    withCode: (code) =>
      `Om een nieuw basedb-wachtwoord te kiezen, voer je deze code in bij “Wachtwoord vergeten”, binnen 30 minuten:\n\n${code}\n\nHeb je dit niet aangevraagd, negeer dan deze e-mail: je wachtwoord verandert niet.`,
  },
  pl: {
    withLink: (link) =>
      `Aby wybrać nowe hasło basedb, otwórz ten link w ciągu 30 minut:\n\n${link}\n\nJeśli to nie Twoja prośba, zignoruj ten e-mail: Twoje hasło się nie zmienia.`,
    withCode: (code) =>
      `Aby wybrać nowe hasło basedb, wpisz ten kod w „Nie pamiętam hasła” w ciągu 30 minut:\n\n${code}\n\nJeśli to nie Twoja prośba, zignoruj ten e-mail: Twoje hasło się nie zmienia.`,
  },
  cs: {
    withLink: (link) =>
      `Chcete-li zvolit nové heslo basedb, otevřete tento odkaz do 30 minut:\n\n${link}\n\nPokud jste o to nežádali, tento e-mail ignorujte: vaše heslo se nezmění.`,
    withCode: (code) =>
      `Chcete-li zvolit nové heslo basedb, zadejte tento kód v „Zapomenuté heslo“ do 30 minut:\n\n${code}\n\nPokud jste o to nežádali, tento e-mail ignorujte: vaše heslo se nezmění.`,
  },
  sv: {
    withLink: (link) =>
      `För att välja ett nytt basedb-lösenord, öppna den här länken inom 30 minuter:\n\n${link}\n\nOm du inte har begärt detta, ignorera det här e-postmeddelandet: ditt lösenord ändras inte.`,
    withCode: (code) =>
      `För att välja ett nytt basedb-lösenord, ange den här koden under ”Glömt lösenord” inom 30 minuter:\n\n${code}\n\nOm du inte har begärt detta, ignorera det här e-postmeddelandet: ditt lösenord ändras inte.`,
  },
  da: {
    withLink: (link) =>
      `For at vælge en ny basedb-adgangskode skal du åbne dette link inden 30 minutter:\n\n${link}\n\nHvis du ikke har bedt om dette, så ignorer denne mail: din adgangskode ændres ikke.`,
    withCode: (code) =>
      `For at vælge en ny basedb-adgangskode skal du indtaste denne kode under “Glemt adgangskode” inden 30 minutter:\n\n${code}\n\nHvis du ikke har bedt om dette, så ignorer denne mail: din adgangskode ændres ikke.`,
  },
  nb: {
    withLink: (link) =>
      `For å velge et nytt basedb-passord, åpne denne lenken innen 30 minutter:\n\n${link}\n\nHvis du ikke har bedt om dette, kan du ignorere denne e-posten: passordet ditt endres ikke.`,
    withCode: (code) =>
      `For å velge et nytt basedb-passord, skriv inn denne koden under «Glemt passord» innen 30 minutter:\n\n${code}\n\nHvis du ikke har bedt om dette, kan du ignorere denne e-posten: passordet ditt endres ikke.`,
  },
  fi: {
    withLink: (link) =>
      `Valitaksesi uuden basedb-salasanan, avaa tämä linkki 30 minuutin kuluessa:\n\n${link}\n\nJos et pyytänyt tätä, jätä tämä sähköposti huomiotta: salasanasi ei muutu.`,
    withCode: (code) =>
      `Valitaksesi uuden basedb-salasanan, syötä tämä koodi kohdassa ”Salasana unohtunut” 30 minuutin kuluessa:\n\n${code}\n\nJos et pyytänyt tätä, jätä tämä sähköposti huomiotta: salasanasi ei muutu.`,
  },
  ro: {
    withLink: (link) =>
      `Pentru a alege o nouă parolă basedb, deschideți acest link în 30 de minute:\n\n${link}\n\nDacă nu ați cerut acest lucru, ignorați acest e-mail: parola dumneavoastră nu se schimbă.`,
    withCode: (code) =>
      `Pentru a alege o nouă parolă basedb, introduceți acest cod în „Parolă uitată”, în 30 de minute:\n\n${code}\n\nDacă nu ați cerut acest lucru, ignorați acest e-mail: parola dumneavoastră nu se schimbă.`,
  },
  hu: {
    withLink: (link) =>
      `Az új basedb jelszó kiválasztásához nyissa meg ezt a linket 30 percen belül:\n\n${link}\n\nHa nem Ön kérte ezt, hagyja figyelmen kívül ezt az e-mailt: a jelszava nem változik meg.`,
    withCode: (code) =>
      `Az új basedb jelszó kiválasztásához adja meg ezt a kódot itt: „Elfelejtett jelszó”, 30 percen belül:\n\n${code}\n\nHa nem Ön kérte ezt, hagyja figyelmen kívül ezt az e-mailt: a jelszava nem változik meg.`,
  },
  tr: {
    withLink: (link) =>
      `Yeni bir basedb şifresi seçmek için bu bağlantıyı 30 dakika içinde açın:\n\n${link}\n\nBunu siz istemediyseniz bu e-postayı yok sayın: şifreniz değişmez.`,
    withCode: (code) =>
      `Yeni bir basedb şifresi seçmek için bu kodu “Şifremi unuttum” bölümüne 30 dakika içinde girin:\n\n${code}\n\nBunu siz istemediyseniz bu e-postayı yok sayın: şifreniz değişmez.`,
  },
  uk: {
    withLink: (link) =>
      `Щоб вибрати новий пароль basedb, відкрийте це посилання протягом 30 хвилин:\n\n${link}\n\nЯкщо ви не просили цього, ігноруйте цей лист: ваш пароль не змінюється.`,
    withCode: (code) =>
      `Щоб вибрати новий пароль basedb, введіть цей код у «Забули пароль» протягом 30 хвилин:\n\n${code}\n\nЯкщо ви не просили цього, ігноруйте цей лист: ваш пароль не змінюється.`,
  },
  ja: {
    withLink: (link) =>
      `新しい basedb のパスワードを選ぶには、30分以内にこのリンクを開いてください。\n\n${link}\n\nこの操作に心当たりがない場合は、このメールを無視してください。パスワードは変更されません。`,
    withCode: (code) =>
      `新しい basedb のパスワードを選ぶには、30分以内に「パスワードをお忘れの方」でこのコードを入力してください。\n\n${code}\n\nこの操作に心当たりがない場合は、このメールを無視してください。パスワードは変更されません。`,
  },
  'zh-CN': {
    withLink: (link) =>
      `要选择新的 basedb 密码，请在 30 分钟内打开此链接：\n\n${link}\n\n如果这不是您本人的请求，请忽略这封邮件：您的密码不会更改。`,
    withCode: (code) =>
      `要选择新的 basedb 密码，请在 30 分钟内在“忘记密码”中输入此代码：\n\n${code}\n\n如果这不是您本人的请求，请忽略这封邮件：您的密码不会更改。`,
  },
  ko: {
    withLink: (link) =>
      `새 basedb 비밀번호를 설정하려면 30분 이내에 이 링크를 여세요.\n\n${link}\n\n요청하지 않으셨다면 이 이메일을 무시하세요. 비밀번호는 변경되지 않습니다.`,
    withCode: (code) =>
      `새 basedb 비밀번호를 설정하려면 30분 이내에 “비밀번호 찾기”에서 이 코드를 입력하세요.\n\n${code}\n\n요청하지 않으셨다면 이 이메일을 무시하세요. 비밀번호는 변경되지 않습니다.`,
  },
}

export function resetTexts(locale: Locale): ResetTexts {
  return RESET_TEXTS[locale]
}
