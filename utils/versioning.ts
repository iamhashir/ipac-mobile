export type VersionEntry = {
  tag: string;
  versionCode: string;
  releaseDate: string; // ISO 8601 date
  highlights: string[];
};

export const versionHistory: VersionEntry[] = [
  {
    tag: 'Beta',
    versionCode: '0.10.0-beta',
    releaseDate: '2026-03-09',
    highlights: [
      'Pending material requests: packers can now submit new materials on-the-fly from any section — available to use immediately while pending admin catalogue review.',
      'Pending items display inline in all material sections with a clock indicator until approved.',
      'Active tab is now larger and bolder for easier navigation on tablets.',
    ],
  },
];

export const currentVersion = versionHistory[0];
