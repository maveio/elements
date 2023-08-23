import 'media-chrome';
import 'media-chrome/dist/experimental/media-captions-selectmenu.js';

import { IntersectionController } from '@lit-labs/observers/intersection_controller.js';
import { Metrics } from '@maveio/metrics';
import Hls from 'hls.js';
import { css, html, LitElement, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ref } from 'lit/directives/ref.js';
import { html as staticHtml, unsafeStatic } from 'lit/static-html.js';
import { styleMap } from 'lit-html/directives/style-map.js';

import { Embed } from '../embed/api';
import { EmbedController } from '../embed/controller';
import { ThemeLoader } from '../themes/loader';

export class Player extends LitElement {
  @property() embed: string;
  @property({ attribute: 'aspect-ratio' }) aspect_ratio?: string;
  @property() width?: string;
  @property() subtitles?: [string];
  @property() height?: string;
  @property() autoplay?: 'always' | 'lazy';
  @property() controls?: 'full' | 'big' | 'none';
  @property() color?: string;
  @property() opacity?: string;
  @property() loop?: boolean;
  @property() theme = 'default';

  private _poster?: string;
  @property()
  get poster(): string {
    if (this._poster && this._poster == 'custom') {
      return `${this.embedController.embedUrl}/thumbnail.jpg`;
    }

    if (this._poster && !Number.isNaN(parseFloat(this._poster))) {
      return `https://image.mave.io/${this.embedController.spaceId}${this.embedController.embedId}.jpg?time=${this._poster}`;
    }

    if (this._poster) {
      return this._poster;
    }

    return `${this.embedController.embedUrl}/poster.webp`;
  }
  set poster(value: string | null) {
    if (value) {
      const oldValue = this._poster;
      this._poster = value;
      this.requestUpdate('poster', oldValue);
    }
  }

  @state() popped = false;

  private _subtitlesText: HTMLElement;

  static styles = css`
    :host {
      display: block;
    }

    video::cue {
      font-family: Inter, Roboto, 'Helvetica Neue', 'Arial Nova', 'Nimbus Sans', Arial,
        sans-serif;
      font-weight: 500;
    }

    video:focus-visible {
      outline: 0;
    }

    :host,
    media-controller,
    theme-default,
    video {
      width: 100%;
      max-height: 100vh;
    }
  `;

  private _intersectionObserver = new IntersectionController(this, {
    callback: this.intersected.bind(this),
  });

  private embedController = new EmbedController(this);
  private _videoElement?: HTMLMediaElement;

  @state()
  private _embed: Embed;

  private _metrics: Metrics;
  private _intersected = false;

  private _queue: { (): void }[] = [];

  private hls: Hls = new Hls({
    startLevel: 3,
    capLevelToPlayerSize: true,
  });

  pop() {
    this.popped = true;
  }

  close() {
    this.popped = false;
  }

  play() {
    if (this._videoElement) {
      this._videoElement.play();
    } else {
      this._queue.push(() => this._videoElement?.play());
    }
  }

  pause() {
    if (this._videoElement) {
      this._videoElement.pause();
    } else {
      this._queue.push(() => this._videoElement?.pause());
    }
  }

  connectedCallback() {
    super.connectedCallback();
    this.embedController.embed = this.embed;
    ThemeLoader.get(this.theme, `${this.embedController.cdnRoot}/themes/player`);
  }

  requestUpdate(name?: PropertyKey, oldValue?: unknown) {
    super.requestUpdate(name, oldValue);
    if (name === 'embed') {
      this.embedController.embed = this.embed;
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._metrics) {
      this._metrics.demonitor();
    }
  }

  handleVideo(videoElement?: Element) {
    if (videoElement && this._embed.video.src) {
      this._videoElement = videoElement as HTMLMediaElement;
      this._intersectionObserver.observe(this._videoElement);

      Metrics.config = {
        socketPath: '__MAVE_METRICS_SOCKET_ENDPOINT__',
        apiKey: this._embed.metrics_key,
      };

      const metadata = {
        component: 'player',
        video_id: this._embed.video.id,
        space_id: this._embed.space_id,
      };

      const containsHls = this._embed.video.renditions.some(
        (rendition) => rendition.container == 'hls',
      );

      if ((containsHls || this._embed.video.src.endsWith('.m3u8')) && Hls.isSupported()) {
        if (containsHls) {
          this.hls.loadSource(this.fullSourcePath);
        } else {
          this.hls.loadSource(this._embed.video.src);
        }

        this.hls.attachMedia(this._videoElement);
        this._metrics = new Metrics(this.hls, this.embed, metadata).monitor();
      } else {
        if (containsHls) {
          this._videoElement.src = this.fullSourcePath;
        } else {
          this._videoElement.src = this._embed.video.src;
        }

        this._metrics = new Metrics(this._videoElement, this.embed, metadata).monitor();
      }

      if (this._queue.length) {
        this._queue.forEach((fn) => fn());
        this._queue = [];
      }

      this.handleAutoplay();
    }
  }

  intersected(entries: IntersectionObserverEntry[]) {
    for (const { isIntersecting } of entries) {
      this._intersected = isIntersecting;
      this.handleAutoplay();
    }
  }

