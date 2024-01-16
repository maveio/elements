export type Embed = {
  id: string;
  name: string;
  space_id: string;
  poster: {
    image_src: string;
    initial_frame_src: string;
    preview_src: string;
    video_src: string;
  };
  settings: {
    aspect_ratio: string;
    opacity: number | null;
    autoplay: 'always' | 'on_show';
    height: string;
    loop: boolean;
    width: string;
    color: string;
    controls: 'big' | 'full' | 'none';
    poster: string | null;
  };
  video: {
    id: string;
    version: number;
    audio: boolean;
    aspect_ratio: string;
    filetype: string;
    original: string;
    sources: {
      mp4: {
        '480p': string;
        '720p': string;
      };
    };
    renditions: [
      {
        size: 'sd' | 'hd' | 'fhd' | 'qhd' | 'uhd';
        codec: 'h264' | 'hevc' | 'av1';
        container: 'webp' | 'webm' | 'jpg' | 'mp4' | 'avif' | 'hls';
        type?: 'video' | 'clip_keyframes';
      },
    ];
    src: string;
  };
  subtitles: Subtitle[];
  metrics_key: string;
};

export type Subtitle = {
  language: string;
  path: string;
  label: string;
};

export type Collection = {
  id: string;
  name: string;
  embeds: Embed[];
};

export type Word = {
  start: number;
  end: number;
  word: string;
}

export type Segment = {
  text: string;
  start: number;
  end: number;
  words: Word[];
}

export type Caption = {
  text: string;
  segments: Segment[];
}

export const baseUrl = '__MAVE_ENDPOINT__';
