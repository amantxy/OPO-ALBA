/* OpoAGE · cuaderno interactivo (C1 y C2). Sin dependencias. Datos en /data. Progreso en localStorage. */
(() => {
"use strict";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const app = $("#app");
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const hoyISO = () => new Date().toISOString().slice(0, 10);

/* ---------------- estado ---------------- */
const KEY = "opoage.v1";
const S = Object.assign({ opo: "ambas", colores: true, repasos: {}, leitner: {}, resp: {}, notas: {}, plan: {}, simulacros: [] },
  JSON.parse(localStorage.getItem(KEY) || "{}"));
const guardar = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } };

/* ---------------- datos ---------------- */
const cache = {};
async function json(url) {
  if (!cache[url]) cache[url] = fetch(url, { cache: "no-cache" }).then(r => { if (!r.ok) throw new Error(url); return r.json(); });
  return cache[url];
}
let IND, PREG, PREGA, PMAP;
async function base() {
  if (!IND) {
    [IND, PREG] = await Promise.all([json("data/indice.json"), json("data/preguntas.json")]);
    PMAP = Object.fromEntries(PREG.map(p => [p.id, p]));
    PREGA = PREG.filter(p => p.modelo !== "B"); // el modelo B repite las preguntas del A en otro orden
  }
}
const tema = slug => json(`data/temas/${slug}.json`);
let PBIB;
async function baseBib() {
  await base();
  if (!PBIB) { PBIB = await json("data/preguntas_bib.json"); PBIB.forEach(p => PMAP[p.id] = p); }
  return PBIB;
}

/* ---------------- utilidades de interfaz ---------------- */
function star(ex) {
  if (!ex || !ex.length) return "";
  return ` <span class="star">★ Examen: <b>${ex.map(esc).join(" · ")}</b></span>`;
}
function chipOpo(cubre) {
  const out = [];
  if (cubre?.C1?.length) out.push(`<span class="chip c1">C1 · ${cubre.C1.join(", ")}</span>`);
  if (cubre?.C2?.length) out.push(`<span class="chip c2">C2 · ${cubre.C2.join(", ")}</span>`);
  return out.join("");
}
const leyenda = () => `<div class="leyenda"><mark class="k-ley">Leyes y artículos</mark><mark class="k-plazo">Plazos, cifras y mayorías</mark><mark class="k-quien">Quién</mark><mark class="k-donde">Dónde / ante quién</mark><span class="star">★ = ha caído en examen</span></div>`;
function pintar(html) { app.innerHTML = html; window.scrollTo(0, 0); }
function menu(r) { $$("#menu a").forEach(a => a.classList.toggle("on", a.dataset.r === r)); }
function barra(p) { return `<div class="barra"><i style="width:${Math.round(p * 100)}%"></i></div>`; }
const mezclar = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pasaOpo = examen => S.opo === "ambas" || examen.startsWith(S.opo);

/* ---------------- progreso por sección ---------------- */
function rep(slug, sec) { const k = slug + "/" + sec; return S.repasos[k] || (S.repasos[k] = { r: [false, false, false, false, false], dom: false }); }
function progresoTema(slug, secs) {
  let tot = 0, h = 0;
  secs.forEach(s => { const r = rep(slug, s.key); tot += 6; h += r.r.filter(Boolean).length + (r.dom ? 1 : 0); });
  return tot ? h / tot : 0;
}

/* ---------------- Leitner (tarjetas de memoria) ---------------- */
const INTERV = [0, 1, 3, 7, 14, 30];
function cardState(id) { return S.leitner[id] || { box: 0, next: hoyISO() }; }
function cardAnswer(id, ok) {
  const c = cardState(id);
  c.box = ok ? Math.min(c.box + 1, 5) : 0;
  const d = new Date(); d.setDate(d.getDate() + INTERV[c.box]);
  c.next = d.toISOString().slice(0, 10);
  S.leitner[id] = c; guardar();
}
const due = id => cardState(id).next <= hoyISO();

/* ================= VISTAS ================= */

/* ---------- inicio ---------- */
async function vInicio() {
  menu("age"); await base();
  const plan = await json("data/plan.json");
  const h = hoyISO();
  let hoy = null;
  plan.forEach(w => w.dias.forEach(d => { if (d.fecha === h) hoy = d; }));
  const resp = Object.values(S.resp); const ok = resp.filter(r => r.ok).length;
  const ultimos = S.simulacros.slice(-1)[0];
  const temasHechos = IND.temas.length;
  let pend = 0; Object.keys(S.leitner).forEach(k => { if (due(k)) pend++; });
  const CONV = await json("data/convocatorias.json").catch(() => []);
  pintar(`
  <p class="muted"><a href="#/">← Mis oposiciones</a></p>
  <h1>AGE · Administrativo y Auxiliar del Estado</h1>
  <p class="sub">Administrativo (C1) y Auxiliar (C2) del Estado · Convocatoria BOE 26/11/2026</p>
  <div class="grid cuenta">${CONV.filter(c => c.id !== "BIB").map(c => tarjetaCuenta(c, c.id === "C1" ? "l" : "m")).join("")}</div>
  <div class="grid">
    <div class="card l link" onclick="location.hash='#/temario/C1'"><h3>Temario C1 · Administrativo</h3><p>45 temas en 6 bloques, con el texto oficial y las preguntas de examen de cada uno.</p></div>
    <div class="card m link" onclick="location.hash='#/temario/C2'"><h3>Temario C2 · Auxiliar</h3><p>28 temas en 2 bloques, enlazados con su equivalente del C1.</p></div>
  </div>
  <div class="grid">
    <div class="card l link" onclick="location.hash='#/plan'"><h3>Hoy</h3>${hoy ? `<p class="just"><b>${esc(hoy.dia)}</b>: ${esc(hoy.teoria)}</p><p class="muted">${esc(hoy.test)} · ${esc(hoy.extra)}</p>
      <label class="fila"><input type="checkbox" ${S.plan[h] ? "checked" : ""} onclick="event.stopPropagation();OPO.planDia('${h}',this.checked)"> Hecho</label>` : `<p>El plan empieza el 30 de noviembre de 2026.</p>`}</div>
    <div class="card m link" onclick="location.hash='#/repaso'"><h3>Repaso de hoy</h3><div class="big">${pend}</div><p class="muted">tarjetas pendientes de repasar (Cornell + autoevaluación)</p></div>
    <div class="card link" onclick="location.hash='#/progreso'"><h3>Preguntas reales</h3><div class="big">${resp.length ? Math.round(ok / resp.length * 100) + "%" : "—"}</div><p class="muted">${ok} aciertos de ${resp.length} respondidas (de ${PREGA.length} distintas)</p></div>
    <div class="card link" onclick="location.hash='#/simulacro'"><h3>Último simulacro</h3>${ultimos ? `<div class="big">${ultimos.nota.toFixed(1)}</div><p class="muted">${esc(ultimos.tipo)} · ${esc(ultimos.fecha)}</p>` : `<p>Aún no has hecho ninguno.</p>`}<button class="btn s m">Hacer simulacro</button></div>
  </div>
  <h2 style="margin-top:22px">Accesos rápidos</h2>
  <div class="grid">
    <div class="card l link" onclick="location.hash='#/temario'"><h3>Temario completo</h3><p>Los ${IND.programa.C1.reduce((a, b) => a + b.temas.length, 0)} temas del C1 y ${IND.programa.C2.reduce((a, b) => a + b.temas.length, 0)} del C2, con el texto oficial del BOE y las preguntas reales de cada uno. ${temasHechos} documentos completos con resumen, esquema y Cornell.</p></div>
    <div class="card m link" onclick="location.hash='#/examenes'"><h3>Exámenes oficiales</h3><p>Los 8 exámenes del INAP (2023-2026) para hacerlos con reloj y corrección automática.</p></div>
    <div class="card link" onclick="location.hash='#/boe'"><h3>BOE oficial</h3><p>Texto consolidado de las normas del temario, con buscador.</p></div>
  </div>`);
  cuentas();
}

