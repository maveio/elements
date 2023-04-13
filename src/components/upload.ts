import '@lottiefiles/lottie-player';

import { css, html, LitElement } from 'lit';
import { property, state } from 'lit/decorators.js';
import { Channel } from 'phoenix';
import * as tus from 'tus-js-client';

import Data from '../embed/socket';

interface ErrorMessage {
  message: string;
}

const fileTypes = [
  'video/3gpp',
  'video/mpeg',
  'video/mp4',
  'video/ogg',
  'video/quicktime',
  'video/webm',
];

export class Upload extends LitElement {
  @property() token: string;
  @state() _progress: number;
  @state() _upload_id: string;
  @state() _completed = false;
  private channel: Channel;

  static styles = css`
    :host {
      all: initial;
      display: block;
      width: 100%;
      aspect-ratio: 16 / 9;
      overflow: hidden;
      position: relative;
      background: white;
      font-family: system-ui;
      box-shadow: inset 0 0 0 1px #eee;
    }

    .state {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: white;
      width: 100%;
      height: 100%;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.channel = Data.connect(this.token);
    this.channel.on('initiate', ({ upload_id }) => {
      this._upload_id = upload_id;
    });
    this.channel.on('completed', this.completed.bind(this));
    this.channel.on('error', this.error.bind(this));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.channel.leave();
  }

  handleDrop(event: DragEvent) {
    event.preventDefault();

    if (event.dataTransfer && event.dataTransfer.items) {
      for (const item of event.dataTransfer.items) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file && fileTypes.includes(file.type)) {
            this._progress = 1;
            this.upload(file);
          }
        }
      }
    } else {
      if (event.dataTransfer && event.dataTransfer.files) {
        for (const file of event.dataTransfer.files) {
          if (fileTypes.includes(file.type)) {
            this._progress = 1;
            this.upload(file);
          }
        }
      }
    }
  }

  handleForm(event: InputEvent) {
    // TODO:
    // split progress into multiple files
    this._progress = 1;
    const target = event.target as HTMLInputElement;
    if (target.files) {
      for (const file of target.files) {
        if (fileTypes.includes(file.type)) {
          this.upload(file);
        }
      }
    }
  }

  upload(file: File) {
    const upload = new tus.Upload(file, {
      endpoint: '__MAVE_UPLOAD_ENDPOINT__',
      retryDelays: [0, 3000, 5000, 10000, 20000, 60000, 60000],
      metadata: {
        title: file.name,
        filetype: file.type,
        token: this.token,
        upload_id: this._upload_id,
      },
      onError: (e) => {
        console.log(e);
      },
      onProgress: (uploaded, total) => {
        const progress = Math.round((uploaded / total) * 100);
        if (progress > this._progress) this._progress = progress;
      },
      onSuccess: () => {
        this._progress = 100;
      },
      removeFingerprintOnSuccess: true,
    });

    upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }

      upload.start();
    });
  }

  completed(data: { embed: string }) {
    this._completed = true;
    this.dispatchEvent(
      new CustomEvent('completed', { bubbles: true, composed: true, detail: data }),
    );
  }

  // registry call
  error(error: ErrorMessage) {
    console.warn(`[mave-upload] ${error.message}`);
    this.dispatchEvent(new CustomEvent('error', { bubbles: true, detail: error }));
  }

  render() {
    return html`${this._progress ? this.renderProgress() : this.renderUpload()}`;
  }

  renderUpload() {
    return html` <form
      class="state"
      style="${!this._upload_id ? 'pointer-events: none; opacity: 0.5;' : ''}"
      @dragover=${(e: DragEvent) => e.preventDefault()}
      @drop=${this.handleDrop}
      onDragOver="this.style.boxShadow='inset 0 0 0 2px blue'"
      onDragLeave="this.style.boxShadow='inset 0 0 0 2px transparent'"
    >
      <div style="font-size: 32px; padding-bottom: 14px; font-weight: 300; opacity: 0.9;">
        drop video here
      </div>
      <div style="padding-bottom: 40px; opacity: 0.5;">or browse your files</div>
      <div
        style="position: relative; background: #1997FF; width: 150px; height: 40px; overflow: hidden; border-radius: 16px; color: white;"
        onMouseOver="this.style.opacity='0.9'"
        onMouseOut="this.style.opacity='1'"
      >
        <input
          .disabled=${!this._upload_id}
          type="file"
          @change=${this.handleForm}
          style="position: absolute; top: 0; left: -150px; display: block; width: 500px; height: 100%; opacity: 0; cursor: pointer;"
        />
        <div
          style="width: 100%; height: 100%; display: flex; justify-content: center; align-items: center;"
        >
          <div style="padding-bottom: 2px;">select file</div>
        </div>
      </div>
    </form>`;
  }

  renderProgress() {
    return html`
      ${this._progress == 100
        ? this.renderProcessing()
        : html`
            <div class="state">
              <lottie-player
                src="https://assets1.lottiefiles.com/packages/lf20_z7DhMX.json"
                background="transparent"
                speed="1"
                style="width: 200px; height: 200px; padding-bottom: 20px;"
                loop
                autoplay
              ></lottie-player>
              <div
                style="width: 40%; height: 3px; border-radius: 3px; background: #ccc; overflow: hidden;"
              >
                <div
                  style="width: ${this
                    ._progress}%; height: 3px; background: #1997FF; transition-property: width; transition-duration: 200ms; transition-timing-function: cubic-bezier(0, 0, 0.2, 1);"
                ></div>
              </div>
              <div style="margin-top: 16px; opacity: 0.6; padding-bottom: 24px;">
                uploading...
              </div>
            </div>
          `}
    `;
  }

  renderProcessing() {
    return html`<div class="state">
      ${this._completed
        ? html` <lottie-player
            src="https://assets1.lottiefiles.com/packages/lf20_tnlxlkom.json"
            background="transparent"
            style="width: 200px; height: 200px; padding-bottom: 20px;"
            autoplay
          ></lottie-player>`
        : html` <lottie-player
            src="https://assets10.lottiefiles.com/private_files/lf30_4kmk2efh.json"
            background="transparent"
            speed="2"
            style="width: 200px; height: 200px; padding-bottom: 20px;"
            loop
            autoplay
          ></lottie-player>`}
      <div style="width: 100%; height: 3px;"></div>
      <div style="margin-top: 16px; opacity: 0.6; padding-bottom: 24px;">
        ${this._completed ? html`done` : html`just a minute...`}
      </div>
    </div>`;
  }
}

if (window && window.customElements) {
  if (!window.customElements.get('mave-upload')) {
    window.customElements.define('mave-upload', Upload);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mave-upload': Upload;
  }
}
