// Chamadas de Curso: voz em mesh (P2P) + compartilhamento de tela, sinalizados via Ably.
// Depende de globais já definidos no <script> principal de central_policial.html:
// state, Notify, getCurrentUserRoles(), parseRoleIds(), isOwner(), isGeneralCommand(), switchSection().
(function () {
  "use strict";

  const VoiceState = {
    config: null,
    rooms: [],
    isAdmin: false,
    canModerate: false,
    currentRoomSlug: null,
    ably: null,
    signalingChannel: null,
    modChannel: null,
    peers: new Map(), // clientId -> { pc, makingOffer, ignoreOffer, audioEl, videoStream }
    presenceMembers: [],
    participantRows: new Map(), // clientId -> <div> da linha (atualização incremental, sem re-render da lista inteira)
    speakingDetectors: new Map(), // clientId -> { ctx, analyser, source, rafId, speaking }
    participantSearchQuery: "",
    localStream: null,
    screenStream: null,
    micMuted: false,
    deafened: false,
    wasMicMutedBeforeDeafen: false,
    presenting: false,
    presenterClientIds: new Set(), // quem está transmitindo tela na sala agora (até MAX_SIMULTANEOUS_PRESENTERS)
    watchingClientId: null, // quem eu escolhi assistir agora (null = não estou assistindo ninguém)
    selfPreviewExpanded: false,
    presenterAudioMuted: true,
    presenterVolume: 1,
    mutedPeers: new Set(),
    deafenedPeers: new Set(),
    locallyMutedPeers: new Set(),
    iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
    roomsPollTimer: null,
    activeContextMenu: null,
  };

  const SPEAKING_THRESHOLD = 14;
  const MAX_SIMULTANEOUS_PRESENTERS = 2;

  function myClientId() {
    return String(state?.currentUser?.id || "");
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[ch]));
  }

  function normalizeSearchText(value) {
    return String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  // ---------------------------------------------------------------------
  // Efeitos sonoros (arquivos em public/audio/, no estilo Discord).
  // Alguns ainda não foram enviados (ex.: início de transmissão) — falha em silêncio, sem quebrar nada.
  // ---------------------------------------------------------------------
  const SOUND_FILES = {
    join: "audio/discord-sounds.mp3",
    leave: "audio/discord-leave-noise.mp3",
    disconnect: "audio/Disconect Discord.mp3",
    mute: "audio/discordmute.mp3",
    unmute: "audio/discord unmute sound - QuickSounds.com.mp3",
    streamStart: "audio/discord-stream-start-sound-effect.mp3",
    streamStop: "audio/discord-stream-stop-sound-effect-made-with-Voicemod.mp3",
  };
  const soundCache = new Map();

  function playVoiceSound(key) {
    const path = SOUND_FILES[key];
    if (!path) return;
    try {
      let audio = soundCache.get(key);
      if (!audio) {
        audio = new Audio(encodeURI(path));
        audio.volume = 0.5;
        soundCache.set(key, audio);
      }
      audio.currentTime = 0;
      audio.play()?.catch(() => { /* som ainda não enviado ou autoplay bloqueado — ignora */ });
    } catch { /* ignora — som é só um reforço, nunca deve travar a chamada */ }
  }

  function isPolite(otherClientId) {
    return myClientId() > String(otherClientId);
  }

  // ---------------------------------------------------------------------
  // Permissões (só para gating de UI — a aplicação real é sempre server-side)
  // ---------------------------------------------------------------------
  async function loadVoiceConfig() {
    const response = await fetch("/api/voice?action=config");
    VoiceState.config = await response.json().catch(() => ({}));
    computePermissions();
  }

  function computePermissions() {
    const cfg = VoiceState.config || {};
    const userRoles = typeof getCurrentUserRoles === "function" ? getCurrentUserRoles() : [];
    const hasRole = (list) => {
      const fn = typeof parseRoleIds === "function" ? parseRoleIds : (v) => String(v || "").split(",").map((x) => x.trim()).filter(Boolean);
      return fn(list || "").some((id) => userRoles.includes(String(id)));
    };
    const admin =
      (typeof isOwner === "function" && isOwner()) ||
      (typeof isGeneralCommand === "function" && isGeneralCommand()) ||
      hasRole(cfg.voiceAdminRoleIds);
    const instructor =
      admin ||
      hasRole(cfg.instrutorRoleIds?.pcerj) ||
      hasRole(cfg.instrutorRoleIds?.pmerj) ||
      hasRole(cfg.instrutorRoleIds?.prf);

    VoiceState.isAdmin = admin;
    VoiceState.canModerate = instructor;

    const createBtn = document.getElementById("voice-create-room-button");
    if (createBtn) createBtn.classList.toggle("hidden", !admin);
  }

  // ---------------------------------------------------------------------
  // Lista de salas
  // ---------------------------------------------------------------------
  async function refreshRoomList() {
    try {
      const response = await fetch("/api/voice?action=rooms");
      const payload = await response.json();
      VoiceState.rooms = Array.isArray(payload.rooms) ? payload.rooms : [];
      renderRoomGrid();
    } catch (error) {
      console.error("Falha ao carregar salas de chamada:", error);
    }
  }

  function getRoomMembersPreviewList(room, isCurrent) {
    if (isCurrent) {
      return (VoiceState.presenceMembers || []).map((member) => ({
        id: String(member.clientId),
        displayName: member.data?.displayName || "Policial",
        avatarUrl: member.data?.avatarUrl || "",
      }));
    }
    return Array.isArray(room.members) ? room.members : [];
  }

  function renderRoomGrid() {
    const list = document.getElementById("voice-room-list");
    if (!list) return;
    list.innerHTML = "";

    if (!VoiceState.rooms.length) {
      list.innerHTML = '<div class="empty-state">Nenhuma sala disponível no momento.</div>';
      return;
    }

    VoiceState.rooms.forEach((room) => {
      const isCurrent = room.slug === VoiceState.currentRoomSlug;
      const occupants = isCurrent ? VoiceState.presenceMembers.length : room.occupants;
      const full = Boolean(room.memberLimit) && occupants >= room.memberLimit;
      const membersPreview = getRoomMembersPreviewList(room, isCurrent);
      const previewAvatars = membersPreview.slice(0, 5);
      const namesText = membersPreview.length
        ? membersPreview.map((member) => member.displayName).join(", ")
        : "Sala vazia";

      const card = document.createElement("div");
      card.className = `voice-room-card${isCurrent ? " current" : ""}`;
      card.dataset.slug = room.slug;
      card.innerHTML = `
        <h3>${escapeHtml(room.name)}</h3>
        <span class="voice-room-status-line${isCurrent ? " is-connected" : ""}"><i class="fa-solid fa-circle"></i>${isCurrent ? "Conectada" : "Disponível"}</span>
        <span class="voice-room-occupants${full ? " full" : ""}">${occupants}${room.memberLimit ? ` / ${room.memberLimit}` : ""} participante${occupants === 1 ? "" : "s"}</span>
        ${membersPreview.length ? `
          <div class="voice-room-members-preview">
            ${previewAvatars.map((member) => `<img class="voice-room-member-avatar" src="${member.avatarUrl || "images/Logo_policia.png"}" alt="" title="${escapeHtml(member.displayName)}" onerror="this.src='images/Logo_policia.png'" />`).join("")}
          </div>
          <span class="voice-room-members-names" title="${escapeHtml(namesText)}">${escapeHtml(namesText)}</span>
        ` : `<span class="voice-room-members-names">Sala vazia</span>`}
        <div class="voice-room-card-actions">
          <button type="button" class="action-button voice-join-button"${full && !isCurrent ? " disabled" : ""} aria-label="${isCurrent ? "Sair da sala " : "Entrar na sala "}${escapeHtml(room.name)}">
            <i class="fa-solid ${isCurrent ? "fa-phone-slash" : "fa-phone"}"></i>
            <span>${isCurrent ? "Sair" : "Entrar"}</span>
          </button>
          ${VoiceState.isAdmin ? `
            <div class="voice-room-admin-actions">
              <button type="button" class="voice-icon-button" data-room-rename title="Renomear sala" aria-label="Renomear sala ${escapeHtml(room.name)}"><i class="fa-solid fa-pen"></i></button>
              <button type="button" class="voice-icon-button" data-room-limit title="Definir limite de membros" aria-label="Definir limite de membros da sala ${escapeHtml(room.name)}"><i class="fa-solid fa-users-gear"></i></button>
              <button type="button" class="voice-icon-button danger" data-room-delete title="Apagar sala" aria-label="Apagar sala ${escapeHtml(room.name)}"><i class="fa-solid fa-trash"></i></button>
            </div>` : ""}
        </div>
      `;

      card.querySelector(".voice-join-button").addEventListener("click", () => {
        if (isCurrent) leaveRoom();
        else joinRoom(room.slug);
      });

      if (VoiceState.isAdmin) {
        card.querySelector("[data-room-rename]").addEventListener("click", () => renameRoomPrompt(room));
        card.querySelector("[data-room-limit]").addEventListener("click", () => setRoomLimitPrompt(room));
        card.querySelector("[data-room-delete]").addEventListener("click", () => deleteRoomPrompt(room));
      }

      wireRoomCardDropTarget(card, room);
      list.appendChild(card);
    });
  }

  function wireRoomCardDropTarget(cardEl, room) {
    cardEl.addEventListener("dragover", (event) => {
      if (!VoiceState.canModerate || room.slug === VoiceState.currentRoomSlug) return;
      event.preventDefault();
      cardEl.classList.add("drag-over");
    });
    cardEl.addEventListener("dragleave", () => cardEl.classList.remove("drag-over"));
    cardEl.addEventListener("drop", (event) => {
      event.preventDefault();
      cardEl.classList.remove("drag-over");
      if (!VoiceState.canModerate || room.slug === VoiceState.currentRoomSlug) return;
      const targetClientId = event.dataTransfer.getData("text/voice-participant");
      if (!targetClientId) return;
      moderate("move", targetClientId, { toRoomSlug: room.slug });
    });
  }

  // ---------------------------------------------------------------------
  // Modal estilizado (substitui prompt()/confirm() do navegador)
  // ---------------------------------------------------------------------
  function closeModal() {
    document.querySelectorAll(".voice-modal-overlay").forEach((el) => el.remove());
  }

  function openModal({ title, description, fields = [], confirmLabel = "Confirmar", cancelLabel = "Cancelar", danger = false, onConfirm }) {
    closeModal();

    const overlay = document.createElement("div");
    overlay.className = "voice-modal-overlay";
    overlay.innerHTML = `
      <div class="voice-modal-box">
        <h3>${escapeHtml(title)}</h3>
        ${description ? `<p class="voice-modal-description">${escapeHtml(description)}</p>` : ""}
        <div class="voice-modal-fields"></div>
        <div class="voice-modal-actions">
          <button type="button" class="ghost-button voice-modal-cancel">${escapeHtml(cancelLabel)}</button>
          <button type="button" class="submit-button${danger ? " danger" : ""} voice-modal-confirm">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    `;

    const fieldsContainer = overlay.querySelector(".voice-modal-fields");
    const inputs = {};
    fields.forEach((field) => {
      const wrap = document.createElement("div");
      wrap.className = "voice-modal-field";
      const label = document.createElement("label");
      label.textContent = field.label;
      const input = document.createElement("input");
      input.type = field.type || "text";
      if (field.value != null) input.value = field.value;
      if (field.placeholder) input.placeholder = field.placeholder;
      if (field.min != null) input.min = field.min;
      wrap.appendChild(label);
      wrap.appendChild(input);
      fieldsContainer.appendChild(wrap);
      inputs[field.name] = input;
    });

    const close = () => {
      overlay.classList.remove("open");
      setTimeout(() => overlay.remove(), 150);
    };
    overlay.querySelector(".voice-modal-cancel").addEventListener("click", close);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
    overlay.querySelector(".voice-modal-confirm").addEventListener("click", () => {
      const values = {};
      Object.keys(inputs).forEach((name) => { values[name] = inputs[name].value; });
      close();
      onConfirm?.(values);
    });
    document.addEventListener("keydown", function onKeydown(event) {
      if (!document.body.contains(overlay)) { document.removeEventListener("keydown", onKeydown); return; }
      if (event.key === "Escape") close();
    });

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("open"));
    const firstInput = fieldsContainer.querySelector("input");
    if (firstInput) setTimeout(() => firstInput.focus(), 60);
  }

  // ---------------------------------------------------------------------
  // Ações administrativas de sala (só admin)
  // ---------------------------------------------------------------------
  async function roomAdminAction(action, extra) {
    try {
      const response = await fetch(`/api/voice?action=${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: myClientId(), ...extra }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Falha na ação administrativa.");
      Notify.success("Sala atualizada com sucesso.");
      await refreshRoomList();
    } catch (error) {
      Notify.error(error.message || "Falha na ação administrativa.");
    }
  }

  function createRoomPrompt() {
    openModal({
      title: "Nova sala de chamada",
      fields: [
        { name: "name", label: "Nome da sala", placeholder: "Ex: Sala de Curso 6" },
        { name: "memberLimit", label: "Limite de membros (opcional)", type: "number", value: 20, min: 2 },
      ],
      confirmLabel: "Criar sala",
      onConfirm: (values) => {
        if (!values.name.trim()) { Notify.error("Informe um nome para a sala."); return; }
        roomAdminAction("create-room", { name: values.name.trim(), memberLimit: values.memberLimit ? Number(values.memberLimit) : null });
      },
    });
  }

  function renameRoomPrompt(room) {
    openModal({
      title: "Renomear sala",
      fields: [{ name: "name", label: "Novo nome da sala", value: room.name }],
      confirmLabel: "Salvar",
      onConfirm: (values) => {
        if (!values.name.trim()) { Notify.error("Informe um nome para a sala."); return; }
        roomAdminAction("rename-room", { slug: room.slug, name: values.name.trim() });
      },
    });
  }

  function setRoomLimitPrompt(room) {
    openModal({
      title: "Limite de membros",
      description: "Deixe em branco para não ter limite.",
      fields: [{ name: "memberLimit", label: "Novo limite de membros", type: "number", value: room.memberLimit || "", min: 2 }],
      confirmLabel: "Salvar",
      onConfirm: (values) => {
        roomAdminAction("set-limit", { slug: room.slug, memberLimit: values.memberLimit ? Number(values.memberLimit) : null });
      },
    });
  }

  function deleteRoomPrompt(room) {
    openModal({
      title: "Apagar sala",
      description: `Tem certeza que deseja apagar "${room.name}"? Essa ação não pode ser desfeita.`,
      confirmLabel: "Apagar sala",
      danger: true,
      onConfirm: () => roomAdminAction("delete-room", { slug: room.slug }),
    });
  }

  // ---------------------------------------------------------------------
  // Ações de moderação (instrutor ou admin — validado de novo no servidor)
  // ---------------------------------------------------------------------
  async function moderate(action, targetUserId, extra = {}) {
    try {
      const response = await fetch(`/api/voice?action=${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: myClientId(), targetUserId, roomSlug: VoiceState.currentRoomSlug, ...extra }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Falha ao aplicar a ação.");
    } catch (error) {
      Notify.error(error.message || "Falha ao aplicar a ação.");
    }
  }

  function toggleLocalMute(clientId) {
    if (VoiceState.locallyMutedPeers.has(clientId)) VoiceState.locallyMutedPeers.delete(clientId);
    else VoiceState.locallyMutedPeers.add(clientId);
    applyModerationStateToPeer(clientId);
    refreshParticipantRow(clientId);
  }

  // ---------------------------------------------------------------------
  // Menu de contexto (botão direito num participante)
  // ---------------------------------------------------------------------
  function closeContextMenu() {
    if (VoiceState.activeContextMenu) {
      VoiceState.activeContextMenu.remove();
      VoiceState.activeContextMenu = null;
    }
  }

  function confirmDisconnect(targetClientId, displayName) {
    openModal({
      title: "Remover participante",
      description: `Remover ${displayName || "este participante"} da sala? A pessoa poderá tentar entrar novamente depois de alguns instantes.`,
      confirmLabel: "Remover",
      danger: true,
      onConfirm: () => moderate("disconnect", targetClientId),
    });
  }

  function openParticipantContextMenu(event, targetClientId) {
    closeContextMenu();

    const targetMember = (VoiceState.presenceMembers || []).find((entry) => String(entry.clientId) === String(targetClientId));
    const targetDisplayName = targetMember?.data?.displayName || "";

    const items = [];
    const locallyMuted = VoiceState.locallyMutedPeers.has(targetClientId);
    items.push({
      label: locallyMuted ? "Tirar mudo só pra mim" : "Mutar só pra mim",
      icon: "fa-volume-low",
      action: () => toggleLocalMute(targetClientId),
    });

    if (VoiceState.canModerate) {
      const isMuted = VoiceState.mutedPeers.has(targetClientId);
      const isDeafened = VoiceState.deafenedPeers.has(targetClientId);
      items.push({ separator: true });
      items.push({ label: isMuted ? "Desmutar" : "Mutar", icon: "fa-microphone-slash", action: () => moderate(isMuted ? "unmute" : "mute", targetClientId) });
      items.push({ label: isDeafened ? "Tirar silêncio" : "Silenciar", icon: "fa-volume-xmark", action: () => moderate(isDeafened ? "undeafen" : "deafen", targetClientId) });
      items.push({ separator: true });
      items.push({ label: "Remover da sala", icon: "fa-phone-slash", danger: true, action: () => confirmDisconnect(targetClientId, targetDisplayName) });

      const otherRooms = VoiceState.rooms.filter((room) => room.slug !== VoiceState.currentRoomSlug);
      if (otherRooms.length) {
        items.push({ separator: true });
        items.push({ submenuLabel: "Mover para" });
        otherRooms.forEach((room) => {
          items.push({ label: room.name, icon: "fa-arrow-right", action: () => moderate("move", targetClientId, { toRoomSlug: room.slug }) });
        });
      }
    }

    const menu = document.createElement("div");
    menu.className = "voice-context-menu";
    items.forEach((item) => {
      if (item.separator) {
        const sep = document.createElement("div");
        sep.className = "voice-context-separator";
        menu.appendChild(sep);
        return;
      }
      if (item.submenuLabel) {
        const label = document.createElement("div");
        label.className = "voice-context-submenu-label";
        label.textContent = item.submenuLabel;
        menu.appendChild(label);
        return;
      }
      const button = document.createElement("button");
      button.type = "button";
      if (item.danger) button.className = "danger";
      button.innerHTML = `<i class="fa-solid ${item.icon}"></i><span>${escapeHtml(item.label)}</span>`;
      button.addEventListener("click", () => {
        closeContextMenu();
        item.action();
      });
      menu.appendChild(button);
    });

    document.body.appendChild(menu);
    const maxLeft = Math.max(8, window.innerWidth - menu.offsetWidth - 8);
    const maxTop = Math.max(8, window.innerHeight - menu.offsetHeight - 8);
    menu.style.left = `${Math.min(event.clientX, maxLeft)}px`;
    menu.style.top = `${Math.min(event.clientY, maxTop)}px`;
    VoiceState.activeContextMenu = menu;
    setTimeout(() => document.addEventListener("click", closeContextMenu, { once: true }), 0);
  }

  // ---------------------------------------------------------------------
  // Lista de participantes da call atual — linhas verticais, atualização incremental
  // ---------------------------------------------------------------------
  function buildParticipantRow(member) {
    const clientId = String(member.clientId);
    const data = member.data || {};
    const isSelf = clientId === myClientId();
    const isMuted = VoiceState.mutedPeers.has(clientId) || Boolean(data.micMuted);
    const isDeafened = VoiceState.deafenedPeers.has(clientId) || Boolean(data.deafened);
    const isPresenting = Boolean(data.presenting);
    const isSpeaking = Boolean(VoiceState.speakingDetectors.get(clientId)?.speaking) && !isMuted && !isDeafened;
    const draggable = VoiceState.canModerate && !isSelf;
    const isWatchable = isPresenting && !isSelf;
    const isWatchingThis = isWatchable && String(VoiceState.watchingClientId) === clientId;

    const row = document.createElement("div");
    row.className = `voice-participant-row${draggable ? " draggable" : ""}${isPresenting ? " is-presenting" : ""}${isSpeaking ? " speaking" : ""}`;
    row.dataset.clientId = clientId;
    row.dataset.searchText = normalizeSearchText(`${data.displayName || ""} ${data.factionLabel || ""}`);
    row.innerHTML = `
      <div class="voice-participant-draghandle" title="${draggable ? "Arraste até outra sala pra mover" : isWatchable ? "Clique 2x para assistir a transmissão" : ""}">
        <span class="voice-participant-status-dot" title="Conectado" aria-hidden="true"></span>
        <img class="voice-participant-avatar" src="${data.avatarUrl || "images/Logo_policia.png"}" alt="" onerror="this.src='images/Logo_policia.png'" />
        <div class="voice-participant-info">
          <span class="voice-participant-name">${escapeHtml(data.displayName || "Policial")}${isSelf ? " (você)" : ""}${data.isModerator ? ' <span class="voice-badge-moderator">Moderador</span>' : ""}</span>
          ${data.factionLabel ? `<span class="voice-participant-org">${escapeHtml(data.factionLabel)}</span>` : ""}
        </div>
      </div>
      <div class="voice-participant-badges">
        ${isMuted
          ? '<i class="fa-solid fa-microphone-slash badge-muted" title="Microfone mutado" aria-label="Microfone mutado"></i>'
          : '<i class="fa-solid fa-microphone badge-live" title="Microfone ativo" aria-label="Microfone ativo"></i>'}
        ${isDeafened ? '<i class="fa-solid fa-volume-xmark badge-deafened" title="Áudio silenciado" aria-label="Áudio silenciado"></i>' : ""}
        ${isPresenting ? '<span class="voice-live-badge"><i class="fa-solid fa-circle"></i><span>AO VIVO</span></span>' : ""}
        ${isWatchable && !isWatchingThis ? '<button type="button" class="voice-watch-button" data-watch-toggle title="Assistir transmissão" aria-label="Assistir à transmissão de tela"><i class="fa-solid fa-eye"></i><span>Assistir</span></button>' : ""}
      </div>
      ${draggable ? `
        <div class="voice-participant-actions">
          <button type="button" class="voice-icon-button voice-chip-mute${isMuted ? " active-off" : ""}" title="${isMuted ? "Desmutar" : "Mutar"}" aria-label="${isMuted ? "Desmutar participante" : "Mutar participante"}"><i class="fa-solid fa-microphone${isMuted ? "-slash" : ""}"></i></button>
          <button type="button" class="voice-icon-button voice-chip-deafen${isDeafened ? " active-off" : ""}" title="${isDeafened ? "Tirar silêncio" : "Silenciar"}" aria-label="${isDeafened ? "Tirar participante do silêncio" : "Silenciar participante"}"><i class="fa-solid ${isDeafened ? "fa-volume-xmark" : "fa-headphones"}"></i></button>
          <button type="button" class="voice-icon-button voice-chip-more" title="Mais opções" aria-label="Mais opções para este participante"><i class="fa-solid fa-ellipsis-vertical"></i></button>
        </div>
      ` : ""}
    `;

    if (!isSelf) {
      row.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        openParticipantContextMenu(event, clientId);
      });
    }
    if (isWatchable) {
      // Clicar 2x no perfil (avatar + nome), igual ao Discord, também abre a transmissão.
      row.querySelector(".voice-participant-draghandle")?.addEventListener("dblclick", (event) => {
        event.stopPropagation();
        startWatchingPresenter(clientId);
      });
      row.querySelector("[data-watch-toggle]")?.addEventListener("click", (event) => {
        event.stopPropagation();
        startWatchingPresenter(clientId);
      });
    }
    if (draggable) {
      // Só o "puxador" (avatar + nome) inicia o arrastar — igual ao Discord, não a linha inteira.
      const handle = row.querySelector(".voice-participant-draghandle");
      handle.draggable = true;
      handle.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("text/voice-participant", clientId);
        row.classList.add("dragging");
      });
      handle.addEventListener("dragend", () => row.classList.remove("dragging"));

      row.querySelector(".voice-chip-mute").addEventListener("click", (event) => {
        event.stopPropagation();
        moderate(isMuted ? "unmute" : "mute", clientId);
      });
      row.querySelector(".voice-chip-deafen").addEventListener("click", (event) => {
        event.stopPropagation();
        moderate(isDeafened ? "undeafen" : "deafen", clientId);
      });
      row.querySelector(".voice-chip-more").addEventListener("click", (event) => {
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        openParticipantContextMenu({ clientX: rect.left, clientY: rect.bottom + 6 }, clientId);
      });
    }

    return row;
  }

  function renderParticipantList() {
    const container = document.getElementById("voice-participant-list");
    if (!container) return;
    container.innerHTML = "";
    VoiceState.participantRows.clear();

    const members = [...(VoiceState.presenceMembers || [])];
    // Quem está transmitindo tela sempre fica fixo em primeiro na lista (até 2 pessoas por vez).
    members.sort((a, b) => {
      const aPresenting = Boolean(a.data?.presenting) ? 1 : 0;
      const bPresenting = Boolean(b.data?.presenting) ? 1 : 0;
      return bPresenting - aPresenting;
    });

    members.forEach((member) => {
      const row = buildParticipantRow(member);
      VoiceState.participantRows.set(String(member.clientId), row);
      container.appendChild(row);
    });

    applyParticipantSearchFilter();
    updateParticipantCount();
  }

  // Garante que quem está transmitindo tela (até 2 pessoas) fique sempre fixo no topo da lista,
  // mantendo a ordem relativa entre elas.
  function reorderParticipantRows() {
    const container = document.getElementById("voice-participant-list");
    if (!container) return;
    const presentingRows = Array.from(container.querySelectorAll(".voice-participant-row.is-presenting"));
    presentingRows.reverse().forEach((row) => {
      if (container.firstChild !== row) container.insertBefore(row, container.firstChild);
    });
  }

  // Atualiza (ou insere) só a linha do participante afetado, sem re-renderizar a lista inteira.
  function upsertParticipantRow(member) {
    const container = document.getElementById("voice-participant-list");
    if (!container) return;
    const clientId = String(member.clientId);
    const newRow = buildParticipantRow(member);
    const existing = VoiceState.participantRows.get(clientId);
    const wasPresenting = Boolean(existing?.classList.contains("is-presenting"));
    if (existing && existing.parentNode === container) {
      container.replaceChild(newRow, existing);
    } else {
      container.appendChild(newRow);
    }
    VoiceState.participantRows.set(clientId, newRow);

    const isPresenting = newRow.classList.contains("is-presenting");
    if (isPresenting !== wasPresenting) reorderParticipantRows();

    applyParticipantSearchFilter();
    updateParticipantCount();
  }

  function removeParticipantRowEl(clientId) {
    const existing = VoiceState.participantRows.get(clientId);
    if (existing) existing.remove();
    VoiceState.participantRows.delete(clientId);
    updateParticipantCount();
  }

  // Reconstrói só a linha de um participante já presente (ex.: mudou de mutado/moderação), a partir do presence atual.
  function refreshParticipantRow(clientId) {
    const member = (VoiceState.presenceMembers || []).find((entry) => String(entry.clientId) === String(clientId));
    if (member) upsertParticipantRow(member);
  }

  function updateParticipantCount() {
    const el = document.getElementById("voice-participant-count");
    if (!el) return;
    const total = VoiceState.presenceMembers.length;
    const room = VoiceState.rooms.find((entry) => entry.slug === VoiceState.currentRoomSlug);
    el.textContent = room?.memberLimit ? `${total} de ${room.memberLimit}` : `${total} conectado${total === 1 ? "" : "s"}`;
  }

  function applyParticipantSearchFilter() {
    const input = document.getElementById("voice-participant-search-input");
    const query = normalizeSearchText(input?.value || "");
    VoiceState.participantSearchQuery = query;

    let visibleCount = 0;
    VoiceState.participantRows.forEach((row) => {
      const matches = !query || (row.dataset.searchText || "").includes(query);
      row.classList.toggle("hidden", !matches);
      if (matches) visibleCount += 1;
    });

    const emptyState = document.getElementById("voice-participant-empty");
    if (emptyState) {
      emptyState.classList.toggle("hidden", !(query && VoiceState.participantRows.size > 0 && visibleCount === 0));
    }
  }

  function upsertPresenceMember(member) {
    const clientId = String(member.clientId);
    const list = VoiceState.presenceMembers || [];
    const index = list.findIndex((entry) => String(entry.clientId) === clientId);
    if (index >= 0) list[index] = member;
    else list.push(member);
    VoiceState.presenceMembers = list;
  }

  function removePresenceMember(clientId) {
    VoiceState.presenceMembers = (VoiceState.presenceMembers || []).filter((entry) => String(entry.clientId) !== clientId);
  }

  function currentPresenceData() {
    return {
      displayName: state?.currentUser?.displayName || state?.currentUser?.username || "Policial",
      avatarUrl: state?.currentUser?.avatarUrl || "",
      factionLabel: typeof resolveCurrentPoliceLabel === "function" ? resolveCurrentPoliceLabel() : "",
      micMuted: VoiceState.micMuted,
      deafened: VoiceState.deafened,
      presenting: VoiceState.presenting,
      isModerator: VoiceState.canModerate,
    };
  }

  // ---------------------------------------------------------------------
  // Mesh WebRTC (perfect negotiation — MDN pattern)
  // ---------------------------------------------------------------------
  function publishSignal(type, to, data) {
    if (!VoiceState.signalingChannel) return;
    VoiceState.signalingChannel.publish(type, { from: myClientId(), to: String(to), ...data });
  }

  function createPeerConnection(remoteClientId) {
    if (VoiceState.peers.has(remoteClientId)) return VoiceState.peers.get(remoteClientId);

    const pc = new RTCPeerConnection({ iceServers: VoiceState.iceServers });
    const peer = { pc, makingOffer: false, ignoreOffer: false, audioEl: null, videoStream: null, micStreamId: null };
    VoiceState.peers.set(remoteClientId, peer);

    if (VoiceState.localStream) {
      VoiceState.localStream.getTracks().forEach((track) => pc.addTrack(track, VoiceState.localStream));
    }
    if (VoiceState.screenStream) {
      VoiceState.screenStream.getTracks().forEach((track) => pc.addTrack(track, VoiceState.screenStream));
    }

    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        publishSignal("offer", remoteClientId, { sdp: pc.localDescription });
      } catch (error) {
        console.error("Falha ao negociar conexão de voz:", error);
      } finally {
        peer.makingOffer = false;
      }
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) publishSignal("ice-candidate", remoteClientId, { candidate });
    };

    pc.ontrack = (event) => handleRemoteTrack(remoteClientId, event);

    return peer;
  }

  function handleRemoteTrack(remoteClientId, event) {
    const peer = VoiceState.peers.get(remoteClientId);
    if (!peer) return;
    const [stream] = event.streams;

    if (event.track.kind === "audio") {
      // O microfone é sempre a primeira faixa de áudio negociada por peer (adicionada na criação
      // da conexão, antes de qualquer compartilhamento de tela). Uma faixa de áudio posterior com
      // um stream diferente é o áudio da transmissão de tela, que já toca junto do vídeo do palco
      // (mesmo MediaStream) — não deve duplicar no sink de áudio dos participantes.
      const isScreenAudio = Boolean(peer.micStreamId) && stream && stream.id !== peer.micStreamId;
      if (isScreenAudio) return;
      if (!peer.micStreamId && stream) peer.micStreamId = stream.id;

      if (!peer.audioEl) {
        peer.audioEl = document.createElement("audio");
        peer.audioEl.autoplay = true;
        peer.audioEl.dataset.peer = remoteClientId;
        document.getElementById("voice-audio-sink")?.appendChild(peer.audioEl);
      }
      peer.audioEl.srcObject = stream;
      applyModerationStateToPeer(remoteClientId);
      attachSpeakingDetector(remoteClientId, stream);
    } else if (event.track.kind === "video") {
      peer.videoStream = stream;
      if (VoiceState.watchingClientId === remoteClientId) {
        showPresenterStream(stream, remoteClientId);
      }
    }
  }

  async function handleSignalMessage(message) {
    const { from, to, ...data } = message.data || {};
    if (!from || String(to) !== myClientId() || String(from) === myClientId()) return;

    const peer = createPeerConnection(String(from));
    const pc = peer.pc;
    const polite = isPolite(from);

    try {
      if (message.name === "offer" || message.name === "answer") {
        const description = data.sdp;
        const offerCollision = description.type === "offer" && (peer.makingOffer || pc.signalingState !== "stable");
        peer.ignoreOffer = !polite && offerCollision;
        if (peer.ignoreOffer) return;

        await pc.setRemoteDescription(description);
        if (description.type === "offer") {
          await pc.setLocalDescription();
          publishSignal("answer", from, { sdp: pc.localDescription });
        }
      } else if (message.name === "ice-candidate" && data.candidate) {
        try {
          await pc.addIceCandidate(data.candidate);
        } catch (error) {
          if (!peer.ignoreOffer) console.error("Falha ao aplicar ICE candidate:", error);
        }
      }
    } catch (error) {
      console.error("Falha ao processar sinal de voz:", error);
    }
  }

  function teardownPeer(clientId) {
    const peer = VoiceState.peers.get(clientId);
    if (!peer) return;
    try { peer.pc.close(); } catch { /* já fechado */ }
    if (peer.audioEl) peer.audioEl.remove();
    VoiceState.peers.delete(clientId);
    detachSpeakingDetector(clientId);
    VoiceState.presenterClientIds.delete(clientId);
    if (VoiceState.watchingClientId === clientId) hidePresenterStage();
  }

  // ---------------------------------------------------------------------
  // Detector de "quem está falando" (Web Audio API — sem biblioteca externa)
  // ---------------------------------------------------------------------
  function setRowSpeaking(clientId, speaking) {
    const row = VoiceState.participantRows.get(String(clientId));
    if (row) row.classList.toggle("speaking", speaking);
  }

  function attachSpeakingDetector(clientId, stream) {
    try {
      if (VoiceState.speakingDetectors.has(clientId)) detachSpeakingDetector(clientId);
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx || !stream || !stream.getAudioTracks().length) return;

      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.65;
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const detector = { ctx, analyser, source, rafId: null, speaking: false };

      const tick = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) sum += data[i];
        const nowSpeaking = sum / data.length > SPEAKING_THRESHOLD;
        if (nowSpeaking !== detector.speaking) {
          detector.speaking = nowSpeaking;
          setRowSpeaking(clientId, nowSpeaking);
        }
        detector.rafId = requestAnimationFrame(tick);
      };
      tick();

      VoiceState.speakingDetectors.set(clientId, detector);
    } catch (error) {
      // Web Audio pode ser bloqueado em alguns navegadores/contextos — degrada sem indicador de fala.
      console.error("Falha ao iniciar detector de fala:", error);
    }
  }

  function detachSpeakingDetector(clientId) {
    const detector = VoiceState.speakingDetectors.get(clientId);
    if (!detector) return;
    if (detector.rafId) cancelAnimationFrame(detector.rafId);
    try {
      detector.source.disconnect();
      detector.analyser.disconnect();
      detector.ctx.close();
    } catch { /* já encerrado */ }
    VoiceState.speakingDetectors.delete(clientId);
    setRowSpeaking(clientId, false);
  }

  // ---------------------------------------------------------------------
  // Enforcement de moderação: aplicado por quem ESCUTA, não só por quem foi mutado
  // ---------------------------------------------------------------------
  function applyModerationStateToPeer(clientId) {
    const peer = VoiceState.peers.get(clientId);
    if (!peer || !peer.audioEl) return;
    const shouldMute =
      VoiceState.mutedPeers.has(clientId) ||
      VoiceState.deafenedPeers.has(clientId) ||
      VoiceState.locallyMutedPeers.has(clientId) ||
      VoiceState.deafened;
    peer.audioEl.muted = shouldMute;
  }

  function forceMuteSelf() {
    if (VoiceState.micMuted) return;
    VoiceState.micMuted = true;
    VoiceState.localStream?.getAudioTracks().forEach((track) => { track.enabled = false; });
    updateMicButtonUI();
    VoiceState.signalingChannel?.presence.update(currentPresenceData());
    playVoiceSound("mute");
    Notify.info("Um moderador mutou seu microfone.");
  }

  function forceUnmuteSelf() {
    if (!VoiceState.micMuted) return;
    VoiceState.micMuted = false;
    VoiceState.localStream?.getAudioTracks().forEach((track) => { track.enabled = !VoiceState.deafened; });
    updateMicButtonUI();
    VoiceState.signalingChannel?.presence.update(currentPresenceData());
    playVoiceSound("unmute");
  }

  function forceDeafenSelf() {
    if (VoiceState.deafened) return;
    VoiceState.wasMicMutedBeforeDeafen = VoiceState.micMuted;
    VoiceState.deafened = true;
    VoiceState.micMuted = true;
    VoiceState.localStream?.getAudioTracks().forEach((track) => { track.enabled = false; });
    VoiceState.peers.forEach((_, clientId) => applyModerationStateToPeer(clientId));
    updateMicButtonUI();
    updateDeafenButtonUI();
    VoiceState.signalingChannel?.presence.update(currentPresenceData());
    Notify.info("Um moderador te colocou em modo silencioso.");
  }

  function forceUndeafenSelf() {
    if (!VoiceState.deafened) return;
    VoiceState.deafened = false;
    VoiceState.micMuted = VoiceState.wasMicMutedBeforeDeafen;
    VoiceState.localStream?.getAudioTracks().forEach((track) => { track.enabled = !VoiceState.micMuted; });
    VoiceState.peers.forEach((_, clientId) => applyModerationStateToPeer(clientId));
    updateMicButtonUI();
    updateDeafenButtonUI();
    VoiceState.signalingChannel?.presence.update(currentPresenceData());
  }

  function handleModMessage(message) {
    const type = message.name;
    const data = message.data || {};
    const target = String(data.target || "");
    const isMe = target === myClientId();

    if (type === "mute") { VoiceState.mutedPeers.add(target); applyModerationStateToPeer(target); if (isMe) forceMuteSelf(); refreshParticipantRow(target); }
    else if (type === "unmute") { VoiceState.mutedPeers.delete(target); applyModerationStateToPeer(target); if (isMe) forceUnmuteSelf(); refreshParticipantRow(target); }
    else if (type === "deafen") { VoiceState.deafenedPeers.add(target); applyModerationStateToPeer(target); if (isMe) forceDeafenSelf(); refreshParticipantRow(target); }
    else if (type === "undeafen") { VoiceState.deafenedPeers.delete(target); applyModerationStateToPeer(target); if (isMe) forceUndeafenSelf(); refreshParticipantRow(target); }
    else if (type === "disconnect" && isMe) { playVoiceSound("disconnect"); Notify.error("Você foi desconectado desta sala por um moderador."); leaveRoom(); }
    else if (type === "move" && isMe) { Notify.info("Você foi movido para outra sala."); switchRoom(data.toRoomSlug); }
    else if (type === "room-deleted") {
      if (VoiceState.currentRoomSlug) { Notify.error("Esta sala foi removida."); leaveRoom(); }
      refreshRoomList();
    } else if (type === "room-renamed" || type === "limit-changed") {
      refreshRoomList();
    }
  }

  // ---------------------------------------------------------------------
  // Compartilhamento de tela (1 apresentador por sala, qualidade adaptativa)
  // ---------------------------------------------------------------------
  function computeShareFrameRate() {
    const count = (VoiceState.presenceMembers || []).length;
    if (count > 20) return 5;
    if (count > 10) return 8;
    return 15;
  }

  function computeShareMaxBitrate() {
    const count = (VoiceState.presenceMembers || []).length;
    if (count > 20) return 500000;
    if (count > 10) return 900000;
    return 2000000;
  }

  function applyBitrateCapToScreenTrack() {
    const maxBitrate = computeShareMaxBitrate();
    VoiceState.peers.forEach((peer) => {
      const sender = peer.pc.getSenders().find((s) => s.track && s.track.kind === "video");
      if (!sender) return;
      const params = sender.getParameters();
      if (!params.encodings || !params.encodings.length) params.encodings = [{}];
      params.encodings[0].maxBitrate = maxBitrate;
      sender.setParameters(params).catch(() => {});
    });
  }

  async function toggleScreenShare() {
    if (VoiceState.presenting) { stopScreenShare(); return; }
    if (VoiceState.presenterClientIds.size >= MAX_SIMULTANEOUS_PRESENTERS) {
      Notify.info(`Já tem ${MAX_SIMULTANEOUS_PRESENTERS} pessoas transmitindo tela nesta sala. Aguarde uma delas parar.`);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: computeShareFrameRate() },
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      VoiceState.screenStream = stream;
      VoiceState.presenting = true;
      VoiceState.presenterClientIds.add(myClientId());

      stream.getVideoTracks()[0].addEventListener("ended", stopScreenShare);
      VoiceState.peers.forEach((peer) => {
        stream.getTracks().forEach((track) => peer.pc.addTrack(track, stream));
      });
      applyBitrateCapToScreenTrack();

      VoiceState.signalingChannel?.presence.update(currentPresenceData());
      updateShareButtonUI();
      refreshParticipantRow(myClientId());
      showPresenterStream(stream, myClientId());
      playVoiceSound("streamStart");
    } catch (error) {
      if (error?.name !== "NotAllowedError") {
        Notify.error("Não foi possível iniciar o compartilhamento de tela.");
      }
    }
  }

  function stopScreenShare() {
    if (!VoiceState.screenStream) return;
    const tracks = VoiceState.screenStream.getTracks();
    tracks.forEach((track) => track.stop());
    VoiceState.peers.forEach((peer) => {
      peer.pc.getSenders()
        .filter((sender) => sender.track && tracks.includes(sender.track))
        .forEach((sender) => peer.pc.removeTrack(sender));
    });

    VoiceState.screenStream = null;
    VoiceState.presenting = false;
    VoiceState.presenterClientIds.delete(myClientId());

    VoiceState.signalingChannel?.presence.update(currentPresenceData());
    updateShareButtonUI();
    hidePresenterStage();
    refreshParticipantRow(myClientId());
    playVoiceSound("streamStop");
  }

  function showPresenterStream(stream, clientId) {
    VoiceState.watchingClientId = clientId;
    const stage = document.getElementById("voice-presenter-stage");
    const video = document.getElementById("voice-presenter-video");
    const label = document.getElementById("voice-presenter-label");
    const volumeControl = document.getElementById("voice-presenter-volume");
    if (!stage || !video) return;

    video.srcObject = stream;
    const isSelf = String(clientId) === myClientId();
    const member = (VoiceState.presenceMembers || []).find((entry) => String(entry.clientId) === String(clientId));
    if (label) {
      label.textContent = isSelf
        ? "Você está compartilhando a tela"
        : `${member?.data?.displayName || "Alguém"} está compartilhando a tela`;
    }
    stage.classList.remove("hidden");

    if (isSelf) {
      VoiceState.selfPreviewExpanded = false;
      video.muted = true;
      volumeControl?.classList.add("hidden");
      document.getElementById("voice-presenter-stop-watching")?.classList.add("hidden");
      applyPresenterViewMode();
    } else {
      stage.classList.remove("self-thumbnail");
      document.getElementById("voice-presenter-minimize")?.classList.add("hidden");
      document.getElementById("voice-presenter-fullscreen")?.classList.remove("hidden");
      document.getElementById("voice-presenter-expand-hint")?.classList.add("hidden");
      document.getElementById("voice-presenter-stop-watching")?.classList.remove("hidden");
      // Autoplay com som só é permitido pelo navegador após um gesto do usuário — por isso o
      // vídeo sempre começa mutado e o espectador ativa o áudio pelo próprio controle de volume.
      video.muted = VoiceState.presenterAudioMuted;
      video.volume = VoiceState.presenterVolume;
      volumeControl?.classList.remove("hidden");
      updatePresenterVolumeUI();
    }
    renderWatchers();
  }

  // Passa a assistir a transmissão de tela de outra pessoa (ação explícita: botão "Assistir" ou
  // duplo clique no perfil dela) — o vídeo só é exibido depois desse gesto do usuário.
  function startWatchingPresenter(clientId) {
    const targetId = String(clientId || "");
    if (!targetId || targetId === myClientId()) return;
    if (!VoiceState.presenterClientIds.has(targetId)) return;
    const previousId = VoiceState.watchingClientId;
    VoiceState.watchingClientId = targetId;
    const peer = VoiceState.peers.get(targetId);
    if (peer?.videoStream) {
      showPresenterStream(peer.videoStream, targetId);
    } else {
      Notify.info("Conectando à transmissão...");
    }
    refreshParticipantRow(targetId);
    // Se eu já estava assistindo outra pessoa (com até 2 transmitindo ao mesmo tempo), a linha dela
    // precisa voltar a mostrar o botão "Assistir".
    if (previousId && previousId !== targetId) refreshParticipantRow(previousId);
  }

  // Para de assistir à transmissão, mas mantém o usuário conectado na sala/call normalmente.
  function stopWatchingPresenter() {
    if (!VoiceState.watchingClientId || VoiceState.watchingClientId === myClientId()) return;
    const previousId = VoiceState.watchingClientId;
    VoiceState.watchingClientId = null;
    hidePresenterStageUI();
    refreshParticipantRow(previousId);
  }

  function updatePresenterVolumeUI() {
    const icon = document.querySelector("#voice-presenter-volume-toggle i");
    const slider = document.getElementById("voice-presenter-volume-slider");
    const effectiveVolume = VoiceState.presenterAudioMuted ? 0 : VoiceState.presenterVolume;
    if (slider) slider.value = String(Math.round(effectiveVolume * 100));
    if (!icon) return;
    icon.className = effectiveVolume <= 0
      ? "fa-solid fa-volume-xmark"
      : effectiveVolume < 0.5
        ? "fa-solid fa-volume-low"
        : "fa-solid fa-volume-high";
  }

  function togglePresenterAudioMute() {
    VoiceState.presenterAudioMuted = !VoiceState.presenterAudioMuted;
    if (!VoiceState.presenterAudioMuted && VoiceState.presenterVolume <= 0) VoiceState.presenterVolume = 1;
    const video = document.getElementById("voice-presenter-video");
    if (video && VoiceState.watchingClientId && VoiceState.watchingClientId !== myClientId()) {
      video.muted = VoiceState.presenterAudioMuted;
      video.volume = VoiceState.presenterVolume;
    }
    updatePresenterVolumeUI();
  }

  function handlePresenterVolumeInput(event) {
    const value = Number(event.target.value);
    VoiceState.presenterVolume = Math.min(1, Math.max(0, value / 100));
    VoiceState.presenterAudioMuted = value <= 0;
    const video = document.getElementById("voice-presenter-video");
    if (video && VoiceState.watchingClientId && VoiceState.watchingClientId !== myClientId()) {
      video.volume = VoiceState.presenterVolume;
      video.muted = VoiceState.presenterAudioMuted;
    }
    updatePresenterVolumeUI();
  }

  function applyPresenterViewMode() {
    const stage = document.getElementById("voice-presenter-stage");
    const minimizeBtn = document.getElementById("voice-presenter-minimize");
    const fullscreenBtn = document.getElementById("voice-presenter-fullscreen");
    const hint = document.getElementById("voice-presenter-expand-hint");
    if (!stage) return;
    const isSelfPresenting = VoiceState.presenting && VoiceState.watchingClientId === myClientId();
    if (!isSelfPresenting) return;

    const expanded = Boolean(VoiceState.selfPreviewExpanded);
    stage.classList.toggle("self-thumbnail", !expanded);
    minimizeBtn?.classList.toggle("hidden", !expanded);
    fullscreenBtn?.classList.toggle("hidden", expanded);
    hint?.classList.toggle("hidden", expanded);
  }

  function expandPresenterView() {
    if (!(VoiceState.presenting && VoiceState.watchingClientId === myClientId())) return;
    VoiceState.selfPreviewExpanded = true;
    applyPresenterViewMode();
  }

  function minimizePresenterView() {
    if (!(VoiceState.presenting && VoiceState.watchingClientId === myClientId())) return;
    VoiceState.selfPreviewExpanded = false;
    applyPresenterViewMode();
  }

  // Só esconde o palco visualmente (usado tanto quando a transmissão acaba de vez quanto quando
  // o espectador escolhe "parar de assistir" — nesse segundo caso o apresentador continua ativo).
  function hidePresenterStageUI() {
    const stage = document.getElementById("voice-presenter-stage");
    const video = document.getElementById("voice-presenter-video");
    if (document.fullscreenElement === stage) document.exitFullscreen?.().catch(() => {});
    if (video) video.srcObject = null;
    if (stage) {
      stage.classList.add("hidden");
      stage.classList.remove("self-thumbnail");
    }
    document.getElementById("voice-presenter-minimize")?.classList.add("hidden");
    document.getElementById("voice-presenter-fullscreen")?.classList.remove("hidden");
    document.getElementById("voice-presenter-expand-hint")?.classList.add("hidden");
    document.getElementById("voice-presenter-volume")?.classList.add("hidden");
    document.getElementById("voice-presenter-stop-watching")?.classList.add("hidden");
  }

  // A transmissão que eu estava vendo (minha prévia ou a de outra pessoa) acabou de fato.
  function hidePresenterStage() {
    VoiceState.watchingClientId = null;
    VoiceState.selfPreviewExpanded = false;
    hidePresenterStageUI();
  }

  function renderWatchers() {
    if (!VoiceState.watchingClientId) return;
    const countEl = document.getElementById("voice-presenter-watchers-count");
    const listEl = document.getElementById("voice-presenter-watchers-list");
    if (!countEl || !listEl) return;

    const watchers = (VoiceState.presenceMembers || []).filter(
      (member) => String(member.clientId) !== String(VoiceState.watchingClientId),
    );
    countEl.textContent = String(watchers.length);
    listEl.innerHTML = watchers.length
      ? watchers.map((member) => `<span>${escapeHtml(member.data?.displayName || "Policial")}</span>`).join("")
      : '<span>Ninguém assistindo ainda</span>';
  }

  function toggleFullscreenPresenter() {
    const stage = document.getElementById("voice-presenter-stage");
    if (!stage) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    } else {
      stage.requestFullscreen?.().catch(() => Notify.error("Não foi possível abrir em tela cheia."));
    }
  }

  // ---------------------------------------------------------------------
  // Controles pessoais (mic / surdo)
  // ---------------------------------------------------------------------
  function updateMicButtonUI() {
    const btn = document.getElementById("voice-toggle-mic");
    if (!btn) return;
    btn.classList.toggle("active-off", VoiceState.micMuted);
    btn.setAttribute("aria-pressed", String(VoiceState.micMuted));
    btn.innerHTML = `<i class="fa-solid ${VoiceState.micMuted ? "fa-microphone-slash" : "fa-microphone"}"></i>`;
  }

  function updateDeafenButtonUI() {
    const btn = document.getElementById("voice-toggle-deafen");
    if (!btn) return;
    btn.classList.toggle("active-off", VoiceState.deafened);
    btn.setAttribute("aria-pressed", String(VoiceState.deafened));
    btn.innerHTML = `<i class="fa-solid ${VoiceState.deafened ? "fa-volume-xmark" : "fa-headphones"}"></i>`;
  }

  function updateShareButtonUI() {
    const btn = document.getElementById("voice-toggle-share");
    if (!btn) return;
    btn.classList.toggle("presenting", VoiceState.presenting);
    btn.setAttribute("aria-pressed", String(VoiceState.presenting));
  }

  function toggleMic() {
    if (!VoiceState.localStream || VoiceState.deafened) return;
    VoiceState.micMuted = !VoiceState.micMuted;
    VoiceState.localStream.getAudioTracks().forEach((track) => { track.enabled = !VoiceState.micMuted; });
    updateMicButtonUI();
    VoiceState.signalingChannel?.presence.update(currentPresenceData());
    playVoiceSound(VoiceState.micMuted ? "mute" : "unmute");
  }

  function toggleDeafen() {
    if (VoiceState.deafened) forceUndeafenSelf();
    else forceDeafenSelfLocalToggle();
  }

  function forceDeafenSelfLocalToggle() {
    // igual a forceDeafenSelf, mas sem a notificação de "moderador te silenciou"
    if (VoiceState.deafened) return;
    VoiceState.wasMicMutedBeforeDeafen = VoiceState.micMuted;
    VoiceState.deafened = true;
    VoiceState.micMuted = true;
    VoiceState.localStream?.getAudioTracks().forEach((track) => { track.enabled = false; });
    VoiceState.peers.forEach((_, clientId) => applyModerationStateToPeer(clientId));
    updateMicButtonUI();
    updateDeafenButtonUI();
    VoiceState.signalingChannel?.presence.update(currentPresenceData());
  }

  // ---------------------------------------------------------------------
  // Presença (entrar/sair/atualizar) e ciclo de vida da sala
  // ---------------------------------------------------------------------
  function attachPresenceHandlers() {
    VoiceState.signalingChannel.presence.subscribe("enter", (member) => {
      if (String(member.clientId) === myClientId()) return;
      upsertPresenceMember(member);
      createPeerConnection(String(member.clientId));
      upsertParticipantRow(member);
      renderRoomGrid();
      renderWatchers();
      playVoiceSound("join");
    });

    VoiceState.signalingChannel.presence.subscribe("leave", (member) => {
      const clientId = String(member.clientId);
      removePresenceMember(clientId);
      teardownPeer(clientId);
      removeParticipantRowEl(clientId);
      renderRoomGrid();
      renderWatchers();
      playVoiceSound("leave");
    });

    VoiceState.signalingChannel.presence.subscribe("update", (member) => {
      upsertPresenceMember(member);
      const clientId = String(member.clientId);
      if (member.data?.presenting) {
        VoiceState.presenterClientIds.add(clientId);
        const peer = VoiceState.peers.get(clientId);
        // O vídeo só aparece se o usuário já escolheu assistir essa transmissão (botão "Assistir"
        // ou duplo clique no perfil) — novas transmissões nunca abrem sozinhas.
        if (peer?.videoStream && VoiceState.watchingClientId === clientId) showPresenterStream(peer.videoStream, clientId);
      } else {
        VoiceState.presenterClientIds.delete(clientId);
        if (VoiceState.watchingClientId === clientId) hidePresenterStage();
      }
      upsertParticipantRow(member);
      renderRoomGrid();
      renderWatchers();
    });
  }

  function connectAblyForRoom(slug) {
    return new Promise((resolve, reject) => {
      if (typeof Ably === "undefined") {
        reject(new Error("Biblioteca do Ably não carregou. Verifique sua conexão com a internet."));
        return;
      }
      const realtime = new Ably.Realtime({
        authCallback: async (_tokenParams, callback) => {
          try {
            const response = await fetch("/api/voice?action=token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: myClientId(), roomSlug: slug }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || "Falha ao autenticar na sala.");
            VoiceState.iceServers = payload.iceServers || VoiceState.iceServers;
            callback(null, payload.tokenRequest);
          } catch (error) {
            callback(error.message || String(error), null);
          }
        },
      });
      realtime.connection.once("connected", () => resolve(realtime));
      realtime.connection.once("failed", (stateChange) => {
        reject(new Error(stateChange?.reason?.message || "Falha ao conectar no serviço de chamadas."));
      });
    });
  }

  function setCallStatus(text, cls) {
    const el = document.getElementById("voice-call-status");
    if (!el) return;
    el.textContent = text;
    el.className = `voice-call-status${cls ? ` ${cls}` : ""}`;
  }

  // Alterna entre o painel "nenhuma sala selecionada" e o painel da chamada ativa.
  function setMainColumnMode(mode) {
    document.getElementById("voice-empty-panel")?.classList.toggle("hidden", mode !== "empty");
    document.getElementById("voice-call-panel")?.classList.toggle("hidden", mode !== "call");
  }

  async function joinRoom(slug) {
    if (VoiceState.currentRoomSlug === slug) return;
    if (VoiceState.currentRoomSlug) await leaveRoomInternal(false);

    setMainColumnMode("call");
    setCallStatus("Conectando...", "connecting");
    const roomMeta = VoiceState.rooms.find((room) => room.slug === slug);
    const roomNameEl = document.getElementById("voice-call-room-name");
    if (roomNameEl) roomNameEl.textContent = roomMeta?.name || slug;

    try {
      VoiceState.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      attachSpeakingDetector(myClientId(), VoiceState.localStream);
    } catch (error) {
      Notify.error("Não foi possível acessar o microfone. Você entrará só ouvindo.");
      VoiceState.localStream = null;
    }

    try {
      VoiceState.ably = await connectAblyForRoom(slug);
    } catch (error) {
      console.error("Falha ao conectar no serviço de chamadas:", error);
      Notify.error("Não foi possível conectar à sala. Tente novamente em instantes.");
      setCallStatus("Falha na conexão", "error");
      VoiceState.localStream?.getTracks().forEach((track) => track.stop());
      VoiceState.localStream = null;
      detachSpeakingDetector(myClientId());
      setMainColumnMode("empty");
      return;
    }

    VoiceState.currentRoomSlug = slug;
    VoiceState.signalingChannel = VoiceState.ably.channels.get(`voice:${slug}:signaling`);
    VoiceState.modChannel = VoiceState.ably.channels.get(`voice:${slug}:mod`);

    VoiceState.signalingChannel.subscribe(handleSignalMessage);
    VoiceState.modChannel.subscribe(handleModMessage);
    attachPresenceHandlers();

    await VoiceState.signalingChannel.presence.enter(currentPresenceData());
    const members = await VoiceState.signalingChannel.presence.get();
    VoiceState.presenceMembers = members || [];
    VoiceState.presenceMembers
      .filter((member) => Boolean(member.data?.presenting))
      .forEach((member) => VoiceState.presenterClientIds.add(String(member.clientId)));
    VoiceState.presenceMembers
      .filter((member) => String(member.clientId) !== myClientId())
      .forEach((member) => createPeerConnection(String(member.clientId)));

    setCallStatus("Conectado", "connected");
    updateMicButtonUI();
    updateDeafenButtonUI();
    updateShareButtonUI();
    renderParticipantList();
    renderRoomGrid();
    updateHeaderBreadcrumb(roomMeta?.name || slug);
    playVoiceSound("join");
  }

  async function leaveRoomInternal(hidePanel) {
    if (VoiceState.currentRoomSlug) playVoiceSound("leave");
    if (VoiceState.signalingChannel) {
      try { await VoiceState.signalingChannel.presence.leave(); } catch { /* já desconectado */ }
      VoiceState.signalingChannel.unsubscribe();
      VoiceState.signalingChannel.presence.unsubscribe();
    }
    if (VoiceState.modChannel) VoiceState.modChannel.unsubscribe();

    stopScreenShare();
    hidePresenterStage(); // garante que a prévia de quem eu estava assistindo também é limpa
    VoiceState.peers.forEach((_, clientId) => teardownPeer(clientId));
    VoiceState.peers.clear();
    detachSpeakingDetector(myClientId());

    if (VoiceState.localStream) {
      VoiceState.localStream.getTracks().forEach((track) => track.stop());
      VoiceState.localStream = null;
    }
    if (VoiceState.ably) {
      try { VoiceState.ably.close(); } catch { /* ignora */ }
      VoiceState.ably = null;
    }

    VoiceState.signalingChannel = null;
    VoiceState.modChannel = null;
    VoiceState.currentRoomSlug = null;
    VoiceState.presenceMembers = [];
    VoiceState.mutedPeers.clear();
    VoiceState.deafenedPeers.clear();
    VoiceState.locallyMutedPeers.clear();
    VoiceState.micMuted = false;
    VoiceState.deafened = false;
    VoiceState.presenting = false;
    VoiceState.presenterClientIds.clear();

    if (hidePanel) {
      setMainColumnMode("empty");
      updateHeaderBreadcrumb(null);
    }
  }

  async function leaveRoom() {
    await leaveRoomInternal(true);
    await refreshRoomList();
  }

  async function switchRoom(newSlug) {
    if (!newSlug) return;
    await joinRoom(newSlug);
    await refreshRoomList();
  }

  // ---------------------------------------------------------------------
  // Integração com a aba/seção da intranet
  // ---------------------------------------------------------------------
  function wireVoiceControls() {
    document.getElementById("voice-create-room-button")?.addEventListener("click", createRoomPrompt);
    document.getElementById("voice-toggle-mic")?.addEventListener("click", toggleMic);
    document.getElementById("voice-toggle-deafen")?.addEventListener("click", toggleDeafen);
    document.getElementById("voice-toggle-share")?.addEventListener("click", toggleScreenShare);
    document.getElementById("voice-leave-call")?.addEventListener("click", leaveRoom);
    document.getElementById("voice-presenter-fullscreen")?.addEventListener("click", toggleFullscreenPresenter);
    document.getElementById("voice-presenter-minimize")?.addEventListener("click", (event) => {
      event.stopPropagation();
      minimizePresenterView();
    });
    document.getElementById("voice-presenter-stage")?.addEventListener("click", () => {
      const stage = document.getElementById("voice-presenter-stage");
      if (stage?.classList.contains("self-thumbnail")) expandPresenterView();
    });
    document.getElementById("voice-presenter-volume-toggle")?.addEventListener("click", (event) => {
      event.stopPropagation();
      togglePresenterAudioMute();
    });
    document.getElementById("voice-presenter-volume-slider")?.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    document.getElementById("voice-presenter-volume-slider")?.addEventListener("input", handlePresenterVolumeInput);
    document.getElementById("voice-presenter-stop-watching")?.addEventListener("click", (event) => {
      event.stopPropagation();
      stopWatchingPresenter();
    });
    document.getElementById("voice-participant-search-input")?.addEventListener("input", applyParticipantSearchFilter);
  }

  function updateHeaderBreadcrumb(roomName) {
    const title = document.getElementById("header-title");
    if (!title) return;
    title.innerHTML = roomName
      ? `CHAMADAS DE CURSO <span class="voice-breadcrumb-sep">›</span> ${escapeHtml(roomName.toUpperCase())}`
      : "Chamadas de Curso • Central Policial Intranet";
  }

  let voiceSectionInitialized = false;
  async function initVoiceSection() {
    if (!voiceSectionInitialized) {
      voiceSectionInitialized = true;
      await loadVoiceConfig();
      wireVoiceControls();
    } else {
      computePermissions();
    }
    await refreshRoomList();
    clearInterval(VoiceState.roomsPollTimer);
    VoiceState.roomsPollTimer = setInterval(refreshRoomList, 15000);
  }

  function initVoiceTabIntegration() {
    if (typeof switchSection !== "function") return;
    const originalSwitchSection = switchSection;
    // eslint-disable-next-line no-func-assign
    switchSection = async function patchedSwitchSectionForVoice(sectionName, linkElement) {
      const leavingCalls = state?.currentSection === "calls" && sectionName !== "calls";
      await originalSwitchSection(sectionName, linkElement);
      if (sectionName === "calls") {
        await initVoiceSection();
        // Se a call já estava ativa (usuário só tinha ido pra outra aba), restaura o nome da sala
        // no cabeçalho — a chamada em si nunca foi encerrada, então não precisa reconectar nada.
        if (VoiceState.currentRoomSlug) {
          const roomMeta = VoiceState.rooms.find((room) => room.slug === VoiceState.currentRoomSlug);
          updateHeaderBreadcrumb(roomMeta?.name || VoiceState.currentRoomSlug);
        }
      } else if (leavingCalls) {
        // Não encerra a call ao trocar de aba — igual ao Discord, o áudio/tela continuam ativos
        // em segundo plano. Só para de atualizar a lista de salas, que não está sendo exibida.
        clearInterval(VoiceState.roomsPollTimer);
      }
    };
  }

  window.addEventListener("beforeunload", () => {
    try {
      VoiceState.localStream?.getTracks().forEach((track) => track.stop());
      VoiceState.screenStream?.getTracks().forEach((track) => track.stop());
    } catch { /* ignora — página está fechando */ }
  });

  document.addEventListener("DOMContentLoaded", () => {
    initVoiceTabIntegration();
  });
})();
