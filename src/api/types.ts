export type NodeSummary = {
  id: number;
  parent: number;
  title: string;
  image: string | null;
  order: number;
  is_leaf: boolean;
  link: string;
  modified: string | null;
  children_count?: number;
};

export type TreeNode = NodeSummary & { children: TreeNode[] };

export type Crumb = { id: number; title: string };

export type NodeDetail = NodeSummary & { path: Crumb[]; children: NodeSummary[] };

export type FileSummary = {
  id: number;
  title: string;
  badge: string;
  badge_color: string | null;
  thumb: string | null;
  modified: string | null;
  date: string | null;
  nodes?: { id: number; title: string; root: number }[];
};

/** `version` changes whenever the file is replaced on the site (even under the same name). */
export type Pdf = { url: string; name: string; size: number | null; version?: string };

export type Crumb2 = { type: 'node'; id: number; title: string } | { type: 'link'; url: string; title: string };

export type ShareNetwork = 'facebook' | 'twitter' | 'whatsapp' | 'telegram' | 'linkedin' | 'copy';

/** One post page, as the website shows it. */
export type FileDetail = FileSummary & {
  pdfs: Pdf[];
  html: string;
  link: string;
  source?: 'site' | 'fallback';
  breadcrumb?: Crumb2[];
  download?: { title: string; button: string };
  follow?: { network: string; url: string }[];
  related?: FileSummary[];
  labels?: { follow: string; related: string; share: string; comments: string };
  share?: ShareNetwork[];
  comments?: { open: boolean; count: number };
};

export type Comment = { id: number; parent: number; author: string; date: string | null; content: string; by_site: boolean };

export type CommentsResponse = { open: boolean; require_name_email: boolean; moderated: boolean; count: number; comments: Comment[] };

export type NodeFiles = { node: { id: number; title: string; path: Crumb[] }; files: FileSummary[] };

export type Banner = { image: string; title: string; type: 'none' | 'node' | 'file' | 'url'; target: string };

export type HomeSection = 'continue' | 'banners' | 'curricula' | 'latest' | 'favorites';

export type AppConfig = {
  content_version: number;
  server_time: string;
  look: { app_name: string; logo: string | null; color_primary: string; color_accent: string; theme_default: 'system' | 'light' | 'dark' };
  home: { sections: HomeSection[]; banners: Banner[]; curricula: NodeSummary[]; default_root: number; latest_count: number };
  ads: {
    enabled: boolean;
    units: { banner_home: string; banner_list: string; banner_search: string; banner_reader: string; interstitial: string };
    interstitial_every: number;
    interstitial_seconds: number;
    child_directed: boolean;
    max_rating: 'G' | 'PG' | 'T' | 'MA';
  };
  update: { latest_code: number; min_code: number; message: string; store_url: string };
  maintenance: { enabled: boolean; message: string };
  links: { privacy: string; contact: string; telegram: string; whatsapp: string; facebook: string };
  push: { topics: string[] };
};

export type Notice = {
  id: number;
  title: string;
  body: string;
  target: { type: 'file' | 'node' | 'url' | 'none'; id?: number; url?: string } | null;
  date: string;
};
