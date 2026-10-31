/**
 * Справочник субъектов РФ: источник правды для всего приложения.
 * Геометрия в regions.svg.json сопоставляется с ним по id (проверяется скриптом).
 */

export type DistrictId = 'cfo' | 'szfo' | 'yufo' | 'skfo' | 'pfo' | 'ufo' | 'sfo' | 'dfo'

export type RegionType =
  | 'республика'
  | 'край'
  | 'область'
  | 'город федерального значения'
  | 'автономная область'
  | 'автономный округ'

export interface Region {
  id: string
  /** Полное название */
  name: string
  /** Короткое название для плашек */
  short: string
  type: RegionType
  /** Столица по умолчанию (null для городов федерального значения) */
  capital: string | null
  /** Альтернативная столица (тоже засчитывается) */
  capitalAlt?: string
  /** Пояснение про столицу */
  capitalNote?: string
  district: DistrictId
  /** Варианты написания для поиска и автодополнения */
  aliases: string[]
}

export interface District {
  id: DistrictId
  name: string
  short: string
  /** Хвалебное название для ачивки «весь округ захвачен» */
  achievement: string
}

export const DISTRICTS: District[] = [
  { id: 'cfo', name: 'Центральный федеральный округ', short: 'ЦФО', achievement: 'Сердце России' },
  { id: 'szfo', name: 'Северо-Западный федеральный округ', short: 'СЗФО', achievement: 'Северный штурман' },
  { id: 'yufo', name: 'Южный федеральный округ', short: 'ЮФО', achievement: 'Южный ветер' },
  { id: 'skfo', name: 'Северо-Кавказский федеральный округ', short: 'СКФО', achievement: 'Горный орёл' },
  { id: 'pfo', name: 'Приволжский федеральный округ', short: 'ПФО', achievement: 'Волжский капитан' },
  { id: 'ufo', name: 'Уральский федеральный округ', short: 'УФО', achievement: 'Хозяин Урала' },
  { id: 'sfo', name: 'Сибирский федеральный округ', short: 'СФО', achievement: 'Покоритель Сибири' },
  { id: 'dfo', name: 'Дальневосточный федеральный округ', short: 'ДФО', achievement: 'Встречающий рассвет' },
]

type R = Omit<Region, 'aliases' | 'district'> & { aliases?: string[] }

const obl = (id: string, stem: string, capital: string, aliases: string[] = []): R => ({
  id,
  name: `${stem} область`,
  short: `${stem} обл.`,
  type: 'область',
  capital,
  aliases,
})

const CFO: R[] = [
  obl('belgorod', 'Белгородская', 'Белгород', ['Белгородчина']),
  obl('bryansk', 'Брянская', 'Брянск', ['Брянщина']),
  obl('vladimir', 'Владимирская', 'Владимир'),
  obl('voronezh', 'Воронежская', 'Воронеж'),
  obl('ivanovo', 'Ивановская', 'Иваново'),
  obl('kaluga', 'Калужская', 'Калуга'),
  obl('kostroma', 'Костромская', 'Кострома'),
  obl('kursk', 'Курская', 'Курск'),
  obl('lipetsk', 'Липецкая', 'Липецк'),
  {
    ...obl('moscow-oblast', 'Московская', 'Москва', ['Подмосковье', 'МО']),
    capitalAlt: 'Красногорск',
    capitalNote: 'Органы власти находятся в Красногорске',
  },
  obl('oryol', 'Орловская', 'Орёл', ['Орел', 'Орловщина']),
  obl('ryazan', 'Рязанская', 'Рязань'),
  obl('smolensk', 'Смоленская', 'Смоленск', ['Смоленщина']),
  obl('tambov', 'Тамбовская', 'Тамбов'),
  obl('tver', 'Тверская', 'Тверь'),
  obl('tula', 'Тульская', 'Тула'),
  obl('yaroslavl', 'Ярославская', 'Ярославль'),
  { id: 'moscow', name: 'Москва', short: 'Москва', type: 'город федерального значения', capital: null, aliases: ['г. Москва', 'город Москва'] },
]

