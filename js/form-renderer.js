// ============================================================
// form-renderer.js
// สร้างฟอร์มจากโครงสร้าง JSON และเก็บค่า/คำนวณคะแนน
// ============================================================

// helper สร้าง element
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c) node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return node;
}

// สร้างฟิลด์หนึ่งช่อง คืนค่า element และลงทะเบียนใน registry
function renderField(field, schema, registry) {
  const wrap = el("div", { class: "field field--" + field.type });

  if (field.type === "heading") {
    return el("h4", { class: "field-heading", text: field.label });
  }
  if (field.type === "note") {
    return el("div", { class: "field-note" }, [
      el("span", { class: "field-label", text: field.label }),
      el("p", { class: "note-text", text: field.text || "" })
    ]);
  }

  const labelText = field.label + (field.required ? " *" : "");
  const label = el("label", { class: "field-label", for: "f_" + field.id, text: labelText });

  let input;
  switch (field.type) {
    case "text":
    case "number": {
      input = el("input", {
        type: field.type === "number" ? "number" : "text",
        id: "f_" + field.id,
        class: "input"
      });
      if (field.maxlength) input.setAttribute("maxlength", field.maxlength);
      registry[field.id] = () => input.value.trim();
      wrap.append(label, input);
      break;
    }
    case "textarea": {
      input = el("textarea", { id: "f_" + field.id, class: "input textarea", rows: "3" });
      registry[field.id] = () => input.value.trim();
      wrap.append(label, input);
      break;
    }
    case "inline": {
      wrap.append(label);
      const rowEl = el("div", { class: "inline-row" });
      const getters = {};
      (field.parts || []).forEach(p => {
        if (p.prefix) rowEl.append(el("span", { class: "inline-affix", text: p.prefix }));
        const inp = el("input", { type: p.type === "number" ? "number" : "text", id: "f_" + field.id + "_" + p.id, class: "input input--inline" });
        getters[p.id] = () => inp.value.trim();
        rowEl.append(inp);
        if (p.suffix) rowEl.append(el("span", { class: "inline-affix", text: p.suffix }));
      });
      registry[field.id] = () => {
        const o = {};
        for (const [k, g] of Object.entries(getters)) o[k] = g();
        return o;
      };
      wrap.append(rowEl);
      break;
    }
    case "select": {
      input = el("select", { id: "f_" + field.id, class: "input select" });
      input.append(el("option", { value: "", text: "— เลือก —" }));
      (field.options || []).forEach(o => input.append(el("option", { value: o, text: o })));
      registry[field.id] = () => input.value;
      wrap.append(label, input);
      break;
    }
    case "radio": {
      const group = el("div", { class: "options" });
      (field.options || []).forEach((o, i) => {
        const id = "f_" + field.id + "_" + i;
        const r = el("input", { type: "radio", name: "f_" + field.id, id, value: o });
        group.append(el("label", { class: "opt", for: id }, [r, el("span", { text: o })]));
      });
      registry[field.id] = () => {
        const sel = group.querySelector("input:checked");
        return sel ? sel.value : "";
      };
      wrap.append(label, group);
      break;
    }
    case "checkbox": {
      const group = el("div", { class: "options" });
      (field.options || []).forEach((o, i) => {
        const id = "f_" + field.id + "_" + i;
        const c = el("input", { type: "checkbox", name: "f_" + field.id, id, value: o });
        group.append(el("label", { class: "opt", for: id }, [c, el("span", { text: o })]));
      });
      registry[field.id] = () =>
        Array.from(group.querySelectorAll("input:checked")).map(c => c.value);
      wrap.append(label, group);
      break;
    }
    case "rating": {
      const row = el("div", { class: "rating-row" });
      row.append(el("div", { class: "rating-label", text: field.label }));
      const scale = schema.ratingScale || [{ value: 3 }, { value: 2 }, { value: 1 }];

      // ร่องรอย/หลักฐาน (ถ้ามี) — ติ๊กได้และบันทึก
      let getEvidence = () => [];
      if (Array.isArray(field.evidence) && field.evidence.length) {
        const ev = el("div", { class: "evidence" });
        ev.append(el("div", { class: "evidence__title", text: "ร่องรอย / หลักฐาน" }));
        const evList = el("div", { class: "evidence__list" });
        const boxes = [];
        field.evidence.forEach((txt, i) => {
          const id = "f_" + field.id + "_ev" + i;
          const cb = el("input", { type: "checkbox", id, value: txt });
          boxes.push(cb);
          evList.append(el("label", { class: "evidence__item", for: id }, [cb, el("span", { text: txt })]));
        });
        ev.append(evList);
        row.append(ev);
        getEvidence = () => boxes.filter(b => b.checked).map(b => b.value);
      }

      if (field.levels) {
        // โหมด rubric: แสดงเกณฑ์การประเมินของแต่ละระดับให้เลือก
        const rubric = el("div", { class: "rubric" });
        rubric.append(el("div", { class: "rubric__title", text: "เกณฑ์การประเมิน" }));
        scale.forEach(s => {
          const id = "f_" + field.id + "_" + s.value;
          const r = el("input", { type: "radio", name: "f_" + field.id, id, value: s.value });
          const opt = el("label", { class: "rubric__opt", for: id }, [
            r,
            el("span", { class: "rubric__badge", text: String(s.value) }),
            el("span", { class: "rubric__text", text: field.levels[String(s.value)] || "" })
          ]);
          rubric.append(opt);
        });
        row.append(rubric);
      } else {
        // โหมด segmented: ปุ่ม 3/2/1
        const choices = el("div", { class: "rating-choices" });
        scale.forEach(s => {
          const id = "f_" + field.id + "_" + s.value;
          const r = el("input", { type: "radio", name: "f_" + field.id, id, value: s.value });
          choices.append(el("label", { class: "rating-opt", for: id }, [r, el("span", { text: s.label || s.value })]));
        });
        row.append(choices);
      }

      let getSuggestion = () => "";
      if (schema.itemSuggestion) {
        const sug = el("input", { type: "text", class: "input input--sm", placeholder: "ข้อเสนอแนะ" });
        getSuggestion = () => sug.value.trim();
        row.append(sug);
      }
      registry[field.id] = () => {
        const sel = row.querySelector('input[type="radio"]:checked');
        return {
          score: sel ? Number(sel.value) : null,
          suggestion: getSuggestion(),
          evidence: getEvidence()
        };
      };
      registry["__rating__" + field.id] = true; // ทำเครื่องหมายว่าเป็นข้อให้คะแนน
      return row;
    }
    case "table": {
      const tableWrap = el("div", { class: "table-wrap" });
      tableWrap.append(label);
      const table = el("table", { class: "data-table" });
      const thead = el("thead");
      const headRow = el("tr");
      headRow.append(el("th", { text: "" }));
      (field.columns || []).forEach(c => headRow.append(el("th", { text: c.label })));
      thead.append(headRow);
      const tbody = el("tbody");
      const cellGetters = {};
      (field.rows || []).forEach(rowName => {
        const tr = el("tr");
        tr.append(el("th", { class: "row-head", text: rowName }));
        cellGetters[rowName] = {};
        (field.columns || []).forEach(c => {
          const inp = el("input", { type: c.type === "number" ? "number" : "text", class: "input input--cell" });
          cellGetters[rowName][c.id] = () => inp.value.trim();
          tr.append(el("td", {}, [inp]));
        });
        tbody.append(tr);
      });
      table.append(thead, tbody);
      tableWrap.append(table);
      registry[field.id] = () => {
        const out = {};
        for (const [rn, cols] of Object.entries(cellGetters)) {
          out[rn] = {};
          for (const [cid, getter] of Object.entries(cols)) out[rn][cid] = getter();
        }
        return out;
      };
      return tableWrap;
    }
    default:
      wrap.append(label, el("em", { text: "(ชนิดฟิลด์ไม่รองรับ: " + field.type + ")" }));
  }
  return wrap;
}

