/** Shared browser-neutral metadata contract used by app identity and page generation. */
export interface SocialImage {
  path: string;
  type: string;
  width: number;
  height: number;
  alt: string;
}

export interface PageMetadataOverrides {
  title?: string;
  description?: string;
  keywords?: readonly string[];
  socialImage?: Partial<SocialImage>;
}
