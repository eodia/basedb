import type { Locale } from '@basedb/contracts'
import type { NotificationKind } from '../collab/notifications.js'

/**
 * What a notification mail says, in its recipient's language — chapter 16 §2.4.
 *
 * The sentences are the interface's own (`notificationSentence`, `apps/web/src/lib/collab.ts`):
 * a mail says what the bell says.
 */

export interface NotificationMailTexts {
  /** `{who} vous a mentionné dans {label}` and its three siblings. */
  readonly sentence: Readonly<Record<NotificationKind, (who: string, label: string) => string>>
  /** Who, when the author's account is gone. */
  readonly someone: string
  /** The subject of a mail that carries several notifications. */
  readonly several: (count: number) => string
  readonly greeting: (name: string) => string
  /** The link to the row. */
  readonly open: string
  /** More notifications than a mail lists. */
  readonly more: (count: number) => string
  /** Why this mail was sent. */
  readonly why: string
  /** Where to choose what comes by mail. */
  readonly settings: string
}

export const NOTIFICATION_MAIL_TEXTS: Record<Locale, NotificationMailTexts> = {
  fr: {
    sentence: {
      mention: (who, label) => `${who} vous a mentionné dans ${label}`,
      reply: (who, label) => `${who} a répondu dans ${label}`,
      assigned: (who, label) => `${who} vous a désigné dans ${label}`,
      automation: (who, label) => `${who} vous prévient par une automatisation dans ${label}`,
    },
    someone: 'Quelqu’un',
    several: (count) => `${count} notifications non lues dans basedb`,
    greeting: (name) => `Bonjour ${name},`,
    open: 'Ouvrir dans basedb',
    more: (count) =>
      count === 1 ? 'Et une autre, dans basedb.' : `Et ${count} autres, dans basedb.`,
    why: 'Ce courriel part quand une notification reste dix minutes sans être lue.',
    settings: 'Pour choisir ce que vous recevez par courriel : Paramètres › Notifications.',
  },
  en: {
    sentence: {
      mention: (who, label) => `${who} mentioned you in ${label}`,
      reply: (who, label) => `${who} replied in ${label}`,
      assigned: (who, label) => `${who} assigned you in ${label}`,
      automation: (who, label) => `${who} notified you through an automation in ${label}`,
    },
    someone: 'Someone',
    several: (count) => `${count} unread notifications in basedb`,
    greeting: (name) => `Hello ${name},`,
    open: 'Open in basedb',
    more: (count) => (count === 1 ? 'And one more, in basedb.' : `And ${count} more, in basedb.`),
    why: 'This email is sent when a notification stays unread for ten minutes.',
    settings: 'To choose what you receive by email: Settings › Notifications.',
  },
  de: {
    sentence: {
      mention: (who, label) => `${who} hat Sie in ${label} erwähnt`,
      reply: (who, label) => `${who} hat in ${label} geantwortet`,
      assigned: (who, label) => `${who} hat Sie in ${label} zugewiesen`,
      automation: (who, label) => `${who} benachrichtigt Sie über eine Automatisierung in ${label}`,
    },
    someone: 'Jemand',
    several: (count) => `${count} ungelesene Benachrichtigungen in basedb`,
    greeting: (name) => `Hallo ${name},`,
    open: 'In basedb öffnen',
    more: (count) =>
      count === 1 ? 'Und noch eine, in basedb.' : `Und noch ${count} weitere, in basedb.`,
    why: 'Diese E-Mail wird versendet, wenn eine Benachrichtigung zehn Minuten ungelesen bleibt.',
    settings: 'Um zu wählen, was Sie per E-Mail erhalten: Einstellungen › Benachrichtigungen.',
  },
  es: {
    sentence: {
      mention: (who, label) => `${who} te mencionó en ${label}`,
      reply: (who, label) => `${who} respondió en ${label}`,
      assigned: (who, label) => `${who} te asignó en ${label}`,
      automation: (who, label) => `${who} te avisa mediante una automatización en ${label}`,
    },
    someone: 'Alguien',
    several: (count) => `${count} notificaciones sin leer en basedb`,
    greeting: (name) => `Hola ${name},`,
    open: 'Abrir en basedb',
    more: (count) => (count === 1 ? 'Y una más, en basedb.' : `Y ${count} más, en basedb.`),
    why: 'Este correo se envía cuando una notificación permanece sin leer durante diez minutos.',
    settings: 'Para elegir lo que recibes por correo: Configuración › Notificaciones.',
  },
  it: {
    sentence: {
      mention: (who, label) => `${who} ti ha menzionato in ${label}`,
      reply: (who, label) => `${who} ha risposto in ${label}`,
      assigned: (who, label) => `${who} ti ha assegnato in ${label}`,
      automation: (who, label) => `${who} ti avvisa tramite un’automazione in ${label}`,
    },
    someone: 'Qualcuno',
    several: (count) => `${count} notifiche non lette in basedb`,
    greeting: (name) => `Ciao ${name},`,
    open: 'Apri in basedb',
    more: (count) => (count === 1 ? 'E un’altra, in basedb.' : `E altre ${count}, in basedb.`),
    why: 'Questa e-mail viene inviata quando una notifica resta da leggere per dieci minuti.',
    settings: 'Per scegliere cosa ricevi per e-mail: Impostazioni › Notifiche.',
  },
  'pt-BR': {
    sentence: {
      mention: (who, label) => `${who} mencionou você em ${label}`,
      reply: (who, label) => `${who} respondeu em ${label}`,
      assigned: (who, label) => `${who} atribuiu você em ${label}`,
      automation: (who, label) => `${who} notificou você por uma automação em ${label}`,
    },
    someone: 'Alguém',
    several: (count) => `${count} notificações não lidas em basedb`,
    greeting: (name) => `Olá ${name},`,
    open: 'Abrir em basedb',
    more: (count) => (count === 1 ? 'E mais uma, em basedb.' : `E mais ${count}, em basedb.`),
    why: 'Este e-mail é enviado quando uma notificação permanece sem leitura por dez minutos.',
    settings: 'Para escolher o que você recebe por e-mail: Configurações › Notificações.',
  },
  nl: {
    sentence: {
      mention: (who, label) => `${who} heeft je vermeld in ${label}`,
      reply: (who, label) => `${who} heeft gereageerd in ${label}`,
      assigned: (who, label) => `${who} heeft je toegewezen in ${label}`,
      automation: (who, label) =>
        `${who} brengt je via een automatisering op de hoogte in ${label}`,
    },
    someone: 'Iemand',
    several: (count) => `${count} ongelezen meldingen in basedb`,
    greeting: (name) => `Hallo ${name},`,
    open: 'Openen in basedb',
    more: (count) => (count === 1 ? 'En nog een, in basedb.' : `En nog ${count} meer, in basedb.`),
    why: 'Deze e-mail wordt verstuurd wanneer een melding tien minuten ongelezen blijft.',
    settings: 'Om te kiezen wat je per e-mail ontvangt: Instellingen › Meldingen.',
  },
  pl: {
    sentence: {
      mention: (who, label) => `${who} wspomniał(a) o tobie w ${label}`,
      reply: (who, label) => `${who} odpowiedział(a) w ${label}`,
      assigned: (who, label) => `${who} przypisał(a) cię w ${label}`,
      automation: (who, label) => `${who} powiadamia cię przez automatyzację w ${label}`,
    },
    someone: 'Ktoś',
    several: (count) => {
      const cat = new Intl.PluralRules('pl').select(count)
      const phrase =
        cat === 'one'
          ? 'nieprzeczytane powiadomienie'
          : cat === 'few'
            ? 'nieprzeczytane powiadomienia'
            : 'nieprzeczytanych powiadomień'
      return `${count} ${phrase} w basedb`
    },
    greeting: (name) => `Cześć ${name},`,
    open: 'Otwórz w basedb',
    more: (count) => {
      const cat = new Intl.PluralRules('pl').select(count)
      if (cat === 'one') return 'I jeszcze jedno, w basedb.'
      if (cat === 'few') return `I jeszcze ${count} inne, w basedb.`
      return `I jeszcze ${count} innych, w basedb.`
    },
    why: 'Ten e-mail jest wysyłany, gdy powiadomienie pozostaje nieprzeczytane przez dziesięć minut.',
    settings: 'Aby wybrać, co otrzymujesz e-mailem: Ustawienia › Powiadomienia.',
  },
  cs: {
    sentence: {
      mention: (who, label) => `${who} vás zmínil(a) v ${label}`,
      reply: (who, label) => `${who} odpověděl(a) v ${label}`,
      assigned: (who, label) => `${who} vás přiřadil(a) v ${label}`,
      automation: (who, label) => `${who} vás upozorňuje automatizací v ${label}`,
    },
    someone: 'Někdo',
    several: (count) => {
      const cat = new Intl.PluralRules('cs').select(count)
      const phrase =
        cat === 'one'
          ? 'nepřečtené oznámení'
          : cat === 'few'
            ? 'nepřečtená oznámení'
            : 'nepřečtených oznámení'
      return `${count} ${phrase} v basedb`
    },
    greeting: (name) => `Dobrý den, ${name},`,
    open: 'Otevřít v basedb',
    more: (count) => {
      const cat = new Intl.PluralRules('cs').select(count)
      if (cat === 'one') return 'A ještě jedno, v basedb.'
      if (cat === 'few') return `A ještě ${count} další, v basedb.`
      return `A ještě ${count} dalších, v basedb.`
    },
    why: 'Tento e-mail se odesílá, když oznámení zůstane deset minut nepřečtené.',
    settings: 'Pro výběr toho, co dostáváte e-mailem: Nastavení › Oznámení.',
  },
  sv: {
    sentence: {
      mention: (who, label) => `${who} nämnde dig i ${label}`,
      reply: (who, label) => `${who} svarade i ${label}`,
      assigned: (who, label) => `${who} tilldelade dig i ${label}`,
      automation: (who, label) => `${who} aviserar dig via en automatisering i ${label}`,
    },
    someone: 'Någon',
    several: (count) => `${count} olästa aviseringar i basedb`,
    greeting: (name) => `Hej ${name},`,
    open: 'Öppna i basedb',
    more: (count) => (count === 1 ? 'Och en till, i basedb.' : `Och ${count} till, i basedb.`),
    why: 'Det här e-postmeddelandet skickas när en avisering är oläst i tio minuter.',
    settings: 'För att välja vad du får via e-post: Inställningar › Aviseringar.',
  },
  da: {
    sentence: {
      mention: (who, label) => `${who} nævnte dig i ${label}`,
      reply: (who, label) => `${who} svarede i ${label}`,
      assigned: (who, label) => `${who} tildelte dig i ${label}`,
      automation: (who, label) => `${who} giver dig besked via en automatisering i ${label}`,
    },
    someone: 'Nogen',
    several: (count) => `${count} ulæste notifikationer i basedb`,
    greeting: (name) => `Hej ${name},`,
    open: 'Åbn i basedb',
    more: (count) => (count === 1 ? 'Og en mere, i basedb.' : `Og ${count} mere, i basedb.`),
    why: 'Denne mail sendes, når en notifikation forbliver ulæst i ti minutter.',
    settings: 'For at vælge, hvad du modtager via e-mail: Indstillinger › Notifikationer.',
  },
  nb: {
    sentence: {
      mention: (who, label) => `${who} nevnte deg i ${label}`,
      reply: (who, label) => `${who} svarte i ${label}`,
      assigned: (who, label) => `${who} har tildelt deg i ${label}`,
      automation: (who, label) => `${who} varsler deg via en automatisering i ${label}`,
    },
    someone: 'Noen',
    several: (count) => `${count} uleste varsler i basedb`,
    greeting: (name) => `Hei ${name},`,
    open: 'Åpne i basedb',
    more: (count) => (count === 1 ? 'Og ett til, i basedb.' : `Og ${count} til, i basedb.`),
    why: 'Denne e-posten sendes når et varsel forblir ulest i ti minutter.',
    settings: 'For å velge hva du får på e-post: Innstillinger › Varsler.',
  },
  fi: {
    sentence: {
      mention: (who, label) => `${who} mainitsi sinut taulukossa ${label}`,
      reply: (who, label) => `${who} vastasi taulukossa ${label}`,
      assigned: (who, label) => `${who} nimesi sinut taulukossa ${label}`,
      automation: (who, label) => `${who} ilmoittaa sinulle automaation kautta taulukossa ${label}`,
    },
    someone: 'Joku',
    several: (count) => `${count} lukematonta ilmoitusta basedb:ssä`,
    greeting: (name) => `Hei ${name},`,
    open: 'Avaa basedb:ssä',
    more: (count) =>
      count === 1 ? 'Ja yksi lisää, basedb:ssä.' : `Ja ${count} lisää, basedb:ssä.`,
    why: 'Tämä sähköposti lähetetään, kun ilmoitus pysyy lukemattomana kymmenen minuuttia.',
    settings: 'Voit valita, mitä saat sähköpostitse: Asetukset › Ilmoitukset.',
  },
  ro: {
    sentence: {
      mention: (who, label) => `${who} v-a menționat în ${label}`,
      reply: (who, label) => `${who} a răspuns în ${label}`,
      assigned: (who, label) => `${who} v-a desemnat în ${label}`,
      automation: (who, label) => `${who} vă anunță printr-o automatizare în ${label}`,
    },
    someone: 'Cineva',
    several: (count) => {
      const cat = new Intl.PluralRules('ro').select(count)
      const phrase =
        cat === 'one'
          ? 'notificare necitită'
          : cat === 'few'
            ? 'notificări necitite'
            : 'de notificări necitite'
      return `${count} ${phrase} în basedb`
    },
    greeting: (name) => `Bună ziua, ${name},`,
    open: 'Deschide în basedb',
    more: (count) => {
      const cat = new Intl.PluralRules('ro').select(count)
      if (cat === 'one') return 'Și încă o notificare, în basedb.'
      if (cat === 'few') return `Și încă ${count} notificări, în basedb.`
      return `Și încă ${count} de notificări, în basedb.`
    },
    why: 'Acest e-mail este trimis atunci când o notificare rămâne necitită timp de zece minute.',
    settings: 'Pentru a alege ce primiți prin e-mail: Setări › Notificări.',
  },
  hu: {
    sentence: {
      mention: (who, label) => `${who} megemlítette Önt itt: ${label}`,
      reply: (who, label) => `${who} válaszolt itt: ${label}`,
      assigned: (who, label) => `${who} Önt jelölte ki itt: ${label}`,
      automation: (who, label) => `${who} automatizálással értesíti Önt itt: ${label}`,
    },
    someone: 'Valaki',
    several: (count) => `${count} olvasatlan értesítés a basedb-ben`,
    greeting: (name) => `Kedves ${name},`,
    open: 'Megnyitás a basedb-ben',
    more: (count) => (count === 1 ? 'És még egy, a basedb-ben.' : `És még ${count}, a basedb-ben.`),
    why: 'Ez az e-mail akkor érkezik, ha egy értesítés tíz percig olvasatlan marad.',
    settings: 'Annak kiválasztásához, hogy mit kap e-mailben: Beállítások › Értesítések.',
  },
  tr: {
    sentence: {
      mention: (who, label) => `${who}, ${label} tablosunda sizden bahsetti`,
      reply: (who, label) => `${who}, ${label} tablosunda yanıt verdi`,
      assigned: (who, label) => `${who} sizi ${label} tablosunda atadı`,
      automation: (who, label) =>
        `${who}, ${label} tablosundaki bir otomasyonla sizi bilgilendiriyor`,
    },
    someone: 'Biri',
    several: (count) => `basedb’de ${count} okunmamış bildirim`,
    greeting: (name) => `Merhaba ${name},`,
    open: 'basedb’de aç',
    more: (count) =>
      count === 1 ? 'Ve basedb’de bir tane daha.' : `Ve basedb’de ${count} tane daha.`,
    why: 'Bu e-posta, bir bildirim on dakika boyunca okunmadan kaldığında gönderilir.',
    settings: 'E-posta ile ne aldığınızı seçmek için: Ayarlar › Bildirimler.',
  },
  uk: {
    sentence: {
      mention: (who, label) => `${who} згадує вас у ${label}`,
      reply: (who, label) => `${who} відповідає в ${label}`,
      assigned: (who, label) => `${who} призначає вас у ${label}`,
      automation: (who, label) => `${who} сповіщає вас через автоматизацію в ${label}`,
    },
    someone: 'Хтось',
    several: (count) => {
      const cat = new Intl.PluralRules('uk').select(count)
      const phrase =
        cat === 'one'
          ? 'непрочитане сповіщення'
          : cat === 'few'
            ? 'непрочитані сповіщення'
            : 'непрочитаних сповіщень'
      return `${count} ${phrase} у basedb`
    },
    greeting: (name) => `Доброго дня, ${name},`,
    open: 'Відкрити в basedb',
    more: (count) => {
      const cat = new Intl.PluralRules('uk').select(count)
      if (cat === 'one') return 'І ще одне, у basedb.'
      if (cat === 'few') return `І ще ${count} інші, у basedb.`
      return `І ще ${count} інших, у basedb.`
    },
    why: 'Цей лист надсилається, коли сповіщення залишається непрочитаним десять хвилин.',
    settings: 'Щоб вибрати, що ви отримуєте електронною поштою: Налаштування › Сповіщення.',
  },
  ja: {
    sentence: {
      mention: (who, label) => `${who} から「${label}」でメンションされました`,
      reply: (who, label) => `${who} が「${label}」で返信しました`,
      assigned: (who, label) => `${who} から「${label}」で担当者に指定されました`,
      automation: (who, label) => `${who} から「${label}」のオートメーションで通知が届きました`,
    },
    someone: '誰か',
    several: (count) => `basedb の未読の通知が${count}件あります`,
    greeting: (name) => `${name} 様、`,
    open: 'basedb で開く',
    more: (count) =>
      count === 1 ? 'basedb にもう1件あります。' : `basedb にあと${count}件あります。`,
    why: 'この通知が10分間未読のままの場合に、このメールが送信されます。',
    settings: 'メールで受け取る内容を選ぶには：設定 › 通知。',
  },
  'zh-CN': {
    sentence: {
      mention: (who, label) => `${who} 在 ${label} 中提及了您`,
      reply: (who, label) => `${who} 在 ${label} 中回复了`,
      assigned: (who, label) => `${who} 在 ${label} 中指派了您`,
      automation: (who, label) => `${who} 通过 ${label} 中的自动化通知您`,
    },
    someone: '有人',
    several: (count) => `basedb 中有 ${count} 条未读通知`,
    greeting: (name) => `${name}，您好，`,
    open: '在 basedb 中打开',
    more: (count) =>
      count === 1 ? '还有 1 条，在 basedb 中。' : `还有 ${count} 条，在 basedb 中。`,
    why: '当某条通知十分钟未被读取时，系统会发送这封邮件。',
    settings: '要选择您通过邮件收到的内容：设置 › 通知。',
  },
  ko: {
    sentence: {
      mention: (who, label) => `${who} 님이 ${label}에서 나를 멘션했습니다`,
      reply: (who, label) => `${who} 님이 ${label}에서 답글을 남겼습니다`,
      assigned: (who, label) => `${who} 님이 ${label}에서 나를 지정했습니다`,
      automation: (who, label) => `${who} 님이 ${label}에서 자동화로 알림을 보냈습니다`,
    },
    someone: '누군가',
    several: (count) => `basedb에 읽지 않은 알림이 ${count}개 있습니다`,
    greeting: (name) => `${name}님, 안녕하세요.`,
    open: 'basedb에서 열기',
    more: (count) =>
      count === 1 ? 'basedb에 1개가 더 있습니다.' : `basedb에 ${count}개가 더 있습니다.`,
    why: '알림이 10분 동안 읽히지 않으면 이 이메일이 발송됩니다.',
    settings: '이메일로 받을 항목을 선택하려면: 설정 › 알림.',
  },
}

export function notificationMailTexts(locale: string | null): NotificationMailTexts {
  return NOTIFICATION_MAIL_TEXTS[(locale ?? 'fr') as Locale] ?? NOTIFICATION_MAIL_TEXTS.en
}