  handleAutoplay() {
    if (this._embed && this.autoplay == 'always') {
      if (this._intersected) {
        if (this._videoElement?.paused) {
          this._videoElement.muted = true;
          this._videoElement?.play();
        }
      }
    }

    if (
      this._embed &&
      (this.autoplay == 'lazy' || this._embed.settings.autoplay == 'on_show')
    ) {
      if (this._intersected) {
        if (this._videoElement?.paused) {
          this._videoElement.muted = true;
          this._videoElement?.play();
        }
      } else {
        if (!this._videoElement?.paused) this._videoElement?.pause();
      }
    }
  }

  requestPlay() {
    if (this._videoElement?.paused) {
      this._videoElement?.play();
    } else {
      this._videoElement?.pause();
    }
  }

  updateEmbed(embed: Embed) {
    this._embed = embed;
    this.poster = this._embed.settings.poster;
    this.color = this._embed.settings.color;
    this.opacity = this._embed.settings.opacity
      ? (this._embed.settings.opacity as unknown as string)
      : undefined;
    this.aspect_ratio = this._embed.settings.aspect_ratio;
    this.width = this._embed.settings.width;
    this.height = this._embed.settings.height;
    this.autoplay =
      this._embed.settings.autoplay == 'on_show' ? 'lazy' : this._embed.settings.autoplay;
    this.controls = this._embed.settings.controls;
    this.loop = this._embed.settings.loop;
  }

  cuechange(e: Event) {
    const track = (e.target as HTMLTrackElement & { track: TextTrack }).track;
    const cues = track.activeCues as TextTrackCueList;

    if (track.mode != 'hidden') track.mode = 'hidden';

    if (!this._subtitlesText) {
      const subtitleText = this.shadowRoot
        ?.querySelector(`theme-${this.theme}`)
        ?.shadowRoot?.querySelector('#subtitles_text');
      if (subtitleText) {
        this._subtitlesText = subtitleText as HTMLElement;
      }
    }

    if (cues.length) {
      const cue = cues[0] as VTTCue;
      this._subtitlesText.style.opacity = '1';
      this._subtitlesText.innerHTML = cue.text;
    } else {
      this._subtitlesText.style.opacity = '0';
    }
  }

  get styles() {
    return styleMap({
      '--primary-color': `${this.color || this._embed?.settings.color}${
        this.opacity || this._embed?.settings.opacity ? this._embed?.settings.opacity : ''
      }`,
      '--aspect-ratio':
        this.aspect_ratio == 'auto' ||
        (this._embed?.settings.aspect_ratio == 'auto' && !this.aspect_ratio)
          ? this._embed?.video.aspect_ratio
          : this.aspect_ratio || this._embed?.settings.aspect_ratio,
      '--width': this.width || this._embed?.settings.width,
      '--height': this.height || this._embed?.settings.height,
      '--media-control-bar-display':
        this.controls == 'full' ||
        (this._embed?.settings.controls == 'full' &&
          this.controls != 'big' &&
          this.controls != 'none')
          ? 'flex'
          : 'none',
      '--big-button-display':
        this.controls == 'big' ||
        (this._embed?.settings.controls == 'big' &&
          this.controls != 'full' &&
          this.controls != 'none')
          ? 'flex'
          : 'none',
    });
  }

  get fullSourcePath() {
    return `${this.embedController.embedUrl}/playlist.m3u8?quality=${this.highestHlsRendition.size}`;
  }

  get highestHlsRendition() {
    const renditions = this._embed.video.renditions.filter(
      (rendition) => rendition.container == 'hls',
    );

    const sizes = ['sd', 'hd', 'fhd', 'qhd', 'uhd'];

    const highestRendition = renditions.reduce((highest, rendition) => {
      const size = sizes.indexOf(rendition.size);
      if (size > sizes.indexOf(highest.size)) {
        return rendition;
      } else {
        return highest;
      }
    });

    return highestRendition;
  }

  get _subtitles() {
    if (this._embed.subtitles.length > 0) {
      return this._embed.subtitles.map((track) => {
        if (this.subtitles && this.subtitles.includes(track.language)) {
          return html`
            <track mode="hidden" @cuechange=${this.cuechange} label=${track.label} kind="subtitles" srclang=${track.language} src=${track.path}></track>
          `;
        }
      });
    }
  }

  get _storyboard() {
    return html`<track
      label="thumbnails"
      default
      kind="metadata"
      src=${`${this.embedController.embedUrl}/storyboard.vtt`}></track>`;
  }

  render() {
    return html`
      <slot name="video">
        ${this.embedController.render({
          pending: this.renderPending,
          error: (error: unknown) =>
            html`<p>${error instanceof Error ? error.message : nothing}</p>`,
          complete: (data) => {
            if (!this._embed) this._embed = data as Embed;
            if (!data) return this.renderPending();

            return staticHtml`<theme-${unsafeStatic(this.theme)} style=${this.styles}>
                <video
                  @click=${this.requestPlay}
                  playsinline
                  ?loop=${this.loop || this._embed.settings.loop}
                  poster=${this.poster}
                  ${ref(this.handleVideo)}
                  slot="media"
                  crossorigin="anonymous"
                >
                  ${this._storyboard}
                  ${this._subtitles}
                </video>
            </theme-${unsafeStatic(this.theme)}>`;
          },
        })}
      </slot>
    `;
  }

  renderPending() {
    return html`
      <theme-default style=${this.styles}>
        <video slot="media" poster=${this.poster}></video>
      </theme-default>
    `;
  }
}

if (window && window.customElements) {
  if (!window.customElements.get('mave-player')) {
    window.customElements.define('mave-player', Player);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mave-player': Player;
  }
}
