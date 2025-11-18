export type VersionEntry = {
  tag: string;
  versionCode: string;
  releaseDate: string; // ISO 8601 date
  highlights: string[];
};

export const versionHistory: VersionEntry[] = [
  {
    tag: 'Beta',
    versionCode: '0.9.0-beta',
    releaseDate: '2025-11-18',
    highlights: [
      'New release workflow automatically completes open tasks and attendance when a project is released.',
      'On-hold projects now appear in the dashboard list with a dedicated highlight color so teams can reclaim them quickly.',
      'Settings screen consolidates accessibility controls, including the new version badge shown below.',
    ],
  },
];

export const currentVersion = versionHistory[0];
