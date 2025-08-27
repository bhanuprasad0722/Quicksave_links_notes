// QuickSave Links & Notes — popup.js
document.addEventListener("DOMContentLoaded", () => {
  const els = {
    linkTitle: document.getElementById('linkTitle'),
    linkUrl: document.getElementById('linkUrl'),
    saveLinkBtn: document.getElementById('saveLinkBtn'),
    copyTitleBtn: document.getElementById('copyTitleBtn'),
    copyUrlBtn: document.getElementById('copyUrlBtn'),
    noteText: document.getElementById('noteText'),
    addNoteBtn: document.getElementById('addNoteBtn'),
    clearNoteInputBtn: document.getElementById('clearNoteInputBtn'),
    linksList: document.getElementById('linksList'),
    notesList: document.getElementById('notesList'),
    filterStarred: document.getElementById('filterStarred')
  };

  // Utils
  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  const now = () => new Date().toISOString();
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied');
    } catch (e) {
      toast('Copy failed');
    }
  };
  let toastTimer = null;
  function toast(msg) {
    clearTimeout(toastTimer);
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    toastTimer = setTimeout(() => t.remove(), 1400);
  }

  // Storage
  async function getItems() {
    return new Promise((resolve) => {
      chrome.storage.local.get({ items: [] }, (res) => resolve(res.items));
    });
  }
  async function setItems(items) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ items }, () => resolve());
    });
  }

  // Prefill from current tab
  async function prefillFromActiveTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        els.linkTitle.value = tab.title || '';
        els.linkUrl.value = tab.url || '';
      }
    } catch (e) {
      // ignore if no permission
    }
  }

  // Renderers
  async function render() {
    const items = await getItems();
    const onlyStarred = els.filterStarred.checked;
    const links = items.filter(i => i.type === 'link' && (!onlyStarred || i.starred));
    const notes = items.filter(i => i.type === 'note' && (!onlyStarred || i.starred));
    renderLinks(links);
    renderNotes(notes);
  }

  function renderLinks(links) {
    els.linksList.innerHTML = '';
    if (!links.length) {
      const li = document.createElement('li');
      li.className = 'item';
      li.innerHTML = '<div class="item-sub">No links yet</div>';
      els.linksList.appendChild(li);
      return;
    }

    for (const link of links.sort((a, b) => (b.starred - a.starred) || (b.createdAt.localeCompare(a.createdAt)))) {
      const li = document.createElement('li');
      li.className = 'item';

      const top = document.createElement('div');
      top.className = 'item-top';
      const title = document.createElement('div');
      title.className = 'item-title';
      title.textContent = link.title || link.url;

      const starBtn = document.createElement('button');
      starBtn.className = 'icon' + (link.starred ? ' starred' : '');
      starBtn.textContent = link.starred ? '★' : '☆';
      starBtn.addEventListener('click', async () => {
        link.starred = !link.starred;
        await upsert(link);
        render();
      });

      top.append(title, starBtn);

      const sub = document.createElement('div');
      sub.className = 'item-sub';
      sub.textContent = link.url;

      const actions = document.createElement('div');
      actions.className = 'item-actions';

      const openBtn = document.createElement('button');
      openBtn.textContent = 'Open';
      openBtn.addEventListener('click', () => chrome.tabs.create({ url: link.url }));

      const copyUrlBtn = document.createElement('button');
      copyUrlBtn.className = 'ghost';
      copyUrlBtn.textContent = 'Copy URL';
      copyUrlBtn.addEventListener('click', () => copy(link.url));

      const copyTitleBtn = document.createElement('button');
      copyTitleBtn.className = 'ghost';
      copyTitleBtn.textContent = 'Copy Title';
      copyTitleBtn.addEventListener('click', () => copy(link.title || ''));

      const delBtn = document.createElement('button');
      delBtn.className = 'icon danger';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', async () => {
        await remove(link.id);
        render();
      });

      actions.append(openBtn, copyUrlBtn, copyTitleBtn, delBtn);
      li.append(top, sub, actions);
      els.linksList.appendChild(li);
    }
  }

  function renderNotes(notes) {
    els.notesList.innerHTML = '';
    if (!notes.length) {
      const li = document.createElement('li');
      li.className = 'item';
      li.innerHTML = '<div class="item-sub">No notes yet</div>';
      els.notesList.appendChild(li);
      return;
    }

    for (const note of notes.sort((a, b) => (b.starred - a.starred) || (b.createdAt.localeCompare(a.createdAt)))) {
      const li = document.createElement('li');
      li.className = 'item';

      const top = document.createElement('div');
      top.className = 'item-top';
      const title = document.createElement('div');
      title.className = 'item-title';
      title.textContent = note.text.length > 80 ? note.text.slice(0, 80) + '…' : note.text || 'Untitled note';

      const starBtn = document.createElement('button');
      starBtn.className = 'icon' + (note.starred ? ' starred' : '');
      starBtn.textContent = note.starred ? '★' : '☆';
      starBtn.addEventListener('click', async () => {
        note.starred = !note.starred;
        await upsert(note);
        render();
      });

      top.append(title, starBtn);

      const sub = document.createElement('div');
      sub.className = 'item-sub';
      sub.textContent = note.text;

      const actions = document.createElement('div');
      actions.className = 'item-actions';

      const copyBtn = document.createElement('button');
      copyBtn.className = 'ghost';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', () => copy(note.text));

      const delBtn = document.createElement('button');
      delBtn.className = 'icon danger';
      delBtn.textContent = 'Delete Note';
      delBtn.addEventListener('click', async () => {
        await remove(note.id);
        render();
      });

      actions.append(copyBtn, delBtn);
      li.append(top, sub, actions);
      els.notesList.appendChild(li);
    }
  }

  // CRUD
  async function upsert(item) {
    const items = await getItems();
    const idx = items.findIndex(i => i.id === item.id);
    if (idx >= 0) items[idx] = item; else items.unshift(item);
    await setItems(items);
  }
  async function remove(id) {
    const items = await getItems();
    await setItems(items.filter(i => i.id !== id));
  }

  // Event handlers
  els.saveLinkBtn.addEventListener('click', async () => {
    const title = els.linkTitle.value.trim();
    const url = els.linkUrl.value.trim();
    if (!url) { toast('URL required'); return; }
    const item = { id: uid(), type: 'link', title, url, starred: false, createdAt: now() };
    await upsert(item);
    toast('Link saved');
    render();
  });

  els.copyTitleBtn.addEventListener('click', () => copy(els.linkTitle.value.trim()));
  els.copyUrlBtn.addEventListener('click', () => copy(els.linkUrl.value.trim()));

  els.addNoteBtn.addEventListener('click', async () => {
    const text = els.noteText.value.trim();
    if (!text) { toast('Note can\'t be empty'); return; }
    const item = { id: uid(), type: 'note', text, starred: false, createdAt: now() };
    await upsert(item);
    els.noteText.value = '';
    toast('Note added');
    render();
  });

  els.clearNoteInputBtn.addEventListener('click', () => { els.noteText.value = ''; });
  els.filterStarred.addEventListener('change', render);

  // Init
  prefillFromActiveTab();
  render();
});
