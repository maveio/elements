import { css, html, LitElement, nothing } from 'lit';
import { property } from 'lit/decorators.js';

import { Collection } from '../embed/api';
import { EmbedController, EmbedType } from '../embed/controller';
import { checkPop } from './pop.js';

export class List extends LitElement {
  @property() token: string;

  static styles = css`
    :host {
      display: block;
    }
  `;

  private embedController = new EmbedController(this, EmbedType.Collection);
  private _collection: Collection;

  connectedCallback() {
    super.connectedCallback();
    this.embedController.token = this.token;
  }

  requestUpdate(name?: PropertyKey, oldValue?: unknown) {
    super.requestUpdate(name, oldValue);
    if (name === 'embed') {
      this.embedController.token = this.token;
    }
  }

  get _slottedChildren() {
    const slot = this.shadowRoot?.querySelector('slot');
    return slot?.assignedElements({ flatten: true }) || [];
  }

  get _stylesheets() {
    if (document) {
      const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
      return html`${Array.from(styles).map((style) => style.cloneNode(true))}`;
    } else {
      return null;
    }
  }

  updated() {
    if (this.shadowRoot) {
      checkPop(this.shadowRoot);
    }
  }

  render() {
    return html`
      ${this.embedController.render({
        // TODO: add loading state with loading player UI
        pending: this.renderPending,
        error: (error: unknown) =>
          // TODO: add error state with error player UI
          html`<p>${error instanceof Error ? error.message : nothing}</p>`,
        complete: (data) => {
          this._collection = data as Collection;
          if (!data) return this.renderPending();

          const templates = this._slottedChildren
            .map((item) => {
              if (item.getAttribute('name') == 'list-title') {
                item.textContent = this._collection.name;
                return html`${item}`;
              }

              if (item.nodeName === 'TEMPLATE' || item.getAttribute('name') == 'mave-list-item') {
                const result = this._collection.embeds.map((embed) => {

                  let template;
                  if (item.nodeName === 'TEMPLATE') {
                    template = (item as HTMLTemplateElement).content.cloneNode(
                      true,
                    ) as DocumentFragment;
                  } else {
                    template = item.cloneNode(true) as DocumentFragment;
                    item.remove();
                  }

                  const title = template.querySelector('[slot="item-title"]');
                  if (title) {
                    title.textContent = embed.name;
                    title.removeAttribute('slot');
                  }

                  // when clip is provided in the template
                  const clip = template.querySelector('mave-clip');
                  if (clip) {
                    clip.setAttribute('embed', embed.id);
                    clip.removeAttribute('slot');
                  }

                  // when img is provided in the template
                  const img = template.querySelector('mave-img');
                  if (img) {
                    img.setAttribute('embed', embed.id);
                    img.removeAttribute('slot');
                  }
                  return html`${template}`;
                });

                return html`${result}`;
              }
            })
            .filter((t) => t);

          return html`${this._stylesheets} ${templates} `;
        },
      })}
    `;
  }

  renderPending() {
    return html`<slot></slot>`;
  }
}

if (window && window.customElements) {
  if (!window.customElements.get('mave-list')) {
    window.customElements.define('mave-list', List);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mave-list': List;
  }
}
