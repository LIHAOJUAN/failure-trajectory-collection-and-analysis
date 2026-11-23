"use strict";

(async () => {
  const {cases, taxonomy, tasks, representatives} = await fetch("failures.json").then(response => { if (!response.ok) throw Error("无法载入轨迹索引"); return response.json(); });
  const $ = (id) => document.getElementById(id);
  const methodNames = {video: "录像复核", score: "任务规则与得分", measure: "录像测量与任务规则", motion: "三机位变化量", result: "逐局结果"};
  const cameras = {head: "头部", left_wrist: "左腕", right_wrist: "右腕"};
  const dims = {open: "开放操作", precision: "精密操作", memory: "记忆", generalization: "泛化", "long-horizon": "长程操作"};
  const pending = cases.filter(r => r.review_status === "pending");
  const primaryText = r => r.group ? r.group + " · " + r.level1 : "待逐条判读";
  const secondaryText = r => r.code ? r.code + " · " + r.level2 : "尚未赋标签";
  const byId = new Map(cases.map(r => [r.id, r]));
  const groups = taxonomy.filter(g => g.id !== "X");
  const byGroup = new Map(groups.map(g => [g.id, cases.filter(r => r.group === g.id)]));
  const byCode = new Map(taxonomy.flatMap(g => g.subtypes.map(s => [s.code, cases.filter(r => r.code === s.code)])));
  const fields = {task: $("task-filter"), group: $("group-filter"), sub: $("sub-filter"), method: $("method-filter"), search: $("search")};
  const pageSize = 25;
  const detail = $("detail-dialog");
  const zoom = $("image-dialog");
  let page = 0;
  let filtered = cases;
  let openId = "";
  let playingTogether = false;
  let lastFocus = null;

  function esc(text) {
    return String(text).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[c]);
  }
  const fmt = n => n.toLocaleString("en-US");
  const sec = n => Number(n.toFixed(2)) + " 秒";
  const link = id => '<a class="case-id" href="#' + id + '">' + id + '</a>';
  const opt = (v, name) => '<option value="' + esc(v) + '">' + esc(name) + '</option>';
  const groupLabel = g => g.id + " · " + g.name;

  function renderOverview() {
    const total = cases.length;
    const uncertain = byGroup.get("U").length;
    const specific = total - uncertain - pending.length;
    $("progress").innerHTML = '<p><strong>' + fmt(specific) + ' 条</strong>定位到具体表现或未完成的任务阶段。</p><p><strong>' + fmt(uncertain) + ' 条</strong>有逐条证据说明，现有记录仍无法区分具体机制。</p><button class="text-button" data-filter-group="U">查看这些轨迹与证据 →</button>';
    $("mechanism-chart").innerHTML = groups.map(g => {
      const count = byGroup.get(g.id).length;
      const percentage = count * 100 / total;
      return '<button type="button" class="chart-row ' + (g.id === "U" ? "unresolved-bar" : "") +
        '" data-filter-group="' + g.id + '" aria-label="' + esc(groupLabel(g)) + '，' + count +
        ' 条，筛选所有轨迹"><span class="chart-name"><b>' + g.id + '</b>' + esc(g.name) +
        '</span><span class="bar-track"><span class="bar-color" style="width:' + percentage +
        '%"></span></span><span class="bar-numbers">' + fmt(count) + ' 条<small>' + percentage.toFixed(1) + '%</small></span></button>';
    }).join("") + '<p class="chart-caption">条形长度表示占全部正式失败的比例。点击任一行可筛选该类的全部轨迹。</p>';
    $("task-rows").innerHTML = Object.entries(tasks).map(([name, t]) => '<tr><td><a href="' + esc(t.source) +
      '">' + esc(t.name) + '</a><small>' + esc(name) + '</small></td><td>' + esc(dims[t.dimension] || t.dimension) +
      '</td><td>' + t.episodes + '</td><td>' + t.successes + '</td><td><button class="text-button" data-filter-task="' + name +
      '">' + t.failures + '</button></td><td>' + t.unstable_episodes_excluded + '</td></tr>').join("");
    const excluded = Object.entries(tasks).filter(([,t]) => t.unstable_episodes_excluded > 0)
      .map(([,t]) => esc(t.name) + ' ' + t.unstable_episodes_excluded + ' 局').join("、");
    const diagnostic = taxonomy.find(g => g.id === "X");
    $("diagnostic-rows").innerHTML = diagnostic.subtypes.map((s, i) =>
      '<tr><th>' + s.code + ' · ' + esc(s.name) + '</th><td>' + esc(s.boundary) + '</td><td>' +
      (i === 0 ? '9 条 unstable 已由正式评测排除。' + excluded + '。' :
        '1,709 组记录均与原局号及布局对应。5,127 段录像可解码，三机位的帧数和时间轴逐组一致。此项核对发现 0 条异常。') + '</td></tr>').join("");
  }

  function renderClassTable() {
    const body = [];
    for (const g of groups) {
      const total = byGroup.get(g.id).length;
      for (const [i, subtype] of g.subtypes.entries()) {
        const rows = byCode.get(subtype.code);
        let ids = '—';
        if (rows.length) {
          ids = rows.length <= 4 ? '<div class="id-links">' + rows.map(r => link(r.id)).join("") + '</div>' :
            '<details><summary>展开 ' + fmt(rows.length) + ' 个编号</summary><div class="id-links">' +
            rows.map(r => link(r.id)).join("") + '</div></details>';
        }
        const groupCell = i === 0 ? '<th scope="rowgroup" rowspan="' + g.subtypes.length +
          '"><span class="group-in-table">' + esc(groupLabel(g)) + '</span><small>' + fmt(total) + ' 条</small></th>' : '';
        body.push('<tr class="' + (i === 0 ? 'group-start' : '') + '">' + groupCell +
          '<td class="sub-name"><b>' + subtype.code + '</b> ' + esc(subtype.name) +
          '</td><td class="rule-cell">' + esc(subtype.boundary) + '</td><td class="label-count">' +
          (rows.length ? '<button class="text-button" data-filter-sub="' + subtype.code + '">' + fmt(rows.length) + '</button>' : '0') +
          '</td><td>' + ids + '</td></tr>');
      }
    }
    if (pending.length) body.push('<tr><th>标注进度</th><td>待逐条判读</td><td>尚无具体行为标签，保留回放及局号。</td><td>' + fmt(pending.length) + '</td><td><details><summary>展开轨迹编号</summary><div class="id-links">' + pending.map(r => link(r.id)).join("") + '</div></details></td></tr>');
    $("class-rows").innerHTML = body.join("");
    $("class-total").innerHTML = '<tr><th colspan="3">正式失败合计</th><td>' + fmt(cases.length) + '</td><td>每个编号只计一次</td></tr>';
  }

  function renderTabs(active) {
    const choices = groups.filter(g => byGroup.get(g.id).length);
    $("case-tabs").innerHTML = choices.map(g => '<button type="button" class="tab-button" role="tab" id="tab-' + g.id +
      '" aria-controls="case-cards" tabindex="' + (g.id === active ? '0' : '-1') + '" aria-selected="' +
      (g.id === active) + '" data-tab="' + g.id + '">' + esc(groupLabel(g)) + '</button>').join("");
    $("case-cards").setAttribute("aria-labelledby", "tab-" + active);
    const group = choices.find(g => g.id === active);
    const records = representatives[active].map(id => byId.get(id));
    $("case-intro").innerHTML = '<h3>' + esc(groupLabel(group)) + '</h3><button type="button" class="text-button" data-filter-group="' +
      active + '">查看全部 ' + fmt(byGroup.get(active).length) + ' 条 →</button>';
    $("case-cards").innerHTML = records.map(r => '<article class="case-card"><div class="case-visual"><video controls playsinline preload="none" poster="frames/posters/' +
      r.id + '.jpg" src="' + esc(r.videos[r.camera]) + '" aria-label="' + r.id + ' ' + cameras[r.camera] +
      '回放"></video></div><div class="case-body"><p class="case-meta">' + r.id + ' · ' + esc(tasks[r.task].name) +
      '</p><h4>' + esc(r.title) + '</h4><p class="case-sub">' + r.code + ' · ' + esc(r.level2) + '</p><p>' + esc(r.evidence) +
      '</p><div class="case-foot"><span class="uuid">' + cameras[r.camera] + ' · ' + sec(r.cue[0]) + '起</span><a href="#' +
      r.id + '">三机位详情 ↗</a></div></div></article>').join("");
  }

  function setupFilters() {
    fields.task.insertAdjacentHTML("beforeend", Object.entries(tasks).map(([id, t]) => opt(id, t.name + " · " + id)).join(""));
    fields.group.insertAdjacentHTML("beforeend", groups.map(g => opt(g.id, groupLabel(g))).join(""));
    if (pending.length) fields.group.insertAdjacentHTML("beforeend", opt("pending","待逐条判读（标注状态）"));
    fields.method.insertAdjacentHTML("beforeend", Object.entries(methodNames).map(([id, name]) => opt(id, name)).join(""));
    refreshSubtypes();
  }

  function refreshSubtypes() {
    const group = fields.group.value;
    fields.sub.innerHTML = opt("", "全部二级标签") + groups.filter(g => !group || g.id === group).flatMap(g =>
      g.subtypes.map(s => opt(s.code, s.code + " · " + s.name + "（" + byCode.get(s.code).length + "）"))).join("");
  }

  function renderPage() {
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    page = Math.min(Math.max(0, page), pages - 1);
    const start = page * pageSize;
    $("filter-summary").textContent = "匹配 " + fmt(filtered.length) + " / " + fmt(cases.length) + " 条失败轨迹";
    $("page-info").textContent = filtered.length ? "第 " + (page + 1) + " / " + pages + " 页 · " + (start + 1) + "–" +
      Math.min(start + pageSize, filtered.length) + " 条" : "没有匹配的轨迹";
    $("prev-page").disabled = page === 0;
    $("next-page").disabled = page === pages - 1;
    $("export-filtered").disabled = !filtered.length;
    $("episode-rows").innerHTML = filtered.slice(start, start + pageSize).map(r =>
      '<tr><td>' + link(r.id) + '<small>' + esc(tasks[r.task].name) + '</small></td><td>' + esc(primaryText(r)) + '</td><td>' + esc(secondaryText(r)) + '</td><td>' + esc(r.title) + '<small>' + esc(r.evidence) + '</small></td><td>' +
      methodNames[r.method] + '<small>' + r.score.toFixed(2) + '</small></td><td><a href="#' + r.id +
      '" aria-label="播放 ' + r.id + ' 的三机位录像">三机位 ↗</a></td></tr>').join("") ||
      '<tr><td colspan="6" class="empty-cell">没有符合条件的轨迹，可调整关键词或清空筛选。</td></tr>';
  }

  function applyFilters() {
    const q = fields.search.value.trim().toLowerCase();
    filtered = cases.filter(r => (!fields.task.value || r.task === fields.task.value) &&
      (!fields.group.value || (fields.group.value === "pending" ? !r.group : r.group === fields.group.value)) && (!fields.sub.value || r.code === fields.sub.value) &&
      (!fields.method.value || r.method === fields.method.value) && (!q || [r.id, r.task, tasks[r.task].name, r.code,
        r.level1, r.level2, r.title, r.evidence, r.score_note, r.dimension].join(" ").toLowerCase().includes(q)));
    page = 0;
    renderPage();
  }

  function reset() {
    $("filters").reset();
    refreshSubtypes();
    applyFilters();
  }

  function selectFilter(type, value) {
    reset();
    if (type === "task") fields.task.value = value;
    else {
      fields.group.value = type === "sub" ? value[0] : value;
      refreshSubtypes();
      if (type === "sub") fields.sub.value = value;
    }
    applyFilters();
    if (location.hash !== "#trajectories") location.hash = "trajectories";
    else $("trajectories").scrollIntoView();
  }

  function exportResults() {
    const cols = ["review_status","id","task","run","episode","layout","score","group","level1","code","level2","method","title","evidence","score_note","camera","start","end","head","left_wrist","right_wrist"];
    const quote = v => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const rows = filtered.map(r => {
      const out = {...r, ...r.videos, start: r.cue[0], end: r.cue[1]};
      return cols.map(k => quote(out[k])).join(",");
    });
    const blob = new Blob(["\uFEFF" + [cols.join(","), ...rows].join("\r\n")], {type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "QwenOFT-RoboDojo-" + filtered.length + ".csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function fact(term, value) {
    return '<div><dt>' + term + '</dt><dd>' + esc(value) + '</dd></div>';
  }

  function showCase(id) {
    if (!byId.has(id) || (detail.open && openId === id)) return;
    openId = id;
    playingTogether = false;
    const r = byId.get(id);
    const t = tasks[r.task];
    const timing = r.timing;
    $("detail-content").innerHTML = '<h2 id="detail-title">' + r.id + ' · ' + esc(r.title) +
      '</h2><p class="detail-uuid">' + esc(t.name) + ' / ' + esc(r.task) + '</p><div class="detail-tags"><span>' +
      esc(primaryText(r)) + '</span><span>' + esc(secondaryText(r)) + '</span></div>' +
      '<h3>判读依据</h3><p>' + esc(r.evidence) + '</p>' + (r.evidence !== r.score_note ? '<p class="detail-note">评测记录　' +
      esc(r.score_note) + '</p>' : '') + '<p class="cue-note"><strong>' + cameras[r.camera] + ' · ' + sec(r.cue[0]) + ' 至 ' +
      sec(r.cue[1]) + '</strong>　' + methodNames[r.method] + '</p><div class="detail-controls"><button type="button" class="button primary" id="play-cue">从证据时段同步播放</button>' +
      '<button type="button" class="button secondary" id="pause-all">暂停三个机位</button><span id="play-status" role="status"></span></div><div class="camera-grid">' +
      Object.entries(cameras).map(([key, name]) => '<figure><figcaption>' + name + (key === r.camera ? ' · 判读机位' : '') +
        '</figcaption><video controls playsinline muted preload="metadata" data-camera="' + key + '" src="' + esc(r.videos[key]) +
        '" aria-label="' + r.id + ' ' + name + '原始录像"></video><a class="camera-file" href="' + esc(r.videos[key]) + '" target="_blank" rel="noopener">单独打开回放 ↗</a></figure>').join("") +
      '</div><h3>三机位关键帧</h3><p class="sheet-caption">每列是同一时刻。从上到下依次为头部、左腕、右腕。点击图片可放大，点击时间可让三个机位跳到同一帧。</p>' +
      '<button id="show-frames" class="detail-image-button" type="button" aria-label="放大 ' + r.id +
      ' 的三机位关键帧"><img class="detail-overview" src="' + r.sheet + '" alt="三行八列的同步关键帧"></button><div class="time-buttons">' +
      timing.times.map(s => '<button type="button" class="text-button" data-time="' + s + '">' + sec(s) + '</button>').join("") +
      '</div><dl class="detail-facts">' + fact("原局号 / 布局号", r.episode + " / " + r.layout) + fact("正式结果 / 评测分", "失败 / " + r.score.toFixed(2)) +
      fact("任务维度", dims[r.dimension] || r.dimension) + fact("各机位片长 / 帧数", sec(timing.seconds) + " / " + timing.frames) +
      fact("运行批次", r.run) + fact("任务成功条件", t.criterion) + '</dl><a href="' + esc(t.source) + '" target="_blank" rel="noopener">对照本任务评测源码 ↗</a>';
    if (!detail.open) {
      if (document.activeElement instanceof HTMLElement) lastFocus = document.activeElement;
      detail.showModal();
      $("close-dialog").focus({preventScroll:true});
    }
    detail.scrollTop = 0;
    $("play-cue").onclick = () => seekAll(r.cue[0], true);
    $("pause-all").onclick = () => {
      playingTogether = false;
      for (const video of detail.querySelectorAll("video")) video.pause();
      $("play-status").textContent = "已暂停";
    };
    $("show-frames").onclick = () => {
      $("large-image").src = r.sheet;
      zoom.showModal();
    };
  }

  async function seekAll(time, play) {
    const id = openId;
    const videos = [...detail.querySelectorAll("video")];
    playingTogether = false;
    for (const video of videos) video.pause();
    $("play-status").textContent = "正在定位…";
    try {
      await Promise.all(videos.map(video => new Promise((resolve, reject) => {
        function clean() {
          video.removeEventListener("loadedmetadata", ready);
          video.removeEventListener("error", failed);
        }
        function failed() { clean(); reject(new Error("video unavailable")); }
        function ready() {
          clean();
          try { video.currentTime = Math.min(time, video.duration - 0.02); resolve(); }
          catch (error) { reject(error); }
        }
        if (video.error) failed();
        else if (video.readyState >= 1) ready();
        else {
          video.addEventListener("loadedmetadata", ready);
          video.addEventListener("error", failed);
        }
      })));
      if (openId !== id || !detail.open) return;
      if (play) {
        await Promise.all(videos.map(v => v.play()));
        playingTogether = true;
      }
      $("play-status").textContent = (play ? "同步播放 · " : "已定位 · ") + sec(time);
    } catch {
      playingTogether = false;
      videos.forEach(v => v.pause());
      if (openId === id && detail.open) $("play-status").textContent = "回放暂未就绪，可单独打开任一机位。";
    }
  }

  function closeMedia() {
    playingTogether = false;
    if (zoom.open) zoom.close();
    if (!detail.open) return;
    detail.querySelectorAll("video").forEach(v => v.pause());
    detail.close();
    $("detail-content").replaceChildren();
    openId = "";
    if (lastFocus?.isConnected) lastFocus.focus({preventScroll:true});
  }

  function closeCase() {
    if (history.state?.dojoCase) history.back();
    else {
      closeMedia();
      history.replaceState(null, "", "#trajectories");
      $("trajectories").scrollIntoView();
    }
  }

  function route() {
    const id = location.hash.replace(/^#(?:trajectory-)?/, "").toUpperCase();
    if (byId.has(id)) showCase(id);
    else closeMedia();
  }

  document.addEventListener("click", event => {
    const el = event.target.closest("a,button");
    if (!el) return;
    if (el.dataset.filterGroup) selectFilter("group", el.dataset.filterGroup);
    else if (el.dataset.filterTask) selectFilter("task", el.dataset.filterTask);
    else if (el.dataset.filterSub) selectFilter("sub", el.dataset.filterSub);
    else if (el.dataset.tab) renderTabs(el.dataset.tab);
    else if (el.dataset.time !== undefined) seekAll(Number(el.dataset.time), false);
    else if (el.tagName === "A" && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      const dest = el.getAttribute("href");
      if (dest && /^#D\d{4}$/.test(dest) && byId.has(dest.slice(1))) {
        event.preventDefault();
        if (dest !== location.hash) history.pushState({dojoCase:true}, "", dest);
        showCase(dest.slice(1));
      }
    }
  });

  $("case-tabs").addEventListener("keydown", event => {
    const tabs = [...$("case-tabs").querySelectorAll("[role=tab]")];
    const index = tabs.indexOf(event.target);
    if (index < 0) return;
    const directions = {ArrowLeft: (index + tabs.length - 1) % tabs.length, ArrowRight: (index + 1) % tabs.length, Home: 0, End: tabs.length - 1};
    if (event.key in directions) {
      event.preventDefault();
      const group = tabs[directions[event.key]].dataset.tab;
      renderTabs(group);
      $("tab-" + group).focus();
    }
  });
  $("filters").addEventListener("submit", event => event.preventDefault());
  $("filters").addEventListener("change", event => {
    if (event.target === fields.group) refreshSubtypes();
    if (event.target === fields.sub && fields.sub.value) fields.group.value = fields.sub.value[0];
    applyFilters();
  });
  fields.search.addEventListener("input", applyFilters);
  $("reset-filters").onclick = reset;
  $("export-filtered").onclick = exportResults;
  for (const [id, offset] of [["prev-page",-1],["next-page",1]]) $(id).onclick = () => {
    page += offset;
    renderPage();
    $("filter-summary").scrollIntoView({block:"start"});
  };
  $("close-dialog").onclick = closeCase;
  $("close-image").onclick = () => zoom.close();
  detail.addEventListener("cancel", event => { event.preventDefault(); closeCase(); });
  detail.addEventListener("click", event => { if (event.target === detail) {
    const box = detail.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeCase();
  }});
  detail.addEventListener("timeupdate", event => {
    if (!playingTogether || event.target.dataset.camera !== "head") return;
    const lead = event.target;
    for (const other of detail.querySelectorAll("video")) {
      if (other !== lead && !other.paused && !other.seeking && Math.abs(other.currentTime-lead.currentTime) > 0.20) other.currentTime = lead.currentTime;
    }
  }, true);
  detail.addEventListener("pause", event => {
    if (!playingTogether || event.target.tagName !== "VIDEO") return;
    playingTogether = false;
    detail.querySelectorAll("video").forEach(v => v.pause());
  }, true);
  window.addEventListener("popstate", route);
  window.addEventListener("hashchange", route);
  renderOverview();
  renderClassTable();
  renderTabs("A");
  setupFilters();
  renderPage();
  route();
})();
