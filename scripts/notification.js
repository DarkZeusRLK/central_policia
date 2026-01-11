class NotificationSystem {
  constructor() {
    this.container = document.createElement("div");
    this.container.className = "notification-container";
    document.body.appendChild(this.container);
  }

  show(message, type = "info", iconClass = "fa-circle-info") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    toast.innerHTML = `
            <i class="fa-solid ${iconClass}"></i>
            <span>${message}</span>
        `;

    this.container.appendChild(toast);

    // Remove após 4 segundos
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  success(msg) {
    this.show(msg, "success", "fa-check-circle");
  }
  error(msg) {
    this.show(msg, "error", "fa-triangle-exclamation");
  }
  loading(msg) {
    this.show(msg, "info", "fa-spinner fa-spin");
  }
}

const Notify = new NotificationSystem();