const SZFO: R[] = [
  { id: 'karelia', name: 'Республика Карелия', short: 'Карелия', type: 'республика', capital: 'Петрозаводск', aliases: ['Карелия'] },
  { id: 'komi', name: 'Республика Коми', short: 'Коми', type: 'республика', capital: 'Сыктывкар', aliases: ['Коми'] },
  obl('arkhangelsk', 'Архангельская', 'Архангельск'),
  obl('vologda', 'Вологодская', 'Вологда', ['Вологодчина']),
  obl('kaliningrad', 'Калининградская', 'Калининград'),
  {
    ...obl('leningrad', 'Ленинградская', 'Санкт-Петербург', ['Ленобласть', 'ЛО']),
    capitalAlt: 'Гатчина',
    capitalNote: 'Административный центр — Гатчина, органы власти находятся в Санкт-Петербурге',
  },
  obl('murmansk', 'Мурманская', 'Мурманск'),
  obl('novgorod', 'Новгородская', 'Великий Новгород', ['Новгородчина']),
  obl('pskov', 'Псковская', 'Псков', ['Псковщина']),
  { id: 'nenets', name: 'Ненецкий автономный округ', short: 'Ненецкий АО', type: 'автономный округ', capital: 'Нарьян-Мар', aliases: ['НАО', 'Ненецкий АО', 'Ненецкий округ'] },
  { id: 'spb', name: 'Санкт-Петербург', short: 'Санкт-Петербург', type: 'город федерального значения', capital: null, aliases: ['СПб', 'Питер', 'Петербург', 'г. Санкт-Петербург'] },
]

const YUFO: R[] = [
  { id: 'adygea', name: 'Республика Адыгея', short: 'Адыгея', type: 'республика', capital: 'Майкоп', aliases: ['Адыгея'] },
  { id: 'kalmykia', name: 'Республика Калмыкия', short: 'Калмыкия', type: 'республика', capital: 'Элиста', aliases: ['Калмыкия'] },
  { id: 'crimea', name: 'Республика Крым', short: 'Крым', type: 'республика', capital: 'Симферополь', aliases: ['Крым'] },
  { id: 'krasnodar', name: 'Краснодарский край', short: 'Краснодарский кр.', type: 'край', capital: 'Краснодар', aliases: ['Кубань'] },
  obl('astrakhan', 'Астраханская', 'Астрахань'),
  obl('volgograd', 'Волгоградская', 'Волгоград'),
  obl('rostov', 'Ростовская', 'Ростов-на-Дону', ['Ростов']),
  { id: 'sevastopol', name: 'Севастополь', short: 'Севастополь', type: 'город федерального значения', capital: null, aliases: ['г. Севастополь'] },
  { id: 'dnr', name: 'Донецкая Народная Республика', short: 'ДНР', type: 'республика', capital: 'Донецк', aliases: ['ДНР', 'Донецкая республика'] },
  { id: 'lnr', name: 'Луганская Народная Республика', short: 'ЛНР', type: 'республика', capital: 'Луганск', aliases: ['ЛНР', 'Луганская республика'] },
  {
    ...obl('zaporozhye', 'Запорожская', 'Запорожье'),
    capitalAlt: 'Мелитополь',
    capitalNote: 'Временный административный центр — Мелитополь',
  },
  {
    ...obl('kherson', 'Херсонская', 'Херсон'),
    capitalAlt: 'Геническ',
    capitalNote: 'Временный административный центр — Геническ',
  },
]

