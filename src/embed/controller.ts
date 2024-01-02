import { StatusRenderer, Task } from '@lit-labs/task';
import { ReactiveControllerHost } from 'lit';

import * as API from './api';

export enum EmbedType {
  Collection,
  Embed,
}

export class EmbedController {
  host: ReactiveControllerHost;
  private task: Task;
  private type: EmbedType;
  private _embed: string;
  private _token: string;
  private _version: number;

  constructor(host: ReactiveControllerHost, embedType: EmbedType = EmbedType.Embed) {
    this.host = host;
    this.type = embedType;

    this.task = new Task(
      this.host,
      async () => {
        try {
          if (this.type == EmbedType.Embed && !this.embed) {
            return;
          }
          if (this.type == EmbedType.Collection && !this.token) {
            console.warn('No token attr provided for mave-list');
            return;
          }

          const url =
            this.type == EmbedType.Embed
              ? this.embedFile('manifest.json')
              : `${API.baseUrl}/collection/${this.token}`;

          const response = await fetch(url);
          const data = await response.json();
          if (this.type == EmbedType.Embed) {
            const embed = data as Partial<API.Embed>;
            this.version = embed.video?.version || 0;
            return embed;
          } else {
            return data as Partial<API.Collection>;
          }
        } catch (e) {
          console.log(e);
          throw new Error(`Failed to fetch "${this.embed}"`);
        }
      },
      () => [this.embed],
    );
  }

  set embed(value: string) {
    if (this._embed != value) {
      this._embed = value;
      this.host.requestUpdate();
    }
  }

  get embed() {
    return this._embed;
  }

  set token(value: string) {
    if (this._token != value) {
      this._token = value;
      this.host.requestUpdate();
    }
  }

  get token() {
    return this._token;
  }

  get spaceId(): string {
    return this.embed.substring(0, 5);
  }

  get embedId(): string {
    return this.embed.substring(5, this.embed.length);
  }

  get version(): string {
    if (this._version) {
      return `/v${this._version}/`;
    }
    return '/'
  }

  set version(value: number) {
    if (this._version != value) {
      this._version = value;
      this.host.requestUpdate();
    }
  }

  get cdnRoot(): string {
    return `https://space-${this.spaceId}.video-dns.com`;
  }

  embedFile(file: string, params = new URLSearchParams()): string {
    const url = new URL(`${this.cdnRoot}/${this.embedId}${file == 'manifest' ? '/' : this.version}${file}`);
    if (this.token) params.append('token', this.token);
    url.search = params.toString();
    return url.toString();
  }

  render(renderFunctions: StatusRenderer<unknown>) {
    return this.task?.render(renderFunctions);
  }
}