// สร้างตารางประเมิน (แบบฟอร์มต้นฉบับ) สำหรับ section ที่ให้คะแนน
function buildEvalTable(sec, schema, registry, fieldIds) {
  const scale = schema.ratingScale || [{ value: 3 }, { value: 2 }, { value: 1 }];
  const isRubric = (sec.fields || []).some(f => f.type === "rating" && f.levels);
  const table = el("table", { class: "eval-table " + (isRubric ? "eval-table--rubric" : "eval-table--rating") });
  const thead = el("thead");
  const hr = el("tr");
  if (isRubric) {
    ["รายการประเมินและตัวชี้วัด", "ร่องรอย / หลักฐาน", "ระดับ", "เกณฑ์การประเมิน"].forEach(h => hr.append(el("th", { text: h })));
  } else {
    hr.append(el("th", { text: "รายการประเมิน" }));
    scale.forEach(s => hr.append(el("th", { class: "th-num", text: String(s.value) })));
    if (schema.itemSuggestion) hr.append(el("th", { text: "ข้อเสนอแนะ" }));
  }
  thead.append(hr);
  const tbody = el("tbody");
  const colCount = isRubric ? 4 : (1 + scale.length + (schema.itemSuggestion ? 1 : 0));

  (sec.fields || []).forEach(f => {
    if (f.type === "heading") {
      const tr = el("tr", { class: "eval-section-row" });
      tr.append(el("td", { colspan: colCount, text: f.label }));
      tbody.append(tr);
      return;
    }
    if (f.type !== "rating") return;
    fieldIds.push(f.id);
    registry["__rating__" + f.id] = true;
    const radios = [];
    let evBoxes = [];
    let sugEl = null;

    if (isRubric) {
      // หลักฐาน
      const evCell = el("td", { class: "ev-cell" });
      if (Array.isArray(f.evidence) && f.evidence.length) {
        f.evidence.forEach((txt, i) => {
          const id = "f_" + f.id + "_ev" + i;
          const cb = el("input", { type: "checkbox", id, value: txt });
          evBoxes.push(cb);
          evCell.append(el("label", { class: "ev-item", for: id }, [cb, el("span", { text: txt })]));
        });
      }
      scale.forEach((s, idx) => {
        const tr = el("tr", { class: "rubric-tr" });
        if (idx === 0) {
          tr.append(el("td", { class: "ind-cell", rowspan: scale.length }, [el("span", { text: f.label })]));
          evCell.setAttribute("rowspan", scale.length);
          tr.append(evCell);
        }
        const id = "f_" + f.id + "_" + s.value;
        const r = el("input", { type: "radio", name: "f_" + f.id, id, value: s.value });
        radios.push(r);
        tr.append(el("td", { class: "lvl-cell" }, [el("label", { class: "lvl-pick", for: id }, [r, el("span", { class: "lvl-badge", text: String(s.value) })])]));
        tr.append(el("td", { class: "crit-cell" }, [el("label", { for: id, text: f.levels[String(s.value)] || "" })]));
        tbody.append(tr);
      });
      registry[f.id] = () => {
        const sel = radios.find(r => r.checked);
        return { score: sel ? Number(sel.value) : null, evidence: evBoxes.filter(b => b.checked).map(b => b.value) };
      };
    } else {
      const tr = el("tr");
      tr.append(el("td", { class: "ind-cell", text: f.label }));
      scale.forEach(s => {
        const id = "f_" + f.id + "_" + s.value;
        const r = el("input", { type: "radio", name: "f_" + f.id, id, value: s.value });
        radios.push(r);
        tr.append(el("td", { class: "pick-cell" }, [el("label", { class: "pick", for: id }, [r])]));
      });
      if (schema.itemSuggestion) {
        sugEl = el("input", { type: "text", class: "input input--cell", placeholder: "—" });
        tr.append(el("td", { class: "sug-cell" }, [sugEl]));
      }
      tbody.append(tr);
      registry[f.id] = () => ({
        score: (radios.find(r => r.checked) || {}).value ? Number(radios.find(r => r.checked).value) : null,
        suggestion: sugEl ? sugEl.value.trim() : ""
      });
    }
  });
  table.append(thead, tbody);
  return el("div", { class: "table-wrap table-wrap--eval" }, [table]);
}