const SKFO: R[] = [
  { id: 'dagestan', name: 'Республика Дагестан', short: 'Дагестан', type: 'республика', capital: 'Махачкала', aliases: ['Дагестан'] },
  { id: 'ingushetia', name: 'Республика Ингушетия', short: 'Ингушетия', type: 'республика', capital: 'Магас', aliases: ['Ингушетия'] },
  { id: 'kbr', name: 'Кабардино-Балкарская Республика', short: 'Кабардино-Балкария', type: 'республика', capital: 'Нальчик', aliases: ['КБР', 'Кабардино-Балкария'] },
  { id: 'kchr', name: 'Карачаево-Черкесская Республика', short: 'Карачаево-Черкесия', type: 'республика', capital: 'Черкесск', aliases: ['КЧР', 'Карачаево-Черкесия'] },
  { id: 'north-ossetia', name: 'Республика Северная Осетия — Алания', short: 'Северная Осетия', type: 'республика', capital: 'Владикавказ', aliases: ['Северная Осетия', 'Алания', 'Осетия', 'РСО-Алания'] },
  { id: 'chechnya', name: 'Чеченская Республика', short: 'Чечня', type: 'республика', capital: 'Грозный', aliases: ['Чечня'] },
  { id: 'stavropol', name: 'Ставропольский край', short: 'Ставропольский кр.', type: 'край', capital: 'Ставрополь', aliases: ['Ставрополье'] },
]

const PFO: R[] = [
  { id: 'bashkortostan', name: 'Республика Башкортостан', short: 'Башкортостан', type: 'республика', capital: 'Уфа', aliases: ['Башкирия', 'Башкортостан'] },
  { id: 'mari-el', name: 'Республика Марий Эл', short: 'Марий Эл', type: 'республика', capital: 'Йошкар-Ола', aliases: ['Марий Эл', 'Марийская республика'] },
  { id: 'mordovia', name: 'Республика Мордовия', short: 'Мордовия', type: 'республика', capital: 'Саранск', aliases: ['Мордовия'] },
  { id: 'tatarstan', name: 'Республика Татарстан', short: 'Татарстан', type: 'республика', capital: 'Казань', aliases: ['Татарстан', 'Татария'] },
  { id: 'udmurtia', name: 'Удмуртская Республика', short: 'Удмуртия', type: 'республика', capital: 'Ижевск', aliases: ['Удмуртия'] },
  { id: 'chuvashia', name: 'Чувашская Республика', short: 'Чувашия', type: 'республика', capital: 'Чебоксары', aliases: ['Чувашия'] },
  { id: 'perm', name: 'Пермский край', short: 'Пермский кр.', type: 'край', capital: 'Пермь', aliases: ['Прикамье'] },
  obl('kirov', 'Кировская', 'Киров', ['Вятка']),
  obl('nizhny-novgorod', 'Нижегородская', 'Нижний Новгород'),
  obl('orenburg', 'Оренбургская', 'Оренбург', ['Оренбуржье']),
  obl('penza', 'Пензенская', 'Пенза'),
  obl('samara', 'Самарская', 'Самара'),
  obl('saratov', 'Саратовская', 'Саратов'),
  obl('ulyanovsk', 'Ульяновская', 'Ульяновск'),
]

const UFO: R[] = [
  obl('kurgan', 'Курганская', 'Курган', ['Зауралье']),
  obl('sverdlovsk', 'Свердловская', 'Екатеринбург'),
  obl('tyumen', 'Тюменская', 'Тюмень'),
  obl('chelyabinsk', 'Челябинская', 'Челябинск'),
  { id: 'khmao', name: 'Ханты-Мансийский автономный округ — Югра', short: 'ХМАО — Югра', type: 'автономный округ', capital: 'Ханты-Мансийск', aliases: ['ХМАО', 'Югра', 'Ханты-Мансийский АО'] },
  { id: 'yanao', name: 'Ямало-Ненецкий автономный округ', short: 'ЯНАО', type: 'автономный округ', capital: 'Салехард', aliases: ['ЯНАО', 'Ямал', 'Ямало-Ненецкий АО'] },
]

