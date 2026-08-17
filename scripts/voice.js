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
    localStream: null,
    screenStream: null,
    micMuted: false,
    deafened: false,
    wasMicMutedBeforeDeafen: false,
    presenting: false,
    presenterClientId: null,
    mutedPeers: new Set(),
    deafenedPeers: new Set(),
    locallyMutedPeers: new Set(),
    iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
    roomsPollTimer: null,
    activeContextMenu: null,
  };

  function myClientId() {
    return String(state?.currentUser?.id || "");
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[ch]));
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

  function renderRoomGrid() {
    const grid = document.getElementById("voice-room-grid");
    if (!grid) return;
    grid.innerHTML = "";

    if (!VoiceState.rooms.length) {
      grid.innerHTML = '<div class="empty-state">Nenhuma sala disponível no momento.</div>';
      return;
    }

    VoiceState.rooms.forEach((room) => {
      const isCurrent = room.slug === VoiceState.currentRoomSlug;
      const full = Boolean(room.memberLimit) && room.occupants >= room.memberLimit;

      const card = document.createElement("div");
      card.className = `voice-room-card${isCurrent ? " current" : ""}`;
      card.dataset.slug = room.slug;
      card.innerHTML = `
        <div class="voice-room-card-top"><h3>${escapeHtml(room.name)}</h3></div>
        <span class="voice-room-occupants${full ? " full" : ""}"><i class="fa-solid fa-users"></i> ${room.occupants}${room.memberLimit ? ` / ${room.memberLimit}` : ""}</span>
        <div class="voice-room-card-actions">
          <button type="button" class="action-button voice-join-button"${full && !isCurrent ? " disabled" : ""}>
            <i class="fa-solid ${isCurrent ? "fa-phone-slash" : "fa-phone"}"></i>
            <span>${isCurrent ? "Sair" : "Entrar"}</span>
          </button>
          ${VoiceState.isAdmin ? `
            <div class="voice-room-admin-actions">
              <button type="button" class="voice-icon-button" data-room-rename title="Renomear sala"><i class="fa-solid fa-pen"></i></button>
              <button type="button" class="voice-icon-button" data-room-limit title="Definir limite de membros"><i class="fa-solid fa-users-gear"></i></button>
              <button type="button" class="voice-icon-button danger" data-room-delete title="Apagar sala"><i class="fa-solid fa-trash"></i></button>
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
      grid.appendChild(card);
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
    const name = window.prompt("Nome da nova sala:");
    if (!name || !name.trim()) return;
    const limitRaw = window.prompt("Limite de membros (deixe em branco para sem limite):", "20");
    roomAdminAction("create-room", { name: name.trim(), memberLimit: limitRaw ? Number(limitRaw) : null });
  }

  function renameRoomPrompt(room) {
    const name = window.prompt("Novo nome da sala:", room.name);
    if (!name || !name.trim()) return;
    roomAdminAction("rename-room", { slug: room.slug, name: name.trim() });
  }

  function setRoomLimitPrompt(room) {
    const limitRaw = window.prompt("Novo limite de membros (deixe em branco para sem limite):", room.memberLimit || "");
    if (limitRaw === null) return;
    roomAdminAction("set-limit", { slug: room.slug, memberLimit: limitRaw ? Number(limitRaw) : null });
  }

  function deleteRoomPrompt(room) {
    if (!window.confirm(`Apagar a sala "${room.name}"? Essa ação não pode ser desfeita.`)) return;
    roomAdminAction("delete-room", { slug: room.slug });
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
    renderParticipantList();
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

  function openParticipantContextMenu(event, targetClientId) {
    closeContextMenu();

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
      items.push({ label: "Desconectar da call", icon: "fa-phone-slash", danger: true, action: () => moderate("disconnect", targetClientId) });

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
  // Lista de participantes da call atual
  // ---------------------------------------------------------------------
  function renderParticipantList() {
    const container = document.getElementById("voice-participant-list");
    if (!container) return;
    container.innerHTML = "";

    (VoiceState.presenceMembers || []).forEach((member) => {
      const clientId = String(member.clientId);
      const data = member.data || {};
      const isSelf = clientId === myClientId();
      const isMuted = VoiceState.mutedPeers.has(clientId) || Boolean(data.micMuted);
      const isDeafened = VoiceState.deafenedPeers.has(clientId) || Boolean(data.deafened);
      const draggable = VoiceState.canModerate && !isSelf;

      const chip = document.createElement("div");
      chip.className = `voice-participant-chip${draggable ? " draggable" : ""}`;
      chip.draggable = draggable;
      chip.dataset.clientId = clientId;
      chip.innerHTML = `
        <img class="voice-participant-avatar" src="${data.avatarUrl || "images/Logo_policia.png"}" alt="" onerror="this.src='images/Logo_policia.png'" />
        <div class="voice-participant-info">
          <span class="voice-participant-name">${escapeHtml(data.displayName || "Policial")}${isSelf ? " (você)" : ""}</span>
          <span class="voice-participant-badges">
            ${isMuted ? '<i class="fa-solid fa-microphone-slash badge-muted" title="Mutado"></i>' : ""}
            ${isDeafened ? '<i class="fa-solid fa-volume-xmark badge-deafened" title="Silenciado"></i>' : ""}
            ${data.presenting ? '<i class="fa-solid fa-desktop badge-presenting" title="Compartilhando tela"></i>' : ""}
          </span>
        </div>
      `;

      if (!isSelf) {
        chip.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          openParticipantContextMenu(event, clientId);
        });
      }
      if (draggable) {
        chip.addEventListener("dragstart", (event) => {
          event.dataTransfer.setData("text/voice-participant", clientId);
          chip.classList.add("dragging");
        });
        chip.addEventListener("dragend", () => chip.classList.remove("dragging"));
      }

      container.appendChild(chip);
    });
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
      micMuted: VoiceState.micMuted,
      deafened: VoiceState.deafened,
      presenting: VoiceState.presenting,
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
    const peer = { pc, makingOffer: false, ignoreOffer: false, audioEl: null, videoStream: null };
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
      if (!peer.audioEl) {
        peer.audioEl = document.createElement("audio");
        peer.audioEl.autoplay = true;
        peer.audioEl.dataset.peer = remoteClientId;
        document.getElementById("voice-audio-sink")?.appendChild(peer.audioEl);
      }
      peer.audioEl.srcObject = stream;
      applyModerationStateToPeer(remoteClientId);
    } else if (event.track.kind === "video") {
      peer.videoStream = stream;
      if (VoiceState.presenterClientId === remoteClientId) {
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
    if (VoiceState.presenterClientId === clientId) hidePresenterStage();
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
    Notify.info("Um moderador mutou seu microfone.");
  }

  function forceUnmuteSelf() {
    if (!VoiceState.micMuted) return;
    VoiceState.micMuted = false;
    VoiceState.localStream?.getAudioTracks().forEach((track) => { track.enabled = !VoiceState.deafened; });
    updateMicButtonUI();
    VoiceState.signalingChannel?.presence.update(currentPresenceData());
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

    if (type === "mute") { VoiceState.mutedPeers.add(target); applyModerationStateToPeer(target); if (isMe) forceMuteSelf(); }
    else if (type === "unmute") { VoiceState.mutedPeers.delete(target); applyModerationStateToPeer(target); if (isMe) forceUnmuteSelf(); }
    else if (type === "deafen") { VoiceState.deafenedPeers.add(target); applyModerationStateToPeer(target); if (isMe) forceDeafenSelf(); }
    else if (type === "undeafen") { VoiceState.deafenedPeers.delete(target); applyModerationStateToPeer(target); if (isMe) forceUndeafenSelf(); }
    else if (type === "disconnect" && isMe) { Notify.error("Você foi desconectado desta sala por um moderador."); leaveRoom(); }
    else if (type === "move" && isMe) { Notify.info("Você foi movido para outra sala."); switchRoom(data.toRoomSlug); }
    else if (type === "room-deleted") {
      if (VoiceState.currentRoomSlug) { Notify.error("Esta sala foi removida."); leaveRoom(); }
      refreshRoomList();
    } else if (type === "room-renamed" || type === "limit-changed") {
      refreshRoomList();
    }

    renderParticipantList();
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
    if (VoiceState.presenterClientId && VoiceState.presenterClientId !== myClientId()) {
      Notify.info("Já existe alguém apresentando a tela nesta sala.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: computeShareFrameRate() },
        audio: false,
      });
      VoiceState.screenStream = stream;
      VoiceState.presenting = true;
      VoiceState.presenterClientId = myClientId();

      stream.getVideoTracks()[0].addEventListener("ended", stopScreenShare);
      VoiceState.peers.forEach((peer) => {
        stream.getTracks().forEach((track) => peer.pc.addTrack(track, stream));
      });
      applyBitrateCapToScreenTrack();

      VoiceState.signalingChannel?.presence.update(currentPresenceData());
      updateShareButtonUI();
      renderParticipantList();
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
    if (VoiceState.presenterClientId === myClientId()) VoiceState.presenterClientId = null;

    VoiceState.signalingChannel?.presence.update(currentPresenceData());
    updateShareButtonUI();
    hidePresenterStage();
    renderParticipantList();
  }

  function showPresenterStream(stream, clientId) {
    VoiceState.presenterClientId = clientId;
    const stage = document.getElementById("voice-presenter-stage");
    const video = document.getElementById("voice-presenter-video");
    const label = document.getElementById("voice-presenter-label");
    if (!stage || !video) return;

    video.srcObject = stream;
    const member = (VoiceState.presenceMembers || []).find((entry) => String(entry.clientId) === String(clientId));
    if (label) label.textContent = `${member?.data?.displayName || "Alguém"} está compartilhando a tela`;
    stage.classList.remove("hidden");
  }

  function hidePresenterStage() {
    VoiceState.presenterClientId = null;
    const stage = document.getElementById("voice-presenter-stage");
    const video = document.getElementById("voice-presenter-video");
    if (video) video.srcObject = null;
    if (stage) stage.classList.add("hidden");
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
      renderParticipantList();
      renderRoomGrid();
    });

    VoiceState.signalingChannel.presence.subscribe("leave", (member) => {
      const clientId = String(member.clientId);
      removePresenceMember(clientId);
      teardownPeer(clientId);
      renderParticipantList();
      renderRoomGrid();
    });

    VoiceState.signalingChannel.presence.subscribe("update", (member) => {
      upsertPresenceMember(member);
      const clientId = String(member.clientId);
      if (member.data?.presenting) {
        VoiceState.presenterClientId = clientId;
        const peer = VoiceState.peers.get(clientId);
        if (peer?.videoStream) showPresenterStream(peer.videoStream, clientId);
      } else if (VoiceState.presenterClientId === clientId) {
        hidePresenterStage();
      }
      renderParticipantList();
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

  async function joinRoom(slug) {
    if (VoiceState.currentRoomSlug === slug) return;
    if (VoiceState.currentRoomSlug) await leaveRoomInternal(false);

    const panel = document.getElementById("voice-call-panel");
    panel?.classList.remove("hidden");
    setCallStatus("Conectando...", "");
    const roomMeta = VoiceState.rooms.find((room) => room.slug === slug);
    const roomNameEl = document.getElementById("voice-call-room-name");
    if (roomNameEl) roomNameEl.textContent = roomMeta?.name || slug;

    try {
      VoiceState.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      Notify.error("Não foi possível acessar o microfone. Você entrará só ouvindo.");
      VoiceState.localStream = null;
    }

    try {
      VoiceState.ably = await connectAblyForRoom(slug);
    } catch (error) {
      Notify.error(error.message || "Falha ao conectar na sala.");
      setCallStatus("Falha na conexão", "error");
      VoiceState.localStream?.getTracks().forEach((track) => track.stop());
      VoiceState.localStream = null;
      panel?.classList.add("hidden");
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
      .filter((member) => String(member.clientId) !== myClientId())
      .forEach((member) => createPeerConnection(String(member.clientId)));

    setCallStatus("Conectado", "connected");
    updateMicButtonUI();
    updateDeafenButtonUI();
    updateShareButtonUI();
    renderParticipantList();
    renderRoomGrid();
  }

  async function leaveRoomInternal(hidePanel) {
    if (VoiceState.signalingChannel) {
      try { await VoiceState.signalingChannel.presence.leave(); } catch { /* já desconectado */ }
      VoiceState.signalingChannel.unsubscribe();
      VoiceState.signalingChannel.presence.unsubscribe();
    }
    if (VoiceState.modChannel) VoiceState.modChannel.unsubscribe();

    stopScreenShare();
    VoiceState.peers.forEach((_, clientId) => teardownPeer(clientId));
    VoiceState.peers.clear();

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
    VoiceState.presenterClientId = null;

    if (hidePanel) document.getElementById("voice-call-panel")?.classList.add("hidden");
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
      } else if (leavingCalls) {
        clearInterval(VoiceState.roomsPollTimer);
        await leaveRoomInternal(true);
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
