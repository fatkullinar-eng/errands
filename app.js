/* Поручения — веб-версия MVP по заказу Weblancer #1265080.
   Две роли, статусы заказов, чат, фото, админ-панель.
   Демо-режим: данные и роли хранятся в браузере, сервера нет. */

(() => {
  "use strict";

  const KEY = "errands-v1";

  const USERS = {
    client: { id: "u-client", name: "Анна" },
    executor: { id: "u-exec", name: "Игорь" },
    admin: { id: "u-admin", name: "Администратор" },
  };

  const ROLE_LABELS = { client: "Клиент", executor: "Исполнитель", admin: "Админ" };

  const CATEGORIES = ["Покупки", "Доставка", "Дом", "Документы", "Другое"];

  const STATUS = {
    new: { label: "Новый", cls: "new" },
    in_progress: { label: "В работе", cls: "progress" },
    done: { label: "Выполнен", cls: "done" },
    cancelled: { label: "Отменён", cls: "cancelled" },
  };

  const ALLOWED = {
    client: ["orders", "new", "order"],
    executor: ["feed", "mine", "order"],
    admin: ["admin", "stats", "order"],
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[ch]));

  const uid = (prefix) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  /* ---------- форматирование ---------- */

  function formatDate(ts) {
    if (!ts) return "—";
    return new Date(ts).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  }

  function formatDateShort(ts) {
    if (!ts) return "—";
    return new Date(ts).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
  }

  function formatTime(ts) {
    if (!ts) return "";
    return new Date(ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }

  function money(value) {
    return new Intl.NumberFormat("ru-RU").format(Number(value) || 0) + " ₽";
  }

  function userName(id) {
    if (!id) return null;
    const entry = Object.values(USERS).find((user) => user.id === id);
    return entry ? entry.name : "Пользователь";
  }

  /* ---------- состояние ---------- */

  function seedState() {
    const now = Date.now();
    const hour = 3600 * 1000;
    return {
      version: 1,
      role: "client",
      theme: "light",
      orders: [
        {
          id: "o-seed-1",
          title: "Купить продукты по списку",
          description: "Список пришлю в чат: молоко, хлеб, яйца, овощи. Оплата наличными, чек нужен.",
          category: "Покупки",
          address: "Москва, ул. Лесная, 7",
          budget: 500,
          photo: null,
          clientId: USERS.client.id,
          executorId: null,
          status: "new",
          createdAt: now - hour * 2,
          acceptedAt: null,
          completedAt: null,
          messages: [],
        },
        {
          id: "o-seed-2",
          title: "Забрать посылку из пункта выдачи",
          description: "Посылка оплачена, нужен код получения. Забрать до 20:00 и привезти домой.",
          category: "Доставка",
          address: "ПВЗ на Ленина, 12 → ул. Мира, 4",
          budget: 400,
          photo: null,
          clientId: USERS.client.id,
          executorId: USERS.executor.id,
          status: "in_progress",
          createdAt: now - hour * 6,
          acceptedAt: now - hour * 5,
          completedAt: null,
          messages: [
            { id: "m1", from: USERS.client.id, text: "Здравствуйте! Код получения 4521, посылка небольшая.", photo: null, at: now - hour * 5 },
            { id: "m2", from: USERS.executor.id, text: "Принял. Буду в ПВЗ примерно через час.", photo: null, at: now - hour * 4 },
          ],
        },
        {
          id: "o-seed-3",
          title: "Собрать шкаф",
          description: "Шкаф из ИКЕА, инструкция есть. Инструменты свои, мусор нужно вынести.",
          category: "Дом",
          address: "Москва, ул. Мира, 4, кв. 18",
          budget: 1500,
          photo: null,
          clientId: USERS.client.id,
          executorId: USERS.executor.id,
          status: "done",
          createdAt: now - 86400000 * 5,
          acceptedAt: now - 86400000 * 4,
          completedAt: now - 86400000 * 3,
          messages: [
            { id: "m3", from: USERS.executor.id, text: "Шкаф собрал, упаковку вынес. Фото прилагаю.", photo: null, at: now - 86400000 * 3 },
          ],
        },
        {
          id: "o-seed-4",
          title: "Оплатить квитанции",
          description: "Две квитанции ЖКХ, сумма 4 300 ₽. Оплатить в приложении банка и прислать чеки.",
          category: "Документы",
          address: "Удалённо",
          budget: 300,
          photo: null,
          clientId: USERS.client.id,
          executorId: null,
          status: "new",
          createdAt: now - hour * 12,
          acceptedAt: null,
          completedAt: null,
          messages: [],
        },
      ],
    };
  }

  function normalize(saved) {
    const statuses = Object.keys(STATUS);
    return {
      version: 1,
      role: ["client", "executor", "admin"].includes(saved.role) ? saved.role : "client",
      theme: saved.theme === "dark" ? "dark" : "light",
      orders: (Array.isArray(saved.orders) ? saved.orders : []).map((order) => ({
        id: String(order.id || uid("o")),
        title: String(order.title || "Без названия"),
        description: String(order.description || ""),
        category: CATEGORIES.includes(order.category) ? order.category : "Другое",
        address: String(order.address || ""),
        budget: Math.max(0, Number(order.budget) || 0),
        photo: typeof order.photo === "string" ? order.photo : null,
        clientId: USERS.client.id,
        executorId: order.executorId || null,
        status: statuses.includes(order.status) ? order.status : "new",
        createdAt: Number(order.createdAt) || Date.now(),
        acceptedAt: Number(order.acceptedAt) || null,
        completedAt: Number(order.completedAt) || null,
        messages: (Array.isArray(order.messages) ? order.messages : [])
          .filter((message) => message && (typeof message.text === "string" || message.photo))
          .map((message) => ({
            id: String(message.id || uid("m")),
            from: message.from || null,
            text: String(message.text || "").slice(0, 500),
            photo: typeof message.photo === "string" ? message.photo : null,
            at: Number(message.at) || Date.now(),
          })),
      })),
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (error) {
      console.warn("Не удалось прочитать данные:", error);
    }
    return seedState();
  }

  let state = loadState();
  let pendingOrderPhoto = null;
  let pendingChatPhoto = null;
  let toastTimer = null;

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      toast("Не хватает места в браузере. Удалите фото или старые заказы.");
      return false;
    }
  }

  /* ---------- роли и маршруты ---------- */

  const me = () => USERS[state.role];
  const orderById = (id) => state.orders.find((order) => order.id === id) || null;

  function roleHome(role = state.role) {
    if (role === "executor") return "feed";
    if (role === "admin") return "admin";
    return "orders";
  }

  function parseRoute() {
    const raw = (location.hash || "").replace(/^#\/?/, "");
    const [view, id] = raw.split("/");
    return { view: view || roleHome(), id: id || null };
  }

  function tabsFor(role) {
    if (role === "executor") {
      return [
        { view: "feed", title: "Доступные" },
        { view: "mine", title: "Мои заказы" },
      ];
    }
    if (role === "admin") {
      return [
        { view: "admin", title: "Все заказы" },
        { view: "stats", title: "Сводка" },
      ];
    }
    return [
      { view: "orders", title: "Мои заказы" },
      { view: "new", title: "Новый заказ" },
    ];
  }

  function renderTabs(view) {
    const tabs = $("#tabs");
    const active = view === "order" ? roleHome() : view;
    tabs.innerHTML = tabsFor(state.role).map((tab) => `
      <button class="tab ${tab.view === active ? "is-active" : ""}" data-view="${tab.view}">${tab.title}</button>`).join("");
  }

  function render() {
    let { view, id } = parseRoute();

    if (!ALLOWED[state.role].includes(view)) {
      const known = ["orders", "new", "feed", "mine", "admin", "stats", "order"];
      view = known.includes(view) ? roleHome() : "404";
      id = null;
    }

    $$(".role-btn").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.role === state.role);
    });

    renderTabs(view);

    if (view === "orders") app.innerHTML = renderOrders();
    else if (view === "new") app.innerHTML = renderNewOrder();
    else if (view === "feed") app.innerHTML = renderFeed();
    else if (view === "mine") app.innerHTML = renderMine();
    else if (view === "admin") app.innerHTML = renderAdmin();
    else if (view === "stats") app.innerHTML = renderStats();
    else if (view === "order") app.innerHTML = renderOrder(id);
    else app.innerHTML = renderNotFound();

    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  const app = $("#app");
  const modalRoot = $("#modalRoot");

  /* ---------- элементы интерфейса ---------- */

  function statusBadge(status) {
    const info = STATUS[status] || STATUS.new;
    return `<span class="badge ${info.cls}">${info.label}</span>`;
  }

  function orderCard(order, footer) {
    return `
      <div class="order-card">
        <div class="order-top">
          <div>
            <a class="order-title" href="#/order/${order.id}">${escapeHtml(order.title)}</a>
            <div class="order-desc">${escapeHtml(order.description || "Без описания")}</div>
          </div>
          ${statusBadge(order.status)}
        </div>
        <div class="order-meta">
          <span class="chip-meta">${escapeHtml(order.category)}</span>
          <span class="chip-meta">${escapeHtml(order.address || "Адрес не указан")}</span>
          <span class="chip-meta">${money(order.budget)}</span>
          <span class="chip-meta">${formatDate(order.createdAt)}</span>
        </div>
        ${footer ? `<div class="row-buttons">${footer}</div>` : ""}
      </div>`;
  }

  /* ---------- экраны ---------- */

  function renderOrders() {
    const mine = state.orders
      .filter((order) => order.clientId === me().id)
      .sort((a, b) => b.createdAt - a.createdAt);

    return `
      <div class="page-head">
        <h1>Мои заказы</h1>
        <p>${mine.length ? `Всего ${mine.length}. Статусы обновляются по ходу работы.` : "Пока ни одного заказа."}</p>
      </div>

      <div class="row-buttons" style="margin-bottom:14px">
        <a class="btn btn-primary" href="#/new">Создать заказ</a>
      </div>

      <div class="order-list">
        ${mine.length
          ? mine.map((order) => orderCard(order, `<a class="btn btn-sm" href="#/order/${order.id}">Открыть</a>`)).join("")
          : `<div class="empty">Создайте первый заказ — исполнитель увидит его в ленте.</div>`}
      </div>`;
  }

  function renderNewOrder() {
    const categoryOptions = CATEGORIES.map((category) => `<option value="${category}">${category}</option>`).join("");

    return `
      <a class="btn btn-sm" href="#/orders" style="margin-bottom:12px">← Назад</a>
      <div class="page-head">
        <h1>Новый заказ</h1>
        <p>Опишите задачу, укажите адрес и вознаграждение</p>
      </div>

      <div class="card">
        <form id="orderForm">
          <div class="field">
            <label for="orderTitle">Что нужно сделать</label>
            <input id="orderTitle" name="title" required maxlength="80" placeholder="Например, купить продукты">
          </div>
          <div class="field">
            <label for="orderDescription">Подробности</label>
            <textarea id="orderDescription" name="description" rows="3" maxlength="500" placeholder="Список, пожелания, детали"></textarea>
          </div>
          <div class="field-row">
            <div class="field">
              <label for="orderCategory">Категория</label>
              <select id="orderCategory" name="category">${categoryOptions}</select>
            </div>
            <div class="field">
              <label for="orderBudget">Вознаграждение, ₽</label>
              <input id="orderBudget" name="budget" type="number" min="0" step="50" value="300">
            </div>
          </div>
          <div class="field">
            <label for="orderAddress">Адрес или «удалённо»</label>
            <input id="orderAddress" name="address" maxlength="120" placeholder="Москва, ул. Лесная, 7">
          </div>
          <div class="field">
            <label>Фото (необязательно)</label>
            <label class="attach-btn" title="Прикрепить фото">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10"></path><path d="m3 16 5-5 4 4 3-3 3 3"></path><circle cx="9" cy="8" r="1.5"></circle></svg>
              <input type="file" id="orderPhoto" accept="image/*">
            </label>
            <div class="attach-preview" id="orderPhotoPreview"></div>
            <span class="hint">Список покупок, фото товара, документ</span>
          </div>
          <div class="row-buttons">
            <button class="btn btn-primary" type="submit">Опубликовать заказ</button>
          </div>
        </form>
      </div>`;
  }

  function renderFeed() {
    const available = state.orders
      .filter((order) => order.status === "new")
      .sort((a, b) => a.createdAt - b.createdAt);

    return `
      <div class="page-head">
        <h1>Доступные заказы</h1>
        <p>${available.length ? `Новых заказов: ${available.length}. Возьмите подходящий.` : "Новых заказов пока нет."}</p>
      </div>

      <div class="order-list">
        ${available.length
          ? available.map((order) => orderCard(order, `
              <a class="btn btn-sm" href="#/order/${order.id}">Открыть</a>
              <button class="btn btn-sm btn-primary" data-action="take" data-id="${order.id}">Взять заказ</button>`)).join("")
          : `<div class="empty">Загляните позже — клиенты добавляют заказы в течение дня.</div>`}
      </div>`;
  }

  function renderMine() {
    const mine = state.orders
      .filter((order) => order.executorId === me().id)
      .sort((a, b) => (b.acceptedAt || 0) - (a.acceptedAt || 0));

    const active = mine.filter((order) => order.status === "in_progress");
    const finished = mine.filter((order) => order.status !== "in_progress");

    const block = (title, list) => `
      <div class="section-title">${title}</div>
      <div class="order-list">
        ${list.length
          ? list.map((order) => orderCard(order, `<a class="btn btn-sm" href="#/order/${order.id}">Открыть</a>`)).join("")
          : `<div class="empty">Пусто.</div>`}
      </div>`;

    return `
      <div class="page-head">
        <h1>Мои заказы</h1>
        <p>В работе: ${active.length} · Завершено и отменено: ${finished.length}</p>
      </div>
      ${block("В работе", active)}
      ${block("Завершённые и отменённые", finished)}`;
  }

  function renderAdmin() {
    const counts = { new: 0, in_progress: 0, done: 0, cancelled: 0 };
    state.orders.forEach((order) => { counts[order.status] = (counts[order.status] || 0) + 1; });

    const rows = state.orders
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((order) => {
        const canCancel = order.status === "new" || order.status === "in_progress";
        return `
          <tr>
            <td><a href="#/order/${order.id}">${escapeHtml(order.title)}</a></td>
            <td>${escapeHtml(order.category)}</td>
            <td>${money(order.budget)}</td>
            <td>${escapeHtml(userName(order.executorId) || "—")}</td>
            <td>${statusBadge(order.status)}</td>
            <td>${formatDateShort(order.createdAt)}</td>
            <td>${canCancel ? `<button class="btn btn-sm btn-danger" data-action="cancel" data-id="${order.id}">Отменить</button>` : ""}</td>
          </tr>`;
      })
      .join("");

    return `
      <div class="page-head">
        <h1>Все заказы</h1>
        <p>Контроль сервиса: статусы, исполнители, отмены</p>
      </div>

      <div class="stat-grid">
        <div class="stat"><div class="label">Новые</div><div class="value">${counts.new || 0}</div></div>
        <div class="stat"><div class="label">В работе</div><div class="value">${counts.in_progress || 0}</div></div>
        <div class="stat"><div class="label">Выполнено</div><div class="value">${counts.done || 0}</div></div>
        <div class="stat"><div class="label">Отменено</div><div class="value">${counts.cancelled || 0}</div></div>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Заказ</th><th>Категория</th><th>Сумма</th><th>Исполнитель</th><th>Статус</th><th>Дата</th><th></th></tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="7">Заказов нет</td></tr>`}</tbody>
        </table>
      </div>`;
  }

  function renderStats() {
    const total = state.orders.length;
    const done = state.orders.filter((order) => order.status === "done");
    const sumDone = done.reduce((sum, order) => sum + order.budget, 0);
    const avg = done.length ? Math.round(sumDone / done.length) : 0;

    const byCategory = CATEGORIES.map((category) => {
      const list = state.orders.filter((order) => order.category === category);
      const count = list.length;
      const percent = total ? Math.round((count / total) * 100) : 0;
      return { category, count, percent };
    });

    const bars = byCategory.map((item) => `
      <div style="display:grid;gap:6px">
        <div style="display:flex;justify-content:space-between;font-size:14px">
          <b>${escapeHtml(item.category)}</b><span style="color:var(--muted)">${item.count}</span>
        </div>
        <div style="height:8px;border-radius:999px;background:var(--surface-2);overflow:hidden">
          <i style="display:block;height:100%;width:${item.percent}%;background:var(--accent)"></i>
        </div>
      </div>`).join("");

    return `
      <div class="page-head">
        <h1>Сводка</h1>
        <p>Цифры по сервису за всё время</p>
      </div>

      <div class="stat-grid">
        <div class="stat"><div class="label">Всего заказов</div><div class="value">${total}</div></div>
        <div class="stat"><div class="label">Выполнено</div><div class="value">${done.length}</div></div>
        <div class="stat"><div class="label">Сумма выполненных</div><div class="value" style="font-size:20px">${money(sumDone)}</div></div>
        <div class="stat"><div class="label">Средний чек</div><div class="value" style="font-size:20px">${money(avg)}</div></div>
      </div>

      <div class="section-title">По категориям</div>
      <div class="card">
        <div style="display:grid;gap:14px">${bars}</div>
      </div>`;
  }

  function renderOrder(id) {
    const order = orderById(id);
    if (!order) return renderNotFound();

    const canTake = state.role === "executor" && order.status === "new";
    const canComplete = state.role === "executor" && order.status === "in_progress" && order.executorId === me().id;
    const canCancel = (state.role === "client" && order.status === "new")
      || (state.role === "admin" && (order.status === "new" || order.status === "in_progress"));

    const steps = [
      { key: "new", label: "Новый" },
      { key: "in_progress", label: "В работе" },
      { key: "done", label: "Выполнен" },
    ];
    const orderIndex = steps.findIndex((step) => step.key === order.status);
    const stepsHtml = order.status === "cancelled"
      ? `<div class="empty" style="margin:14px 0">Заказ отменён</div>`
      : `<div class="steps">${steps.map((step, index) => `
          <div class="step ${index < orderIndex ? "is-done" : ""} ${index === orderIndex ? "is-current" : ""}">${step.label}</div>`).join("")}
        </div>`;

    const actions = [];
    if (canTake) actions.push(`<button class="btn btn-primary" data-action="take" data-id="${order.id}">Взять заказ</button>`);
    if (canComplete) actions.push(`<button class="btn btn-primary" data-action="complete" data-id="${order.id}">Завершить заказ</button>`);
    if (canCancel) actions.push(`<button class="btn btn-danger" data-action="cancel" data-id="${order.id}">Отменить заказ</button>`);

    const messages = order.messages.map((message) => {
      const mine = message.from === me().id;
      const author = message.from ? userName(message.from) : "Система";
      return `
        <div class="msg ${mine ? "mine" : ""}">
          <div class="msg-author">${escapeHtml(author)} · ${formatTime(message.at)}</div>
          ${message.text ? `<div>${escapeHtml(message.text)}</div>` : ""}
          ${message.photo ? `<img class="msg-photo" src="${message.photo}" alt="Фото в сообщении">` : ""}
        </div>`;
    }).join("");

    return `
      <a class="btn btn-sm" href="#/${roleHome()}" style="margin-bottom:12px">← Назад</a>

      <div class="detail-head">
        <div>
          <h1 class="detail-title">${escapeHtml(order.title)}</h1>
          <div class="order-meta">
            <span class="chip-meta">${escapeHtml(order.category)}</span>
            <span class="chip-meta">${money(order.budget)}</span>
            <span class="chip-meta">${escapeHtml(order.address || "Адрес не указан")}</span>
          </div>
        </div>
        ${statusBadge(order.status)}
      </div>

      ${stepsHtml}

      <div class="detail-grid">
        <div class="detail-item"><div class="label">Клиент</div><div class="value">${escapeHtml(userName(order.clientId) || "—")}</div></div>
        <div class="detail-item"><div class="label">Исполнитель</div><div class="value">${escapeHtml(userName(order.executorId) || "не назначен")}</div></div>
        <div class="detail-item"><div class="label">Создан</div><div class="value">${formatDate(order.createdAt)}</div></div>
        <div class="detail-item"><div class="label">Завершён</div><div class="value">${order.completedAt ? formatDate(order.completedAt) : "—"}</div></div>
      </div>

      ${order.description ? `<div class="card" style="margin-bottom:12px"><p style="margin:0">${escapeHtml(order.description)}</p></div>` : ""}
      ${order.photo ? `<div class="card" style="margin-bottom:12px"><img class="photo" src="${order.photo}" alt="Фото заказа"></div>` : ""}

      ${actions.length ? `<div class="row-buttons" style="margin-bottom:16px">${actions.join("")}</div>` : ""}

      <div class="section-title">Чат по заказу</div>
      <div class="card">
        <div class="chat" id="chat">
          ${messages || `<div class="empty">Сообщений пока нет. Напишите первым.</div>`}
        </div>
        <form id="chatForm" data-id="${order.id}">
          <div class="attach-preview" id="chatPhotoPreview"></div>
          <div class="chat-form">
            <label class="attach-btn" title="Прикрепить фото">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.4 11.6 12.3 20.7a5 5 0 0 1-7.1-7.1l8.5-8.5a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-2.8-2.8l7.8-7.8"></path></svg>
              <input type="file" id="chatPhoto" accept="image/*">
            </label>
            <textarea name="text" maxlength="500" placeholder="Написать сообщение" rows="1"></textarea>
            <button class="btn btn-primary" type="submit">Отправить</button>
          </div>
        </form>
      </div>`;
  }

  function renderNotFound() {
    return `
      <div class="page-head">
        <h1>404 — страница не найдена</h1>
        <p>Такого раздела или заказа нет.</p>
      </div>
      <div class="row-buttons"><a class="btn btn-primary" href="#/${roleHome()}">На главную</a></div>`;
  }

  /* ---------- фото ---------- */

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          const max = 900;
          const scale = Math.min(1, max / Math.max(image.width, image.height));
          const width = Math.max(1, Math.round(image.width * scale));
          const height = Math.max(1, Math.round(image.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d").drawImage(image, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.7));
        };
        image.onerror = reject;
        image.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleFile(file, target) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Можно прикрепить только изображение");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast("Файл больше 8 МБ");
      return;
    }
    try {
      const data = await fileToDataUrl(file);
      if (target === "order") {
        pendingOrderPhoto = data;
        const preview = $("#orderPhotoPreview");
        if (preview) preview.innerHTML = `<img src="${data}" alt="Фото заказа"><button type="button" class="btn btn-sm" data-action="clear-order-photo">Убрать</button>`;
      } else {
        pendingChatPhoto = data;
        const preview = $("#chatPhotoPreview");
        if (preview) preview.innerHTML = `<img src="${data}" alt="Фото к сообщению"><button type="button" class="btn btn-sm" data-action="clear-chat-photo">Убрать</button>`;
      }
    } catch (error) {
      toast("Не удалось прочитать изображение");
    }
  }

  /* ---------- действия ---------- */

  function toast(message) {
    const node = $("#toast");
    node.textContent = message;
    node.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove("is-visible"), 2400);
  }

  function systemMessage(order, text) {
    order.messages.push({ id: uid("m"), from: null, text, photo: null, at: Date.now() });
  }

  function takeOrder(id) {
    const order = orderById(id);
    if (!order || order.status !== "new") return;
    order.executorId = me().id;
    order.status = "in_progress";
    order.acceptedAt = Date.now();
    systemMessage(order, `Заказ взял исполнитель ${me().name}`);
    if (save()) {
      render();
      toast("Заказ взят в работу");
    }
  }

  function completeOrder(id) {
    const order = orderById(id);
    if (!order || order.status !== "in_progress" || order.executorId !== me().id) return;
    order.status = "done";
    order.completedAt = Date.now();
    systemMessage(order, "Заказ выполнен");
    if (save()) {
      render();
      toast("Заказ завершён");
    }
  }

  function cancelOrder(id) {
    const order = orderById(id);
    if (!order) return;
    const allowed = (state.role === "client" && order.clientId === me().id && order.status === "new")
      || (state.role === "admin" && (order.status === "new" || order.status === "in_progress"));
    if (!allowed) return;
    if (!window.confirm(`Отменить заказ «${order.title}»?`)) return;
    order.status = "cancelled";
    systemMessage(order, "Заказ отменён");
    if (save()) {
      render();
      toast("Заказ отменён");
    }
  }

  function sendMessage(orderId, text, photo) {
    const order = orderById(orderId);
    if (!order) return;
    if (!text && !photo) {
      toast("Напишите сообщение или прикрепите фото");
      return;
    }
    order.messages.push({ id: uid("m"), from: me().id, text: text.slice(0, 500), photo: photo || null, at: Date.now() });
    pendingChatPhoto = null;
    if (save()) {
      render();
      const chat = $("#chat");
      if (chat) chat.scrollTop = chat.scrollHeight;
    }
  }

  function createOrder(form) {
    const data = new FormData(form);
    const title = String(data.get("title") || "").trim();
    if (!title) return;
    const order = {
      id: uid("o"),
      title,
      description: String(data.get("description") || "").trim(),
      category: CATEGORIES.includes(String(data.get("category"))) ? String(data.get("category")) : "Другое",
      address: String(data.get("address") || "").trim(),
      budget: Math.max(0, Number(data.get("budget")) || 0),
      photo: pendingOrderPhoto,
      clientId: me().id,
      executorId: null,
      status: "new",
      createdAt: Date.now(),
      acceptedAt: null,
      completedAt: null,
      messages: [],
    };
    state.orders.unshift(order);
    pendingOrderPhoto = null;
    if (save()) {
      location.hash = "#/order/" + order.id;
      toast("Заказ опубликован");
    }
  }

  function applyTheme() {
    document.documentElement.dataset.theme = state.theme;
  }

  function toggleTheme() {
    state.theme = state.theme === "light" ? "dark" : "light";
    applyTheme();
    save();
    render();
  }

  /* ---------- события ---------- */

  document.addEventListener("click", (event) => {
    const roleButton = event.target.closest(".role-btn");
    if (roleButton) {
      state.role = roleButton.dataset.role;
      save();
      const target = "#/" + roleHome();
      if (location.hash === target) render();
      else location.hash = target;
      return;
    }

    if (event.target.closest("#themeToggle")) {
      toggleTheme();
      return;
    }

    const tab = event.target.closest(".tab");
    if (tab) {
      const target = "#/" + tab.dataset.view;
      if (location.hash === target) render();
      else location.hash = target;
      return;
    }

    const overlay = event.target.closest(".modal-overlay");
    if (overlay && event.target === overlay) {
      modalRoot.innerHTML = "";
      return;
    }

    const button = event.target.closest("[data-action]");
    if (!button) return;
    const { action, id } = button.dataset;

    if (action === "take") takeOrder(id);
    else if (action === "complete") completeOrder(id);
    else if (action === "cancel") cancelOrder(id);
    else if (action === "clear-order-photo") {
      pendingOrderPhoto = null;
      const preview = $("#orderPhotoPreview");
      if (preview) preview.innerHTML = "";
    } else if (action === "clear-chat-photo") {
      pendingChatPhoto = null;
      const preview = $("#chatPhotoPreview");
      if (preview) preview.innerHTML = "";
    }
  });

  document.addEventListener("submit", (event) => {
    const id = event.target.getAttribute("id");
    if (id === "orderForm") {
      event.preventDefault();
      createOrder(event.target);
      return;
    }
    if (id === "chatForm") {
      event.preventDefault();
      const text = (event.target.querySelector("textarea[name=text]")?.value || "").trim();
      sendMessage(event.target.dataset.id, text, pendingChatPhoto);
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.id === "orderPhoto") handleFile(event.target.files[0], "order");
    if (event.target.id === "chatPhoto") handleFile(event.target.files[0], "chat");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") modalRoot.innerHTML = "";
  });

  window.addEventListener("hashchange", render);

  /* ---------- старт ---------- */

  applyTheme();

  if (!location.hash) location.hash = "#/" + roleHome();
  render();
})();
