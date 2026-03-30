import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export type Lang = 'ru' | 'en';

function ruPlural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const mod = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (mod === 1) return one;
  if (mod >= 2 && mod <= 4) return few;
  return many;
}

const strings = {
  en: {
    nav: {
      backlog: 'Backlog',
      setlists: 'Setlists',
      musicians: 'Musicians',
    },
    musicians: {
      title: 'Musicians',
      addBtn: '+ Add Musician',
      name: 'Name',
      defaultInstruments: 'Default instruments',
      free: 'Free',
      empty: 'No musicians yet.',
      save: 'Save',
      cancel: 'Cancel',
      deleteConfirm: 'Delete this musician?',
      noInstrument: '(free)',
    },
    filter: {
      all: 'All',
      top: '💩 Top',
      mid: '🎵 Mid',
      low: '🧪 Under',
    },
    sort: {
      label: 'Sort:',
      default: 'Default',
      artist: 'Artist',
      title: 'Title',
    },
    backlog: {
      search: 'Search artist or title…',
      addSong: '+ Add Song',
      cols: { artist: 'Artist', title: 'Title', cat: 'Cat', musicians: 'Musicians' },
      progress: 'Progress',
      empty: 'No songs found',
      shown: (n: number, total: number) =>
        n === total ? `${n} song${n !== 1 ? 's' : ''}` : `${n} / ${total} songs`,
    },
    addToSetlist: {
      title: 'Add to setlist',
      noSetlists: 'No setlists yet.',
      createLink: 'Create one',
    },
    song: {
      editTitle: 'Edit Song',
      addTitle: 'Add Song',
      artist: 'Artist',
      title: 'Title',
      category: 'Category',
      musicians: 'Musicians',
      comment: 'Comment',
      commentPlaceholder: 'e.g. guest musician, key note…',
      musicianPlaceholder: 'Musician name',
      addMusician: '+ Add',
      remove: 'Remove',
      cancel: 'Cancel',
      save: 'Save',
    },
    instrument: {
      guitar: 'Guitar',
      bass: 'Bass',
      drums: 'Drums',
      keys: 'Keys',
      cajon: 'Cajón',
      violin: 'Violin',
      percussion: 'Perc',
      vocals: 'Vocals',
    },
    setlists: {
      title: 'Setlists',
      newBtn: '+ New Setlist',
      namePlaceholder: 'Setlist name (e.g. 2025-03-20 Bar Gig)',
      create: 'Create',
      cancel: 'Cancel',
      empty: 'No setlists yet.',
      createFirst: 'Create your first setlist',
      songs: (n: number) => `${n} song${n !== 1 ? 's' : ''}`,
      stage: '🎤 Stage',
      deleteConfirm: 'Delete this setlist?',
    },
    editor: {
      addSongs: '+ Add Songs',
      stageView: '🎤 Stage View',
      empty: 'No songs yet.',
      addSongsBtn: 'Add Songs',
      songs: (n: number) => `${n} song${n !== 1 ? 's' : ''}`,
      remove: 'Remove',
    },
    addSongs: {
      title: 'Add Songs',
      search: 'Search…',
      empty: 'No songs available',
      selected: (n: number) => `${n} selected`,
      addBtn: (n: number) => n > 0 ? `Add ${n} Song${n !== 1 ? 's' : ''}` : 'Add Songs',
      cancel: 'Cancel',
    },
    stage: {
      comment: '💬 Comment',
      shown: (n: number) => `· ${n} shown`,
      noSongs: 'No songs match current filters',
    },
    notFound: {
      message: 'Setlist not found.',
      back: '← Back',
      backToSetlists: '← Back to setlists',
    },
    progress: {
      queue:      'In queue',
      structure:  'Structure',
      mastering:  'Mastering',
      ready:      'Ready',
      readyCount: (n: number, total: number) => `${n}/${total} ready`,
    },
    deleteConfirm: 'Delete this song?',
    login: {
      title: 'Музыкальные Котятки',
      subtitle: 'Log in with Telegram to continue',
      pending: 'Your account is pending approval.',
      pendingHint: 'Ask the admin to approve your access.',
      rejected: 'Your access has been rejected.',
      stageHint: 'Log in to mark songs as played.',
    },
    admin: {
      title: 'Admin',
      users: 'Users',
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
      approve: 'Approve',
      reject: 'Reject',
      revoke: 'Revoke',
      mapMusician: 'Map to musician',
      noMusician: '— none —',
      empty: 'No users yet.',
      save: 'Save',
      cancel: 'Cancel',
    },
  },

  ru: {
    nav: {
      backlog: 'Каталог',
      setlists: 'Сетлисты',
      musicians: 'Музыканты',
    },
    musicians: {
      title: 'Музыканты',
      addBtn: '+ Добавить музыканта',
      name: 'Имя',
      defaultInstruments: 'Инструменты',
      free: 'Свободен',
      empty: 'Нет музыкантов.',
      save: 'Сохранить',
      cancel: 'Отмена',
      deleteConfirm: 'Удалить музыканта?',
      noInstrument: '(свободен)',
    },
    filter: {
      all: 'Все',
      top: '💩 По говну',
      mid: '🎵 Середняк',
      low: '🧪 Андеграунд',
    },
    sort: {
      label: 'Сорт:',
      default: 'Исходный',
      artist: 'Исполнитель',
      title: 'Название',
    },
    backlog: {
      search: 'Поиск по исполнителю или названию…',
      addSong: '+ Добавить',
      cols: { artist: 'Исполнитель', title: 'Название', cat: 'Категория', musicians: 'Музыканты' },
      progress: 'Прогресс',
      empty: 'Ничего не найдено',
      shown: (n: number, total: number) => {
        const word = ruPlural(total, 'песня', 'песни', 'песен');
        return n === total ? `${n} ${word}` : `${n} / ${total} ${word}`;
      },
    },
    addToSetlist: {
      title: 'Добавить в сетлист',
      noSetlists: 'Нет сетлистов.',
      createLink: 'Создать',
    },
    song: {
      editTitle: 'Редактировать',
      addTitle: 'Добавить песню',
      artist: 'Исполнитель',
      title: 'Название',
      category: 'Категория',
      musicians: 'Музыканты',
      comment: 'Комментарий',
      commentPlaceholder: 'напр. Саша (перкуссия), особые пожелания…',
      musicianPlaceholder: 'Имя музыканта',
      addMusician: '+ Добавить',
      remove: 'Удалить',
      cancel: 'Отмена',
      save: 'Сохранить',
    },
    instrument: {
      guitar: 'Гитара',
      bass: 'Бас',
      drums: 'Ударные',
      keys: 'Клавиши',
      cajon: 'Кахон',
      violin: 'Скрипка',
      percussion: 'Перкуссия',
      vocals: 'Вокал',
    },
    setlists: {
      title: 'Сетлисты',
      newBtn: '+ Новый сетлист',
      namePlaceholder: 'Название (напр. 20.03.2025 Бар)',
      create: 'Создать',
      cancel: 'Отмена',
      empty: 'Нет сетлистов.',
      createFirst: 'Создать первый сетлист',
      songs: (n: number) => `${n} ${ruPlural(n, 'песня', 'песни', 'песен')}`,
      stage: '🎤 Сцена',
      deleteConfirm: 'Удалить сетлист?',
    },
    editor: {
      addSongs: '+ Добавить песни',
      stageView: '🎤 На сцену',
      empty: 'Нет песен.',
      addSongsBtn: 'Добавить',
      songs: (n: number) => `${n} ${ruPlural(n, 'песня', 'песни', 'песен')}`,
      remove: 'Удалить',
    },
    addSongs: {
      title: 'Добавить песни',
      search: 'Поиск…',
      empty: 'Нет доступных песен',
      selected: (n: number) => `Выбрано: ${n}`,
      addBtn: (n: number) => n > 0
        ? `Добавить ${n} ${ruPlural(n, 'песню', 'песни', 'песен')}`
        : 'Добавить',
      cancel: 'Отмена',
    },
    stage: {
      comment: '💬 Комментарий',
      shown: (n: number) => `· ${n} показано`,
      noSongs: 'Нет песен по фильтру',
    },
    notFound: {
      message: 'Сетлист не найден.',
      back: '← Назад',
      backToSetlists: '← К сетлистам',
    },
    progress: {
      queue:      'В очередь',
      structure:  'Структура',
      mastering:  'Пальцы',
      ready:      'Готово',
      readyCount: (n: number, total: number) => `${n}/${total} готово`,
    },
    deleteConfirm: 'Удалить песню?',
    login: {
      title: 'Музыкальные Котятки',
      subtitle: 'Войдите через Telegram',
      pending: 'Ваш аккаунт ожидает подтверждения.',
      pendingHint: 'Попросите администратора одобрить доступ.',
      rejected: 'Ваш доступ отклонён.',
      stageHint: 'Войдите, чтобы отмечать сыгранные песни.',
    },
    admin: {
      title: 'Администрация',
      users: 'Пользователи',
      pending: 'Ожидает',
      approved: 'Одобрен',
      rejected: 'Отклонён',
      approve: 'Одобрить',
      reject: 'Отклонить',
      revoke: 'Отозвать',
      mapMusician: 'Привязать к музыканту',
      noMusician: '— нет —',
      empty: 'Нет пользователей.',
      save: 'Сохранить',
      cancel: 'Отмена',
    },
  },
};

export const lang = writable<Lang>(
  browser ? ((localStorage.getItem('lang') as Lang) ?? 'ru') : 'ru'
);

lang.subscribe(l => {
  if (browser) localStorage.setItem('lang', l);
});

export const t = derived(lang, $lang => strings[$lang]);
