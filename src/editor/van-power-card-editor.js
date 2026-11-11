import { DEFAULT_CONFIG } from "../card/config.js";
import { EDITOR_FIELD_GROUPS } from "./fields.js";

export class VanPowerCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = { ...DEFAULT_CONFIG };
    this._hass = null;
  }
  setConfig(config) {
    this._config = { ...DEFAULT_CONFIG, ...config || {} };
    this.render();
  }
  set hass(hass) {
    this._hass = hass;
    this.applyHassToEntityForms();
  }
  applyHassToEntityForms() {
    this.shadowRoot?.querySelectorAll("ha-form[data-key]").forEach((form) => {
      form.hass = this._hass;
    });
  }
  emitConfigChanged() {
    const nextConfig = { type: this._config.type || "custom:van-power-card" };
    Object.keys(DEFAULT_CONFIG).forEach((key) => {
      const value = this._config[key];
      const defaultValue = DEFAULT_CONFIG[key];
      if (value === "" || value == null) return;
      if (typeof defaultValue === "number" && typeof value === "number" && Number.isFinite(value) && value === defaultValue) return;
      if (typeof defaultValue === "boolean" && Boolean(value) === defaultValue) return;
      if (value === defaultValue) return;
      nextConfig[key] = value;
    });
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: nextConfig },
      bubbles: true,
      composed: true
    }));
  }
  updateField(key, rawValue, type) {
    if (type === "boolean") {
      this._config[key] = Boolean(rawValue);
      this.emitConfigChanged();
      return;
    }
    if (type === "number") {
      const parsed = Number(rawValue);
      this._config[key] = Number.isFinite(parsed) ? parsed : null;
      this.emitConfigChanged();
      return;
    }
    this._config[key] = String(rawValue || "").trim();
    this.emitConfigChanged();
  }
  getEntitySelector(field) {
    const includeDomains = Array.isArray(field.includeDomains) ? field.includeDomains.filter((domain) => typeof domain === "string" && domain) : [];
    if (includeDomains.length >= 1) {
      return { entity: { domain: includeDomains.length === 1 ? includeDomains[0] : includeDomains } };
    }
    return { entity: {} };
  }
  renderField(field) {
    const value = this._config[field.key];
    if (field.type === "entity") {
      return `
        <div class="field">
          <label>${field.label}</label>
          <ha-form data-key="${field.key}"></ha-form>
        </div>
      `;
    }
    if (field.type === "boolean") {
      return `
        <label class="field checkbox">
          <input type="checkbox" data-key="${field.key}" ${value ? "checked" : ""} />
          <span>${field.label}</span>
        </label>
      `;
    }
    if (field.type === "text") {
      return `
      <div class="field">
        <label>${field.label}</label>
        <input type="text" data-key="${field.key}" value="${value ?? ""}" />
      </div>
    `;
    }
    if (field.type === "select") {
      const options = Array.isArray(field.options) ? field.options : [];
      const optionsMarkup = options.map((option) => {
        const optionValue = String(option?.value ?? "");
        const optionLabel = String(option?.label ?? optionValue);
        const selected = String(value ?? "") === optionValue ? "selected" : "";
        return `<option value="${optionValue}" ${selected}>${optionLabel}</option>`;
      }).join("");
      return `
      <div class="field">
        <label>${field.label}</label>
        <select data-key="${field.key}">${optionsMarkup}</select>
      </div>
    `;
    }
    return `
      <div class="field">
        <label>${field.label}</label>
        <input type="number" data-key="${field.key}" step="${field.step || "any"}" min="${field.min || ""}" max="${field.max || ""}" value="${value ?? ""}" />
      </div>
    `;
  }
  render() {
    const groupsMarkup = EDITOR_FIELD_GROUPS.map((group) => `
      <section class="group">
        <h3>${group.title}</h3>
        <div class="grid">
          ${group.fields.map((field) => this.renderField(field)).join("")}
        </div>
      </section>
    `).join("");
    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block}
        .wrap{
          display:flex;
          flex-direction:column;
          gap:14px;
          padding:12px 0 4px;
          color:var(--primary-text-color);
        }
        .group{
          border:1px solid var(--divider-color);
          border-radius:14px;
          padding:12px;
          background:var(--card-background-color);
        }
        .group h3{
          margin:0 0 10px;
          font-size:15px;
          font-weight:700;
        }
        .grid{
          display:grid;
          grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));
          gap:10px 12px;
        }
        .field{
          display:flex;
          flex-direction:column;
          gap:6px;
        }
        .field label{
          font-size:12px;
          color:var(--secondary-text-color);
        }
        .field.checkbox{
          display:flex;
          flex-direction:row;
          align-items:center;
          gap:8px;
          min-height:40px;
        }
        .field.checkbox span{
          font-size:13px;
          color:var(--primary-text-color);
        }
        input[type="number"]{
          width:100%;
          border:1px solid var(--divider-color);
          border-radius:10px;
          padding:8px 10px;
          font:inherit;
          color:var(--primary-text-color);
          background:var(--secondary-background-color, transparent);
        }
        input[type="text"]{
          width:100%;
          border:1px solid var(--divider-color);
          border-radius:10px;
          padding:8px 10px;
          font:inherit;
          color:var(--primary-text-color);
          background:var(--secondary-background-color, transparent);
        }
        select{
          width:100%;
          border:1px solid var(--divider-color);
          border-radius:10px;
          padding:8px 10px;
          font:inherit;
          color:var(--primary-text-color);
          background:var(--secondary-background-color, transparent);
        }
        ha-form{display:block}
      </style>
      <div class="wrap">${groupsMarkup}</div>
    `;
    EDITOR_FIELD_GROUPS.forEach((group) => {
      group.fields.forEach((field) => {
        if (field.type === "entity") {
          const form = this.shadowRoot.querySelector(`ha-form[data-key="${field.key}"]`);
          if (!form) return;
          form.hass = this._hass;
          form.data = { [field.key]: this._config[field.key] || "" };
          form.schema = [
            {
              name: field.key,
              label: "",
              selector: this.getEntitySelector(field)
            }
          ];
          form.computeLabel = () => "";
          form.addEventListener("value-changed", (event) => {
            this.updateField(field.key, event.detail?.value?.[field.key] || "", field.type);
          });
          return;
        }
        const input = this.shadowRoot.querySelector(`[data-key="${field.key}"]`);
        if (!input) return;
        if (field.type === "boolean") {
          input.addEventListener("change", (event) => {
            this.updateField(field.key, event.target.checked, field.type);
          });
        } else if (field.type === "select") {
          input.addEventListener("change", (event) => {
            this.updateField(field.key, event.target.value, "text");
          });
        } else if (field.type === "text") {
          input.addEventListener("change", (event) => {
            this.updateField(field.key, event.target.value, field.type);
          });
        } else {
          input.addEventListener("change", (event) => {
            this.updateField(field.key, event.target.value, field.type);
          });
        }
      });
    });
  }
}
