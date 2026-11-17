import { getAllPets, savePet, removePet, replaceAllPets } from "./db.js";

const $ = id => document.getElementById(id);
const dialog = $("petDialog");
let pets = [];
let editingPhotos = [];
let newPhotos = [];
let toastTimer;

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
}
function esc(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}
function imageUrl(blob) {
  return blob instanceof Blob ? URL.createObjectURL(blob) : "";
}
function fmt(value) { return value && String(value).trim() ? esc(value) : "Не указано"; }

async function refresh() {
  pets = await getAllPets();
  render();
}
function render() {
  const query = $("searchInput").value.trim().toLocaleLowerCase("ru");
  const type = $("typeFilter").value;
  const status = $("statusFilter").value;
  const sort = $("sortFilter").value;
  let list = pets.filter(p => {
    const haystack = `${p.name} ${p.location || ""}`.toLocaleLowerCase("ru");
    return haystack.includes(query) && (!type || p.type === type) && (!status || p.status === status);
  });
  if (sort === "name") list.sort((a,b) => a.name.localeCompare(b.name, "ru"));
  else if (sort === "old") list.sort((a,b) => a.createdAt - b.createdAt);
  else list.sort((a,b) => b.createdAt - a.createdAt);

  $("totalCount").textContent = pets.length;
  $("treatmentCount").textContent = pets.filter(p => p.status === "На лечении").length;
  $("homeCount").textContent = pets.filter(p => p.status === "Ищет дом").length;
  $("shownCount").textContent = `Показано: ${list.length}`;
  const grid = $("petGrid");
  grid.innerHTML = "";
  if (!list.length) {
    grid.innerHTML = `<div class="empty">${pets.length ? "По заданным условиям питомцы не найдены." : "Пока нет карточек. Нажмите «Добавить питомца», чтобы создать первую."}</div>`;
    return;
  }
  for (const p of list) {
    const firstPhoto = p.photos?.[0] ? imageUrl(p.photos[0]) : "";
    const unit = document.createElement("article");
    unit.className = "pet-unit";
    unit.innerHTML = `
      <div class="flip-card" tabindex="0" role="button" aria-label="Перевернуть карточку ${esc(p.name)}">
        <div class="flip-inner">
          <div class="card-face front">
            ${firstPhoto ? `<img src="${firstPhoto}" alt="${esc(p.name)}">` : `<div class="no-photo">Фото не добавлено</div>`}
            <div class="front-shade"></div>
            <span class="status-pill">${esc(p.status)}</span>
            <div class="front-name">${esc(p.name)}</div>
          </div>
          <div class="card-face back">
            <h3>${esc(p.name)}</h3>
            <div class="info"><b>Вид животного</b>${fmt(p.type)}</div>
            <div class="info"><b>Место обитания</b>${fmt(p.location)}</div>
            <div class="info"><b>Лечение</b>${fmt(p.treatment || "Лечение не требуется")}</div>
            <div class="info"><b>Питание</b>${fmt(p.food)}</div>
            <div class="info"><b>Дополнительные заметки</b>${fmt(p.notes)}</div>
            <div class="info"><b>Фотографий</b>${p.photos?.length || 0}</div>
            <div class="card-actions">
              <button class="edit-btn" type="button">Изменить</button>
              <button class="delete-btn" type="button">Удалить</button>
            </div>
          </div>
        </div>
      </div>
      <div class="flip-hint">Нажмите на карточку, чтобы перевернуть</div>`;
    const card = unit.querySelector(".flip-card");
    card.addEventListener("click", () => card.classList.toggle("flipped"));
    card.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); card.classList.toggle("flipped"); }
    });
    unit.querySelector(".back").addEventListener("click", e => e.stopPropagation());
    unit.querySelector(".edit-btn").addEventListener("click", () => openEdit(p.id));
    unit.querySelector(".delete-btn").addEventListener("click", () => deleteOne(p.id));
    grid.append(unit);
  }
}