// ตารางความพร้อม (ไม่คิดคะแนน) — รายการ | แนวการพิจารณา | ระดับความพร้อม
function buildLevelTable(sec, schema, registry, fieldIds) {
  const table = el("table", { class: "eval-table eval-table--level" });
  const thead = el("thead");
  const hr = el("tr");
  ["รายการ", "แนวการพิจารณา", "ระดับความพร้อม"].forEach(h => hr.append(el("th", { text: h })));
  thead.append(hr);
  const tbody = el("tbody");

  (sec.fields || []).forEach(f => {
    if (f.type === "heading") {
      const tr = el("tr", { class: "eval-section-row" });
      tr.append(el("td", { colspan: 3, text: f.label }));
      tbody.append(tr);
      return;
    }
    if (f.type !== "level") return;
    fieldIds.push(f.id);
    const radios = [];
    const opts = f.options || [];
    opts.forEach((o, idx) => {
      const tr = el("tr", { class: "level-tr" });
      if (idx === 0) {
        const cell = el("td", { class: "ind-cell", rowspan: opts.length });
        cell.append(el("span", { text: f.label }));
        if (f.hint) cell.append(el("div", { class: "ind-hint", text: f.hint }));
        tr.append(cell);
      }
      const id = "f_" + f.id + "_" + idx;
      const r = el("input", { type: "radio", name: "f_" + f.id, id, value: o.value });
      radios.push(r);
      tr.append(el("td", { class: "consider-cell" }, [el("label", { for: id, text: o.desc })]));
      tr.append(el("td", { class: "ready-cell" }, [
        el("label", { class: "ready-pick", for: id }, [r, el("span", { text: o.value })])
      ]));
      tbody.append(tr);
    });
    registry[f.id] = () => {
      const sel = radios.find(r => r.checked);
      return sel ? sel.value : "";
    };
  });
  table.append(thead, tbody);
  return el("div", { class: "table-wrap table-wrap--eval" }, [table]);
}