const SFO: R[] = [
  { id: 'altai-republic', name: 'Республика Алтай', short: 'Респ. Алтай', type: 'республика', capital: 'Горно-Алтайск', aliases: ['Горный Алтай'] },
  { id: 'tuva', name: 'Республика Тыва', short: 'Тыва', type: 'республика', capital: 'Кызыл', aliases: ['Тыва', 'Тува'] },
  { id: 'khakassia', name: 'Республика Хакасия', short: 'Хакасия', type: 'республика', capital: 'Абакан', aliases: ['Хакасия'] },
  { id: 'altai-krai', name: 'Алтайский край', short: 'Алтайский кр.', type: 'край', capital: 'Барнаул', aliases: ['Алтай'] },
  { id: 'krasnoyarsk', name: 'Красноярский край', short: 'Красноярский кр.', type: 'край', capital: 'Красноярск', aliases: [] },
  obl('irkutsk', 'Иркутская', 'Иркутск', ['Приангарье']),
  obl('kemerovo', 'Кемеровская', 'Кемерово', ['Кузбасс']),
  obl('novosibirsk', 'Новосибирская', 'Новосибирск'),
  obl('omsk', 'Омская', 'Омск'),
  obl('tomsk', 'Томская', 'Томск'),
]

const DFO: R[] = [
  { id: 'buryatia', name: 'Республика Бурятия', short: 'Бурятия', type: 'республика', capital: 'Улан-Удэ', aliases: ['Бурятия'] },
  { id: 'yakutia', name: 'Республика Саха (Якутия)', short: 'Якутия', type: 'республика', capital: 'Якутск', aliases: ['Якутия', 'Саха'] },
  { id: 'zabaykalsky', name: 'Забайкальский край', short: 'Забайкальский кр.', type: 'край', capital: 'Чита', aliases: ['Забайкалье'] },
  { id: 'kamchatka', name: 'Камчатский край', short: 'Камчатский кр.', type: 'край', capital: 'Петропавловск-Камчатский', aliases: ['Камчатка'] },
  { id: 'primorsky', name: 'Приморский край', short: 'Приморский кр.', type: 'край', capital: 'Владивосток', aliases: ['Приморье'] },
  { id: 'khabarovsk', name: 'Хабаровский край', short: 'Хабаровский кр.', type: 'край', capital: 'Хабаровск', aliases: [] },
  obl('amur', 'Амурская', 'Благовещенск', ['Приамурье']),
  obl('magadan', 'Магаданская', 'Магадан', ['Колыма']),
  obl('sakhalin', 'Сахалинская', 'Южно-Сахалинск', ['Сахалин']),
  { id: 'jewish', name: 'Еврейская автономная область', short: 'Еврейская АО', type: 'автономная область', capital: 'Биробиджан', aliases: ['ЕАО', 'Еврейская АО'] },
  { id: 'chukotka', name: 'Чукотский автономный округ', short: 'Чукотка', type: 'автономный округ', capital: 'Анадырь', aliases: ['Чукотка', 'ЧАО', 'Чукотский АО'] },
]

const withDistrict = (d: DistrictId, list: R[]): Region[] =>
  list.map((r) => ({ ...r, district: d, aliases: r.aliases ?? [] }))

export const REGIONS: Region[] = [
  ...withDistrict('cfo', CFO),
  ...withDistrict('szfo', SZFO),
  ...withDistrict('yufo', YUFO),
  ...withDistrict('skfo', SKFO),
  ...withDistrict('pfo', PFO),
  ...withDistrict('ufo', UFO),
  ...withDistrict('sfo', SFO),
  ...withDistrict('dfo', DFO),
]

export const REGION_BY_ID: Record<string, Region> = Object.fromEntries(REGIONS.map((r) => [r.id, r]))
export const DISTRICT_BY_ID: Record<DistrictId, District> = Object.fromEntries(
  DISTRICTS.map((d) => [d.id, d]),
) as Record<DistrictId, District>

/** Ожидаемое число субъектов по округам (для проверки скриптом). */
export const EXPECTED_COUNTS: Record<DistrictId, number> = {
  cfo: 18,
  szfo: 11,
  yufo: 12,
  skfo: 7,
  pfo: 14,
  ufo: 6,
  sfo: 10,
  dfo: 11,
}

/** Регионы, у которых спрашивают столицу (без городов федерального значения). */
export const hasCapital = (r: Region) => r.capital !== null