function resetForm() {
  $("petForm").reset();
  $("petId").value = "";
  editingPhotos = [];
  newPhotos = [];
  $("photoPreview").innerHTML = "";
}
function openAdd() {
  resetForm();
  $("dialogTitle").textContent = "Новый питомец";
  dialog.showModal();
}
function openEdit(id) {
  const p = pets.find(x => x.id === id);
  if (!p) return;
  resetForm();
  $("dialogTitle").textContent = "Редактирование карточки";
  $("petId").value = p.id;
  $("petName").value = p.name;
  $("petType").value = p.type;
  $("petStatus").value = p.status;
  $("petLocation").value = p.location || "";
  $("petTreatment").value = p.treatment || "";
  $("petFood").value = p.food || "";
  $("petNotes").value = p.notes || "";
  editingPhotos = [...(p.photos || [])];
  updatePreview();
  dialog.showModal();
}
function updatePreview() {
  const box = $("photoPreview");
  box.innerHTML = "";
  [...editingPhotos, ...newPhotos].forEach((blob, i) => {
    const img = document.createElement("img");
    img.className = "photo-thumb";
    img.src = URL.createObjectURL(blob);
    img.alt = `Фото ${i+1}`;
    box.append(img);
  });
}
async function deleteOne(id) {
  if (!confirm("Удалить эту карточку? Это действие нельзя отменить.")) return;
  await removePet(id);
  await refresh();
  toast("Карточка удалена");
}

$("addBtn").addEventListener("click", openAdd);
$("closeDialog").addEventListener("click", () => dialog.close());
$("cancelBtn").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
["searchInput","typeFilter","statusFilter","sortFilter"].forEach(id =>
  $(id).addEventListener(id === "searchInput" ? "input" : "change", render)
);
$("petPhotos").addEventListener("change", e => {
  const files = [...e.target.files].filter(f => f.type.startsWith("image/"));
  newPhotos.push(...files);
  e.target.value = "";
  updatePreview();
});

$("petForm").addEventListener("submit", async e => {
  e.preventDefault();
  const name = $("petName").value.trim();
  if (!name) return;
  const id = $("petId").value || crypto.randomUUID();
  const old = pets.find(p => p.id === id);
  const pet = {
    id, name,
    type: $("petType").value,
    status: $("petStatus").value,
    location: $("petLocation").value.trim(),
    treatment: $("petTreatment").value.trim(),
    food: $("petFood").value.trim(),
    notes: $("petNotes").value.trim(),
    photos: [...editingPhotos, ...newPhotos],
    createdAt: old?.createdAt || Date.now(),
    updatedAt: Date.now()
  };
  try {
    await savePet(pet);
    dialog.close();
    await refresh();
    toast("Карточка сохранена");
  } catch (err) {
    console.error(err);
    toast("Не удалось сохранить данные. Возможно, закончилось место на устройстве.");
  }
});

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
function dataURLToBlob(dataURL) {
  const [meta, data] = dataURL.split(",");
  const mime = meta.match(/:(.*?);/)[1];
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i=0; i<binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], {type:mime});
}

$("exportBtn").addEventListener("click", async () => {
  try {
    const all = await getAllPets();
    const serialized = [];
    for (const p of all) {
      serialized.push({...p, photos: await Promise.all((p.photos || []).map(blobToDataURL))});
    }
    const blob = new Blob([JSON.stringify({app:"nashi-pitomcy",version:1,exportedAt:new Date().toISOString(),pets:serialized}, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nashi-pitomcy-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Резервная копия скачана");
  } catch (err) {
    console.error(err);
    toast("Не удалось создать резервную копию");
  }
});

$("importInput").addEventListener("change", async e => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  if (!confirm("Восстановление заменит текущую базу данных. Сначала экспортируйте текущие данные, если они нужны. Продолжить?")) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (parsed.app !== "nashi-pitomcy" || !Array.isArray(parsed.pets)) throw new Error("Неверный формат файла");
    const restored = parsed.pets.map(p => ({
      ...p,
      photos: (p.photos || []).map(x => typeof x === "string" ? dataURLToBlob(x) : x)
    }));
    await replaceAllPets(restored);
    await refresh();
    toast("База восстановлена");
  } catch (err) {
    console.error(err);
    alert("Не удалось восстановить файл. Проверьте, что это резервная копия приложения.");
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try { await navigator.serviceWorker.register("./sw.js"); }
    catch (e) { console.error("Service Worker registration failed", e); }
  });
}
refresh().catch(err => {
  console.error(err);
  $("petGrid").innerHTML = '<div class="empty">Не удалось открыть базу данных. Откройте приложение через локальный сервер или HTTPS.</div>';
});