// สร้างทั้งฟอร์ม
export function renderForm(schema, container) {
  container.innerHTML = "";
  const registry = {}; // field.id -> getter
  const sectionScored = []; // เก็บข้อมูล section ที่ให้คะแนน

  const sections = schema.sections || [{ id: "main", title: "", fields: schema.fields }];
  sections.forEach(sec => {
    const card = el("section", { class: "form-card" });
    if (sec.title) card.append(el("h3", { class: "section-title", text: sec.title }));
    if (sec.scored) {
      card.classList.add("form-card--scored");
      if (schema.ratingLegend) card.append(el("p", { class: "rating-legend", text: schema.ratingLegend }));
      const meter = el("div", { class: "score-meter", id: "score_" + sec.id });
      meter.innerHTML =
        '<div class="score-meter__head">' +
          '<span class="score-meter__label">คะแนน</span>' +
          '<span class="score-meter__val"><b>0</b> / ' + sec.maxScore + '</span>' +
          '<span class="score-meter__level"></span>' +
        '</div>' +
        '<div class="score-meter__track"><div class="score-meter__fill" style="width:0%"></div></div>';
      card.append(meter);
    }

    const fieldIds = [];
    if (sec.scored) {
      card.append(buildEvalTable(sec, schema, registry, fieldIds));
    } else if (sec.layout === "readiness") {
      card.append(buildLevelTable(sec, schema, registry, fieldIds));
    } else {
      (sec.fields || []).forEach(f => {
        card.append(renderField(f, schema, registry));
        if (f.id) fieldIds.push(f.id);
      });
    }

    if (sec.scored) {
      sectionScored.push({ id: sec.id, maxScore: sec.maxScore, qualityBands: sec.qualityBands, fieldIds, title: sec.title });
    }
    container.append(card);
  });

  // คำนวณคะแนนสดเมื่อมีการเลือก
  container.addEventListener("change", () => updateScores());

  function updateScores() {
    sectionScored.forEach(sec => {
      let sum = 0;
      sec.fieldIds.forEach(fid => {
        if (registry["__rating__" + fid] && registry[fid]) {
          const v = registry[fid]();
          if (v && v.score) sum += v.score;
        }
      });
      const meter = container.querySelector("#score_" + sec.id);
      if (!meter) return;
      const pct = sec.maxScore ? Math.round((sum / sec.maxScore) * 100) : 0;
      meter.querySelector(".score-meter__val b").textContent = sum;
      meter.querySelector(".score-meter__fill").style.width = pct + "%";
      const levelEl = meter.querySelector(".score-meter__level");
      if (sec.qualityBands) {
        const b = sec.qualityBands.find(q => sum >= q.min && sum <= q.max);
        if (b) {
          levelEl.textContent = b.label;
          meter.dataset.level = b.level;
        } else {
          levelEl.textContent = "";
          delete meter.dataset.level;
        }
      } else {
        // ฟอร์มไม่มีระดับคุณภาพ: ใช้สัดส่วนคะแนนกำหนดสีแถบ
        meter.dataset.level = pct >= 80 ? 3 : pct >= 60 ? 2 : 1;
      }
    });
  }

  return {
    registry,
    sectionScored,
    collect() {
      const data = {};
      for (const [id, getter] of Object.entries(registry)) {
        if (id.startsWith("__rating__")) continue;
        data[id] = getter();
      }
      const scores = {};
      let total = 0, totalMax = 0;
      sectionScored.forEach(sec => {
        let sum = 0;
        sec.fieldIds.forEach(fid => {
          const v = data[fid];
          if (v && typeof v === "object" && "score" in v && v.score) sum += v.score;
        });
        let band = null;
        if (sec.qualityBands) {
          const b = sec.qualityBands.find(q => sum >= q.min && sum <= q.max);
          band = b ? b.label : null;
        }
        scores[sec.id] = { title: sec.title, score: sum, max: sec.maxScore, level: band };
        total += sum;
        totalMax += sec.maxScore;
      });
      if (sectionScored.length) scores.__total = { score: total, max: totalMax };
      return { data, scores };
    },
    updateScores
  };
}
