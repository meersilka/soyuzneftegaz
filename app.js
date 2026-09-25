/* ============================================================
   СоюзНефтеГаз — витрина металлопроката
   Концепция B «Инженерная белизна»
   Бизнес-логика прототипа сохранена: гибрид цен, мультисклад,
   холд факт-веса, конвертация единиц, подбор по смете,
   роли и лимиты, резерв счёта 30 минут.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- 0. Утилиты ---------- */
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const nf  = new Intl.NumberFormat("ru-RU");
  const nf3 = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 });
  const fmt  = (n) => nf.format(Math.round(Number(n) || 0));
  const fmt2 = (n) => nf3.format(Number(n) || 0);
  /* 1 позиция · 2 позиции · 5 позиций */
  function plural(n, one, few, many) {
    const a = Math.abs(Number(n) || 0) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  }
  const pos = (n) => n + " " + plural(n, "позиция", "позиции", "позиций");

  function esc(s) {
    return String(s === undefined || s === null ? "" : s)
      .replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  const attr = esc;

  function store(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* приватный режим */ }
  }

  /* ---------- 1. Компания (карточка партнёра) ---------- */
  const CO = {
    brand:   "СоюзНефтеГаз",
    short:   "ООО «СоюзНефтеГаз»",
    full:    "Общество с ограниченной ответственностью «СОЮЗНЕФТЕГАЗ»",
    tagline: "Производственно-коммерческое предприятие",
    inn: "7448175704",
    kpp: "744801001",
    ogrn: "1157448001358",
    ogrnDate: "04.02.2015",
    since: 2015,
    addrLegal: "454030, Челябинская область, г. Челябинск, ул. Скульптора Головницкого, д. 32, кв. 215",
    addrFact:  "454030, Челябинская область, г. Челябинск, ул. Скульптора Головницкого, д. 32, кв. 215",
    /* Телефон, ФИО и карточка PDF скрыты на время демонстрации.
       Настоящие значения — в ЧИТАТЬ.md, раздел «Что скрыто перед публикацией». */
    ceo: "ХХХХХХХ Х. Х.",
    founder: "ХХХХХХХ Х. Х.",
    capital: "10 000 рублей",
    okpo: "32574622",
    bank: "ООО «Банк Точка»",
    rs: "40702810120000284420",
    bik: "044525104",
    ks: "30101810745374525104",
    phone: "8 ХХХ ХХХ-ХХ-ХХ",
    phoneHref: "",
    vat: "Компания работает с НДС",
    city: "Челябинск",
    pdf: ""
  };
  const YEARS = new Date().getFullYear() - CO.since;

  /* ---------- 2. Состояние ---------- */
  const state = {
    route: { name: "home", params: {}, query: new URLSearchParams() },
    wh: store("sng_wh", "MSK"),
    auth: false,
    payer: "b2b",
    cart: store("sng_cart", []),
    unit: "t",
    qty: 1,
    cutOn: false,
    packOn: false,
    ship: "pickup",
    truck: "open",
    slot: "10:00",
    reserveUntil: null,
    facetsOpen: false,
    smetaRows: null,
    role: "boss",
    lkTab: "people",
    staff: store("sng_staff", null) || [
      { id: "u1", fio: "ХХХХХХ Х. А.",    mail: "boss@example.ru",     role: "boss",    status: "active",  wh: ["MSK", "SPB", "EKB"], limit: 1800000, invoice: true,  pay: true },
      { id: "u2", fio: "ХХХХХХ Х. В.",   mail: "snab@example.ru",   role: "supply",  status: "active",  wh: ["MSK", "SPB"],        limit: 400000,  invoice: true,  pay: false },
      { id: "u3", fio: "ХХХХХХ Х. О.",    mail: "snab2@example.ru",   role: "supply",  status: "invited", wh: ["EKB"],               limit: 150000,  invoice: false, pay: false },
      { id: "u4", fio: "ХХХХХХ Х. Н.",    mail: "buh@example.ru",      role: "acc",     status: "active",  wh: ["MSK", "SPB", "EKB"], limit: 0,       invoice: false, pay: true },
      { id: "u5", fio: "ХХХХХХ Х. Д.",    mail: "prorab@example.ru",   role: "foreman", status: "active",  wh: ["MSK"],               limit: 0,       invoice: false, pay: false }
    ],
    audit: store("sng_audit", null) || [
      { t: "11.09.2026 16:40", who: "ХХХХХХ Х. А.", text: "Приглашён снабженец · лимит 400 000 ₽" },
      { t: "11.09.2026 16:51", who: "ХХХХХХ Х. А.", text: "Прорабу выдан доступ на склад Москва" }
    ]
  };

  const WH = {
    MSK: { name: "Москва · Подольск", short: "Москва", key: "stk_msk" },
    SPB: { name: "Санкт-Петербург",   short: "Санкт-Петербург", key: "stk_spb" },
    EKB: { name: "Екатеринбург",      short: "Екатеринбург", key: "stk_ekb" }
  };
  const WH_KEYS = Object.keys(WH);

  const ROLE_NAME = { boss: "Руководитель", supply: "Снабженец", acc: "Бухгалтер", foreman: "Прораб" };

  const PERMS = [
    ["price.b2b",   "Цена компании",                { supply: "Y", boss: "Y", acc: "Y", foreman: "N" }],
    ["cart.edit",   "Корзина и услуги резки",       { supply: "Y", boss: "Y", acc: "N", foreman: "N" }],
    ["smeta.run",   "Подбор по смете",              { supply: "Y", boss: "Y", acc: "N", foreman: "N" }],
    ["doc.kp",      "Скачать КП",                   { supply: "Y", boss: "Y", acc: "Y", foreman: "N" }],
    ["doc.invoice", "Счёт и резерв 30 минут",       { supply: "C", boss: "Y", acc: "Y", foreman: "N" }],
    ["doc.approve", "Согласовать черновик",         { supply: "N", boss: "Y", acc: "N", foreman: "N" }],
    ["pay.delay",   "Оплата с отсрочки",            { supply: "N", boss: "Y", acc: "C", foreman: "N" }],
    ["doc.upd",     "УПД и сверки",                 { supply: "N", boss: "Y", acc: "Y", foreman: "N" }],
    ["edo.sign",    "Подпись ЭДО",                  { supply: "N", boss: "Y", acc: "Y", foreman: "N" }],
    ["wh.choose",   "Выбор склада отгрузки",        { supply: "Y", boss: "Y", acc: "N", foreman: "N" }],
    ["order.track", "Статус отгрузки и фото",       { supply: "Y", boss: "Y", acc: "Y", foreman: "Y" }],
    ["gate.qr",     "Пропуск на склад",             { supply: "C", boss: "Y", acc: "N", foreman: "Y" }],
    ["iam.invite",  "Приглашать сотрудников",       { supply: "N", boss: "Y", acc: "N", foreman: "N" }],
    ["iam.roles",   "Менять роли и лимиты",         { supply: "N", boss: "Y", acc: "N", foreman: "N" }],
    ["credit.see",  "Видеть лимит компании",        { supply: "N", boss: "Y", acc: "Y", foreman: "N" }]
  ];

  /* ---------- 3. Бизнес-логика ---------- */
  /* Прокат — учебный набор из data.js. Арматура, фланцы и опоры — data-arm.js:
     это настоящая номенклатура из «Каталога продукции 2015», но без цен и остатков. */
  const SKU = (Array.isArray(window.DEMO_SKU) ? window.DEMO_SKU : [])
    .concat(Array.isArray(window.SNG_ARM) ? window.SNG_ARM : []);
  const byReq = (s) => !!(s && s.req);

  const stock     = (s) => Number(s[WH[state.wh].key] || 0);
  const stockAt   = (s, w) => Number(s[WH[w].key] || 0);
  const pubPrice  = (s) => Number(s.p1t || 0);
  const b2bPrice  = (s) => Math.round(pubPrice(s) * 0.94);
  const priceNow  = (s) => (state.auth ? b2bPrice(s) : pubPrice(s));
  const isScrap   = (s) => s.vat && String(s.vat).includes("161");
  const isLong    = (s) => /11\.7|МД 12/.test(String(s.mer));

  function stockKind(v) { return v <= 0 ? "out" : v < 2 ? "low" : "ok"; }
  function stockText(v) {
    if (v <= 0) return "под заказ";
    if (v < 2) return "мало · " + fmt2(v) + " т";
    return "на складе " + fmt2(v) + " т";
  }
  function statusHtml(v, s) {
    if (byReq(s)) return '<span class="status status--req">под заказ</span>';
    const k = stockKind(v);
    return '<span class="status status--' + k + '">' + esc(stockText(v)) + "</span>";
  }

  function unitOptions(s) {
    if (s.unit === "кг") return ["kg"];
    if (String(s.l2 || "").includes("Лист")) return ["t", "sheet", "m2"];
    if (String(s.mass_base || "").includes("кг/м")) return ["t", "m", "pc"];
    return ["t"];
  }
  const UNIT_NAME = { t: "Тонны", m: "Метры", pc: "Штуки 12 м", sheet: "Листы", m2: "м²", kg: "Килограммы" };

  function toTons(s, unit, qty) {
    const mass = Number(s.mass) || 0;
    const q = Number(qty) || 0;
    if (unit === "t") return q;
    if (unit === "kg") return q / 1000;
    if (unit === "m" && mass) return (q * mass) / 1000;
    if (unit === "pc" && mass) return (q * mass * 12) / 1000;
    if (unit === "sheet" && mass) return (q * mass) / 1000;
    if (unit === "m2") {
      const p = String(s.size).split("×").map(Number);
      if (p[0] && p[1] && p[2]) {
        const one = (p[1] / 1000) * (p[2] / 1000);
        return ((q / one) * mass) / 1000;
      }
    }
    return q;
  }

  function coilRound(s, tons) {
    if (!String(s.pack).includes("бухта")) return tons;
    const m = String(s.pack).match(/([\d.]+)/);
    const coil = m ? Number(m[1]) : 1.25;
    return Math.max(coil, Math.ceil(tons / coil) * coil);
  }

  function cartRows() {
    return state.cart
      .map((l) => {
        const s = SKU.find((x) => x.id === l.id);
        return s ? { s: s, tons: Number(l.tons) || 0 } : null;
      })
      .filter(Boolean);
  }
  function cartSum(rows) { return rows.reduce((a, r) => a + priceNow(r.s) * r.tons, 0); }
  function cartHold(rows) { return rows.reduce((a, r) => a + priceNow(r.s) * r.tons * Number(r.s.hold || 0.08), 0); }
  function servicesSum() { return (state.cutOn ? 450 : 0) + (state.packOn ? 250 : 0); }

  function addToCart(id, tons) {
    const s = SKU.find((x) => x.id === id);
    if (!s) return;
    const exist = state.cart.find((l) => l.id === id);
    if (exist) exist.tons = Number(exist.tons) + Number(tons || 1);
    else state.cart.push({ id: id, tons: Number(tons || 1) });
    save("sng_cart", state.cart);
    toast("Добавлено: " + s.name, "ok");
    syncCartCount();
  }
  function removeFromCart(id) {
    state.cart = state.cart.filter((l) => l.id !== id);
    save("sng_cart", state.cart);
    syncCartCount();
  }
  function syncCartCount() {
    const n = state.cart.length;
    $$("[data-cart-count]").forEach((el) => { el.textContent = n; });
  }

  /* Пока телефон скрыт, кнопки звонка ведут на страницу контактов,
     чтобы не было нерабочих ссылок tel: */
  const TEL = CO.phoneHref ? "tel:" + CO.phoneHref : "#/contacts";

  function saveIam() { save("sng_staff", state.staff); save("sng_audit", state.audit); }
  const canIam = () => state.role === "boss";
  function logIam(text) {
    const t = new Date().toLocaleString("ru-RU", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
    state.audit.unshift({ t: t, who: "ХХХХХХ Х. А.", text: text });
    saveIam();
  }

  function mmss(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  }

  /* ---------- 4. Графика ---------- */
  const C_LINE = "#0091D0";
  const C_DIM  = "#7D8B96";

  function svgWrap(inner, vb) {
    return '<svg viewBox="' + (vb || "0 0 220 150") + '" role="img" aria-hidden="true" focusable="false" ' +
      'fill="none" stroke-linecap="round" stroke-linejoin="round">' + inner + "</svg>";
  }

  /* поперечное сечение по типу проката */
  function profileSvg(s) {
    const t = String(s.l2 || "");
    const cx = 110, cy = 72;
    const g = 'stroke="' + C_LINE + '" stroke-width="2"';
    const gf = 'fill="rgba(0,145,208,.08)" stroke="' + C_LINE + '" stroke-width="2"';
    const dim = 'stroke="' + C_DIM + '" stroke-width="1" stroke-dasharray="3 3"';
    let body = "";

    if (/Труба/.test(t)) {
      body =
        '<circle cx="' + cx + '" cy="' + cy + '" r="46" ' + gf + "/>" +
        '<circle cx="' + cx + '" cy="' + cy + '" r="34" fill="#fff" stroke="' + C_LINE + '" stroke-width="2"/>' +
        '<line x1="' + (cx - 46) + '" y1="' + cy + '" x2="' + (cx + 46) + '" y2="' + cy + '" ' + dim + "/>";
    } else if (/Арматура/.test(t)) {
      body =
        '<circle cx="' + cx + '" cy="' + cy + '" r="42" ' + gf + "/>" +
        '<path d="M' + (cx - 30) + ' ' + (cy - 26) + ' l60 12 M' + (cx - 34) + ' ' + (cy - 6) + ' l68 12 M' + (cx - 30) + ' ' + (cy + 16) + ' l60 12" stroke="' + C_LINE + '" stroke-width="2" opacity=".55"/>' +
        '<line x1="' + (cx - 42) + '" y1="' + cy + '" x2="' + (cx + 42) + '" y2="' + cy + '" ' + dim + "/>";
    } else if (/Круг|Катанка|Вольфрам|Молибден|Тантал|Нихром|Инструментальная/.test(t)) {
      body =
        '<circle cx="' + cx + '" cy="' + cy + '" r="42" ' + gf + "/>" +
        '<line x1="' + (cx - 42) + '" y1="' + cy + '" x2="' + (cx + 42) + '" y2="' + cy + '" ' + dim + "/>";
    } else if (/Швеллер/.test(t)) {
      body = '<path d="M64 26 h40 v12 h-28 v68 h28 v12 h-40 z" ' + gf + "/>";
    } else if (/Балка/.test(t)) {
      body = '<path d="M62 26 h96 v12 h-42 v68 h42 v12 h-96 v-12 h42 v-68 h-42 z" ' + gf + "/>";
    } else if (/Уголок/.test(t)) {
      body = '<path d="M64 26 h14 v80 h72 v14 h-86 z" ' + gf + "/>";
    } else if (/Шестигранник/.test(t)) {
      body = '<path d="M110 28 l38 22 v44 l-38 22 -38-22 v-44 z" ' + gf + "/>";
    } else if (/Лист|Полоса|Шина/.test(t)) {
      body =
        '<path d="M42 58 h136 v30 h-136 z" ' + gf + "/>" +
        '<path d="M42 58 l16-14 h136 l-16 14" fill="rgba(0,145,208,.04)" stroke="' + C_LINE + '" stroke-width="2"/>' +
        '<path d="M178 58 l16-14 v30 l-16 14" fill="rgba(0,145,208,.04)" stroke="' + C_LINE + '" stroke-width="2"/>';
    } else if (/шаров/i.test(t)) {
      const flanged = /фланц/i.test(t);
      const under = /подземн/i.test(t);
      const ends = flanged
        ? '<rect x="58" y="42" width="14" height="60" rx="2" ' + gf + '/><rect x="148" y="42" width="14" height="60" rx="2" ' + gf + "/>"
        : '<rect x="52" y="58" width="24" height="28" rx="2" ' + gf + '/><rect x="144" y="58" width="24" height="28" rx="2" ' + gf + "/>";
      body =
        '<rect x="76" y="50" width="68" height="44" rx="8" ' + gf + "/>" + ends +
        '<circle cx="110" cy="72" r="16" fill="#fff" stroke="' + C_LINE + '" stroke-width="2"/>' +
        '<line x1="94" y1="72" x2="126" y2="72" ' + dim + "/>" +
        '<line x1="110" y1="50" x2="110" y2="' + (under ? 16 : 30) + '" ' + g + "/>" +
        (under
          ? '<path d="M96 16 h28" ' + g + "/>"
          : '<path d="M110 30 h46" ' + g + '/><circle cx="156" cy="30" r="3.5" ' + gf + "/>");
    } else if (/Клапан/.test(t)) {
      body =
        '<rect x="84" y="34" width="52" height="74" rx="6" ' + gf + "/>" +
        '<path d="M96 78 h28 l-14 -20 z" fill="#fff" stroke="' + C_LINE + '" stroke-width="2"/>' +
        '<line x1="110" y1="58" x2="110" y2="28" ' + g + "/>" +
        '<path d="M100 28 h20" ' + g + "/>" +
        '<line x1="84" y1="96" x2="136" y2="96" ' + dim + "/>";
    } else if (/Изолирующ/.test(t)) {
      body =
        '<rect x="66" y="44" width="14" height="56" rx="2" ' + gf + "/>" +
        '<rect x="140" y="44" width="14" height="56" rx="2" ' + gf + "/>" +
        '<rect x="82" y="58" width="56" height="28" rx="2" fill="#fff" stroke="' + C_LINE + '" stroke-width="2" stroke-dasharray="5 4"/>' +
        '<line x1="66" y1="72" x2="154" y2="72" ' + dim + "/>";
    } else if (/Фланц/.test(t)) {
      body =
        '<rect x="70" y="38" width="16" height="68" rx="2" ' + gf + "/>" +
        '<circle cx="78" cy="50" r="3.4" ' + g + '/><circle cx="78" cy="94" r="3.4" ' + g + "/>" +
        '<rect x="86" y="58" width="62" height="28" rx="2" ' + gf + "/>" +
        '<line x1="70" y1="72" x2="148" y2="72" ' + dim + "/>";
    } else if (/Отвод/.test(t)) {
      const d = "M58 104 h30 a44 44 0 0 0 44 -44 v-18";
      body = '<path d="' + d + '" stroke="' + C_LINE + '" stroke-width="18" fill="none" opacity=".15"/>' +
        '<path d="' + d + '" ' + g + "/>";
    } else if (/Тройник/.test(t)) {
      const d = "M56 88 h108 M110 88 v-42";
      body = '<path d="' + d + '" stroke="' + C_LINE + '" stroke-width="18" fill="none" opacity=".15"/>' +
        '<path d="' + d + '" ' + g + "/>";
    } else if (/Угольник/.test(t)) {
      const d = "M64 106 v-48 h46";
      body = '<path d="' + d + '" stroke="' + C_LINE + '" stroke-width="18" fill="none" opacity=".15"/>' +
        '<path d="' + d + '" ' + g + "/>";
    } else if (/Переход/.test(t)) {
      body = '<path d="M56 50 h38 l30 14 h34 v16 h-34 l-30 14 h-38 z" ' + gf + "/>" +
        '<line x1="56" y1="72" x2="158" y2="72" ' + dim + "/>";
    } else if (/Прокладк/.test(t)) {
      body = '<circle cx="110" cy="72" r="40" ' + gf + "/>" +
        '<circle cx="110" cy="72" r="26" fill="#fff" stroke="' + C_LINE + '" stroke-width="2"/>' +
        '<line x1="70" y1="72" x2="150" y2="72" ' + dim + "/>";
    } else if (/Заглушк/.test(t)) {
      body = '<circle cx="94" cy="72" r="30" ' + gf + "/>" +
        '<circle cx="152" cy="72" r="18" fill="none" stroke="' + C_LINE + '" stroke-width="2" opacity=".5"/>' +
        '<path d="M124 72 h10 M152 54 v-14" ' + g + "/>";
    } else if (/Опор/.test(t)) {
      body = '<path d="M48 60 h124" stroke="' + C_LINE + '" stroke-width="22" opacity=".15"/>' +
        '<path d="M48 60 h124" ' + g + "/>" +
        '<path d="M88 72 h44 v22 h-44 z" ' + gf + "/>" +
        '<path d="M58 104 h104" ' + g + "/>";
    } else if (/лом|Некондиция/i.test(t)) {
      body =
        '<path d="M52 96 h40 l14-26 h34 l10 26 h30" ' + g + "/>" +
        '<rect x="70" y="44" width="34" height="22" rx="2" ' + gf + "/>" +
        '<rect x="116" y="52" width="46" height="16" rx="2" ' + gf + "/>";
    } else {
      body = '<rect x="58" y="42" width="104" height="60" rx="4" ' + gf + "/>";
    }

    const label =
      '<text x="110" y="136" text-anchor="middle" font-family="JetBrains Mono, monospace" ' +
      'font-size="11" letter-spacing="1.4" fill="' + C_DIM + '">' + esc(s.size || "") + "</text>";
    return svgWrap(body + label);
  }

  /* иконки групп каталога */
  function groupArt(name) {
    const g = 'fill="none" stroke="currentColor" stroke-width="2.2"';
    const soft = 'fill="rgba(0,145,208,.08)" stroke="currentColor" stroke-width="2.2"';
    let inner;
    if (/Нержавейка/.test(name)) {
      inner = '<circle cx="34" cy="34" r="22" ' + soft + '/><circle cx="34" cy="34" r="13" ' + g + '/><path d="M18 18 l32 32" ' + g + ' opacity=".4"/>';
    } else if (/Цветной/.test(name)) {
      inner = '<rect x="10" y="30" width="48" height="14" rx="2" ' + soft + '/><rect x="18" y="14" width="32" height="12" rx="2" ' + g + "/>";
    } else if (/Спецстали/.test(name)) {
      inner = '<path d="M34 8 l22 13 v26 l-22 13 -22-13 v-26 z" ' + soft + '/><path d="M34 22 v24" ' + g + "/>";
    } else if (/арматура/i.test(name)) {
      inner = '<rect x="22" y="26" width="24" height="17" rx="4" ' + soft + "/>" +
        '<rect x="8" y="22" width="8" height="25" rx="1.5" ' + g + "/>" +
        '<rect x="52" y="22" width="8" height="25" rx="1.5" ' + g + "/>" +
        '<path d="M34 26 v-12 h16" ' + g + "/>";
    } else if (/Фланцы|фасонн/i.test(name)) {
      inner = '<path d="M10 56 h14 a24 24 0 0 0 24 -24 v-10" ' + g + "/>" +
        '<rect x="40" y="6" width="16" height="8" rx="1.5" ' + soft + "/>";
    } else if (/Опор|заглушк/i.test(name)) {
      inner = '<path d="M8 26 h52" ' + g + "/>" +
        '<path d="M24 32 h20 v12 h-20 z" ' + soft + "/>" +
        '<path d="M14 54 h40" ' + g + "/>";
    } else if (/лом|остатки/i.test(name)) {
      inner = '<path d="M8 50 h18 l10-18 h16 l8 18 h4" ' + g + '/><rect x="16" y="16" width="20" height="12" rx="2" ' + soft + "/>";
    } else {
      inner = '<path d="M10 10 h44 v9 h-17 v34 h17 v9 h-44 v-9 h17 v-34 h-17 z" ' + soft + "/>";
    }
    return '<svg viewBox="0 0 68 68" aria-hidden="true" focusable="false">' + inner + "</svg>";
  }

  /* ---------- 4б. Объёмная сборка изделия ----------
     Свой маленький рендерер на canvas: без внешних библиотек,
     чтобы сайт по-прежнему работал без интернета и открывался файлом.
     Модель не просто вращается — детали прилетают по очереди и собираются
     в изделие, а свежий срез металла остывает с оранжевого до синего. */

  const SHAPES = [
    ["valve",  "Кран",   "Кран шаровой фланцевый в сборе"],
    ["elbow",  "Отвод",  "Отвод 90° с фланцами"],
    ["flange", "Фланец", "Фланец с крепёжными болтами"],
    ["bolt",   "Крепёж", "Болт с шайбой и гайкой"],
    ["beam",   "Двутавр", "Балка двутавровая"]
  ];
  let heroShape = "valve";
  let heroViewer = null;

  function heroViewerHtml() {
    const cur = SHAPES.filter(function (s) { return s[0] === heroShape; })[0] || SHAPES[0];
    return (
      '<figure class="hero__figure viewer" style="margin:0">' +
        '<div class="viewer__stage">' +
          '<canvas class="viewer__canvas" id="heroCanvas" tabindex="0" role="img" ' +
            'aria-label="Объёмная модель: ' + attr(cur[2]) + '. Потяните мышью или стрелками, чтобы повернуть"></canvas>' +
          '<span class="viewer__hint" id="heroHint">Потяните, чтобы повернуть</span>' +
        "</div>" +
        '<div class="segmented viewer__tabs" role="group" aria-label="Какое изделие показать">' +
          SHAPES.map(function (s) {
            return '<button type="button" data-shape="' + attr(s[0]) + '" aria-pressed="' +
              (s[0] === heroShape ? "true" : "false") + '">' + esc(s[1]) + "</button>";
          }).join("") +
        "</div>" +
        '<figcaption class="hero__figcap">' +
          '<span class="eyebrow" id="heroCap">' + esc(cur[2]) + "</span>" +
          '<span class="eyebrow">' + esc(pos(SKU.length)) + " в каталоге</span>" +
        "</figcaption>" +
      "</figure>"
    );
  }

  /* ---- примитивы: всё собирается из четырёх- и многоугольных граней ---- */

  const TAU = Math.PI * 2;

  /* прямоугольный брусок */
  function boxFaces(x0, y0, z0, x1, y1, z1) {
    const p = [
      [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
      [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]
    ];
    return [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [4, 5, 1, 0], [3, 2, 6, 7]]
      .map(function (f) { return { v: f.map(function (k) { return p[k]; }), soft: false }; });
  }

  /* труба или сплошной цилиндр вдоль оси Z; r = 0 — сплошной */
  function tubeFaces(R, r, z0, z1, N) {
    const f = [];
    const co = [], ci = [];
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * TAU;
      co.push([R * Math.cos(a), R * Math.sin(a)]);
      ci.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    for (let i = 0; i < N; i++) {
      const A = co[i], B = co[i + 1];
      f.push({ v: [[A[0], A[1], z0], [B[0], B[1], z0], [B[0], B[1], z1], [A[0], A[1], z1]], soft: true });
      if (r > 0) {
        const a = ci[i], b = ci[i + 1];
        f.push({ v: [[b[0], b[1], z0], [a[0], a[1], z0], [a[0], a[1], z1], [b[0], b[1], z1]], soft: true });
        f.push({ v: [[A[0], A[1], z0], [a[0], a[1], z0], [b[0], b[1], z0], [B[0], B[1], z0]], soft: true });
        f.push({ v: [[A[0], A[1], z1], [B[0], B[1], z1], [b[0], b[1], z1], [a[0], a[1], z1]], soft: true });
      } else {
        f.push({ v: [[0, 0, z0], [B[0], B[1], z0], [A[0], A[1], z0]], soft: true });
        f.push({ v: [[0, 0, z1], [A[0], A[1], z1], [B[0], B[1], z1]], soft: true });
      }
    }
    return f;
  }

  /* правильная призма вдоль Z — головка болта, гайка */
  function prismFaces(R, sides, z0, z1) {
    const f = [], p = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * TAU + Math.PI / sides;
      p.push([R * Math.cos(a), R * Math.sin(a)]);
    }
    for (let i = 0; i < sides; i++) {
      const A = p[i], B = p[(i + 1) % sides];
      f.push({ v: [[A[0], A[1], z0], [B[0], B[1], z0], [B[0], B[1], z1], [A[0], A[1], z1]], soft: false });
    }
    f.push({ v: p.map(function (q) { return [q[0], q[1], z1]; }), soft: false });
    f.push({ v: p.slice().reverse().map(function (q) { return [q[0], q[1], z0]; }), soft: false });
    return f;
  }

  /* шар запорного элемента */
  function ballFaces(R, NU, NV) {
    const f = [];
    for (let i = 0; i < NV; i++) {
      const t0 = (i / NV) * Math.PI, t1 = ((i + 1) / NV) * Math.PI;
      for (let j = 0; j < NU; j++) {
        const a0 = (j / NU) * TAU, a1 = ((j + 1) / NU) * TAU;
        const P = function (t, a) {
          return [R * Math.sin(t) * Math.cos(a), R * Math.cos(t), R * Math.sin(t) * Math.sin(a)];
        };
        f.push({ v: [P(t0, a0), P(t0, a1), P(t1, a1), P(t1, a0)], soft: true });
      }
    }
    return f;
  }

  /* дуга трубы в плоскости XY — отвод */
  function arcTubeFaces(bendR, R, r, a0, a1, NA, NC) {
    const f = [];
    const pt = function (a, phi, rad) {
      const u = [Math.cos(a), Math.sin(a), 0];
      return [
        bendR * u[0] + rad * Math.cos(phi) * u[0],
        bendR * u[1] + rad * Math.cos(phi) * u[1],
        rad * Math.sin(phi)
      ];
    };
    for (let i = 0; i < NA; i++) {
      const A = a0 + (a1 - a0) * (i / NA), B = a0 + (a1 - a0) * ((i + 1) / NA);
      for (let j = 0; j < NC; j++) {
        const p0 = (j / NC) * TAU, p1 = ((j + 1) / NC) * TAU;
        f.push({ v: [pt(A, p0, R), pt(B, p0, R), pt(B, p1, R), pt(A, p1, R)], soft: true });
        f.push({ v: [pt(A, p1, r), pt(B, p1, r), pt(B, p0, r), pt(A, p0, r)], soft: true });
      }
    }
    for (let j = 0; j < NC; j++) {
      const p0 = (j / NC) * TAU, p1 = ((j + 1) / NC) * TAU;
      f.push({ v: [pt(a0, p0, R), pt(a0, p1, R), pt(a0, p1, r), pt(a0, p0, r)], soft: true });
      f.push({ v: [pt(a1, p0, r), pt(a1, p1, r), pt(a1, p1, R), pt(a1, p0, R)], soft: true });
    }
    return f;
  }

  /* ---- преобразования готовых наборов граней ---- */

  function mapPts(faces, fn) {
    return faces.map(function (f) { return { v: f.v.map(fn), soft: f.soft }; });
  }
  function moveF(faces, dx, dy, dz) {
    return mapPts(faces, function (p) { return [p[0] + dx, p[1] + dy, p[2] + dz]; });
  }
  /* поворот заготовки, построенной вдоль Z, на другую ось */
  function alongX(faces) { return mapPts(faces, function (p) { return [p[2], p[1], -p[0]]; }); }
  function alongY(faces) { return mapPts(faces, function (p) { return [p[0], p[2], -p[1]]; }); }

  /* деталь сборки: откуда прилетает, когда и с каким доворотом */
  function part(faces, from, t0, t1, rot, pivot, axis) {
    return {
      faces: faces, from: from || [0, 0, 0], t0: t0, t1: t1,
      rot: rot || 0, pivot: pivot || [0, 0, 0], axis: axis || "z"
    };
  }

  function buildShape(kind) {
    if (kind === "elbow") {
      const B = 152, R = 46, r = 31, NC = 14;
      const seg = [];
      for (let i = 0; i < 4; i++) {
        const a0 = (Math.PI / 2) * (i / 4), a1 = (Math.PI / 2) * ((i + 1) / 4);
        seg.push(part(arcTubeFaces(B, R, r, a0, a1, 4, NC),
          [0, 0, 210], 0.02 + i * 0.12, 0.26 + i * 0.12));
      }
      return seg.concat([
        part(moveF(alongY(tubeFaces(R, r, 0, 62, NC)), B, -62, 0), [0, -250, 0], 0.50, 0.72),
        part(moveF(alongX(tubeFaces(R, r, 0, 62, NC)), -62, B, 0), [-250, 0, 0], 0.56, 0.78),
        part(moveF(alongY(tubeFaces(84, r, 0, 24, 20)), B, -86, 0), [0, -300, 0], 0.70, 0.90),
        part(moveF(alongX(tubeFaces(84, r, 0, 24, 20)), -86, B, 0), [-300, 0, 0], 0.78, 1.00)
      ]);
    }

    if (kind === "flange") {
      const list = [
        part(tubeFaces(126, 46, -18, 18, 22), [0, 0, 300], 0.00, 0.26),
        part(tubeFaces(76, 46, 18, 56, 20), [0, 0, 240], 0.18, 0.42),
        part(tubeFaces(60, 46, 56, 92, 20), [0, 0, 220], 0.28, 0.52)
      ];
      const NB = 8;
      for (let i = 0; i < NB; i++) {
        const a = (i / NB) * TAU + Math.PI / NB;
        const x = 96 * Math.cos(a), y = 96 * Math.sin(a);
        const bolt = moveF(tubeFaces(11, 0, -40, 34, 10), x, y, 0)
          .concat(moveF(prismFaces(19, 6, 34, 54), x, y, 0));
        list.push(part(bolt, [0, 0, 200], 0.44 + i * 0.05, 0.64 + i * 0.05, -2.4, [x, y, 0]));
      }
      return list;
    }

    if (kind === "bolt") {
      return [
        part(alongX(tubeFaces(27, 0, -160, 116, 18)), [-300, 0, 0], 0.00, 0.26),
        part(alongX(prismFaces(54, 6, 116, 176)), [300, 0, 0], 0.18, 0.44),
        part(alongX(tubeFaces(64, 29, -106, -86, 20)), [-300, 0, 0], 0.40, 0.64),
        part(alongX(prismFaces(52, 6, -86, -34)), [-330, 0, 0], 0.60, 1.00, -6.3, [0, 0, 0], "x")
      ];
    }

    if (kind === "beam") {
      const L = 150;
      return [
        part(boxFaces(-6, -86, -L, 6, 86, L), [0, 0, 240], 0.00, 0.30),
        part(boxFaces(-56, 86, -L, 56, 100, L), [0, 230, 0], 0.22, 0.56),
        part(boxFaces(-56, -100, -L, 56, -86, L), [0, -230, 0], 0.40, 0.76)
      ];
    }

    /* кран шаровой фланцевый — по умолчанию */
    const NP = 20;
    return [
      part(ballFaces(60, 12, 8), [0, 250, 0], 0.00, 0.22),
      part(alongX(tubeFaces(78, 0, -92, 92, 22)), [0, 0, 260], 0.14, 0.40),
      part(alongX(tubeFaces(48, 31, -156, -92, NP)), [-280, 0, 0], 0.30, 0.54),
      part(alongX(tubeFaces(48, 31, 92, 156, NP)), [280, 0, 0], 0.30, 0.54),
      part(alongX(tubeFaces(92, 31, -176, -156, NP)), [-330, 0, 0], 0.46, 0.70),
      part(alongX(tubeFaces(92, 31, 156, 176, NP)), [330, 0, 0], 0.46, 0.70),
      part(alongY(tubeFaces(17, 0, 66, 140, 14)), [0, 280, 0], 0.60, 0.80),
      part(
        boxFaces(-14, 140, -15, 150, 162, 15).concat(moveF(alongX(tubeFaces(19, 0, -10, 10, 12)), 150, 151, 0)),
        [0, 120, 0], 0.74, 1.00, -1.15, [0, 140, 0]
      )
    ];
  }

  function initHeroViewer() {
    const canvas = document.getElementById("heroCanvas");
    if (!canvas || !canvas.getContext) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const hint = document.getElementById("heroHint");
    const cap = document.getElementById("heroCap");
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const LIGHT = (function () {
      const v = [-0.34, 0.60, 0.72], m = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
      return [v[0] / m, v[1] / m, v[2] / m];
    })();
    const DARK = [0, 88, 132], BASE = [0, 145, 208], LITE = [122, 210, 246];
    const HOT = [231, 128, 52];
    const mixc = function (c1, c2, t) {
      return [
        Math.round(c1[0] + (c2[0] - c1[0]) * t),
        Math.round(c1[1] + (c2[1] - c1[1]) * t),
        Math.round(c1[2] + (c2[2] - c1[2]) * t)
      ];
    };
    const rgb = function (c) { return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")"; };
    const tone = function (t, hot) {
      let c = t < 0.5 ? mixc(DARK, BASE, t * 2) : mixc(BASE, LITE, (t - 0.5) * 2);
      if (hot > 0) c = mixc(c, HOT, hot * 0.92);
      return rgb(c);
    };

    const ASM_MS = 2800;
    let parts = buildShape(heroShape);
    let asmFrom = 0, asm = reduce ? 1 : 0;
    let modelR = 1;

    function measure() {
      modelR = 1;
      parts.forEach(function (pt) {
        pt.faces.forEach(function (f) {
          f.v.forEach(function (p) {
            const d = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
            if (d > modelR) modelR = d;
          });
        });
      });
    }
    measure();

    /* у каждого изделия свой стартовый ракурс — так форма читается лучше всего */
    const START = {
      valve:  [-0.30, 0.58],
      elbow:  [-0.30, 0.40],
      flange: [-0.40, 0.66],
      bolt:   [-0.34, 0.52],
      beam:   [-0.34, 0.62]
    };
    const startAngles = function () { return START[heroShape] || START.valve; };
    let rotX = startAngles()[0], rotY = startAngles()[1];
    let auto = !reduce, dragging = false, touched = false;
    let lastX = 0, lastY = 0, raf = 0, w = 0, h = 0, dpr = 1;
    let visible = true, alive = true, needs = true;

    function restart() {
      asm = reduce ? 1 : 0;
      asmFrom = (window.performance && performance.now) ? performance.now() : Date.now();
      needs = true;
    }
    restart();

    function resize() {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      needs = true;
    }

    const easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };

    function draw() {
      ctx.clearRect(0, 0, w, h);
      if (w < 8 || h < 8) return;

      const cam = 760, focal = 680;
      const scale = (Math.min(w, h) * 0.42) / (modelR * (focal / cam));
      const ox = w / 2, oy = h / 2;
      const cx = Math.cos(rotX), sx = Math.sin(rotX);
      const cy = Math.cos(rotY), sy = Math.sin(rotY);

      const sh = ctx.createRadialGradient(ox, h * 0.9, 1, ox, h * 0.9, Math.min(w, h) * 0.42);
      sh.addColorStop(0, "rgba(17,26,32,.16)");
      sh.addColorStop(1, "rgba(17,26,32,0)");
      ctx.fillStyle = sh;
      ctx.beginPath();
      ctx.ellipse(ox, h * 0.9, Math.min(w, h) * 0.40, Math.min(w, h) * 0.072, 0, 0, Math.PI * 2);
      ctx.fill();

      const list = [];
      for (let n = 0; n < parts.length; n++) {
        const pt = parts[n];
        const raw = pt.t1 > pt.t0 ? (asm - pt.t0) / (pt.t1 - pt.t0) : 1;
        const p = Math.max(0, Math.min(1, raw));
        if (p <= 0) continue;
        const e = easeOut(p);
        const k = 1 - e;                       /* 1 — деталь ещё в полёте, 0 — на месте */
        const alpha = Math.min(1, p * 4);
        const hot = Math.pow(1 - p, 1.5);      /* свежий срез остывает */
        const ca = Math.cos(pt.rot * k), sa = Math.sin(pt.rot * k);
        const ax = pt.axis;

        for (let i = 0; i < pt.faces.length; i++) {
          const src = pt.faces[i].v, pts = [];
          let zs = 0;
          for (let j = 0; j < src.length; j++) {
            let X = src[j][0], Y = src[j][1], Z = src[j][2];
            if (pt.rot) {
              if (ax === "x") {
                const dy = Y - pt.pivot[1], dz = Z - pt.pivot[2];
                Y = pt.pivot[1] + dy * ca - dz * sa;
                Z = pt.pivot[2] + dy * sa + dz * ca;
              } else if (ax === "y") {
                const dz = Z - pt.pivot[2], dx2 = X - pt.pivot[0];
                Z = pt.pivot[2] + dz * ca - dx2 * sa;
                X = pt.pivot[0] + dz * sa + dx2 * ca;
              } else {
                const dx = X - pt.pivot[0], dy = Y - pt.pivot[1];
                X = pt.pivot[0] + dx * ca - dy * sa;
                Y = pt.pivot[1] + dx * sa + dy * ca;
              }
            }
            X += pt.from[0] * k; Y += pt.from[1] * k; Z += pt.from[2] * k;
            const x1 = X * cy + Z * sy;
            const z1 = -X * sy + Z * cy;
            const y2 = Y * cx - z1 * sx;
            const z2 = Y * sx + z1 * cx;
            pts.push([x1, y2, z2]);
            zs += z2;
          }
          list.push({ pts: pts, z: zs / src.length, soft: pt.faces[i].soft, a: alpha, hot: hot });
        }
      }
      list.sort(function (p, q) { return p.z - q.z; });

      ctx.lineJoin = "round";
      for (let i = 0; i < list.length; i++) {
        const it = list[i], pts = it.pts;
        const ax = pts[1][0] - pts[0][0], ay = pts[1][1] - pts[0][1], az = pts[1][2] - pts[0][2];
        const bx = pts[2][0] - pts[0][0], by = pts[2][1] - pts[0][1], bz = pts[2][2] - pts[0][2];
        let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
        const nm = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        nx /= nm; ny /= nm; nz /= nm;
        if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
        const dot = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);

        ctx.globalAlpha = it.a;
        ctx.beginPath();
        for (let j = 0; j < pts.length; j++) {
          const p = pts[j];
          const k = focal / (cam - p[2]);
          const X = ox + p[0] * k * scale;
          const Y = oy - p[1] * k * scale;
          if (j === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
        }
        ctx.closePath();
        const fill = tone(0.14 + 0.86 * dot, it.hot);
        ctx.fillStyle = fill;
        ctx.fill();
        /* на круглых поверхностях обводим цветом заливки — иначе видны швы сегментов */
        ctx.lineWidth = it.hot > 0.04 ? 1.6 : 1;
        ctx.strokeStyle = it.hot > 0.04
          ? rgb(mixc([11, 16, 20], HOT, Math.min(1, it.hot + 0.35)))
          : (it.soft ? fill : "rgba(11,16,20,.20)");
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    function loop() {
      if (!alive) return;
      const on = visible && !document.hidden;
      if (on && asm < 1) {
        const now = (window.performance && performance.now) ? performance.now() : Date.now();
        asm = Math.min(1, (now - asmFrom) / ASM_MS);
        needs = true;
      }
      if (auto && on) { rotY += 0.0042; needs = true; }
      if (needs && on) { draw(); needs = false; }
      raf = requestAnimationFrame(loop);
    }

    function stopAuto() {
      if (!touched) {
        touched = true;
        auto = false;
        if (hint) hint.hidden = true;
      }
    }

    /* Перетаскивание слушаем на окне: так вращение не обрывается,
       если курсор или палец ушёл за пределы модели. */
    function onMove(e) {
      if (!dragging) return;
      rotY += (e.clientX - lastX) * 0.009;
      rotX += (e.clientY - lastY) * 0.007;
      rotX = Math.max(-1.25, Math.min(1.25, rotX));
      lastX = e.clientX; lastY = e.clientY;
      needs = true;
      if (e.cancelable) e.preventDefault();
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    }
    function onDown(e) {
      dragging = true;
      stopAuto();
      lastX = e.clientX; lastY = e.clientY;
      window.addEventListener("pointermove", onMove, { passive: false });
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    }

    function onKey(e) {
      const step = 0.16;
      if (e.key === "ArrowLeft") rotY -= step;
      else if (e.key === "ArrowRight") rotY += step;
      else if (e.key === "ArrowUp") rotX = Math.max(-1.25, rotX - step);
      else if (e.key === "ArrowDown") rotX = Math.min(1.25, rotX + step);
      else if (e.key === "Enter" || e.key === " ") { restart(); e.preventDefault(); return; }
      else return;
      e.preventDefault();
      stopAuto();
      needs = true;
    }

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("keydown", onKey);

    let ro = null;
    if ("ResizeObserver" in window) {
      ro = new ResizeObserver(resize);
      ro.observe(canvas);
    } else window.addEventListener("resize", resize);

    let io = null;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) needs = true;
      }, { threshold: 0.05 });
      io.observe(canvas);
    }

    $$("[data-shape]").forEach(function (b) {
      b.addEventListener("click", function () {
        /* повторное нажатие на активную вкладку пересобирает изделие заново */
        heroShape = b.dataset.shape;
        parts = buildShape(heroShape);
        measure();
        rotX = startAngles()[0]; rotY = startAngles()[1];
        restart();
        $$("[data-shape]").forEach(function (x) {
          x.setAttribute("aria-pressed", x.dataset.shape === heroShape ? "true" : "false");
        });
        const cur = SHAPES.filter(function (s) { return s[0] === heroShape; })[0];
        if (cap && cur) cap.textContent = cur[2];
        if (cur) canvas.setAttribute("aria-label",
          "Объёмная модель: " + cur[2] + ". Потяните мышью или стрелками, чтобы повернуть");
      });
    });

    resize();
    loop();

    return {
      destroy: function () {
        alive = false;
        if (raf) cancelAnimationFrame(raf);
        if (ro) ro.disconnect(); else window.removeEventListener("resize", resize);
        if (io) io.disconnect();
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("keydown", onKey);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      }
    };
  }

  function icon(name) {
    const a = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
    const paths = {
      cart: '<path d="M3 4h2l2.4 10.2a1.6 1.6 0 0 0 1.6 1.3h7.6a1.6 1.6 0 0 0 1.6-1.3L20 7H6" ' + a + '/><circle cx="9.5" cy="19" r="1.3" fill="currentColor"/><circle cx="17" cy="19" r="1.3" fill="currentColor"/>',
      menu: '<path d="M3 6h18M3 12h18M3 18h18" ' + a + "/>",
      close: '<path d="M6 6l12 12M18 6L6 18" ' + a + "/>",
      search: '<circle cx="11" cy="11" r="6.5" ' + a + '/><path d="M16 16l4.5 4.5" ' + a + "/>",
      phone: '<path d="M6 3h3l1.6 4-2 1.4a12 12 0 0 0 5.9 5.9l1.4-2 4 1.6v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4 6.2 2 2 0 0 1 6 4z" ' + a + "/>",
      doc: '<path d="M6 3h8l4 4v14H6z" ' + a + '/><path d="M14 3v4h4M9 12h6M9 16h6" ' + a + "/>"
    };
    return '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (paths[name] || "") + "</svg>";
  }

  /* ---------- 5. Тосты ---------- */
  function toast(text, kind) {
    const host = $("#toastHost");
    if (!host) return;
    const el = document.createElement("div");
    el.className = "toast" + (kind === "ok" ? " toast--ok" : "");
    el.textContent = text;
    host.appendChild(el);
    setTimeout(function () { el.remove(); }, 4200);
  }

  /* ---------- 6. Навигация и общие блоки ---------- */
  const NAV = [
    ["/", "Главная"],
    ["/catalog", "Каталог"],
    ["/smeta", "Подбор по смете"],
    ["/calc", "Калькулятор массы"],
    ["/delivery", "Доставка и оплата"],
    ["/about", "О компании"],
    ["/contacts", "Контакты"],
    ["/account", "Кабинет"]
  ];

  function isCurrent(path) {
    const cur = "/" + (state.route.name === "home" ? "" : state.route.name);
    if (path === "/catalog") return cur === "/catalog" || cur === "/product";
    return cur === path;
  }

  function header() {
    return (
      '<div class="notice-bar"><div class="container">' +
        "<span>Демонстрационная версия. Каталог, остатки, цены и список складов — учебный набор данных. " +
        "Телефон и имена скрыты. Реквизиты компании и город — настоящие.</span>" +
      "</div></div>" +
      '<header class="site-header">' +
        '<div class="container header-bar">' +
          '<a class="brand" href="#/">' +
            '<img class="brand__logo" src="assets/logo/logo.png" width="1189" height="340" ' +
              'alt="' + attr(CO.brand) + ', на главную" />' +
          "</a>" +
          '<span class="header-spacer"></span>' +
          '<nav class="header-nav" aria-label="Основная навигация">' +
            NAV.map(function (n) {
              return '<a href="#' + attr(n[0]) + '"' + (isCurrent(n[0]) ? ' aria-current="page"' : "") + ">" + esc(n[1]) + "</a>";
            }).join("") +
          "</nav>" +
          '<div class="header-actions">' +
            '<a class="header-phone" href="' + attr(TEL) + '">' + esc(CO.phone) +
              "<span>" + esc(CO.city) + "</span></a>" +
            '<a class="icon-btn" href="#/cart">' + icon("cart") +
              '<span class="visually-hidden">Корзина, позиций:</span>' +
              '<span class="icon-btn__count" data-cart-count aria-live="polite">' + state.cart.length + "</span></a>" +
            '<button class="icon-btn burger" id="burger" aria-label="Открыть меню" aria-expanded="false">' + icon("menu") + "</button>" +
          "</div>" +
        "</div>" +
      "</header>" +
      '<div class="drawer" id="drawer" data-open="false">' +
        '<div class="drawer__panel" role="dialog" aria-modal="true" aria-label="Меню">' +
          '<div class="drawer__head">' +
            '<span class="brand"><img class="brand__logo" src="assets/logo/logo.png" width="1189" height="340" ' +
              'alt="' + attr(CO.brand) + '" /></span>' +
            '<button class="icon-btn" id="drawerClose" aria-label="Закрыть меню">' + icon("close") + "</button>" +
          "</div>" +
          '<nav aria-label="Меню сайта">' +
          NAV.map(function (n) {
            return '<a class="drawer__link" href="#' + attr(n[0]) + '"' + (isCurrent(n[0]) ? ' aria-current="page"' : "") + ">" + esc(n[1]) + "</a>";
          }).join("") +
          "</nav>" +
          '<a class="btn btn--lg btn--block" style="margin-top:16px" href="' + attr(TEL) + '">' +
            icon("phone") + " " + esc(CO.phone) + "</a>" +
        "</div>" +
      "</div>"
    );
  }

  function footer() {
    return (
      '<footer class="site-footer">' +
        '<div class="container">' +
          '<div class="footer-grid">' +
            "<div>" +
              '<div class="brand footer-logo"><img class="brand__logo" src="assets/logo/logo-white.png" ' +
                'width="1189" height="340" alt="' + attr(CO.brand) + '" /></div>' +
              '<p class="footer-req" style="margin-top:16px">' +
                esc(CO.full) + "<br>ИНН " + esc(CO.inn) + " · КПП " + esc(CO.kpp) + "<br>ОГРН " + esc(CO.ogrn) +
                " от " + esc(CO.ogrnDate) + "<br>" + esc(CO.vat) +
              "</p>" +
            "</div>" +
            "<div><h2>Каталог</h2><ul class=\"footer-list\">" +
              groupNames().map(function (g) {
                return '<li><a href="' + attr(groupHref(g)) + '">' + esc(g) + "</a></li>";
              }).join("") +
            "</ul></div>" +
            '<div><h2>Покупателю</h2><ul class="footer-list">' +
              '<li><a href="#/smeta">Подбор по смете</a></li>' +
              '<li><a href="#/calc">Калькулятор массы</a></li>' +
              '<li><a href="#/delivery">Доставка и оплата</a></li>' +
              '<li><a href="#/account">Личный кабинет</a></li>' +
              '<li><a href="#/privacy">Политика конфиденциальности</a></li>' +
            "</ul></div>" +
            '<div><h2>Контакты</h2><ul class="footer-list">' +
              '<li><a href="' + attr(TEL) + '">' + esc(CO.phone) + "</a></li>" +
              "<li>" + esc(CO.addrFact) + "</li>" +
              (CO.pdf ? '<li><a href="' + attr(CO.pdf) + '" download>Карточка партнёра, PDF</a></li>' : "") +
            "</ul></div>" +
          "</div>" +
          '<div class="footer-bottom">' +
            "<span>© " + new Date().getFullYear() + " " + esc(CO.short) + " · " + esc(CO.city) + "</span>" +
            "<span>Информация на сайте не является публичной офертой</span>" +
          "</div>" +
        "</div>" +
      "</footer>"
    );
  }

  function groupNames() {
    const set = [];
    SKU.forEach(function (s) { if (set.indexOf(s.l1) < 0) set.push(s.l1); });
    return set;
  }
  function groupCount(g) { return SKU.filter(function (s) { return s.l1 === g; }).length; }
  /* у групп из каталога 2015 остатков нет — открываем их сразу с фильтром «всё» */
  function groupHasStock(g) {
    return SKU.some(function (s) { return s.l1 === g && stock(s) > 0; });
  }
  function groupHref(g) {
    return "#/catalog?l1=" + encodeURIComponent(g) + (groupHasStock(g) ? "" : "&stock=all");
  }
  function typesOf(g) {
    const set = [];
    SKU.forEach(function (s) { if ((!g || s.l1 === g) && set.indexOf(s.l2) < 0) set.push(s.l2); });
    return set;
  }

  function breadcrumbs(items) {
    return (
      '<nav class="breadcrumbs" aria-label="Хлебные крошки">' +
      items.map(function (it, i) {
        const sep = i ? '<span class="sep" aria-hidden="true">/</span>' : "";
        return sep + (it.href ? '<a href="#' + attr(it.href) + '">' + esc(it.label) + "</a>" : "<span>" + esc(it.label) + "</span>");
      }).join("") +
      "</nav>"
    );
  }

  /* блок формы заявки — используется на главной и в контактах */
  function leadForm(id, title, note, prefill) {
    return (
      '<form class="panel" id="' + attr(id) + '" novalidate>' +
        '<h2 style="font-size:1.125rem">' + esc(title) + "</h2>" +
        '<p class="small muted" style="margin-top:6px">' + esc(note) + "</p>" +
        '<div style="margin-top:20px">' +
          '<div class="field-row field-row--2">' +
            '<label class="field" data-field="name">' +
              '<span class="field__label">Как к вам обращаться <span class="req">*</span></span>' +
              '<input class="input" name="name" autocomplete="name" placeholder="Имя и фамилия" required />' +
              '<span class="field__error">Напишите имя</span>' +
            "</label>" +
            '<label class="field" data-field="phone">' +
              '<span class="field__label">Телефон <span class="req">*</span></span>' +
              '<input class="input" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 900 000-00-00" required />' +
              '<span class="field__error">Нужен телефон — не меньше 10 цифр</span>' +
            "</label>" +
          "</div>" +
          '<label class="field" data-field="task">' +
            '<span class="field__label">Что нужно</span>' +
            '<textarea class="textarea" name="task" placeholder="Например: арматура А500С Ø12, 5 тонн, самовывоз на этой неделе">' +
              esc(prefill || "") + "</textarea>" +
          "</label>" +
          '<div style="margin-top:16px">' +
            '<label class="check" data-field="consent">' +
              '<input type="checkbox" name="consent" required />' +
              '<span class="small">Согласен на обработку персональных данных в соответствии с ' +
                '<a href="#/privacy">политикой конфиденциальности</a> <span class="req">*</span>' +
                '<span class="field__error">Без согласия отправить заявку нельзя</span></span>' +
            "</label>" +
          "</div>" +
          '<div class="row" style="margin-top:20px">' +
            '<button class="btn btn--lg" type="submit">Отправить заявку</button>' +
            '<a class="btn btn--lg btn--secondary" href="' + attr(TEL) + '">' + icon("phone") + " " + esc(CO.phone) + "</a>" +
          "</div>" +
        "</div>" +
      "</form>"
    );
  }

  /* ---------- 7. Экраны ---------- */

  function viewHome() {
    const groups = groupNames();
    /* по одной позиции из разных типов — чтобы витрина не была восемью арматурами подряд */
    const seenTypes = {};
    const inStock = SKU.filter(function (s) {
      if (!(stock(s) > 5 && s.p1t) || seenTypes[s.l2]) return false;
      seenTypes[s.l2] = true;
      return true;
    }).slice(0, 8);
    const totalTons = SKU.reduce(function (a, s) { return a + stock(s); }, 0);

    return (
      '<section class="hero">' +
        '<div class="container hero__grid">' +
          "<div>" +
            '<p class="eyebrow eyebrow--brand">' + esc(CO.city) + " · " + esc(CO.tagline) + "</p>" +
            '<h1 class="hero__title" id="pageTitle" tabindex="-1">Изготавливаем трубопроводную арматуру.<br>' +
              "Поставляем <em>металлопрокат</em> со склада.</h1>" +
            '<p class="hero__lead lead">Краны шаровые, отводы, фланцы, опоры и заглушки поворотные — ' +
              "делаем с любой строительной длиной и комплектуем редуктором, электро- или пневмоприводом. " +
              "Прокат отгружаем со склада: наличие и цена видны сразу, счёт для юрлица формируется из корзины.</p>" +
            '<div class="hero__cta">' +
              '<a class="btn btn--lg" href="#/smeta">Подобрать по смете</a>' +
              '<a class="btn btn--lg btn--secondary" href="#/catalog">Открыть каталог</a>' +
            "</div>" +
            '<div class="hero__meta">' +
              '<span class="chip chip--brand">Изготовление под размер</span>' +
              '<span class="chip">Счёт и УПД</span>' +
              '<span class="chip">Резерв 30 минут</span>' +
              '<span class="chip">Резка в размер</span>' +
              '<span class="chip">Самовывоз и доставка</span>' +
            "</div>" +
          "</div>" +
          '<div class="hero__aside">' + heroViewerHtml() + "</div>" +
        "</div>" +
        '<div class="container"><div class="trust">' +
          '<div class="trust__item"><div class="trust__v">с ' + esc(String(CO.since)) + "</div><div class=\"trust__l\">" + YEARS + " лет в ЕГРЮЛ</div></div>" +
          '<div class="trust__item"><div class="trust__v">' + esc(CO.inn) + '</div><div class="trust__l">ИНН — проверьте нас</div></div>' +
          '<div class="trust__item"><div class="trust__v">НДС 20%</div><div class="trust__l">счёт, УПД, ЭДО</div></div>' +
          '<div class="trust__item"><div class="trust__v">' + fmt2(totalTons) + ' т</div><div class="trust__l">на складе ' + esc(WH[state.wh].short) + "</div></div>" +
        "</div></div>" +
      "</section>" +

      '<section class="section">' +
        '<div class="container">' +
          '<div class="section-head reveal">' +
            '<p class="eyebrow">Что возим</p>' +
            "<h2>Что изготавливаем и что возим со склада</h2>" +
            '<p class="lead">Внутри группы — фильтры по типу, марке и ГОСТу. У проката видно наличие на трёх складах сразу. ' +
              "Арматуру, фланцы и опоры подбираем под задачу — по ним цена и срок по запросу.</p>" +
          "</div>" +
          '<div class="grid grid--3 reveal">' +
            groups.map(function (g) {
              return (
                '<a class="group-card" href="' + attr(groupHref(g)) + '">' +
                  '<span class="group-card__art">' + groupArt(g) + "</span>" +
                  "<h3>" + esc(g) + "</h3>" +
                  '<p class="small muted">' + esc(typesOf(g).slice(0, 4).join(" · ")) + "</p>" +
                  '<span class="link-arrow" style="margin-top:auto">' + esc(pos(groupCount(g))) + "</span>" +
                "</a>"
              );
            }).join("") +
          "</div>" +
        "</div>" +
      "</section>" +

      '<section class="section section--surface">' +
        '<div class="container">' +
          '<div class="row row--between reveal" style="margin-bottom:24px">' +
            '<div class="section-head" style="margin:0">' +
              '<p class="eyebrow">Со склада сегодня</p>' +
              "<h2>Есть в наличии прямо сейчас</h2>" +
            "</div>" +
            '<a class="btn btn--secondary" href="#/catalog">Весь каталог</a>' +
          "</div>" +
          '<div class="grid grid--auto reveal">' + inStock.map(cardHtml).join("") + "</div>" +
        "</div>" +
      "</section>" +

      '<section class="section">' +
        '<div class="container">' +
          '<div class="section-head reveal">' +
            '<p class="eyebrow">Как работаем</p>' +
            "<h2>От заявки до отгрузки — четыре шага</h2>" +
          "</div>" +
          '<div class="steps reveal">' +
            '<div class="step"><h3>Заявка или смета</h3><p class="small muted">Пришлите список позиций или загрузите смету в Excel, PDF, DOCX.</p></div>' +
            '<div class="step"><h3>Наличие и расчёт</h3><p class="small muted">Сверяем со складом, считаем массу по ГОСТу и цену по объёму партии.</p></div>' +
            '<div class="step"><h3>Счёт и резерв</h3><p class="small muted">Выставляем счёт, позиции держатся в резерве 30 минут.</p></div>' +
            '<div class="step"><h3>Отгрузка и документы</h3><p class="small muted">Самовывоз по слоту или доставка. После весовой — итоговый УПД.</p></div>' +
          "</div>" +
        "</div>" +
      "</section>" +

      '<section class="section section--dark">' +
        '<div class="container">' +
          '<div class="grid grid--2" style="gap:40px;align-items:center">' +
            "<div>" +
              '<p class="eyebrow eyebrow--dark">Чем докажем</p>' +
              '<h2 style="margin-top:12px">Действующее юрлицо с 2015 года, работаем с НДС</h2>' +
              '<p class="lead" style="margin-top:16px">Все реквизиты открыты: проверьте ИНН и ОГРН в ЕГРЮЛ до того, как переводить деньги. ' +
                "Карточку партнёра можно скачать одним файлом и отдать своему бухгалтеру.</p>" +
              '<div class="row" style="margin-top:28px">' +
                '<a class="btn btn--on-dark" href="#/about">Реквизиты и карточка</a>' +
                (CO.pdf ? '<a class="btn btn--on-dark" href="' + attr(CO.pdf) + '" download>' + icon("doc") + " Скачать PDF</a>" : "") +
              "</div>" +
            "</div>" +
            '<div class="panel panel--dark">' +
              '<table class="req-table" style="color:inherit">' +
                "<tbody>" +
                  "<tr><th>Наименование</th><td>" + esc(CO.short) + "</td></tr>" +
                  '<tr><th>ИНН / КПП</th><td class="num">' + esc(CO.inn) + " / " + esc(CO.kpp) + "</td></tr>" +
                  '<tr><th>ОГРН</th><td class="num">' + esc(CO.ogrn) + "</td></tr>" +
                  "<tr><th>Директор</th><td>" + esc(CO.ceo) + "</td></tr>" +
                  "<tr><th>Телефон</th><td>" + esc(CO.phone) + "</td></tr>" +
                "</tbody>" +
              "</table>" +
            "</div>" +
          "</div>" +
        "</div>" +
      "</section>" +

      '<section class="section section--soft">' +
        '<div class="container container--narrow">' +
          '<div class="section-head center" style="margin-inline:auto">' +
            '<p class="eyebrow">Заявка</p>' +
            "<h2>Пришлите список — вернёмся с ценой и сроком</h2>" +
          "</div>" +
          leadForm("leadHome", "Оставить заявку", "Ответим в рабочее время. Можно просто позвонить — телефон рядом.") +
        "</div>" +
      "</section>"
    );
  }

  function cardHtml(s) {
    const st = stock(s);
    const other = WH_KEYS.filter(function (w) { return w !== state.wh && stockAt(s, w) > 0; });
    return (
      '<article class="card">' +
        '<div class="card__media">' + profileSvg(s) + "</div>" +
        '<div class="card__body">' +
          '<p class="eyebrow">' + esc(s.l2) + "</p>" +
          '<a class="card__title" href="#/product/' + encodeURIComponent(s.id) + '">' + esc(s.name) + "</a>" +
          '<p class="xs muted">' + esc([subLabel(s), s.mark].filter(Boolean).join(" · ")) + "</p>" +
          '<div class="card__foot">' +
            '<span class="price' + (s.p1t ? '"' : ' price-req"') + '>' +
              (s.p1t ? fmt(priceNow(s)) + " <small>₽/т</small>" : "по запросу") +
              (state.auth && s.p1t ? '<span class="price__was">' + fmt(pubPrice(s)) + "</span>" : "") +
            "</span>" +
          "</div>" +
          statusHtml(st, s) +
          (other.length
            ? '<p class="xs muted">есть ещё: ' + esc(other.map(function (w) { return WH[w].short; }).join(", ")) + "</p>"
            : "") +
        "</div>" +
      "</article>"
    );
  }

  /* ---- Каталог ---- */
  function filteredSku() {
    const q = String(state.route.query.get("q") || "").trim().toLowerCase();
    const l1 = state.route.query.get("l1") || "";
    const l2 = state.route.query.get("l2") || "";
    const onlyStock = state.route.query.get("stock") !== "all";

    let list = SKU.filter(function (s) {
      if (l1 && s.l1 !== l1) return false;
      if (l2 && s.l2 !== l2) return false;
      if (onlyStock && stock(s) <= 0) return false;
      if (!q) return true;
      const blob = [s.id, s.name, s.mark, s.gost, s.aisi, s.size, s.l2].join(" ").toLowerCase();
      if (blob.indexOf(q) >= 0) return true;
      if (q.indexOf("12-ка") >= 0 || q === "12ка") return s.id.indexOf("ARM-A500-12") === 0;
      if (q.indexOf("304") >= 0) return String(s.aisi).indexOf("304") >= 0 || s.id.indexOf("304") >= 0;
      return false;
    });

    const sort = state.route.query.get("sort") || "name";
    const dir = state.route.query.get("dir") === "desc" ? -1 : 1;
    list = list.slice().sort(function (a, b) {
      if (sort === "price") {
        /* позиции без цены всегда в конце — в любом направлении сортировки */
        const pa = priceNow(a) || 0, pb = priceNow(b) || 0;
        if (!pa && !pb) return byName(a, b);
        if (!pa) return 1;
        if (!pb) return -1;
        return (pa - pb) * dir;
      }
      if (sort === "stock") return (stock(a) - stock(b)) * dir;
      return byName(a, b) * dir;
    });
    return list;
  }

  /* «Ду 100» должен идти после «Ду 15», а не между 10 и 15 */
  const COLL = new Intl.Collator("ru", { numeric: true, sensitivity: "base" });
  function byName(a, b) { return COLL.compare(String(a.name), String(b.name)); }

  /* под названием показываем ГОСТ; если его нет — обозначение, но только когда
     оно не повторяет само название */
  function subLabel(s) {
    const name = String(s.name);
    const g = String(s.gost || "");
    if (g && g !== "—" && name.indexOf(g) < 0) return g;
    const m = String(s.mer || "");
    if (!m || m === "—") return "";
    return name.indexOf(m) < 0 ? m : "";
  }

  function sortHead(key, label, extraClass) {
    const cur = state.route.query.get("sort") || "name";
    const dir = state.route.query.get("dir") === "desc" ? "desc" : "asc";
    const next = cur === key && dir === "asc" ? "desc" : "asc";
    const d = cur === key ? dir : "";
    return (
      '<th' + (extraClass ? ' class="' + extraClass + '"' : "") + ' scope="col">' +
        '<button class="sort-btn" data-sort="' + attr(key) + '" data-next="' + attr(next) + '"' +
          (d ? ' data-dir="' + attr(d) + '"' : "") +
          ' aria-label="Сортировать по: ' + attr(label) + '">' + esc(label) + "</button>" +
      "</th>"
    );
  }

  /* Схема условных обозначений со стр. 9 каталога 2015 — показываем в группе арматуры */
  const KSH_CODE = [
    ["Тип", "цельносварной — без обозначения · разборный — Р"],
    ["Исполнение", "муфтовое — М · фланцевое — Ф · штуцерное — Ш · под приварку — П · комбинированное — К"],
    ["Назначение", "регулирующий — 01(Р) · для подземной установки — 02 · с обогревом — 03(О) · " +
      "с контролем протечки — 04 · для высокотемпературных сред — 05 · распределительный — 06 · " +
      "с «плавающими» фланцами — 07 · манометрический — 08"],
    ["Ду", "диаметр условного прохода, мм"],
    ["Ру", "давление условное, МПа"],
    ["Исполнение крана", "по таблице 1 каталога"],
    ["Тип привода", "электрический — Э · пневматический — П · редуктор — Р · ручной — без обозначения"]
  ];

  function kshCodeHtml() {
    return (
      '<details class="panel note-details" style="margin-bottom:24px">' +
        "<summary>Как читается обозначение крана, например КШ.Ф.50-16</summary>" +
        '<p class="small muted" style="margin-top:12px">Схема условных обозначений из каталога продукции ' +
          "ООО «СоюзНефтеГаз». Обозначение собирается слева направо: КШ, затем тип, исполнение, " +
          "назначение, Ду, Ру, исполнение по таблице и привод.</p>" +
        '<table class="table table--plain" style="margin-top:12px"><tbody>' +
          KSH_CODE.map(function (r) {
            return "<tr><th>" + esc(r[0]) + "</th><td>" + esc(r[1]) + "</td></tr>";
          }).join("") +
        "</tbody></table>" +
      "</details>"
    );
  }

  function viewCatalog() {
    const list = filteredSku();
    const l1 = state.route.query.get("l1") || "";
    const l2 = state.route.query.get("l2") || "";
    const q = state.route.query.get("q") || "";
    const onlyStock = state.route.query.get("stock") !== "all";
    const page = Math.max(1, Number(state.route.query.get("page") || 1));
    const perPage = 24;
    const shown = list.slice(0, page * perPage);

    const crumbs = [{ label: "Главная", href: "/" }];
    if (l1) { crumbs.push({ label: "Каталог", href: "/catalog" }); crumbs.push({ label: l1 }); }
    else crumbs.push({ label: "Каталог" });

    return (
      '<div class="container section section--tight">' +
        breadcrumbs(crumbs) +
        '<div class="section-head" style="margin-bottom:24px">' +
          '<p class="eyebrow">Каталог</p>' +
          '<h1 id="pageTitle" tabindex="-1">' + esc(l2 || l1 || "Весь сортамент") + "</h1>" +
          '<p class="lead">' + esc(pos(list.length)) +
            (list.every(byReq) ? "" : " · склад " + esc(WH[state.wh].name)) +
            (state.auth && !list.every(byReq) ? " · цена компании −6%" : "") + "</p>" +
        "</div>" +
        (/арматура/i.test(l1) || /шаров|клапан/i.test(l2) ? kshCodeHtml() : "") +

        '<div class="catalog-layout">' +
          '<aside class="facets">' +
            '<button class="btn btn--secondary facets__toggle" id="facetsToggle" aria-expanded="' + (state.facetsOpen ? "true" : "false") + '">' +
              "Фильтры и поиск" + (l1 || l2 || q || !onlyStock ? " · включены" : "") + "</button>" +
            '<div class="facets__body panel" data-open="' + (state.facetsOpen ? "true" : "false") + '">' +
              '<form id="facetForm">' +
                '<label class="field">' +
                  '<span class="field__label">Поиск по названию, ГОСТу, размеру</span>' +
                  '<input class="input" name="q" type="search" value="' + attr(q) + '" placeholder="12-ка, 304-я 2 мм, труба 57" />' +
                "</label>" +
                '<label class="field">' +
                  '<span class="field__label">Склад отгрузки</span>' +
                  '<select class="select" name="wh">' +
                    WH_KEYS.map(function (w) {
                      return '<option value="' + attr(w) + '"' + (state.wh === w ? " selected" : "") + ">" + esc(WH[w].name) + "</option>";
                    }).join("") +
                  "</select>" +
                "</label>" +
                '<label class="field">' +
                  '<span class="field__label">Наличие</span>' +
                  '<select class="select" name="stock">' +
                    '<option value="in"' + (onlyStock ? " selected" : "") + ">Только то, что на складе</option>" +
                    '<option value="all"' + (!onlyStock ? " selected" : "") + ">Всё, включая под заказ</option>" +
                  "</select>" +
                "</label>" +
                '<label class="field">' +
                  '<span class="field__label">Группа</span>' +
                  '<select class="select" name="l1">' +
                    '<option value="">Все группы</option>' +
                    groupNames().map(function (g) {
                      return '<option value="' + attr(g) + '"' + (l1 === g ? " selected" : "") + ">" + esc(g) + "</option>";
                    }).join("") +
                  "</select>" +
                "</label>" +
                '<label class="field">' +
                  '<span class="field__label">Тип</span>' +
                  '<select class="select" name="l2">' +
                    '<option value="">Все типы</option>' +
                    typesOf(l1).map(function (t) {
                      return '<option value="' + attr(t) + '"' + (l2 === t ? " selected" : "") + ">" + esc(t) + "</option>";
                    }).join("") +
                  "</select>" +
                "</label>" +
                '<div class="row" style="margin-top:20px">' +
                  '<button class="btn" type="submit">Показать</button>' +
                  '<a class="btn btn--ghost" href="#/catalog">Сбросить</a>' +
                "</div>" +
              "</form>" +
            "</div>" +
          "</aside>" +

          "<div>" +
            (list.length === 0
              ? '<div class="empty"><h3>Ничего не нашлось</h3>' +
                '<p class="lead" style="margin-top:8px">Поменяйте фильтры или пришлите список — подберём вручную.</p>' +
                '<div class="row" style="justify-content:center;margin-top:20px">' +
                  '<a class="btn" href="#/contacts">Отправить запрос</a>' +
                  '<a class="btn btn--secondary" href="#/catalog">Сбросить фильтры</a></div></div>'
              : '<div class="result-cards">' + shown.map(cardHtml).join("") + "</div>" +
                '<div class="result-table table-scroll">' +
                  '<table class="table">' +
                    "<thead><tr>" +
                      sortHead("name", "Наименование") +
                      '<th scope="col">Марка / размер</th>' +
                      sortHead("stock", "Наличие") +
                      sortHead("price", shown.every(byReq) ? "Цена" : "₽ за тонну", "num") +
                      '<th scope="col"><span class="visually-hidden">Действие</span></th>' +
                    "</tr></thead><tbody>" +
                    shown.map(function (s) {
                      return (
                        "<tr>" +
                          '<td><a class="table__name" href="#/product/' + encodeURIComponent(s.id) + '">' + esc(s.name) + "</a>" +
                            '<div class="xs muted">' + esc(subLabel(s)) + "</div></td>" +
                          "<td>" + esc(s.mark) + '<div class="xs muted">' + esc(s.size) + "</div></td>" +
                          "<td>" + statusHtml(stock(s), s) + "</td>" +
                          '<td class="num">' +
                            (s.p1t ? fmt(priceNow(s))
                              : byReq(s) ? '<span class="xs price-req">по запросу</span>'
                              : "—") +
                          "</td>" +
                          "<td>" + (byReq(s)
                            ? '<a class="btn btn--sm btn--secondary" href="#/contacts?item=' +
                              encodeURIComponent(s.id) + '">Запросить</a>'
                            : '<button class="btn btn--sm btn--secondary" data-quick="' + attr(s.id) + '"' +
                              (stock(s) <= 0 ? " disabled" : "") + ">В корзину</button>") + "</td>" +
                        "</tr>"
                      );
                    }).join("") +
                    "</tbody></table>" +
                "</div>" +
                (shown.length < list.length
                  ? '<div class="row" style="justify-content:center;margin-top:28px">' +
                    '<button class="btn btn--secondary btn--lg" data-more="' + (page + 1) + '">' +
                    "Показать ещё · осталось " + (list.length - shown.length) + "</button></div>"
                  : "")) +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  /* ---- Карточка товара ---- */
  function viewProduct() {
    const s = SKU.find(function (x) { return x.id === state.route.params.id; });
    if (!s) {
      return (
        '<div class="container section">' +
          '<h1 id="pageTitle" tabindex="-1">Позиция не найдена</h1>' +
          '<p class="lead" style="margin-top:12px">Возможно, ссылка устарела.</p>' +
          '<div class="row" style="margin-top:20px"><a class="btn" href="#/catalog">Вернуться в каталог</a></div>' +
        "</div>"
      );
    }
    const st = stock(s);
    const units = unitOptions(s);
    if (units.indexOf(state.unit) < 0) state.unit = units[0];
    const tons = toTons(s, state.unit, state.qty);
    const p = priceNow(s);
    const sum = p * tons;
    const hold = Number(s.hold || 0.08);
    const ladder = [
      ["от 100 кг", s.p100, tons > 0 && tons < 1],
      ["от 1 т", s.p1t, tons >= 1 && tons < 5],
      ["от 5 т", s.p5t, tons >= 5 && tons < 20],
      ["от 20 т", s.p20t, tons >= 20]
    ];

    return (
      '<div class="container section section--tight">' +
        breadcrumbs([
          { label: "Главная", href: "/" },
          { label: "Каталог", href: "/catalog" },
          { label: s.l1, href: "/catalog?l1=" + encodeURIComponent(s.l1) },
          { label: s.l2 }
        ]) +
        '<div class="pdp">' +
          "<div>" +
            '<figure class="pdp__figure" style="margin:0">' + profileSvg(s) + "</figure>" +
            '<div class="panel" style="margin-top:16px">' +
              "<h2 style=\"font-size:1.0625rem\">Характеристики</h2>" +
              '<table class="table table--plain" style="margin-top:12px"><tbody>' +
                "<tr><th>Артикул</th><td class=\"num\">" + esc(s.id) + "</td></tr>" +
                (Array.isArray(s.specs) && s.specs.length
                  ? s.specs.map(function (r) {
                      return "<tr><th>" + esc(r[0]) + "</th><td>" + esc(r[1]) + "</td></tr>";
                    }).join("") + "<tr><th>НДС</th><td>" + esc(s.vat) + "</td></tr>"
                  :
                "<tr><th>ГОСТ / ТУ</th><td>" + esc(s.gost) + "</td></tr>" +
                "<tr><th>Марка</th><td>" + esc(s.mark) + "</td></tr>" +
                "<tr><th>Зарубежный аналог</th><td>" + esc(s.aisi) + "</td></tr>" +
                '<tr><th>Плотность</th><td class="num">' + esc(s.rho) + " г/см³</td></tr>" +
                '<tr><th>Теоретическая масса</th><td class="num">' + esc(s.mass || "—") + " " + esc(s.mass_base || "") + "</td></tr>" +
                "<tr><th>Кратность отгрузки</th><td>" + esc(s.pack) + "</td></tr>" +
                "<tr><th>Мерность</th><td>" + esc(s.mer) + "</td></tr>" +
                "<tr><th>НДС</th><td>" + esc(s.vat) + "</td></tr>" +
                '<tr><th>Запас на фактический вес</th><td class="num">' + Math.round(hold * 100) + "%</td></tr>") +
              "</tbody></table>" +
            "</div>" +
          "</div>" +

          "<div>" +
            '<p class="eyebrow">' + esc(s.l2) + " · " + esc(s.mer) + "</p>" +
            '<h1 id="pageTitle" tabindex="-1" style="margin-top:10px">' + esc(s.name) + "</h1>" +

            '<div class="panel" style="margin-top:20px">' +
              '<p class="price price--lg">' + (p ? fmt(p) + " <small>₽ за тонну</small>" : "цена по запросу") + "</p>" +
              '<p class="small muted" style="margin-top:6px">' +
                (byReq(s)
                  ? "Позиция из каталога продукции. Цену и срок считаем под типоразмер, рабочую среду и исполнение."
                  : state.auth
                    ? "Цена вашей компании, −6% к базовой."
                    : "Базовая цена «от 1 т». Ниже — сетка по объёму. Цена компании открывается после входа по ИНН.") +
              "</p>" +
              (p
                ? '<table class="price-ladder" style="margin-top:16px"><tbody>' +
                  ladder.map(function (r) {
                    return '<tr data-active="' + (r[2] ? "true" : "false") + '"><th scope="row">' + esc(r[0]) + "</th>" +
                      '<td>' + fmt(state.auth ? Math.round(r[1] * 0.94) : r[1]) + " ₽/т</td></tr>";
                  }).join("") +
                  "</tbody></table>"
                : "") +
              '<div style="margin-top:18px">' + statusHtml(st, s) + "</div>" +
              (byReq(s)
                ? ""
                : '<p class="xs muted" style="margin-top:8px">Другие склады: ' +
                  WH_KEYS.filter(function (w) { return w !== state.wh; })
                    .map(function (w) { return esc(WH[w].short) + " " + fmt2(stockAt(s, w)) + " т"; }).join(" · ") +
                  "</p>") +
            "</div>" +

            (st > 0 && p
              ? '<div class="panel" style="margin-top:16px">' +
                  "<h2 style=\"font-size:1.0625rem\">Сколько нужно</h2>" +
                  (units.length > 1
                    ? '<div class="segmented" style="margin-top:12px" role="group" aria-label="Единица измерения">' +
                      units.map(function (u) {
                        return '<button type="button" data-unit="' + attr(u) + '" aria-pressed="' + (state.unit === u ? "true" : "false") + '">' +
                          esc(UNIT_NAME[u]) + "</button>";
                      }).join("") + "</div>"
                    : "") +
                  '<div class="qty-row" style="margin-top:16px">' +
                    '<label class="field">' +
                      '<span class="field__label">Количество, ' + esc(UNIT_NAME[state.unit].toLowerCase()) + "</span>" +
                      '<input class="input" id="qty" type="number" min="0.001" step="0.001" value="' + attr(state.qty) + '" />' +
                    "</label>" +
                    '<div class="qty-out"><span>= <b class="num">' + fmt2(tons) + "</b> т · <b class=\"num\">" + fmt(sum) + "</b> ₽</span></div>" +
                  "</div>" +
                  (String(s.pack).indexOf("бухта") >= 0
                    ? '<div class="callout callout--warn" style="margin-top:14px"><span class="callout__icon">!</span>' +
                      "<span>Отгружаем целыми бухтами — количество округлится вверх до складской бухты.</span></div>"
                    : "") +
                  (isScrap(s) && !state.auth
                    ? '<div class="callout callout--warn" style="margin-top:14px"><span class="callout__icon">!</span>' +
                      "<span>Деловой лом отгружаем только юридическим лицам. Войдите по ИНН.</span></div>"
                    : "") +
                  (isLong(s)
                    ? '<div class="callout callout--warn" style="margin-top:14px"><span class="callout__icon">!</span>' +
                      "<span>Длина 11,7–12 м: нужен открытый борт или шаланда с верхней погрузкой. Крытая фура не подойдёт.</span></div>"
                    : "") +
                  (s.cut === "да"
                    ? '<div style="margin-top:16px;display:grid;gap:8px">' +
                      '<label class="check check--card"><input type="checkbox" id="cutOn"' + (state.cutOn ? " checked" : "") + " />" +
                        '<span><span class="radio-tile__t">Резка в размер</span><span class="radio-tile__d">450 ₽ за рез, отдельной строкой в счёте</span></span></label>' +
                      '<label class="check check--card"><input type="checkbox" id="packOn"' + (state.packOn ? " checked" : "") + " />" +
                        '<span><span class="radio-tile__t">Упаковка в плёнку</span><span class="radio-tile__d">250 ₽ за партию</span></span></label>' +
                      "</div>"
                    : "") +
                  '<div class="row" style="margin-top:20px">' +
                    '<button class="btn btn--lg" id="addCart"' + (isScrap(s) && !state.auth ? " disabled" : "") + ">В корзину</button>" +
                    '<a class="btn btn--lg btn--secondary" href="#/cart">Перейти в корзину</a>' +
                  "</div>" +
                "</div>"
              : '<div class="panel" style="margin-top:16px">' +
                  '<h2 style="font-size:1.0625rem">' +
                    (byReq(s) ? "Поставляем под заказ" : "Сейчас нет на складе " + esc(WH[state.wh].short)) + "</h2>" +
                  '<p class="small muted" style="margin-top:8px">' +
                    (byReq(s)
                      ? "Напишите типоразмер, рабочую среду и давление — вернёмся с ценой, сроком и исполнением. " +
                        "Краны изготавливаем с любой строительной длиной."
                      : "Привозим под заказ. Оставьте контакт — вернёмся со сроком и ценой на вашу партию.") + "</p>" +
                  '<div class="row" style="margin-top:18px">' +
                    '<a class="btn btn--lg" href="#/contacts?item=' + encodeURIComponent(s.id) + '">Запросить срок и цену</a>' +
                    '<a class="btn btn--lg btn--secondary" href="' + attr(TEL) + '">' + icon("phone") + " Позвонить</a>" +
                  "</div>" +
                "</div>") +

            '<div class="panel" style="margin-top:16px">' +
              (byReq(s)
                ? '<p class="small"><b>Откуда характеристики.</b> Из каталога продукции ООО «СоюзНефтеГаз». ' +
                  "Цен и остатков в каталоге нет, поэтому здесь мы их не показываем.</p>"
                : '<p class="small"><b>Что входит в цену.</b> Цена за тонну по теоретическому весу ГОСТ. ' +
                  "Итоговая сумма считается после весовой, разницу видно в УПД. Резка и упаковка — отдельные строки.</p>") +
            "</div>" +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  /* ---- Подбор по смете ---- */
  const LVL = {
    HIGH:   { label: "Точное совпадение", cls: "chip--ok" },
    MID:    { label: "Нужно подтвердить", cls: "chip--warn" },
    REJECT: { label: "Передаём менеджеру", cls: "chip--bad" }
  };

  function viewSmeta() {
    const rows = state.smetaRows;
    return (
      '<div class="container section section--tight">' +
        breadcrumbs([{ label: "Главная", href: "/" }, { label: "Подбор по смете" }]) +
        '<div class="section-head">' +
          '<p class="eyebrow">Подбор по смете</p>' +
          '<h1 id="pageTitle" tabindex="-1">Загрузите смету — соберём корзину сами</h1>' +
          '<p class="lead">Читаем Excel, PDF и DOCX. Сопоставляем строки сметы с позициями склада и показываем, ' +
            "где совпало точно, а где нужно ваше подтверждение. Рукописные сметы передаём менеджеру.</p>" +
        "</div>" +

        (!rows
          ? '<div class="panel">' +
              '<div class="empty" style="border-style:dashed">' +
                '<h2 style="font-size:1.125rem">Перетащите файл сметы сюда</h2>' +
                '<p class="small muted" style="margin-top:8px">Excel, PDF или DOCX, до 20 МБ</p>' +
                '<div class="row" style="justify-content:center;margin-top:20px">' +
                  '<button class="btn btn--lg" id="runSmeta">Показать на примере сметы</button>' +
                "</div>" +
                '<p class="xs muted" style="margin-top:14px">В прототипе разбор файла показан на готовом примере.</p>' +
              "</div>" +
            "</div>"
          : '<div class="panel panel--flush">' +
              '<div class="table-scroll" style="border:0">' +
                '<table class="table">' +
                  "<thead><tr>" +
                    '<th scope="col">Строка сметы</th>' +
                    '<th scope="col">Позиция склада</th>' +
                    '<th scope="col">Результат</th>' +
                    '<th scope="col"><span class="visually-hidden">Действие</span></th>' +
                  "</tr></thead><tbody>" +
                  rows.map(function (r) {
                    const lv = LVL[r.lvl];
                    return (
                      "<tr>" +
                        "<td>" + esc(r.src) + "</td>" +
                        "<td>" + esc(r.dst) + "</td>" +
                        '<td><span class="chip ' + lv.cls + '">' + esc(lv.label) + "</span></td>" +
                        "<td>" +
                          (r.lvl === "REJECT"
                            ? '<span class="xs muted">свяжемся сами</span>'
                            : '<button class="btn btn--sm' + (r.lvl === "MID" ? " btn--secondary" : "") + '" data-add="' + attr(r.id) + '">' +
                              (r.lvl === "MID" ? "Подтвердить" : "В корзину") + "</button>") +
                        "</td>" +
                      "</tr>"
                    );
                  }).join("") +
                  "</tbody></table>" +
              "</div>" +
              '<div style="padding:20px">' +
                '<div class="callout callout--info"><span class="callout__icon">i</span>' +
                  "<span>Позиции с пометкой «нужно подтвердить» сами в корзину не попадают: у них несколько подходящих вариантов.</span></div>" +
                '<div class="row" style="margin-top:18px">' +
                  '<button class="btn btn--lg" id="moveHigh">Перенести точные совпадения в корзину</button>' +
                  '<button class="btn btn--secondary" id="resetSmeta">Загрузить другую смету</button>' +
                "</div>" +
              "</div>" +
            "</div>") +
      "</div>"
    );
  }

  /* ---- Калькулятор массы ---- */
  const CALC_RHO = [
    ["7.85", "Сталь углеродистая — 7,85"],
    ["7.9", "Нержавеющая сталь — 7,9"],
    ["2.7", "Алюминий — 2,7"],
    ["8.9", "Медь — 8,9"],
    ["8.5", "Латунь — 8,5"]
  ];

  function viewCalc() {
    return (
      '<div class="container section section--tight">' +
        breadcrumbs([{ label: "Главная", href: "/" }, { label: "Калькулятор массы" }]) +
        '<div class="section-head">' +
          '<p class="eyebrow">Инженерный расчёт</p>' +
          '<h1 id="pageTitle" tabindex="-1">Калькулятор теоретической массы</h1>' +
          '<p class="lead">Считает по формулам ГОСТ: сколько весит метр, сколько метров в тонне и сколько выйдет ваша партия. ' +
            "Тот же расчёт применяется в карточке товара.</p>" +
        "</div>" +

        '<div class="grid grid--2" style="align-items:start">' +
          '<form class="panel" id="calcForm">' +
            '<label class="field">' +
              '<span class="field__label">Что считаем</span>' +
              '<select class="select" name="kind" id="calcKind">' +
                '<option value="round">Круг, арматура — Ø</option>' +
                '<option value="pipe">Труба — Ø и стенка</option>' +
                '<option value="sheet">Лист — толщина и размер</option>' +
                '<option value="square">Квадрат — сторона</option>' +
                '<option value="hex">Шестигранник — под ключ</option>' +
              "</select>" +
            "</label>" +
            '<div id="calcDims"></div>' +
            '<label class="field">' +
              '<span class="field__label">Плотность, г/см³</span>' +
              '<select class="select" name="rho">' +
                CALC_RHO.map(function (r) { return '<option value="' + attr(r[0]) + '">' + esc(r[1]) + "</option>"; }).join("") +
              "</select>" +
            "</label>" +
            '<label class="field">' +
              '<span class="field__label">Длина партии, м <span class="field__hint" style="display:inline">(для листа — количество листов)</span></span>' +
              '<input class="input" name="len" type="number" min="0" step="0.1" value="100" />' +
            "</label>" +
          "</form>" +

          '<div class="panel" id="calcOut" aria-live="polite">' +
            '<p class="eyebrow">Результат</p>' +
            '<p class="lead" style="margin-top:10px">Введите размеры — посчитаем.</p>' +
          "</div>" +
        "</div>" +

        '<div class="panel" style="margin-top:24px">' +
          "<h2 style=\"font-size:1.0625rem\">Формулы</h2>" +
          '<table class="table table--plain" style="margin-top:12px"><tbody>' +
            "<tr><th>Круг, арматура</th><td class=\"num\">π / 4 × d² × ρ / 1000 = кг/м</td></tr>" +
            "<tr><th>Труба</th><td class=\"num\">π × s × (D − s) × ρ / 1000 = кг/м</td></tr>" +
            "<tr><th>Лист</th><td class=\"num\">A × B × t × ρ / 1 000 000 = кг/лист</td></tr>" +
            "<tr><th>Квадрат</th><td class=\"num\">a² × ρ / 1000 = кг/м</td></tr>" +
            "<tr><th>Шестигранник</th><td class=\"num\">0,866 × S² × ρ / 1000 = кг/м</td></tr>" +
          "</tbody></table>" +
          '<p class="xs muted" style="margin-top:12px">Это теоретическая масса. Фактическая отличается в пределах допуска ГОСТ — на эту разницу в заказе закладывается запас 7–10%.</p>' +
        "</div>" +
      "</div>"
    );
  }

  const CALC_FIELDS = {
    round:  [["d", "Диаметр d, мм", 12]],
    pipe:   [["D", "Наружный диаметр D, мм", 57], ["s", "Толщина стенки s, мм", 3.5]],
    sheet:  [["t", "Толщина t, мм", 2], ["A", "Ширина A, мм", 1250], ["B", "Длина B, мм", 2500]],
    square: [["a", "Сторона a, мм", 20]],
    hex:    [["S", "Размер под ключ S, мм", 22]]
  };

  function renderCalcDims() {
    const host = $("#calcDims");
    if (!host) return;
    const kind = $("#calcKind").value;
    host.innerHTML = CALC_FIELDS[kind].map(function (f) {
      return (
        '<label class="field">' +
          '<span class="field__label">' + esc(f[1]) + "</span>" +
          '<input class="input" name="' + attr(f[0]) + '" type="number" min="0" step="0.1" value="' + attr(f[2]) + '" />' +
        "</label>"
      );
    }).join("");
    runCalc();
  }

  function runCalc() {
    const form = $("#calcForm");
    const out = $("#calcOut");
    if (!form || !out) return;
    const d = new FormData(form);
    const kind = d.get("kind");
    const rho = Number(d.get("rho")) || 7.85;
    const len = Number(d.get("len")) || 0;
    const v = function (k) { return Number(d.get(k)) || 0; };

    let perUnit = 0, unitLabel = "кг/м", partLabel = "метров", ok = true;
    if (kind === "round") perUnit = (Math.PI / 4) * Math.pow(v("d"), 2) * rho / 1000;
    else if (kind === "pipe") {
      if (v("s") * 2 >= v("D")) ok = false;
      perUnit = Math.PI * v("s") * (v("D") - v("s")) * rho / 1000;
    } else if (kind === "sheet") {
      perUnit = v("A") * v("B") * v("t") * rho / 1000000;
      unitLabel = "кг/лист"; partLabel = "листов";
    } else if (kind === "square") perUnit = Math.pow(v("a"), 2) * rho / 1000;
    else if (kind === "hex") perUnit = 0.866 * Math.pow(v("S"), 2) * rho / 1000;

    if (!ok || !isFinite(perUnit) || perUnit <= 0) {
      out.innerHTML = '<p class="eyebrow">Результат</p>' +
        '<div class="callout callout--warn" style="margin-top:12px"><span class="callout__icon">!</span>' +
        "<span>" + (ok ? "Заполните размеры числами больше нуля." : "Стенка не может быть толще половины диаметра.") + "</span></div>";
      return;
    }

    const total = perUnit * len;
    const perTon = perUnit > 0 ? 1000 / perUnit : 0;
    out.innerHTML =
      '<p class="eyebrow">Результат</p>' +
      '<p class="price price--lg" style="margin-top:10px">' + fmt2(Math.round(perUnit * 1000) / 1000) + " <small>" + esc(unitLabel) + "</small></p>" +
      '<table class="table table--plain" style="margin-top:16px"><tbody>' +
        "<tr><th>Ваша партия, " + esc(partLabel) + "</th><td class=\"num\">" + fmt2(len) + "</td></tr>" +
        '<tr><th>Масса партии</th><td class="num">' + fmt2(Math.round(total) / 1000) + " т · " + fmt(total) + " кг</td></tr>" +
        "<tr><th>В одной тонне</th><td class=\"num\">" + fmt2(Math.round(perTon * 100) / 100) + " " + esc(partLabel) + "</td></tr>" +
      "</tbody></table>" +
      '<p class="xs muted" style="margin-top:14px">Плотность ' + fmt2(rho) + " г/см³.</p>";
  }

  /* ---- Корзина ---- */
  function viewCart() {
    const rows = cartRows();
    const metal = rows.filter(function (r) { return !isScrap(r.s); });
    const scrap = rows.filter(function (r) { return isScrap(r.s); });
    const hold = cartHold(rows);
    const left = state.reserveUntil ? Math.max(0, state.reserveUntil - Date.now()) : 0;

    if (!rows.length) {
      return (
        '<div class="container section section--tight">' +
          breadcrumbs([{ label: "Главная", href: "/" }, { label: "Корзина" }]) +
          '<h1 id="pageTitle" tabindex="-1">Корзина пуста</h1>' +
          '<div class="empty" style="margin-top:24px">' +
            '<p class="lead">Добавьте позиции из каталога или загрузите смету — соберём корзину за вас.</p>' +
            '<div class="row" style="justify-content:center;margin-top:20px">' +
              '<a class="btn btn--lg" href="#/catalog">Открыть каталог</a>' +
              '<a class="btn btn--lg btn--secondary" href="#/smeta">Загрузить смету</a>' +
            "</div>" +
          "</div>" +
        "</div>"
      );
    }

    return (
      '<div class="container section section--tight">' +
        breadcrumbs([{ label: "Главная", href: "/" }, { label: "Корзина" }]) +
        '<div class="section-head">' +
          '<h1 id="pageTitle" tabindex="-1">Корзина</h1>' +
          '<p class="lead">Склад отгрузки — ' + esc(WH[state.wh].name) + ". Позиции с разных складов отгружаются отдельными заказами.</p>" +
        "</div>" +

        '<div class="table-scroll">' +
          '<table class="table">' +
            "<thead><tr>" +
              '<th scope="col">Позиция</th>' +
              '<th scope="col" class="num">Тонн</th>' +
              '<th scope="col" class="num">₽ за тонну</th>' +
              '<th scope="col">НДС</th>' +
              '<th scope="col" class="num">Сумма</th>' +
              '<th scope="col"><span class="visually-hidden">Удалить</span></th>' +
            "</tr></thead><tbody>" +
            rows.map(function (r) {
              return (
                "<tr>" +
                  '<td><a class="table__name" href="#/product/' + encodeURIComponent(r.s.id) + '">' + esc(r.s.name) + "</a>" +
                    '<div class="xs muted">' + esc(r.s.gost) + "</div></td>" +
                  '<td class="num">' + fmt2(r.tons) + "</td>" +
                  '<td class="num">' + fmt(priceNow(r.s)) + "</td>" +
                  "<td>" + esc(isScrap(r.s) ? "агент, ст. 161" : "20%") + "</td>" +
                  '<td class="num">' + fmt(priceNow(r.s) * r.tons) + "</td>" +
                  '<td><button class="btn btn--sm btn--ghost" data-del="' + attr(r.s.id) + '" ' +
                    'aria-label="Убрать ' + attr(r.s.name) + '">Убрать</button></td>' +
                "</tr>"
              );
            }).join("") +
            "</tbody></table>" +
        "</div>" +

        '<div class="grid grid--4" style="margin-top:24px">' +
          '<div class="panel panel--tight"><p class="xs muted">Металл, НДС 20%</p><p class="price" style="margin-top:4px">' + fmt(cartSum(metal)) + " ₽</p></div>" +
          '<div class="panel panel--tight"><p class="xs muted">Лом, агент ст. 161</p><p class="price" style="margin-top:4px">' + fmt(cartSum(scrap)) + " ₽</p></div>" +
          '<div class="panel panel--tight"><p class="xs muted">Запас на фактический вес</p><p class="price" style="margin-top:4px">+' + fmt(hold) + " ₽</p></div>" +
          '<div class="panel panel--tight" style="border-color:var(--action)"><p class="xs muted">К резервированию</p>' +
            '<p class="price" style="margin-top:4px;color:var(--action-700)">' + fmt(cartSum(rows) + hold) + " ₽</p></div>" +
        "</div>" +

        (scrap.length && metal.length
          ? '<div class="callout callout--warn" style="margin-top:20px"><span class="callout__icon">!</span>' +
            "<span>В заказе есть и металл, и деловой лом — по ним разный НДС, поэтому счёта будет два.</span></div>"
          : "") +
        (left
          ? '<div class="callout callout--ok" style="margin-top:16px"><span class="callout__icon">✓</span>' +
            '<span>Позиции в резерве, осталось <b class="timer num" id="tm">' + mmss(left) + "</b></span></div>"
          : "") +

        '<div class="row" style="margin-top:28px">' +
          '<a class="btn btn--lg" href="#/checkout">Перейти к оформлению</a>' +
          '<a class="btn btn--lg btn--secondary" href="#/catalog">Добавить ещё позиции</a>' +
        "</div>" +
      "</div>"
    );
  }

  /* ---- Оформление ---- */
  function viewCheckout() {
    const rows = cartRows();
    if (!rows.length) {
      return (
        '<div class="container section section--tight">' +
          '<h1 id="pageTitle" tabindex="-1">Оформление</h1>' +
          '<div class="empty" style="margin-top:24px"><p class="lead">Сначала добавьте позиции в корзину.</p>' +
          '<div class="row" style="justify-content:center;margin-top:20px"><a class="btn" href="#/catalog">В каталог</a></div></div>' +
        "</div>"
      );
    }
    const theory = cartSum(rows);
    const hold = cartHold(rows);
    const svc = servicesSum();
    const long = rows.some(function (r) { return isLong(r.s); });
    const truckBlocked = long && state.truck === "closed";
    const left = state.reserveUntil ? Math.max(0, state.reserveUntil - Date.now()) : 0;

    return (
      '<div class="container section section--tight">' +
        breadcrumbs([{ label: "Главная", href: "/" }, { label: "Корзина", href: "/cart" }, { label: "Оформление" }]) +
        '<div class="section-head">' +
          '<h1 id="pageTitle" tabindex="-1">Оформление заказа</h1>' +
          '<p class="lead">Заполните контакты — вернёмся со счётом. Позиции держим в резерве 30 минут с момента выставления счёта.</p>' +
        "</div>" +

        '<form id="checkoutForm" novalidate>' +
        '<div class="grid grid--2" style="align-items:start;gap:24px">' +
          "<div>" +

            '<div class="panel">' +
              "<h2 style=\"font-size:1.0625rem\">Кто покупает</h2>" +
              '<div class="segmented" style="margin-top:12px" role="group" aria-label="Тип покупателя">' +
                '<button type="button" data-payer="b2b" aria-pressed="' + (state.payer === "b2b" ? "true" : "false") + '">Юридическое лицо</button>' +
                '<button type="button" data-payer="b2c" aria-pressed="' + (state.payer === "b2c" ? "true" : "false") + '">Физическое лицо</button>' +
              "</div>" +

              '<div style="margin-top:20px">' +
                '<div class="field-row field-row--2">' +
                  '<label class="field" data-field="name">' +
                    '<span class="field__label">Контактное лицо <span class="req">*</span></span>' +
                    '<input class="input" name="name" autocomplete="name" placeholder="Имя и фамилия" required />' +
                    '<span class="field__error">Напишите имя</span>' +
                  "</label>" +
                  '<label class="field" data-field="phone">' +
                    '<span class="field__label">Телефон <span class="req">*</span></span>' +
                    '<input class="input" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 900 000-00-00" required />' +
                    '<span class="field__error">Нужен телефон — не меньше 10 цифр</span>' +
                  "</label>" +
                "</div>" +
                '<label class="field" data-field="email">' +
                  '<span class="field__label">Почта для счёта и документов' + (state.payer === "b2b" ? ' <span class="req">*</span>' : "") + "</span>" +
                  '<input class="input" name="email" type="email" autocomplete="email" placeholder="buh@company.ru"' +
                    (state.payer === "b2b" ? " required" : "") + " />" +
                  '<span class="field__error">Проверьте адрес почты</span>' +
                "</label>" +
                (state.payer === "b2b"
                  ? '<label class="field" data-field="inn">' +
                      '<span class="field__label">ИНН организации <span class="req">*</span></span>' +
                      '<input class="input" name="inn" inputmode="numeric" placeholder="10 или 12 цифр" required />' +
                      '<span class="field__hint">Подтянем название и реквизиты, счёт выставим на эту организацию.</span>' +
                      '<span class="field__error">ИНН — это 10 или 12 цифр</span>' +
                    "</label>"
                  : "") +
              "</div>" +
            "</div>" +

            (state.payer === "b2b"
              ? '<div class="panel" style="margin-top:16px">' +
                  "<h2 style=\"font-size:1.0625rem\">Оплата</h2>" +
                  '<div class="radio-group" style="margin-top:12px">' +
                    '<label class="radio-tile"><input type="radio" name="pay" value="invoice" checked />' +
                      '<span><span class="radio-tile__t">Счёт с НДС</span>' +
                      '<span class="radio-tile__d">Обычная безналичная оплата, резерв на 30 минут</span></span></label>' +
                    '<label class="radio-tile"><input type="radio" name="pay" value="delay" />' +
                      '<span><span class="radio-tile__t">Оплата с отсрочки</span>' +
                      '<span class="radio-tile__d">Доступно по согласованному лимиту компании</span></span></label>' +
                  "</div>" +
                "</div>"
              : '<div class="panel" style="margin-top:16px">' +
                  "<h2 style=\"font-size:1.0625rem\">Оплата</h2>" +
                  '<p class="small muted" style="margin-top:10px">Оплата картой или через СБП, чек по 54-ФЗ приходит на почту. ' +
                    "Сумма считается по теоретическому весу, после весовой разница возвращается или доплачивается.</p>" +
                "</div>") +

            '<div class="panel" style="margin-top:16px">' +
              "<h2 style=\"font-size:1.0625rem\">Получение</h2>" +
              '<div class="radio-group" style="margin-top:12px">' +
                '<label class="radio-tile"><input type="radio" name="ship" value="pickup"' + (state.ship === "pickup" ? " checked" : "") + " />" +
                  '<span><span class="radio-tile__t">Самовывоз со склада</span>' +
                  '<span class="radio-tile__d">' + esc(WH[state.wh].name) + "</span></span></label>" +
                '<label class="radio-tile"><input type="radio" name="ship" value="delivery"' + (state.ship === "delivery" ? " checked" : "") + " />" +
                  '<span><span class="radio-tile__t">Доставка на объект</span>' +
                  '<span class="radio-tile__d">Стоимость считает менеджер по адресу и весу</span></span></label>' +
              "</div>" +

              (state.ship === "pickup"
                ? '<label class="field" style="margin-top:16px">' +
                    '<span class="field__label">Время подачи машины</span>' +
                    '<select class="select" name="slot" id="slot">' +
                      ["08:00", "10:00", "12:00", "14:00", "16:00"].map(function (t) {
                        return '<option value="' + attr(t) + '"' + (state.slot === t ? " selected" : "") + ">" + esc(t) + "</option>";
                      }).join("") +
                    "</select>" +
                  "</label>"
                : '<label class="field" data-field="addr" style="margin-top:16px">' +
                    '<span class="field__label">Адрес объекта <span class="req">*</span></span>' +
                    '<input class="input" name="addr" placeholder="Город, улица, дом" required />' +
                    '<span class="field__error">Укажите, куда везти</span>' +
                  "</label>") +

              '<label class="field" style="margin-top:16px">' +
                '<span class="field__label">Кузов</span>' +
                '<select class="select" name="truck" id="truck">' +
                  '<option value="open"' + (state.truck === "open" ? " selected" : "") + ">Шаланда, верхняя погрузка</option>" +
                  '<option value="manip"' + (state.truck === "manip" ? " selected" : "") + ">Манипулятор</option>" +
                  '<option value="closed"' + (state.truck === "closed" ? " selected" : "") + ">Крытая фура</option>" +
                "</select>" +
              "</label>" +
              (long
                ? '<div class="callout ' + (truckBlocked ? "callout--bad" : "callout--ok") + '" style="margin-top:14px">' +
                  '<span class="callout__icon">' + (truckBlocked ? "!" : "✓") + "</span><span>" +
                  (truckBlocked
                    ? "В заказе хлысты 11,7–12 м — в крытую фуру они не входят. Выберите шаланду или манипулятор."
                    : "Выбранный кузов подходит для длинномера в заказе.") +
                  "</span></div>"
                : "") +
            "</div>" +

          "</div>" +

          "<div>" +
            '<div class="panel checkout-summary">' +
              "<h2 style=\"font-size:1.0625rem\">Ваш заказ</h2>" +
              '<table class="table table--plain" style="margin-top:12px"><tbody>' +
                rows.map(function (r) {
                  return "<tr><th style=\"width:62%\">" + esc(r.s.name) + '<div class="xs muted">' + fmt2(r.tons) + " т</div></th>" +
                    '<td class="num">' + fmt(priceNow(r.s) * r.tons) + " ₽</td></tr>";
                }).join("") +
              "</tbody></table>" +
              '<hr class="divider" />' +
              '<table class="table table--plain"><tbody>' +
                '<tr><th>По теоретическому весу</th><td class="num">' + fmt(theory) + " ₽</td></tr>" +
                (svc ? '<tr><th>Услуги</th><td class="num">' + fmt(svc) + " ₽</td></tr>" : "") +
                '<tr><th>Запас на фактический вес</th><td class="num">+' + fmt(hold) + " ₽</td></tr>" +
              "</tbody></table>" +
              '<div class="callout callout--info" style="margin-top:16px">' +
                '<span class="callout__icon">Σ</span>' +
                '<span>К резервированию <b class="num">' + fmt(theory + hold + svc) + "</b> ₽. " +
                  "Итоговая сумма — после весовой, она попадёт в УПД.</span>" +
              "</div>" +

              '<label class="check" style="margin-top:20px" data-field="consent">' +
                '<input type="checkbox" name="consent" required />' +
                '<span class="small">Согласен на обработку персональных данных в соответствии с ' +
                  '<a href="#/privacy">политикой конфиденциальности</a> <span class="req">*</span>' +
                  '<span class="field__error">Без согласия оформить заказ нельзя</span></span>' +
              "</label>" +

              (left
                ? '<div class="callout callout--ok" style="margin-top:16px"><span class="callout__icon">✓</span>' +
                  '<span>Резерв активен, осталось <b class="timer num" id="tm">' + mmss(left) + "</b></span></div>"
                : "") +

              '<div style="margin-top:20px;display:grid;gap:10px">' +
                '<button class="btn btn--lg btn--block" type="submit"' + (truckBlocked ? " disabled" : "") + ">" +
                  (state.payer === "b2b" ? "Получить счёт и резерв на 30 минут" : "Оформить и оплатить") + "</button>" +
                '<button class="btn btn--lg btn--secondary btn--block" type="button" id="dlKp">' + icon("doc") + " Скачать коммерческое предложение</button>" +
              "</div>" +
              '<p class="xs muted" style="margin-top:14px">Прототип: форма пока не отправляет данные на сервер.</p>' +
            "</div>" +
          "</div>" +
        "</div>" +
        "</form>" +
      "</div>"
    );
  }

  /* ---- О компании ---- */
  function viewAbout() {
    return (
      '<div class="container section section--tight">' +
        breadcrumbs([{ label: "Главная", href: "/" }, { label: "О компании" }]) +
        '<div class="section-head">' +
          '<p class="eyebrow">О компании</p>' +
          '<h1 id="pageTitle" tabindex="-1">' + esc(CO.short) + "</h1>" +
          '<p class="lead">Общество с ограниченной ответственностью, зарегистрировано ' + esc(CO.ogrnDate) +
            " в Челябинске. Работаем с НДС, отгружаем юридическим и физическим лицам.</p>" +
        "</div>" +

        '<div class="grid grid--2" style="align-items:start;gap:24px">' +
          '<div class="panel">' +
            "<h2 style=\"font-size:1.0625rem\">Карточка партнёра</h2>" +
            '<p class="small muted" style="margin-top:8px">Те же данные, что в PDF — можно скопировать прямо отсюда.</p>' +
            '<table class="req-table" style="margin-top:16px"><tbody>' +
              "<tr><th>Полное наименование</th><td>" + esc(CO.full) + "</td></tr>" +
              "<tr><th>Сокращённое наименование</th><td>" + esc(CO.short) + "</td></tr>" +
              '<tr><th>ИНН</th><td class="num">' + esc(CO.inn) + "</td></tr>" +
              '<tr><th>КПП</th><td class="num">' + esc(CO.kpp) + "</td></tr>" +
              '<tr><th>ОГРН / дата регистрации</th><td class="num">' + esc(CO.ogrn) + " / " + esc(CO.ogrnDate) + "</td></tr>" +
              "<tr><th>Юридический адрес</th><td>" + esc(CO.addrLegal) + "</td></tr>" +
              "<tr><th>Фактический адрес</th><td>" + esc(CO.addrFact) + "</td></tr>" +
              "<tr><th>Генеральный директор</th><td>" + esc(CO.ceo) + "</td></tr>" +
              "<tr><th>Учредитель</th><td>" + esc(CO.founder) + "</td></tr>" +
              "<tr><th>Уставный капитал</th><td>" + esc(CO.capital) + "</td></tr>" +
              '<tr><th>ОКПО</th><td class="num">' + esc(CO.okpo) + "</td></tr>" +
              "<tr><th>Банк</th><td>" + esc(CO.bank) + "</td></tr>" +
              '<tr><th>Расчётный счёт</th><td class="num">' + esc(CO.rs) + "</td></tr>" +
              '<tr><th>БИК</th><td class="num">' + esc(CO.bik) + "</td></tr>" +
              '<tr><th>Корреспондентский счёт</th><td class="num">' + esc(CO.ks) + "</td></tr>" +
              "<tr><th>Телефон</th><td>" + esc(CO.phone) + "</td></tr>" +
              "<tr><th>НДС</th><td>" + esc(CO.vat) + "</td></tr>" +
            "</tbody></table>" +
            '<div class="row" style="margin-top:20px">' +
              (CO.pdf ? '<a class="btn" href="' + attr(CO.pdf) + '" download>' + icon("doc") + " Скачать карточку, PDF</a>" : "") +
              '<button class="btn btn--secondary" id="copyReq">Скопировать реквизиты</button>' +
            "</div>" +
          "</div>" +

          '<div class="stack-4">' +
            '<div class="panel">' +
              "<h2 style=\"font-size:1.0625rem\">Чем занимаемся</h2>" +
              '<ul class="list-check" style="margin-top:14px">' +
                "<li>Металлопрокат и трубопроводная арматура со склада</li>" +
                "<li>Подбор позиций по смете заказчика</li>" +
                "<li>Резка в размер и упаковка партии</li>" +
                "<li>Отгрузка юрлицам по счёту с НДС и физлицам с чеком</li>" +
              "</ul>" +
              '<p class="xs muted" style="margin-top:16px">Список услуг сформирован по составу прототипа. ' +
                "Финальную формулировку подтверждает руководитель компании.</p>" +
            "</div>" +
            '<div class="panel">' +
              "<h2 style=\"font-size:1.0625rem\">Проверьте нас до оплаты</h2>" +
              '<p class="small muted" style="margin-top:10px">Мы открыто публикуем ИНН и ОГРН. ' +
                "Проверить регистрацию можно на сайте налоговой по ИНН " + esc(CO.inn) + " — это занимает минуту " +
                "и защищает вас от фирм-однодневок.</p>" +
              '<div class="row" style="margin-top:16px">' +
                '<span class="chip chip--brand">В ЕГРЮЛ с ' + esc(CO.ogrnDate) + "</span>" +
                '<span class="chip">' + YEARS + " лет работы</span>" +
              "</div>" +
            "</div>" +
            '<div class="panel">' +
              "<h2 style=\"font-size:1.0625rem\">Контакты</h2>" +
              '<dl class="dl-inline" style="margin-top:14px">' +
                '<dt>Телефон</dt><dd><a href="' + attr(TEL) + '">' + esc(CO.phone) + "</a></dd>" +
                "<dt>Адрес</dt><dd>" + esc(CO.addrFact) + "</dd>" +
              "</dl>" +
              '<div class="row" style="margin-top:18px"><a class="btn btn--secondary" href="#/contacts">Написать нам</a></div>' +
            "</div>" +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  /* ---- Доставка и оплата ---- */
  function viewDelivery() {
    return (
      '<div class="container section section--tight">' +
        breadcrumbs([{ label: "Главная", href: "/" }, { label: "Доставка и оплата" }]) +
        '<div class="section-head">' +
          '<p class="eyebrow">Условия</p>' +
          '<h1 id="pageTitle" tabindex="-1">Доставка и оплата</h1>' +
          '<p class="lead">Как считается сумма, что такое запас на фактический вес и почему длинномер не влезает в крытую фуру.</p>' +
        "</div>" +

        '<div class="grid grid--2" style="align-items:start;gap:24px">' +
          '<div class="panel">' +
            "<h2 style=\"font-size:1.0625rem\">Оплата</h2>" +
            '<ul class="list-check" style="margin-top:14px">' +
              "<li>Юридическим лицам — счёт с НДС 20%, закрывающие документы и УПД</li>" +
              "<li>По согласованному лимиту возможна отсрочка платежа</li>" +
              "<li>Физическим лицам — карта или СБП, чек по 54-ФЗ</li>" +
              "<li>Деловой лом идёт отдельным счётом: по нему НДС платит покупатель как налоговый агент, статья 161 НК</li>" +
            "</ul>" +
          "</div>" +
          '<div class="panel">' +
            "<h2 style=\"font-size:1.0625rem\">Теоретический и фактический вес</h2>" +
            '<p class="small muted" style="margin-top:10px">Прокат продаётся по весу, но точный вес партии известен только после весовой. ' +
              "Поэтому счёт выставляется по теоретическому весу ГОСТ, а сверху закладывается запас 7–10%. " +
              "После взвешивания разница либо возвращается, либо доплачивается — и попадает в итоговый УПД.</p>" +
          "</div>" +
          '<div class="panel">' +
            "<h2 style=\"font-size:1.0625rem\">Отгрузка</h2>" +
            '<ul class="list-check" style="margin-top:14px">' +
              "<li>Самовывоз по выбранному времени подачи машины</li>" +
              "<li>Доставка на объект — стоимость считает менеджер по адресу и весу</li>" +
              "<li>Хлысты 11,7–12 м грузятся только на шаланду или открытый борт, краном сверху</li>" +
              "<li>Позиции с разных складов оформляются отдельными заказами</li>" +
            "</ul>" +
          "</div>" +
          '<div class="panel">' +
            "<h2 style=\"font-size:1.0625rem\">Резерв 30 минут</h2>" +
            '<p class="small muted" style="margin-top:10px">Когда счёт выставлен, позиции уходят в резерв на 30 минут. ' +
              "Таймер показывает реальное состояние: если резерв снят, счётчик исчезает. " +
              "Это защищает от ситуации, когда оплаченная позиция уже уехала другому покупателю.</p>" +
          "</div>" +
        "</div>" +

        '<div class="panel" style="margin-top:24px">' +
          '<div class="row row--between">' +
            "<div><h2 style=\"font-size:1.0625rem\">Остались вопросы по условиям?</h2>" +
            '<p class="small muted" style="margin-top:6px">Позвоните — ответим сразу.</p></div>' +
            '<a class="btn btn--lg" href="' + attr(TEL) + '">' + icon("phone") + " " + esc(CO.phone) + "</a>" +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  /* ---- Контакты ---- */
  function viewContacts() {
    /* пришли с кнопки «Запросить» — сразу подставляем позицию в текст заявки */
    const askedId = state.route.query.get("item") || "";
    const asked = askedId ? SKU.find(function (x) { return x.id === askedId; }) : null;
    const pre = asked ? "Нужна цена и срок: " + asked.name + " (артикул " + asked.id + ")" : "";
    return (
      '<div class="container section section--tight">' +
        breadcrumbs([{ label: "Главная", href: "/" }, { label: "Контакты" }]) +
        '<div class="section-head">' +
          '<p class="eyebrow">Контакты</p>' +
          '<h1 id="pageTitle" tabindex="-1">Связаться с нами</h1>' +
        "</div>" +
        '<div class="grid grid--2" style="align-items:start;gap:24px">' +
          '<div class="stack-4">' +
            '<div class="panel">' +
              '<p class="eyebrow">Телефон</p>' +
              '<p class="price price--lg" style="margin-top:8px"><a href="' + attr(TEL) + '">' + esc(CO.phone) + "</a></p>" +
              '<p class="small muted" style="margin-top:10px">' + esc(CO.city) + ", " + esc(CO.addrFact) + "</p>" +
            "</div>" +
            '<div class="panel">' +
              '<p class="eyebrow">Реквизиты</p>' +
              '<p class="small" style="margin-top:10px">' + esc(CO.short) + "<br>ИНН " + esc(CO.inn) +
                " · КПП " + esc(CO.kpp) + "<br>ОГРН " + esc(CO.ogrn) + "</p>" +
              '<div class="row" style="margin-top:16px"><a class="btn btn--secondary btn--sm" href="#/about">Все реквизиты</a>' +
              (CO.pdf ? '<a class="btn btn--secondary btn--sm" href="' + attr(CO.pdf) + '" download>Карточка PDF</a>' : "") + "</div>" +
            "</div>" +
          "</div>" +
          leadForm("leadContacts", "Написать нам", "Опишите задачу — вернёмся с ценой, наличием и сроком.", pre) +
        "</div>" +
      "</div>"
    );
  }

  /* ---- Политика ---- */
  function viewPrivacy() {
    return (
      '<div class="container container--narrow section section--tight">' +
        breadcrumbs([{ label: "Главная", href: "/" }, { label: "Политика конфиденциальности" }]) +
        '<h1 id="pageTitle" tabindex="-1">Политика обработки персональных данных</h1>' +
        '<div class="panel stack-4" style="margin-top:24px">' +
          "<p class=\"small\"><b>1. Кто обрабатывает данные.</b> " + esc(CO.full) + ", ИНН " + esc(CO.inn) +
            ", адрес: " + esc(CO.addrLegal) + ".</p>" +
          '<p class="small"><b>2. Какие данные собираются.</b> Имя, телефон, адрес электронной почты, ' +
            "ИНН организации и текст обращения — то, что вы сами указываете в форме заявки или оформления заказа.</p>" +
          '<p class="small"><b>3. Зачем.</b> Чтобы связаться с вами по заявке, подготовить счёт и документы, ' +
            "согласовать отгрузку. В рекламных рассылках данные не используются без отдельного согласия.</p>" +
          '<p class="small"><b>4. Сколько хранятся.</b> До достижения цели обработки либо до отзыва согласия, ' +
            "а в части бухгалтерских документов — в течение сроков, установленных законодательством.</p>" +
          '<p class="small"><b>5. Передача третьим лицам.</b> Данные не продаются и не передаются третьим лицам, ' +
            "кроме случаев, прямо предусмотренных законом.</p>" +
          '<p class="small"><b>6. Как отозвать согласие.</b> Напишите или позвоните по телефону ' + esc(CO.phone) +
            " — обработка будет прекращена.</p>" +
          '<div class="callout callout--warn"><span class="callout__icon">!</span>' +
            "<span>Это рабочий шаблон для прототипа. Перед публикацией сайта текст должен проверить юрист " +
            "и дополнить его под фактические процессы компании.</span></div>" +
        "</div>" +
      "</div>"
    );
  }

  /* ---- Личный кабинет ---- */
  function viewAccount() {
    const tabs = [["people", "Сотрудники"], ["matrix", "Права"], ["invite", "Пригласить"], ["audit", "Журнал"]];
    const roles = [["boss", "Руководитель"], ["supply", "Снабженец"], ["acc", "Бухгалтер"], ["foreman", "Прораб"]];

    return (
      '<div class="container section section--tight">' +
        breadcrumbs([{ label: "Главная", href: "/" }, { label: "Личный кабинет" }]) +
        '<div class="section-head">' +
          '<p class="eyebrow">Кабинет компании</p>' +
          '<h1 id="pageTitle" tabindex="-1">Сотрудники и права</h1>' +
          '<p class="lead">Компания привязана к ИНН. Руководитель приглашает сотрудников и задаёт, ' +
            "кто видит цены, кто выставляет счёт, а кто только забирает груз со склада.</p>" +
        "</div>" +

        '<div class="panel panel--tight" style="margin-bottom:20px">' +
          '<p class="eyebrow">Смотреть интерфейс глазами роли</p>' +
          '<div class="segmented" style="margin-top:10px" role="group" aria-label="Роль">' +
            roles.map(function (r) {
              return '<button type="button" data-role="' + attr(r[0]) + '" aria-pressed="' + (state.role === r[0] ? "true" : "false") + '">' +
                esc(r[1]) + "</button>";
            }).join("") +
          "</div>" +
          '<p class="small muted" style="margin-top:12px">Сейчас вы — ' + esc(ROLE_NAME[state.role]) + ". " +
            (canIam() ? "Редактирование открыто." : "Менять состав и роли может только руководитель.") + "</p>" +
        "</div>" +

        '<div class="tabs" role="tablist">' +
          tabs.map(function (t) {
            return '<button role="tab" data-lktab="' + attr(t[0]) + '" aria-selected="' + (state.lkTab === t[0] ? "true" : "false") + '">' +
              esc(t[1]) + "</button>";
          }).join("") +
        "</div>" +

        (state.lkTab === "people" ? lkPeople() : "") +
        (state.lkTab === "matrix" ? lkMatrix() : "") +
        (state.lkTab === "invite" ? lkInvite() : "") +
        (state.lkTab === "audit" ? lkAudit() : "") +
      "</div>"
    );
  }

  function lkPeople() {
    return (
      '<div class="panel">' +
        '<div class="row row--between">' +
          "<h2 style=\"font-size:1.0625rem\">Штат компании</h2>" +
          '<span class="small muted">' +
            state.staff.filter(function (s) { return s.status !== "blocked"; }).length + " активных и приглашённых</span>" +
        "</div>" +
        '<div style="margin-top:8px">' +
        state.staff.map(function (s) {
          const badge = s.status === "active" ? "chip--ok" : s.status === "blocked" ? "chip--bad" : "chip--warn";
          const badgeText = s.status === "active" ? "работает" : s.status === "blocked" ? "заблокирован" : "приглашён";
          return (
            '<div class="person">' +
              "<div><b>" + esc(s.fio) + "</b>" +
                '<div class="xs muted">' + esc(ROLE_NAME[s.role]) + " · " + esc(s.mail || "почта не указана") + "</div>" +
                '<div class="xs muted">склады: ' + esc(s.wh.map(function (w) { return WH[w] ? WH[w].short : w; }).join(", ")) + "</div></div>" +
              '<div><span class="chip ' + badge + '">' + esc(badgeText) + "</span></div>" +
              '<div class="xs muted">' +
                (s.role === "boss" ? "лимит компании" : s.limit ? "лимит " + fmt(s.limit) + " ₽" : "без личного лимита") +
                "<br>счёт: " + (s.invoice ? "да" : "нет") + " · оплата: " + (s.pay ? "да" : "нет") +
              "</div>" +
              "<div>" +
                (canIam() && s.role !== "boss"
                  ? '<div style="display:grid;gap:8px;min-width:170px">' +
                      '<label class="visually-hidden" for="role-' + attr(s.id) + '">Роль ' + attr(s.fio) + "</label>" +
                      '<select class="select" id="role-' + attr(s.id) + '" data-editrole="' + attr(s.id) + '">' +
                        Object.keys(ROLE_NAME).map(function (k) {
                          return '<option value="' + attr(k) + '"' + (s.role === k ? " selected" : "") + ">" + esc(ROLE_NAME[k]) + "</option>";
                        }).join("") +
                      "</select>" +
                      '<button class="btn btn--sm btn--secondary" data-toggle="' + attr(s.id) + '">' +
                        (s.status === "blocked" ? "Разблокировать" : "Заблокировать") + "</button>" +
                    "</div>"
                  : '<span class="xs muted">' + (s.role === "boss" ? "руководителя снять нельзя" : "только просмотр") + "</span>") +
              "</div>" +
            "</div>"
          );
        }).join("") +
        "</div>" +
      "</div>"
    );
  }

  function permCell(v) {
    if (v === "Y") return '<td class="yes">да</td>';
    if (v === "C") return '<td class="cond">по настройке</td>';
    return '<td class="no">нет</td>';
  }

  function lkMatrix() {
    return (
      '<div class="panel">' +
        "<h2 style=\"font-size:1.0625rem\">Что может каждая роль</h2>" +
        '<p class="small muted" style="margin-top:8px">«По настройке» — право включается галочкой в карточке сотрудника, а не самой ролью.</p>' +
        '<div class="table-scroll" style="margin-top:16px;border:0">' +
          '<table class="matrix">' +
            "<thead><tr>" +
              '<th scope="col">Действие</th><th scope="col">Снабженец</th><th scope="col">Руководитель</th>' +
              '<th scope="col">Бухгалтер</th><th scope="col">Прораб</th>' +
            "</tr></thead><tbody>" +
            PERMS.map(function (p) {
              return "<tr><th scope=\"row\">" + esc(p[1]) + "</th>" +
                permCell(p[2].supply) + permCell(p[2].boss) + permCell(p[2].acc) + permCell(p[2].foreman) + "</tr>";
            }).join("") +
            "</tbody></table>" +
        "</div>" +
      "</div>"
    );
  }

  function lkInvite() {
    if (!canIam()) {
      return '<div class="panel"><p class="small">Приглашать сотрудников может только руководитель — ' +
        "иначе размывается ответственность за резерв и лимит компании.</p></div>";
    }
    return (
      '<form class="panel" id="inviteForm" novalidate>' +
        "<h2 style=\"font-size:1.0625rem\">Пригласить сотрудника</h2>" +
        '<p class="small muted" style="margin-top:8px">Человек присоединится к вашей компании по ИНН. Новое юрлицо не создаётся.</p>' +
        '<div style="margin-top:20px">' +
          '<div class="field-row field-row--2">' +
            '<label class="field" data-field="fio"><span class="field__label">ФИО <span class="req">*</span></span>' +
              '<input class="input" name="fio" placeholder="Фамилия Имя Отчество" required />' +
              '<span class="field__error">Впишите ФИО</span></label>' +
            '<label class="field" data-field="mail"><span class="field__label">Почта или телефон <span class="req">*</span></span>' +
              '<input class="input" name="mail" placeholder="сотрудник@company.ru" required />' +
              '<span class="field__error">Нужен контакт для приглашения</span></label>' +
          "</div>" +
          '<div class="field-row field-row--2">' +
            '<label class="field"><span class="field__label">Роль</span>' +
              '<select class="select" name="role">' +
                '<option value="supply">Снабженец</option><option value="acc">Бухгалтер</option>' +
                '<option value="foreman">Прораб</option><option value="boss">Ещё один руководитель</option>' +
              "</select></label>" +
            '<label class="field" data-field="limit"><span class="field__label">Личный лимит, ₽</span>' +
              '<input class="input" name="limit" type="number" min="0" step="1000" value="0" />' +
              '<span class="field__hint">Не выше лимита компании 1 800 000 ₽</span>' +
              '<span class="field__error">Лимит сотрудника не может превышать лимит компании</span></label>' +
          "</div>" +
          '<fieldset style="border:0;padding:0;margin:20px 0 0">' +
            '<legend class="field__label" style="padding:0">Доступные склады</legend>' +
            '<div style="display:grid;gap:8px;margin-top:8px">' +
              WH_KEYS.map(function (w) {
                return '<label class="check check--card"><input type="checkbox" class="invWh" value="' + attr(w) + '"' +
                  (w !== "EKB" ? " checked" : "") + " /><span>" + esc(WH[w].name) + "</span></label>";
              }).join("") +
              '<label class="check check--card"><input type="checkbox" name="invoice" /><span>Может выставлять счёт</span></label>' +
            "</div>" +
          "</fieldset>" +
          '<div class="row" style="margin-top:20px"><button class="btn btn--lg" type="submit">Отправить приглашение</button></div>' +
        "</div>" +
      "</form>"
    );
  }

  function lkAudit() {
    return (
      '<div class="panel panel--flush">' +
        '<div style="padding:24px 24px 0"><h2 style="font-size:1.0625rem">Журнал изменений</h2>' +
        '<p class="small muted" style="margin-top:8px">Смена роли без записи в журнал невозможна.</p></div>' +
        '<div class="table-scroll" style="border:0;margin-top:16px">' +
          '<table class="table"><thead><tr>' +
            '<th scope="col">Когда</th><th scope="col">Кто</th><th scope="col">Что сделал</th>' +
          "</tr></thead><tbody>" +
          state.audit.map(function (a) {
            return '<tr><td class="num">' + esc(a.t) + "</td><td>" + esc(a.who) + "</td><td>" + esc(a.text) + "</td></tr>";
          }).join("") +
          "</tbody></table>" +
        "</div>" +
      "</div>"
    );
  }

  /* ---------- 8. Роутер ---------- */
  const VIEWS = {
    home: viewHome, catalog: viewCatalog, product: viewProduct, smeta: viewSmeta,
    calc: viewCalc, cart: viewCart, checkout: viewCheckout, account: viewAccount,
    about: viewAbout, delivery: viewDelivery, contacts: viewContacts, privacy: viewPrivacy
  };

  const TITLES = {
    home: "СоюзНефтеГаз — трубопроводная арматура и металлопрокат, Челябинск",
    catalog: "Каталог продукции", product: "Позиция каталога",
    smeta: "Подбор по смете", calc: "Калькулятор массы металла",
    cart: "Корзина", checkout: "Оформление заказа", account: "Личный кабинет",
    about: "О компании и реквизиты", delivery: "Доставка и оплата",
    contacts: "Контакты", privacy: "Политика конфиденциальности"
  };

  /* в карточке товара во вкладке браузера полезнее имя позиции, чем «Позиция каталога» */
  function pageTitle() {
    if (state.route.name === "product") {
      const s = SKU.find(function (x) { return x.id === state.route.params.id; });
      if (s) return s.name + " — СоюзНефтеГаз";
    }
    if (state.route.name === "catalog") {
      const g = state.route.query.get("l2") || state.route.query.get("l1");
      if (g) return g + " — СоюзНефтеГаз";
    }
    return TITLES[state.route.name] || TITLES.home;
  }

  function parseHash() {
    const raw = (location.hash || "#/").replace(/^#/, "");
    const parts = raw.split("?");
    const seg = parts[0].split("/").filter(Boolean);
    const query = new URLSearchParams(parts[1] || "");
    if (!seg.length) return { name: "home", params: {}, query: query };
    const name = seg[0];
    if (!VIEWS[name]) return { name: "home", params: {}, query: query };
    return { name: name, params: { id: seg[1] ? decodeURIComponent(seg[1]) : null }, query: query };
  }

  function go(hash) { location.hash = hash; }

  function setQuery(patch, keepScroll) {
    const q = new URLSearchParams(state.route.query.toString());
    Object.keys(patch).forEach(function (k) {
      if (patch[k] === "" || patch[k] === null || patch[k] === undefined) q.delete(k);
      else q.set(k, patch[k]);
    });
    const qs = q.toString();
    const base = "/" + state.route.name + (state.route.params.id ? "/" + encodeURIComponent(state.route.params.id) : "");
    if (keepScroll) pendingScroll = window.scrollY;
    go("#" + base + (qs ? "?" + qs : ""));
  }

  let pendingScroll = null;
  let timerId = null;

  function render() {
    const root = $("#app");
    if (!root) return;
    if (heroViewer) { heroViewer.destroy(); heroViewer = null; }
    const view = VIEWS[state.route.name] || viewHome;
    root.innerHTML = header() + '<main id="main">' + view() + "</main>" + footer();
    document.title = pageTitle();
    bind();
    syncCartCount();
    revealInit();
    heroViewer = initHeroViewer();
    tick();
  }

  function tick() {
    if (timerId) { clearTimeout(timerId); timerId = null; }
    const el = $("#tm");
    if (!el || !state.reserveUntil) return;
    const left = state.reserveUntil - Date.now();
    if (left <= 0) { state.reserveUntil = null; render(); return; }
    el.textContent = mmss(left);
    timerId = setTimeout(tick, 1000);
  }

  function revealInit() {
    const items = $$(".reveal");
    if (!items.length) return;
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    document.documentElement.classList.add("js-anim");
    /* страховка: если наблюдатель почему-то не сработал, через 2 с показываем всё */
    setTimeout(function () { items.forEach(function (el) { el.classList.add("is-in"); }); }, 2000);
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ---------- 9. Валидация форм ---------- */
  function markField(form, name, invalid) {
    const wrap = form.querySelector('[data-field="' + name + '"]');
    if (wrap) wrap.setAttribute("data-invalid", invalid ? "true" : "false");
  }
  const digits = (v) => String(v || "").replace(/\D/g, "");

  function validate(form, rules) {
    const data = new FormData(form);
    let firstBad = null;
    Object.keys(rules).forEach(function (name) {
      const bad = !rules[name](data.get(name), data);
      markField(form, name, bad);
      if (bad && !firstBad) firstBad = name;
    });
    if (firstBad) {
      const wrap = form.querySelector('[data-field="' + firstBad + '"]');
      const input = wrap && wrap.querySelector("input, select, textarea");
      if (input) input.focus();
      toast("Проверьте поля, отмеченные красным");
      return null;
    }
    return data;
  }

  const RULE_NAME = (v) => String(v || "").trim().length >= 2;
  const RULE_PHONE = (v) => digits(v).length >= 10;
  const RULE_CONSENT = (v) => v === "on" || v === "true";

  /* ---------- 10. Обработчики ---------- */
  function bind() {
    /* меню */
    const drawer = $("#drawer");
    const burger = $("#burger");
    function setDrawer(open) {
      if (!drawer) return;
      drawer.setAttribute("data-open", open ? "true" : "false");
      if (burger) burger.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.style.overflow = open ? "hidden" : "";
      if (open) {
        /* панель появляется с переходом — фокусируем, когда она уже видима */
        setTimeout(function () {
          const first = drawer.querySelector(".drawer__link");
          if (first) first.focus();
        }, 240);
      } else if (burger) burger.focus();
    }
    if (burger) burger.addEventListener("click", function () { setDrawer(true); });
    const dc = $("#drawerClose");
    if (dc) dc.addEventListener("click", function () { setDrawer(false); });
    if (drawer) {
      drawer.addEventListener("click", function (e) { if (e.target === drawer) setDrawer(false); });
      $$(".drawer__link, .drawer .btn", drawer).forEach(function (a) {
        a.addEventListener("click", function () { setDrawer(false); });
      });
    }
    document.onkeydown = function (e) {
      if (e.key === "Escape" && drawer && drawer.getAttribute("data-open") === "true") setDrawer(false);
    };

    /* каталог: фильтры */
    const ft = $("#facetsToggle");
    if (ft) ft.addEventListener("click", function () {
      state.facetsOpen = !state.facetsOpen;
      const body = $(".facets__body");
      if (body) body.setAttribute("data-open", state.facetsOpen ? "true" : "false");
      ft.setAttribute("aria-expanded", state.facetsOpen ? "true" : "false");
    });

    const facetForm = $("#facetForm");
    if (facetForm) {
      facetForm.addEventListener("submit", function (e) {
        e.preventDefault();
        const d = new FormData(facetForm);
        state.wh = d.get("wh") || state.wh;
        save("sng_wh", state.wh);
        setQuery({
          q: String(d.get("q") || "").trim(),
          l1: d.get("l1") || "",
          l2: d.get("l2") || "",
          stock: d.get("stock") === "all" ? "all" : "",
          page: ""
        });
      });
      const l1sel = facetForm.querySelector('[name="l1"]');
      if (l1sel) l1sel.addEventListener("change", function () {
        const l2sel = facetForm.querySelector('[name="l2"]');
        if (!l2sel) return;
        const opts = typesOf(l1sel.value);
        l2sel.innerHTML = '<option value="">Все типы</option>' +
          opts.map(function (t) { return '<option value="' + attr(t) + '">' + esc(t) + "</option>"; }).join("");
      });
    }

    $$("[data-sort]").forEach(function (b) {
      b.addEventListener("click", function () {
        setQuery({ sort: b.dataset.sort, dir: b.dataset.next, page: "" }, true);
      });
    });
    const more = $("[data-more]");
    if (more) more.addEventListener("click", function () { setQuery({ page: more.dataset.more }, true); });

    $$("[data-quick]").forEach(function (b) {
      b.addEventListener("click", function () { addToCart(b.dataset.quick, 1); });
    });
    $$("[data-del]").forEach(function (b) {
      b.addEventListener("click", function () { removeFromCart(b.dataset.del); render(); });
    });

    /* карточка товара */
    $$("[data-unit]").forEach(function (b) {
      b.addEventListener("click", function () { state.unit = b.dataset.unit; state.qty = 1; render(); });
    });
    const qty = $("#qty");
    if (qty) qty.addEventListener("input", function () {
      state.qty = Number(qty.value) || 0;
      const s = SKU.find(function (x) { return x.id === state.route.params.id; });
      if (!s) return;
      const tons = toTons(s, state.unit, state.qty);
      const out = $(".qty-out");
      if (out) out.innerHTML = "<span>= <b class=\"num\">" + fmt2(tons) + "</b> т · <b class=\"num\">" +
        fmt(priceNow(s) * tons) + "</b> ₽</span>";
      $$(".price-ladder tr").forEach(function (tr, i) {
        const active = (i === 0 && tons > 0 && tons < 1) || (i === 1 && tons >= 1 && tons < 5) ||
          (i === 2 && tons >= 5 && tons < 20) || (i === 3 && tons >= 20);
        tr.setAttribute("data-active", active ? "true" : "false");
      });
    });
    const cutOn = $("#cutOn");
    if (cutOn) cutOn.addEventListener("change", function () { state.cutOn = cutOn.checked; });
    const packOn = $("#packOn");
    if (packOn) packOn.addEventListener("change", function () { state.packOn = packOn.checked; });

    const addCart = $("#addCart");
    if (addCart) addCart.addEventListener("click", function () {
      const s = SKU.find(function (x) { return x.id === state.route.params.id; });
      if (!s) return;
      let tons = toTons(s, state.unit, state.qty);
      if (tons <= 0) { toast("Укажите количество больше нуля"); return; }
      tons = coilRound(s, tons);
      addToCart(s.id, tons);
    });

    /* смета */
    const runSmeta = $("#runSmeta");
    if (runSmeta) runSmeta.addEventListener("click", function () {
      state.smetaRows = [
        { src: "Арматура 12 А500С — 4,8 т", dst: "Арматура А500С Ø12 мм, МД 11.7", lvl: "HIGH", id: "ARM-A500-12-MD" },
        { src: "Лист 10 ст3 — 8 т", dst: "Лист г/к ст3 10 мм, 1500×6000", lvl: "HIGH", id: "SH-HR-ST3-10-1500x6000" },
        { src: "304-я 2 мм — 1,2 т", dst: "Лист н/ж AISI 304, 2 мм — нужно выбрать отделку", lvl: "MID", id: "SS-304-2-1250x2500-M" },
        { src: "Обрезь листа ст3 — 2 т", dst: "Деловой лом, лист ст3 · НДС платит покупатель", lvl: "HIGH", id: "SCR-SH-ST3" },
        { src: "Профтруба 40×20×2 — 1 т", dst: "Нет на складе — подберёт менеджер", lvl: "REJECT", id: "" }
      ];
      render();
    });
    const resetSmeta = $("#resetSmeta");
    if (resetSmeta) resetSmeta.addEventListener("click", function () { state.smetaRows = null; render(); });
    $$("[data-add]").forEach(function (b) {
      b.addEventListener("click", function () {
        const id = b.dataset.add;
        if (!id) return;
        const s = SKU.find(function (x) { return x.id === id; });
        if (!s) { toast("Позиции нет в каталоге"); return; }
        if (isScrap(s)) state.auth = true;
        addToCart(id, 1);
      });
    });
    const moveHigh = $("#moveHigh");
    if (moveHigh) moveHigh.addEventListener("click", function () {
      const list = (state.smetaRows || []).filter(function (r) { return r.lvl === "HIGH" && r.id; });
      if (!list.length) { toast("Нечего переносить"); return; }
      list.forEach(function (r) { addToCart(r.id, 1); });
      go("#/cart");
    });

    /* калькулятор */
    const calcForm = $("#calcForm");
    if (calcForm) {
      renderCalcDims();
      calcForm.addEventListener("submit", function (e) { e.preventDefault(); });
      calcForm.addEventListener("input", runCalc);
      const kind = $("#calcKind");
      if (kind) kind.addEventListener("change", renderCalcDims);
    }

    /* оформление */
    $$("[data-payer]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.payer = b.dataset.payer;
        state.auth = state.payer === "b2b";
        render();
      });
    });
    $$('input[name="ship"]').forEach(function (r) {
      r.addEventListener("change", function () { state.ship = r.value; render(); });
    });
    const slot = $("#slot");
    if (slot) slot.addEventListener("change", function () { state.slot = slot.value; });
    const truck = $("#truck");
    if (truck) truck.addEventListener("change", function () { state.truck = truck.value; render(); });
    const dlKp = $("#dlKp");
    if (dlKp) dlKp.addEventListener("click", function () {
      toast("Коммерческое предложение формируется — в прототипе файл не выгружается");
    });

    const checkoutForm = $("#checkoutForm");
    if (checkoutForm) checkoutForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const rules = { name: RULE_NAME, phone: RULE_PHONE, consent: RULE_CONSENT };
      if (state.payer === "b2b") {
        rules.email = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || "").trim()); };
        rules.inn = function (v) { const d = digits(v); return d.length === 10 || d.length === 12; };
      }
      if (state.ship === "delivery") rules.addr = function (v) { return String(v || "").trim().length >= 5; };
      const data = validate(checkoutForm, rules);
      if (!data) return;
      state.reserveUntil = Date.now() + 30 * 60 * 1000;
      toast(state.payer === "b2b" ? "Счёт формируется, позиции в резерве 30 минут" : "Заказ оформлен", "ok");
      render();
    });

    /* формы заявки */
    ["leadHome", "leadContacts"].forEach(function (id) {
      const f = $("#" + id);
      if (!f) return;
      f.addEventListener("submit", function (e) {
        e.preventDefault();
        const data = validate(f, { name: RULE_NAME, phone: RULE_PHONE, consent: RULE_CONSENT });
        if (!data) return;
        f.innerHTML =
          '<div class="callout callout--ok"><span class="callout__icon">✓</span>' +
          "<span><b>Заявка принята.</b> Свяжемся по телефону " + esc(data.get("phone")) + " в рабочее время.<br>" +
          '<span class="xs">Прототип: данные никуда не отправляются, форма показана как есть.</span></span></div>';
        toast("Заявка принята", "ok");
      });
    });

    /* кабинет */
    $$("[data-role]").forEach(function (b) {
      b.addEventListener("click", function () { state.role = b.dataset.role; render(); });
    });
    $$("[data-lktab]").forEach(function (b) {
      b.addEventListener("click", function () { state.lkTab = b.dataset.lktab; render(); });
    });
    $$("[data-editrole]").forEach(function (sel) {
      sel.addEventListener("change", function () {
        const u = state.staff.find(function (x) { return x.id === sel.dataset.editrole; });
        if (!u || !canIam()) return;
        const from = ROLE_NAME[u.role];
        u.role = sel.value;
        logIam("Роль «" + u.fio + "»: " + from + " → " + ROLE_NAME[u.role]);
        toast("Роль обновлена", "ok");
        render();
      });
    });
    $$("[data-toggle]").forEach(function (b) {
      b.addEventListener("click", function () {
        const u = state.staff.find(function (x) { return x.id === b.dataset.toggle; });
        if (!u || !canIam() || u.role === "boss") return;
        u.status = u.status === "blocked" ? "active" : "blocked";
        logIam((u.status === "blocked" ? "Заблокирован" : "Разблокирован") + " · " + u.fio);
        saveIam();
        render();
      });
    });

    const inviteForm = $("#inviteForm");
    if (inviteForm) inviteForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const data = validate(inviteForm, {
        fio: RULE_NAME,
        mail: function (v) { return String(v || "").trim().length >= 5; },
        limit: function (v, d) { return d.get("role") !== "supply" || Number(v || 0) <= 1800000; }
      });
      if (!data) return;
      const wh = $$(".invWh").filter(function (x) { return x.checked; }).map(function (x) { return x.value; });
      state.staff.push({
        id: "u" + Date.now(),
        fio: String(data.get("fio")).trim(),
        mail: String(data.get("mail")).trim(),
        role: data.get("role"),
        status: "invited",
        wh: wh.length ? wh : ["MSK"],
        limit: Number(data.get("limit") || 0),
        invoice: data.get("invoice") === "on",
        pay: data.get("role") === "acc"
      });
      logIam("Приглашение: " + String(data.get("fio")).trim() + " · " + ROLE_NAME[data.get("role")] +
        " · склады " + (wh.length ? wh.join(", ") : "MSK"));
      state.lkTab = "people";
      toast("Приглашение отправлено", "ok");
      render();
    });

    /* реквизиты */
    const copyReq = $("#copyReq");
    if (copyReq) copyReq.addEventListener("click", function () {
      const text = [
        CO.full, "ИНН " + CO.inn, "КПП " + CO.kpp, "ОГРН " + CO.ogrn,
        "Юридический адрес: " + CO.addrLegal, "Генеральный директор: " + CO.ceo,
        "Банк: " + CO.bank, "Р/с " + CO.rs, "БИК " + CO.bik, "К/с " + CO.ks,
        "Телефон: " + CO.phone, CO.vat
      ].join("\n");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          function () { toast("Реквизиты скопированы", "ok"); },
          function () { toast("Не удалось скопировать — выделите текст вручную"); }
        );
      } else toast("Браузер не разрешил копирование");
    });
  }

  /* ---------- 11. Старт ---------- */
  function onRoute() {
    const prev = state.route;
    state.route = parseHash();
    if (prev.name !== state.route.name || prev.params.id !== state.route.params.id) {
      state.facetsOpen = false;
      if (state.route.name === "product") { state.qty = 1; state.unit = "t"; }
    }
    render();
    if (pendingScroll !== null) {
      window.scrollTo(0, pendingScroll);
      pendingScroll = null;
    } else {
      window.scrollTo(0, 0);
      const h = $("#pageTitle");
      if (h && state.route.name !== "home") h.focus({ preventScroll: true });
    }
  }

  window.addEventListener("hashchange", onRoute);
  document.addEventListener("DOMContentLoaded", onRoute);
  if (document.readyState !== "loading") onRoute();

  window.SNG = { state: state, go: go, render: render };
})();