function tarjetaCuenta(c, cls = "") {
  return `<div class="card ${cls}"><h3>${esc(c.nombre)}</h3>
    ${c.fecha ? `<div class="big" data-cuenta="${c.fecha}T${c.hora || "09:00"}:00"></div>
      <p><b>${new Date(c.fecha + "T12:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</b>${c.hora ? " · " + esc(c.hora) + " h" : " · hora pendiente"}</p>
      <p>${c.lugar ? "📍 " + esc(c.lugar) : "Lugar pendiente de publicar"}</p>`
    : `<div class="big">—</div><p class="muted">Fecha pendiente de publicar. ${esc(c.nota)}</p>`}
    <p class="muted"><a href="${esc(c.boe_url)}" target="_blank" rel="noopener">Convocatoria ${esc(c.boe)}</a> · <a href="${esc(c.web)}" target="_blank" rel="noopener">web del proceso</a></p></div>`;
}
let cuentaInt = null;
function cuentas() {
  clearInterval(cuentaInt);
  const tick = () => $$("[data-cuenta]").forEach(el => {
    const ms = new Date(el.dataset.cuenta) - Date.now();
    if (ms <= 0) { el.textContent = "¡Hoy es el examen!"; return; }
    const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60;
    el.textContent = `${d} días ${h} h ${m} min`;
  });
  tick(); cuentaInt = setInterval(tick, 30000);
}

/* ---------- portada ---------- */
async function vPortada() {
  menu("portada");
  const CONV = await json("data/convocatorias.json").catch(() => []);
  const by = Object.fromEntries(CONV.map(c => [c.id, c]));
  pintar(`<h1>Hola, Alba</h1><p class="sub">Tus oposiciones. Elige por dónde quieres estudiar hoy.</p>
  <div class="portada">
    <section class="opo-bloque age">
      <div class="opo-cab"><h2>Administración General del Estado</h2><p>Administrativo (C1) y Auxiliar (C2) · BOE de 26/11/2026 · examen en Valladolid</p></div>
      <div class="grid">${["C1", "C2"].filter(k => by[k]).map(k => tarjetaCuenta(by[k], k === "C1" ? "l" : "m")).join("")}</div>
      <div class="fila"><a class="btn" href="#/age">Entrar en AGE</a><a class="btn o" href="#/temario/C1">Temario C1</a><a class="btn o" href="#/temario/C2">Temario C2</a><a class="btn o" href="#/simulacro">Simulacro</a><a class="btn o" href="#/examenes">Exámenes</a></div>
    </section>
    <section class="opo-bloque bib">
      <div class="opo-cab"><h2>Bibliotecas · Ministerio de Cultura</h2><p>Escala Auxiliar de Archivos, Bibliotecas y Museos · Sección Bibliotecas (C1) · BOE de 2026</p></div>
      <div class="grid">${by.BIB ? tarjetaCuenta(by.BIB, "bibc") : ""}</div>
      <div class="fila"><a class="btn nar" href="#/bib">Entrar en Bibliotecas</a><a class="btn nar o" href="#/temario/BIB">Temario Bibliotecas</a></div>
    </section>
  </div>`);
  cuentas();
}

async function vBib() {
  menu("bib"); await baseBib();
  const porTema = {}; PBIB.forEach(p => { if (p.tema) porTema[p.tema] = (porTema[p.tema] || 0) + 1; });
  const exB = [...new Set(PBIB.map(p => p.examen))].map(k => [k, PBIB.find(p => p.examen === k).lab]);
  const B = await json("data/bibliotecas.json");
  const CONV = await json("data/convocatorias.json").catch(() => []);
  const c = CONV.find(x => x.id === "BIB");
  const nombres = { constitucion: "Constitución", cortes: "Cortes Generales", gobierno: "Gobierno", poder_judicial: "Poder Judicial", ccaa: "Comunidades Autónomas", local: "Administración local", age: "AGE", transparencia: "Transparencia" };
  let h = `<p class="muted"><a href="#/">← Mis oposiciones</a></p><h1 class="nar-t">Bibliotecas · Ministerio de Cultura</h1><p class="sub">${esc(B.nombre)} (${B.grupo})</p>
  <div class="grid">${c ? tarjetaCuenta(c, "m") : ""}
    ${B.modalidades.map((m, i) => `<div class="card ${i ? "m" : "l"}"><h3>${esc(m.nombre)} · ${esc(m.grupo)}</h3><p class="muted">${esc(m.para)}</p><p>${esc(m.plazas)}</p><ul>${m.examen.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>`).join("")}
    <div class="card"><h3>Plazas y solicitudes</h3><p>${esc(B.plazas)}</p><p class="muted">${esc(B.solicitudes)}</p><p><a href="${esc(B.boe_url)}" target="_blank" rel="noopener">Convocatoria ${esc(B.boe)}</a></p></div></div>
  <div class="aviso">${esc(B.nota_grupos)}</div>
  <h2 class="nar-t" style="margin-top:18px">Practicar</h2>
  <div class="grid">
    <div class="card l"><h3>Simulacro turno libre</h3><p>100 preguntas oficiales al azar + 2 supuestos prácticos reales · 150 min · error −1/3.</p><button class="btn nar" onclick="OPO.simBib('TL')">Empezar</button></div>
    ${exB.map(([k, n]) => `<div class="card"><h3>${esc(n)}</h3><p>Examen oficial completo con su plantilla${["BIB_2024", "BIB_2025"].includes(k) ? " (100 preguntas + 2 supuestos prácticos)" : ""}.</p><button class="btn o" onclick="OPO.exBib('${k}')">Hacer con reloj</button></div>`).join("")}
  </div>
  <p class="fila"><a class="btn s o" href="examenes/bib/BIB_2025.pdf" target="_blank">Cuadernillo 2026</a><a class="btn s o" href="examenes/bib/BIB_2024.pdf" target="_blank">Cuadernillo 2024</a><a class="btn s o" href="examenes/bib/BIB_2019.pdf" target="_blank">Cuadernillo 2021</a><a class="btn s o" href="examenes/bib/supuestos_BIB_2019.pdf" target="_blank">Supuestos 2021</a><a class="btn s o" href="examenes/bib/BIB_2017.pdf" target="_blank">Cuadernillo 2017</a><a class="btn s o" href="examenes/bib/supuestos_BIB_2017.pdf" target="_blank">Supuestos 2017</a><a class="btn s o" href="examenes/bib/plantilla_BIB_2024_A.pdf" target="_blank">Plantilla 2024</a><a class="btn s o" href="examenes/bib/plantillas_BIB_2025.pdf" target="_blank">Plantillas 2025</a><a class="btn s o" href="examenes/bib/criterios_catalogacion_2025.pdf" target="_blank">Criterios de catalogación del tribunal (2025)</a></p>
  <p class="muted">Banco: ${PBIB.length} preguntas oficiales de la Sección Bibliotecas (turno libre) con la respuesta oficial. La clasificación por tema es orientativa. Los supuestos prácticos de 2024 y 2026 se pueden hacer completos con su caso.</p>
  <h2 class="nar-t" style="margin-top:20px">Temario oficial · Sección Bibliotecas · turno libre</h2>
  <div class="aviso">Los temas de legislación que comparte con AGE ya enlazan al material completo. El resto del temario se está preparando con el mismo formato (resumen, esquema, Cornell y tarjetas).</div>`;
  for (const b of B.programa) {
    h += `<div class="bloque card bib"><h3>Bloque ${b.bloque}. ${esc(b.nombre)}</h3>`;
    for (const t of b.temas) {
      const links = t.ir.map(d => d.doc ? `<a class="btn s" href="#/tema/${d.doc}">${esc(nombres[d.doc] || d.doc)}</a>` : `<a class="btn s o" href="#/tema/${d.auto}">Tema ${d.auto.replace("C1-", "C1 ").replace(/-/g, ".")}</a>`).join(" ");
      const nq = b.bloque === "IV" ? PBIB.filter(p => p.parte > 1).length : (porTema[b.bloque + "." + t.n] || 0);
      const qlink = nq ? (b.bloque === "IV" ? (t.n === 1 ? `<a class="btn s o" href="#/bibp/IV">★ ${nq} preguntas de supuestos prácticos oficiales</a>` : "") : `<a class="btn s o" href="#/bibp/${b.bloque}.${t.n}">★ ${nq} preguntas de examen</a>`) : "";
      h += `<div class="tema-li"><div class="n">${b.bloque}.${t.n}</div><div class="t">${esc(t.titulo)}<div class="fila" style="margin-top:6px">${t.comparte ? `<span class="chip ${t.comparte.tipo === "total" ? "comp" : "parc"}">${t.comparte.tipo === "total" ? "Compartido" : "En parte"} · ${t.comparte.C1.join(", ")} · ${t.comparte.C2.join(", ")}</span>` : `<span class="chip nuevo">Nuevo</span>`}</div><div class="fila" style="margin-top:6px">${links || '<span class="pend">En preparación</span>'} ${qlink}</div></div></div>`;
    }
    h += `</div>`;
  }
  pintar(h); cuentas();
}
async function vBibPreg(t) {
  menu("bib"); await baseBib();
  const B = await json("data/bibliotecas.json");
  const [bl, n] = t.split(".");
  const tit = t === "IV" ? "Supuestos prácticos de los exámenes de 2024 y 2026, con el enunciado de cada caso." : (B.programa.find(b => b.bloque === bl)?.temas.find(x => String(x.n) === n)?.titulo || "");
  pintar(`<p class="muted"><a href="#/bib">← Bibliotecas</a></p><h1>Tema ${esc(t)} · preguntas de examen</h1><p class="sub">${esc(tit)}</p><div id="cont"></div>`);
  vPreguntas($("#cont"), t === "IV" ? PBIB.filter(p => p.parte > 1).sort((a, b) => a.examen.localeCompare(b.examen) || a.parte - b.parte || a.reserva - b.reserva || a.n - b.n) : PBIB.filter(p => p.tema === t), true);
}

/* ---------- temario ---------- */
async function vTemario(sel) {
  menu("temario"); await base();
  const temasDoc = Object.fromEntries(IND.temas.map(t => [t.slug, t]));
  const opos = sel === "BIB" ? [] : sel === "C1" || sel === "C2" ? [sel] : S.opo === "ambas" ? ["C1", "C2"] : [S.opo];
  let h = `<p class="muted"><a href="#/">← Mis oposiciones</a></p><div class="fila"><a class="btn s ${!sel ? "" : "o"}" href="#/temario">Todo</a><a class="btn s ${sel === "C1" ? "" : "o"}" href="#/temario/C1">Temario C1</a><a class="btn s ${sel === "C2" ? "" : "o"}" href="#/temario/C2">Temario C2</a><a class="btn s nar ${sel === "BIB" ? "" : "o"}" href="#/temario/BIB">Temario Bibliotecas</a></div><h1>Temario oficial</h1><p class="sub">Programas oficiales: AGE (BOE 26/11/2026) y Bibliotecas del Ministerio de Cultura (BOE 23/11/2026). Cada tema enlaza al documento completo (si ya está hecho) o al texto oficial con sus preguntas de examen.</p>`;
  for (const c of opos) {
    h += `<h2>${c === "C1" ? "Administrativo del Estado · C1" : "Auxiliar Administrativo del Estado · C2"}</h2>`;
    for (const b of IND.programa[c]) {
      h += `<div class="bloque card"><h3>Bloque ${b.bloque}. ${esc(b.nombre)}</h3>`;
      for (const t of b.temas) {
        const links = (t.ir || []).map(d => {
          if (d.doc) { const T = temasDoc[d.doc]; return `<a class="btn s" href="#/tema/${d.doc}${d.sec ? "/" + d.sec : ""}">Documento completo</a>`; }
          return `<a class="btn s o" href="#/tema/${d.auto}">${c === "C2" && d.auto ? "Tema " + d.auto.replace("C1-", "C1 ").replace(/-/g, ".").replace("C1 .", "C1 ") : "Texto oficial y preguntas"}</a>`;
        }).join(" ");
        h += `<div class="tema-li"><div class="n">${b.bloque}.${t.n}</div><div class="t">${esc(t.titulo)}<div class="fila" style="margin-top:6px">${links || '<span class="pend">En preparación</span>'}</div></div></div>`;
      }
      h += `</div>`;
    }
  }
  if (!sel || sel === "BIB") h += await temarioBib();
  pintar(h);
}

async function temarioBib() {
  const B = await json("data/bibliotecas.json");
  const nombres = { constitucion: "Constitución", cortes: "Cortes Generales", gobierno: "Gobierno", poder_judicial: "Poder Judicial", ccaa: "Comunidades Autónomas", local: "Administración local", age: "AGE", transparencia: "Transparencia" };
  let nT = 0, nC = 0, nP = 0;
  B.programa.forEach(b => b.temas.forEach(t => { nT++; if (t.comparte?.tipo === "total") nC++; else if (t.comparte) nP++; }));
  let h = `<section class="bib-zona"><h2 class="nar-t">Bibliotecas · Ministerio de Cultura · turno libre (C1)</h2>
    <div class="leyenda"><span class="chip comp">Compartido con AGE</span><span class="chip parc">Compartido en parte</span><span class="chip nuevo">Nuevo · solo Bibliotecas</span></div>
    <p class="sub">${nT} temas: <b>${nC}</b> ya los tienes de AGE, <b>${nP}</b> en parte y <b>${nT - nC - nP}</b> son nuevos (los propios de Bibliotecas).</p>`;
  for (const b of B.programa) {
    h += `<div class="bloque card bib"><h3>Bloque ${b.bloque}. ${esc(b.nombre)}</h3>`;
    for (const t of b.temas) {
      const c = t.comparte;
      const chip = c ? `<span class="chip ${c.tipo === "total" ? "comp" : "parc"}">${c.tipo === "total" ? "Compartido" : "En parte"} · ${c.C1.join(", ")} · ${c.C2.join(", ")}</span>${c.nota ? `<span class="muted"> ${esc(c.nota)}</span>` : ""}` : `<span class="chip nuevo">Nuevo</span>`;
      const links = t.ir.map(d => d.doc ? `<a class="btn s" href="#/tema/${d.doc}">${esc(nombres[d.doc] || d.doc)}</a>` : `<a class="btn s o" href="#/tema/${d.auto}">Tema ${d.auto.replace("C1-", "C1 ").replace(/-/g, ".")}</a>`).join(" ");
      h += `<div class="tema-li"><div class="n">${b.bloque}.${t.n}</div><div class="t">${esc(t.titulo)}<div class="fila" style="margin-top:6px">${chip}</div><div class="fila" style="margin-top:6px">${links || '<span class="pend">En preparación</span>'}</div></div></div>`;
    }
    h += `</div>`;
  }
  return h + `<p><a class="btn nar" href="#/bib">Ir a Bibliotecas (simulacros y preguntas por tema)</a></p></section>`;
}

/* ---------- tema ---------- */
const TABS = [["resumen", "Resumen"], ["apuntes", "Texto oficial"], ["esquema", "Esquema"], ["cornell", "Cornell"], ["tarjetas", "Tarjetas"], ["examen", "Preguntas de examen"], ["notas", "Mis notas"]];
async function vTema(slug, secKey, tab) {
  menu("temario"); await base();
  let T;
  try { T = await tema(slug); } catch (e) { pintar(`<p>No encuentro este tema.</p>`); return; }
  const sec = T.secciones.find(s => s.key === secKey) || T.secciones[0];
  const disponibles = TABS.filter(([k]) => {
    if (k === "resumen") return sec.resumen.length; if (k === "apuntes") return sec.apuntes.length;
    if (k === "esquema") return sec.esquema.length; if (k === "cornell" || k === "tarjetas") return sec.cornell.filas.length;
    if (k === "examen") return sec.preguntas.length; return true;
  });
  if (!tab || !disponibles.find(([k]) => k === tab)) tab = disponibles[0][0];
  const r = rep(slug, sec.key);
  let h = `<p class="muted"><a href="#/temario">← Temario</a></p><h1>${esc(T.titulo)}</h1><div>${chipOpo(T.cubre)}</div>`;
  if (T.auto) h += `<div class="aviso">${T.ofimatica ? "Tema de ofimática: aquí tienes las preguntas reales de los exámenes oficiales sobre este tema. El resumen, el esquema y las fichas están en preparación." : "Texto oficial del BOE de este tema y preguntas reales de examen. El resumen, el esquema y las fichas Cornell están en preparación."}</div>`;
  if (T.secciones.length > 1) h += `<div class="secnav">${T.secciones.map(s => `<a class="${s.key === sec.key ? "on" : ""}" href="#/tema/${slug}/${s.key}/${tab}">${esc(s.corto)}</a>`).join("")}</div>`;
  h += `<h2>${esc(sec.titulo)}${star(sec.ex)}</h2>${sec.programa ? `<p class="sub">${esc(sec.programa)}</p>` : ""}`;
  h += `<div class="prog-sec">Repasos: ${r.r.map((v, i) => `<label><input type="checkbox" ${v ? "checked" : ""} onchange="OPO.rep('${slug}','${sec.key}',${i},this.checked)">${i + 1}.º</label>`).join("")}
        <label><input type="checkbox" ${r.dom ? "checked" : ""} onchange="OPO.rep('${slug}','${sec.key}','dom',this.checked)">Dominado</label></div>`;
  h += `<div class="tabs">${disponibles.map(([k, n]) => `<a class="${k === tab ? "on" : ""}" href="#/tema/${slug}/${sec.key}/${k}">${n}${k === "examen" ? ` (${sec.preguntas.length})` : ""}</a>`).join("")}</div>`;
  h += `<div id="cont"></div>`;
  pintar(h);
  const cont = $("#cont");
  if (tab === "resumen") cont.innerHTML = leyenda() + bloques(sec.resumen);
  if (tab === "apuntes") cont.innerHTML = leyenda() + bloques(sec.apuntes);
  if (tab === "esquema") cont.innerHTML = leyenda() + sec.esquema.map(e => `<div class="rama"><div class="rn">${esc(e.rama)}</div><ul>${e.hojas.map(x => typeof x === "string" ? `<li>${x}</li>` : `<li><b>${x.t}</b><ul>${x.sub.map(y => `<li>${y}</li>`).join("")}</ul></li>`).join("")}</ul></div>`).join("");
  if (tab === "cornell") vCornell(cont, sec);
  if (tab === "tarjetas") vTarjetas(cont, sec.cornell.filas.map((f, i) => ({ id: `${slug}/${sec.key}/${i}`, q: f.q, a: f.a })), true);
  if (tab === "examen") vPreguntas(cont, sec.preguntas.map(id => PMAP[id]).filter(Boolean));
  if (tab === "notas") {
    const k = slug + "/" + sec.key;
    cont.innerHTML = `<p class="muted">Tus notas se guardan en este navegador. Exporta tu progreso desde «Progreso» para pasarlas a otro dispositivo.</p><textarea class="notas" id="nt">${esc(S.notas[k] || "")}</textarea>`;
    $("#nt").addEventListener("input", e => { S.notas[k] = e.target.value; guardar(); });
  }
}

function bloques(bs) {
  return bs.map(b => {
    switch (b.t) {
      case "h2": return `<h3>${esc(b.txt)}${star(b.ex)}</h3>`;
      case "p": return `<p>${b.html}</p>`;
      case "ul": return `<ul>${b.items.map(i => `<li>${i}</li>`).join("")}</ul>`;
      case "tabla": return `<div style="overflow-x:auto"><table class="t"><tr>${b.cab.map(c => `<th>${esc(c)}</th>`).join("")}</tr>${b.filas.map((f, i) => `<tr>${f.map((c, j) => `<td>${c}${j === f.length - 1 ? star(b.ex?.[i]) : ""}</td>`).join("")}</tr>`).join("")}</table></div>`;
      case "clave": return `<div class="caja"><b class="tt">★ Clave de examen</b><ul>${b.items.map(i => `<li>${i}</li>`).join("")}</ul></div>`;
      case "nov": return `<div class="caja nov"><b class="tt">⚠ ${esc(b.titulo || "Novedad")}</b><ul>${b.items.map(i => `<li>${i}</li>`).join("")}</ul></div>`;
      case "fuente": return `<p class="fuente">Fuente oficial: <a href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.txt)}</a></p>`;
      case "arts": return b.arts.map(a => `<div class="art"><h4>Artículo ${esc(a.n)} ${esc(a.sigla)}${a.titulo ? ". " + esc(a.titulo) : ""}${star(a.ex)}</h4>${a.paras.map(p => `<p>${p}</p>`).join("")}${a.notas?.length ? `<details class="notas"><summary>Notas del BOE (${a.notas.length})</summary>${a.notas.map(n => `<p class="nota">${esc(n)}</p>`).join("")}</details>` : ""}</div>`).join("");
    }
    return "";
  }).join("");
}

function vCornell(cont, sec) {
  cont.innerHTML = `<div class="fila" style="margin-bottom:10px"><button class="btn s" id="tog">Ocultar respuestas</button><span class="muted">Con las respuestas ocultas, toca cada una para comprobarla.</span></div>
  <div class="cornell" id="cn">${sec.cornell.filas.map(f => `<div class="cf"><div class="cq">${f.q}</div><div class="ca">${f.a}</div></div>`).join("")}
  <div class="cr"><b>Resumen</b><p>${sec.cornell.resumen}</p></div></div>`;
  const cn = $("#cn");
  $("#tog").onclick = e => { cn.classList.toggle("oculto"); $$(".ca", cn).forEach(x => x.classList.remove("ver")); e.target.textContent = cn.classList.contains("oculto") ? "Mostrar todas" : "Ocultar respuestas"; };
  $$(".ca", cn).forEach(x => x.onclick = () => x.classList.toggle("ver"));
}

/* ---------- tarjetas de memoria (Leitner) ---------- */
function vTarjetas(cont, cards, todas) {
  let cola = todas ? cards.slice() : cards.filter(c => due(c.id));
  if (!cola.length) { cont.innerHTML = `<div class="card m"><h3>¡Al día!</h3><p>No tienes tarjetas pendientes. Vuelve mañana o repasa un tema desde el Temario.</p></div>`; return; }
  cola = mezclar(cola);
  let i = 0, vista = false, ok = 0, mal = 0;
  const pinta = () => {
    if (i >= cola.length) { cont.innerHTML = `<div class="card l"><h3>Sesión terminada</h3><p>${ok} sabidas · ${mal} para repasar. Las falladas volverán mañana; las sabidas, cada vez más espaciadas (1, 3, 7, 14 y 30 días).</p><button class="btn" onclick="location.reload()">Otra vez</button></div>`; return; }
    const c = cola[i], st = cardState(c.id);
    cont.innerHTML = `<div class="flash"><p class="muted">Tarjeta ${i + 1} de ${cola.length} · caja ${st.box}/5</p>
      <div class="fcard ${vista ? "dorso" : ""}" id="fc"><div class="lado">${vista ? "Respuesta" : "Pregunta · toca para girar"}</div>${vista ? `<div class="resp">${c.a}</div>` : `<div>${c.q}</div>`}</div>
      <div class="fila" style="justify-content:center;margin-top:12px">${vista ? `<button class="btn" id="no" style="background:#9b2c48">No la sabía</button><button class="btn m" id="si">La sabía</button>` : `<button class="btn" id="ver">Ver respuesta</button>`}</div></div>`;
    $("#fc").onclick = () => { vista = !vista; pinta(); };
    if (vista) { $("#si").onclick = () => { cardAnswer(c.id, true); ok++; i++; vista = false; pinta(); }; $("#no").onclick = () => { cardAnswer(c.id, false); mal++; i++; vista = false; pinta(); }; }
    else $("#ver").onclick = () => { vista = true; pinta(); };
  };
  pinta();
}

const OPOS = [["C1", "AGE · Administrativo C1", "l"], ["C2", "AGE · Auxiliar C2", "m"], ["BIB", "Bibliotecas · Cultura", "bibc"]];
const BIB_DOCS = ["constitucion", "cortes", "gobierno", "poder_judicial", "ccaa", "local", "age", "transparencia"];
function opoTabs(ruta, sel) {
  return `<div class="tabs opo-tabs">${[["", "Las tres"]].concat(OPOS.map(o => [o[0], o[1]])).map(([k, n]) => `<a class="${(sel || "") === k ? "on" : ""} ${k === "BIB" ? "t-bib" : k === "C2" ? "t-c2" : k === "C1" ? "t-c1" : ""}" href="#/${ruta}${k ? "/" + k : ""}">${n}</a>`).join("")}</div>`;
}
const opoSel = sel => OPOS.filter(o => !sel || o[0] === sel);
const tituloOpo = (o) => `<h2 class="opo-h ${o[0] === "BIB" ? "nar-t" : o[0] === "C2" ? "menta-t" : ""}">${esc(o[1])}</h2>`;

async function vRepaso(sel) {
  menu("repaso"); await base(); await baseBib();
  let h = `<h1>Repaso</h1><p class="sub">Tarjetas de memoria con repetición espaciada (1, 3, 7, 14 y 30 días) y repaso de tus fallos, por oposición.</p>${opoTabs("repaso", sel)}`;
  const cardsDe = async (filtro) => {
    const cards = [];
    for (const t of IND.temas.filter(filtro)) {
      const T = await tema(t.slug);
      T.secciones.forEach(s => s.cornell.filas.forEach((f, i) => cards.push({ id: `${t.slug}/${s.key}/${i}`, q: f.q, a: f.a })));
    }
    return cards;
  };
  const datos = [];
  for (const o of opoSel(sel)) {
    const filtro = o[0] === "BIB" ? (t => BIB_DOCS.includes(t.slug)) : (t => t.cubre?.[o[0]]?.length);
    const cards = await cardsDe(filtro);
    const pend = cards.filter(c => S.leitner[c.id] && due(c.id)).length, nuevas = cards.filter(c => !S.leitner[c.id]).length;
    const fallos = (o[0] === "BIB" ? (PBIB || []) : PREG).filter(p => p.examen.startsWith(o[0]) && S.resp[p.id] && !S.resp[p.id].ok).length;
    datos.push([o, cards]);
    h += tituloOpo(o) + `<div class="grid"><div class="card ${o[2]}"><h3>Tarjetas de hoy</h3><div class="big">${pend + Math.min(nuevas, 25)}</div><p class="muted">${pend} pendientes y ${Math.min(nuevas, 25)} nuevas, de ${cards.length} tarjetas${o[0] === "BIB" ? " (de los temas compartidos con AGE; las de los temas propios de Bibliotecas se añadirán al prepararlos)" : ""}.</p><button class="btn ${o[0] === "BIB" ? "nar" : o[0] === "C2" ? "m" : ""}" onclick="OPO.repasar('${o[0]}')">Repasar</button></div>
      <div class="card ${o[2]}"><h3>Mis fallos</h3><div class="big">${fallos}</div><p class="muted">preguntas de examen que has fallado alguna vez.</p><button class="btn o" onclick="OPO.fallos('${o[0]}')">Repetirlas</button></div></div>`;
  }
  pintar(h + `<div id="fl"></div>`);
  window._repaso = Object.fromEntries(datos.map(([o, c]) => [o[0], c]));
}
function repasar(k) {
  const cards = window._repaso?.[k] || [];
  const nuevas = cards.filter(c => !S.leitner[c.id]);
  const dueC = cards.filter(c => S.leitner[c.id] && due(c.id));
  const sesion = dueC.concat(mezclar(nuevas).slice(0, Math.max(0, 25 - dueC.length)));
  vTarjetas($("#fl"), sesion, true); $("#fl").scrollIntoView({ behavior: "smooth" });
}
async function fallos(k) {
  if (k === "BIB") await baseBib();
  const l = (k === "BIB" ? PBIB : PREG).filter(p => p.examen.startsWith(k) && S.resp[p.id] && !S.resp[p.id].ok);
  if (!l.length) { alert("Todavía no has fallado ninguna pregunta de esta oposición."); return; }
  examenCronometrado("Mis fallos · " + OPOS.find(o => o[0] === k)[1], mezclar(l).slice(0, 40), 40, "Fallos " + k, k === "BIB" ? 3 : 3);
}

/* ---------- preguntas (práctica libre) ---------- */
function htmlPreg(p, i, modo) {
  return `<div class="preg" data-id="${p.id}"><div class="cab">★ ${esc(p.lab)} · ${p.supuesto ? esc(p.supuesto) + " · " : ""}pregunta ${p.reserva ? "de reserva " : ""}${p.n}${p.parte > 1 && !p.supuesto ? " (2.ª parte)" : ""}</div>
    ${p.contexto ? `<details class="notas" ${p.n === 1 && !p.reserva ? "open" : ""}><summary>${esc(p.supuesto || "Supuesto práctico")} · enunciado del caso</summary><p>${esc(p.contexto)}</p></details>` : ""}
    <div class="en">${i != null ? (i + 1) + ". " : ""}${esc(p.enunciado)}</div>
    ${["a", "b", "c", "d"].map(l => `<button class="op" data-l="${l}"><b>${l})</b>${esc(p.opciones[l] || "")}</button>`).join("")}
    <div class="res-preg"></div></div>`;
}
function corregir(div, p, l) {
  $$(".op", div).forEach(b => { b.disabled = true; if (b.dataset.l === p.respuesta) b.classList.add("ok"); else if (b.dataset.l === l) b.classList.add("mal"); });
  const r = $(".res-preg", div);
  if (p.respuesta && p.respuesta.length === 1) {
    const ok = l === p.respuesta;
    r.className = "res-preg " + (ok ? "ok" : "mal");
    r.textContent = ok ? "¡Correcta! (plantilla oficial del INAP)" : `Incorrecta. La respuesta oficial es la ${p.respuesta}).`;
    S.resp[p.id] = { ok, l, fecha: hoyISO() }; guardar();
  } else { r.textContent = "Pregunta anulada en la plantilla oficial."; }
}
function vPreguntas(cont, lista, todas) {
  if (!todas) lista = lista.filter(p => pasaOpo(p.examen));
  if (!lista.length) { cont.innerHTML = `<p class="muted">No hay preguntas de examen para la oposición seleccionada.</p>`; return; }
  cont.innerHTML = `<p class="muted">Preguntas de exámenes oficiales. Elige una opción y se corrige con la plantilla oficial.</p>` + lista.map((p, i) => htmlPreg(p, i)).join("");
  $$(".preg", cont).forEach(div => {
    const p = PMAP[div.dataset.id];
    $$(".op", div).forEach(b => b.onclick = () => corregir(div, p, b.dataset.l));
  });
}

/* ---------- simulacro y exámenes con reloj ---------- */
let reloj = null;
function examenCronometrado(titulo, lista, minutos, tipo, pen = 3) {
  clearInterval(reloj);
  const fin = Date.now() + minutos * 60000;
  const marc = {};
  pintar(`<h1>${esc(titulo)}</h1><p class="sub">${lista.length} preguntas · ${minutos} minutos · cada error resta 1/${pen} de acierto; en blanco no resta.</p>
    <span class="reloj" id="rl"></span><div id="qq">${lista.map((p, i) => htmlPreg(p, i)).join("")}</div>
    <div class="fila" style="margin:20px 0"><button class="btn m" id="ent">Entregar y corregir</button></div>`);
  $$(".preg").forEach(div => $$(".op", div).forEach(b => b.onclick = () => {
    $$(".op", div).forEach(x => x.classList.remove("sel")); if (marc[div.dataset.id] === b.dataset.l) { delete marc[div.dataset.id]; return; }
    b.classList.add("sel"); marc[div.dataset.id] = b.dataset.l;
  }));
  const tick = () => { const s = Math.max(0, Math.round((fin - Date.now()) / 1000)); $("#rl").textContent = `⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; if (!s) entregar(); };
  const entregar = () => {
    clearInterval(reloj);
    let A = 0, F = 0, B = 0;
    $$(".preg").forEach(div => {
      const p = PMAP[div.dataset.id], l = marc[p.id];
      $$(".op", div).forEach(b => b.classList.remove("sel"));
      if (!l) { B++; $$(".op", div).forEach(b => { b.disabled = true; if (b.dataset.l === p.respuesta) b.classList.add("ok"); }); $(".res-preg", div).textContent = `En blanco. Respuesta oficial: ${p.respuesta})`; return; }
      corregir(div, p, l); if (l === p.respuesta) A++; else if (p.respuesta && p.respuesta.length === 1) F++;
    });
    const neta = A - F / pen, nota = Math.max(0, neta / lista.length * 10);
    S.simulacros.push({ fecha: hoyISO(), tipo, aciertos: A, fallos: F, blancos: B, nota }); guardar();
    $("#ent").remove();
    $("#qq").insertAdjacentHTML("beforebegin", `<div class="marcador"><div class="card m"><b>Nota</b><div class="big">${nota.toFixed(2)}</div><span class="muted">sobre 10</span></div><div class="card"><b>Aciertos</b><div class="big">${A}</div></div><div class="card"><b>Fallos</b><div class="big">${F}</div></div><div class="card"><b>En blanco</b><div class="big">${B}</div></div><div class="card l"><b>Puntuación neta</b><div class="big">${neta.toFixed(2)}</div><span class="muted">aciertos − fallos/${pen}</span></div></div>`);
    window.scrollTo(0, 0);
  };
  $("#ent").onclick = () => { if (confirm("¿Entregar el examen?")) entregar(); };
  tick(); reloj = setInterval(tick, 1000);
}

async function vSimulacro(sel) {
  menu("simulacro"); await base(); await baseBib();
  const cnt = (c, cat) => PREGA.filter(p => p.examen.startsWith(c) && p.cat === cat).length;
  let h = `<h1>Simulacro</h1><p class="sub">Preguntas oficiales elegidas al azar, con reloj y corrección con la plantilla oficial.</p>${opoTabs("simulacro", sel)}`;
  for (const o of opoSel(sel)) {
    h += tituloOpo(o);
    if (o[0] === "C1") h += `<div class="grid"><div class="card l"><h3>Simulacro C1 · primera parte</h3><p>40 preguntas de los bloques I a V + 30 de ofimática, como el examen real. 60 minutos · error −1/3.</p><button class="btn" onclick="OPO.sim('C1')">Empezar</button></div>
      <div class="card l"><h3>Rápido C1</h3><p>20 preguntas de teoría. 15 minutos.</p><button class="btn o" onclick="OPO.sim('rapidoC1')">Empezar</button></div></div>
      <p class="muted">Banco C1: ${cnt("C1", "teoria")} de teoría y ${cnt("C1", "ofimatica")} de ofimática.</p>`;
    if (o[0] === "C2") h += `<div class="grid"><div class="card m"><h3>Simulacro C2 · teoría y ofimática</h3><p>30 de teoría (bloque I) + 50 de ofimática (bloque II). 80 minutos · error −1/3.</p><button class="btn m" onclick="OPO.sim('C2')">Empezar</button></div>
      <div class="card m"><h3>Rápido C2</h3><p>20 preguntas de teoría. 15 minutos.</p><button class="btn o" onclick="OPO.sim('rapidoC2')">Empezar</button></div></div>
      <p class="muted">Banco C2: ${cnt("C2", "teoria")} de teoría y ${cnt("C2", "ofimatica")} de ofimática. Los psicotécnicos dependen de tablas del cuadernillo y se hacen desde «Exámenes».</p>`;
    if (o[0] === "BIB") h += `<div class="grid"><div class="card bibc"><h3>Simulacro Bibliotecas · turno libre</h3><p>100 preguntas + 2 supuestos prácticos reales. 150 minutos · error −1/3.</p><button class="btn nar" onclick="OPO.simBib('TL')">Empezar</button></div>
      <div class="card bibc"><h3>Rápido Bibliotecas</h3><p>20 preguntas de la primera parte. 15 minutos.</p><button class="btn nar o" onclick="OPO.sim('rapidoBIB')">Empezar</button></div></div>
      <p class="muted">Banco Bibliotecas: ${PBIB.filter(p => p.parte === 1 && !p.reserva).length} preguntas de la primera parte y ${PBIB.filter(p => p.parte > 1 && !p.reserva).length} de supuestos prácticos.</p>`;
  }
  pintar(h);
}
function sim(tipo) {
  const pick = (c, cat, n) => mezclar(PREGA.filter(p => p.examen.startsWith(c) && p.cat === cat && p.respuesta?.length === 1)).slice(0, n);
  if (tipo === "C1") examenCronometrado("Simulacro C1", mezclar(pick("C1", "teoria", 40)).concat(pick("C1", "ofimatica", 30)), 60, "Simulacro C1");
  if (tipo === "C2") examenCronometrado("Simulacro C2", pick("C2", "teoria", 30).concat(pick("C2", "ofimatica", 50)), 80, "Simulacro C2");
  if (tipo === "rapidoC1" || tipo === "rapidoC2") { const c = tipo.slice(-2); examenCronometrado("Simulacro rápido " + c, mezclar(PREGA.filter(p => p.cat === "teoria" && p.examen.startsWith(c) && p.respuesta?.length === 1)).slice(0, 20), 15, "Rápido " + c); }
  if (tipo === "rapidoBIB") examenCronometrado("Simulacro rápido Bibliotecas", mezclar(PBIB.filter(p => p.parte === 1 && !p.reserva && p.respuesta?.length === 1)).slice(0, 20), 15, "Rápido BIB", 3);
  if (tipo === "fallos") fallos("C1");
}

async function vExamenes(sel) {
  menu("examenes"); await base(); await baseBib();
  let h = `<h1>Exámenes oficiales</h1><p class="sub">Haz cada examen con reloj y corrección automática, o abre el cuadernillo y la plantilla originales.</p>${opoTabs("examenes", sel)}`;
  for (const o of opoSel(sel)) {
    h += tituloOpo(o);
    if (o[0] !== "BIB") {
      const ex = Object.entries(IND.examenes).filter(([k]) => k.startsWith(o[0]));
      h += `<p class="muted">INAP. En 2024 y 2026 hubo dos modelos (A y B): las mismas preguntas en distinto orden, cada una con su plantilla.</p><div class="grid">${ex.map(([k, n]) => {
        const l = PREG.filter(p => p.examen === k && p.cat !== "psico");
        const ps = PREG.filter(p => p.examen === k && p.cat === "psico").length;
        return `<div class="card ${o[2]}"><h3>${esc(n)}</h3><p class="muted">${l.length} preguntas corregibles${ps ? ` + ${ps} psicotécnicos (en el PDF)` : ""}</p>
          <div class="fila"><button class="btn s ${o[0] === "C2" ? "m" : ""}" onclick="OPO.examen('${k}')">Hacer con reloj</button><a class="btn s o" href="examenes/${k}.pdf" target="_blank">Cuadernillo</a><a class="btn s o" href="examenes/plantilla_${k}.pdf" target="_blank">Plantilla</a></div></div>`;
      }).join("")}</div>${o[0] === "C1" ? `<p class="muted">Los supuestos prácticos del C1 se consultan en el cuadernillo.</p>` : ""}`;
    } else {
      const PDF = { BIB_2025: ["BIB_2025.pdf", "plantillas_BIB_2025.pdf"], BIB_2024: ["BIB_2024.pdf", "plantilla_BIB_2024_A.pdf"], BIB_2019: ["BIB_2019.pdf", "plantilla_BIB_2019.pdf"], BIB_2017: ["BIB_2017.pdf", "plantilla_BIB_2017.pdf"] };
      const exB = ["BIB_2025", "BIB_2024", "BIB_2019", "BIB_2017"].filter(k => PBIB.some(p => p.examen === k));
      h += `<p class="muted">Ministerio de Cultura · Sección Bibliotecas · turno libre.</p><div class="grid">${exB.map(k => {
        const l = PBIB.filter(p => p.examen === k && !p.reserva), sup = l.filter(p => p.parte > 1).length;
        return `<div class="card bibc"><h3>${esc(l[0].lab)}</h3><p class="muted">${l.length - sup} preguntas${sup ? ` + ${sup} de 2 supuestos prácticos` : ""}</p>
          <div class="fila"><button class="btn s nar" onclick="OPO.exBib('${k}')">Hacer con reloj</button><a class="btn s o" href="examenes/bib/${PDF[k][0]}" target="_blank">Cuadernillo</a><a class="btn s o" href="examenes/bib/${PDF[k][1]}" target="_blank">Plantilla</a></div></div>`;
      }).join("")}</div><p class="fila"><a class="btn s o" href="examenes/bib/supuestos_BIB_2019.pdf" target="_blank">Supuestos 2021</a><a class="btn s o" href="examenes/bib/supuestos_BIB_2017.pdf" target="_blank">Supuestos 2017</a><a class="btn s o" href="examenes/bib/criterios_catalogacion_2025.pdf" target="_blank">Criterios de catalogación del tribunal</a></p>`;
    }
  }
  pintar(h);
}
function examen(k) {
  const l = PREG.filter(p => p.examen === k && p.cat !== "psico" && p.respuesta);
  examenCronometrado(IND.examenes[k], l, k.startsWith("C1") ? 60 : 80, IND.examenes[k]);
}

/* ---------- plan ---------- */
async function vPlan() {
  menu("plan");
  const plan = await json("data/plan.json"); const h = hoyISO();
  const hechos = Object.values(S.plan).filter(Boolean).length, total = plan.reduce((a, w) => a + w.dias.length, 0);
  let html = `<h1>Plan de estudio</h1><p class="sub">26 semanas · 2 horas al día · fines de semana incluidos. Marca cada día al terminar.</p>
    <div class="card l" style="margin-bottom:14px"><b>${hechos} de ${total} días hechos</b>${barra(hechos / total)}</div>
    <div class="fila" style="margin-bottom:8px"><button class="btn s o" onclick="document.getElementById('hoy')?.scrollIntoView({behavior:'smooth',block:'center'})">Ir a hoy</button></div>`;
  plan.forEach(w => {
    html += `<div class="semana"><h3>Semana ${w.semana} · Fase ${w.fase}</h3>`;
    w.dias.forEach(d => {
      const k = d.fecha, ok = !!S.plan[k];
      html += `<div class="dia ${d.tipo} ${k === h ? "hoy" : ""} ${ok ? "hecho" : ""}" ${k === h ? 'id="hoy"' : ""}><div class="f">${esc(d.dia)} ${k.slice(8)}/${k.slice(5, 7)}</div>
        <div class="t-dia"><div>${esc(d.teoria)}</div><div class="x">${esc(d.test)}${d.extra ? " · " + esc(d.extra) : ""}</div></div>
        <input type="checkbox" ${ok ? "checked" : ""} onchange="OPO.planDia('${k}',this.checked);this.closest('.dia').classList.toggle('hecho',this.checked)"></div>`;
    });
    html += `</div>`;
  });
  pintar(html);
}

/* ---------- progreso ---------- */
async function vProgreso() {
  menu("progreso"); await base();
  const resp = Object.entries(S.resp);
  const porEx = {};
  resp.forEach(([id, r]) => { const p = PMAP[id]; if (!p) return; const k = p.lab; porEx[k] = porEx[k] || { ok: 0, n: 0 }; porEx[k].n++; if (r.ok) porEx[k].ok++; });
  let h = `<h1>Mi progreso</h1>`;
  h += `<h2>Temas</h2><div class="grid">`;
  for (const t of IND.temas) {
    const p = progresoTema(t.slug, t.secciones);
    h += `<div class="card link" onclick="location.hash='#/tema/${t.slug}'"><b>${esc(t.titulo)}</b>${star(t.secciones.flatMap(s => s.ex).filter((v, i, a) => a.indexOf(v) === i).slice(0, 0))}<p class="muted">${Math.round(p * 100)}% de repasos marcados</p>${barra(p)}</div>`;
  }
  h += `</div><h2>Preguntas reales por examen</h2>`;
  h += resp.length ? `<table class="t"><tr><th>Examen</th><th>Respondidas</th><th>Aciertos</th><th>%</th></tr>${Object.entries(porEx).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v.n}</td><td>${v.ok}</td><td>${Math.round(v.ok / v.n * 100)}%</td></tr>`).join("")}</table>` : `<p class="muted">Aún no has respondido preguntas.</p>`;
  h += `<h2>Simulacros</h2>` + (S.simulacros.length ? `<table class="t"><tr><th>Fecha</th><th>Tipo</th><th>Aciertos</th><th>Fallos</th><th>Blanco</th><th>Nota</th></tr>${S.simulacros.slice().reverse().map(s => `<tr><td>${s.fecha}</td><td>${esc(s.tipo)}</td><td>${s.aciertos}</td><td>${s.fallos}</td><td>${s.blancos}</td><td><b>${s.nota.toFixed(2)}</b></td></tr>`).join("")}</table>` : `<p class="muted">Sin simulacros todavía.</p>`);
  const cajas = [0, 0, 0, 0, 0, 0]; Object.values(S.leitner).forEach(c => cajas[c.box]++);
  h += `<h2>Tarjetas de memoria</h2><p>${cajas.map((n, i) => `<span class="chip ${i >= 4 ? "c2" : "c1"}">Caja ${i}: ${n}</span>`).join("")}</p>`;
  h += `<h2>Copia de seguridad</h2><p class="muted">Tu progreso se guarda en este navegador. Exporta el archivo para llevarlo a otro dispositivo o no perderlo.</p>
    <div class="fila"><button class="btn" onclick="OPO.exportar()">Exportar progreso</button><label class="btn o">Importar progreso<input type="file" accept=".json" class="oculto" onchange="OPO.importar(this.files[0])"></label>
    <button class="btn o" onclick="if(confirm('¿Borrar todo tu progreso de este navegador?')){localStorage.removeItem('${KEY}');location.reload()}">Borrar progreso</button></div>`;
  pintar(h);
}

/* ---------- BOE ---------- */
async function vBoe() {
  menu("boe");
  const N = await json("data/normas.json");
  pintar(`<h1>BOE oficial</h1><p class="sub">Texto consolidado de las normas del temario (descargado de boe.es y EUR-Lex el 27/11/2026). Toca una norma para leerla y buscar dentro.</p>
  <p><a class="btn s o" href="boe/convocatoria-BOE-A-2026-24839.pdf" target="_blank">Convocatoria (BOE 26/11/2026)</a></p>
  <table class="t"><tr><th>Norma</th><th>Oposición</th><th>Última actualización</th></tr>
  ${N.filter(n => S.opo === "ambas" || n.tag === "AMBAS" || n.tag === S.opo).map(n => `<tr><td><a href="#/ley/${encodeURIComponent(n.txt)}">${esc(n.nombre)}</a></td><td><span class="chip ${n.tag === "C1" ? "c1" : n.tag === "C2" ? "c2" : "amb"}">${n.tag === "AMBAS" ? "C1 y C2" : n.tag}</span></td><td>${n.act ? n.act.split("-").reverse().join("/") : "—"} <a href="${esc(n.url)}" target="_blank" rel="noopener">fuente</a></td></tr>`).join("")}</table>`);
}
async function vLey(path) {
  menu("boe");
  pintar(`<p><a href="#/boe">← BOE oficial</a></p><input class="busca" id="b" placeholder="Buscar en la norma (por ejemplo: artículo 21, plazo, tres meses…)"><p class="muted" id="nres"></p><div class="ley-txt" id="lt">Cargando…</div>`);
  const txt = await fetch(path).then(r => r.text());
  const lt = $("#lt"); lt.textContent = txt;
  $("#b").addEventListener("input", e => {
    const q = e.target.value.trim();
    if (q.length < 3) { lt.textContent = txt; $("#nres").textContent = ""; return; }
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    let n = 0;
    lt.innerHTML = esc(txt).replace(rx, m => { n++; return `<mark class="k-ley" id="m${n}">${m}</mark>`; });
    $("#nres").textContent = n ? `${n} coincidencias` : "Sin coincidencias";
    $("#m1")?.scrollIntoView({ block: "center" });
  });
}

/* ---------- buscador global ---------- */
async function vBuscar() {
  menu(""); await base();
  pintar(`<h1>Buscar</h1><input class="busca" id="b" placeholder="Busca en todo el temario: «moción de censura», «tres meses», «Defensor del Pueblo»…" autofocus><div id="rs"></div>`);
  const docs = [];
  const slugs = IND.temas.map(t => t.slug);
  IND.programa.C1.forEach(b => b.temas.forEach(t => (t.ir || []).forEach(d => d.auto && slugs.push(d.auto))));
  for (const s of [...new Set(slugs)]) {
    try {
      const T = await tema(s);
      T.secciones.forEach(sec => {
        const txt = JSON.stringify([sec.resumen, sec.apuntes, sec.cornell, sec.esquema]).replace(/<[^>]+>/g, "");
        docs.push({ s, sec: sec.key, tit: T.titulo + (T.secciones.length > 1 ? " · " + sec.corto : ""), txt });
      });
    } catch (e) { }
  }
  $("#b").addEventListener("input", e => {
    const q = e.target.value.trim().toLowerCase();
    if (q.length < 3) { $("#rs").innerHTML = ""; return; }
    const r = docs.map(d => { const i = d.txt.toLowerCase().indexOf(q); return i < 0 ? null : { ...d, frag: d.txt.slice(Math.max(0, i - 90), i + 140) }; }).filter(Boolean);
    const pq = PREGA.filter(p => (p.enunciado + " " + Object.values(p.opciones).join(" ")).toLowerCase().includes(q)).slice(0, 15);
    $("#rs").innerHTML = `<p class="muted">${r.length} apartados y ${pq.length} preguntas de examen</p>` +
      r.map(d => `<div class="res-b"><a href="#/tema/${d.s}/${d.sec}/apuntes"><b>${esc(d.tit)}</b></a><div class="muted">…${esc(d.frag).replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), m => `<mark class="k-ley">${m}</mark>`)}…</div></div>`).join("") +
      (pq.length ? `<h3>Preguntas de examen</h3>` + pq.map(p => `<div class="res-b"><span class="star">${esc(p.lab)} · p. ${p.n}</span> ${esc(p.enunciado)}</div>`).join("") : "");
  });
}

/* ================= router ================= */
async function router() {
  clearInterval(reloj);
  const [ruta, ...a] = location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  try {
    if (!ruta) return vPortada();
    if (ruta === "age") return vInicio();
    if (ruta === "bib") return vBib();
    if (ruta === "bibp") return vBibPreg(a[0]);
    if (ruta === "temario") return vTemario(a[0]);
    if (ruta === "tema") return vTema(a[0], a[1], a[2]);
    if (ruta === "repaso") return vRepaso(a[0]);
    if (ruta === "simulacro") return vSimulacro(a[0]);
    if (ruta === "examenes") return vExamenes(a[0]);
    if (ruta === "plan") return vPlan();
    if (ruta === "progreso") return vProgreso();
    if (ruta === "boe") return vBoe();
    if (ruta === "ley") return vLey(a.join("/"));
    if (ruta === "buscar") return vBuscar();
    vPortada();
  } catch (e) { console.error(e); pintar(`<p>Ha ocurrido un error al cargar: ${esc(e.message)}</p>`); }
}

/* ---------- API para los botones ---------- */
window.OPO = {
  rep(slug, sec, i, v) { const r = rep(slug, sec); if (i === "dom") r.dom = v; else r.r[i] = v; guardar(); },
  planDia(f, v) { S.plan[f] = v; guardar(); },
  sim, examen, repasar, fallos,
  async simBib(m) {
    await baseBib();
    const ok = PBIB.filter(p => p.parte === 1 && p.respuesta && p.respuesta.length === 1 && !p.reserva);
    const sets = {}; PBIB.filter(p => p.parte > 1 && !p.reserva).forEach(p => { const k = p.examen + p.parte; (sets[k] = sets[k] || []).push(p); });
    const sup = mezclar(Object.values(sets)).slice(0, 2).flatMap(l => l.sort((a, b) => a.n - b.n));
    examenCronometrado("Simulacro Bibliotecas · turno libre", mezclar(ok).slice(0, 100).concat(sup), 150, "Bibliotecas TL", 3);
  },
  async exBib(k) {
    await baseBib();
    const l = PBIB.filter(p => p.examen === k && !p.reserva).sort((a, b) => a.parte - b.parte || a.n - b.n);
    const nuevo = l.some(p => p.parte > 1);
    examenCronometrado(l[0].lab, l, nuevo ? 150 : 120, l[0].lab, nuevo ? 3 : 4);
  },
  exportar() {
    const b = new Blob([JSON.stringify(S, null, 1)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `progreso-opoage-${hoyISO()}.json`; a.click();
  },
  importar(f) {
    if (!f) return; const rd = new FileReader();
    rd.onload = () => { try { Object.assign(S, JSON.parse(rd.result)); guardar(); alert("Progreso importado."); router(); } catch (e) { alert("El archivo no es válido."); } };
    rd.readAsText(f);
  }
};
$("#opo").value = S.opo;
$("#opo").onchange = e => { S.opo = e.target.value; guardar(); router(); };
document.body.classList.toggle("sin-colores", !S.colores);
$("#colores").onclick = () => { S.colores = !S.colores; guardar(); document.body.classList.toggle("sin-colores", !S.colores); };
window.addEventListener("hashchange", router);
router();
})();
