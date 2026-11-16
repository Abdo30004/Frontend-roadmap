// Where the questions live on GitHub. Change `branch` / `contentDir` here if the repo layout differs.
export const REPO = {
  url: 'https://github.com/ahmedgourmat/Frontend-roadmap',
  branch: 'main',
  contentDir: 'content',
};

export const questionSourceUrl = (level: string, slug: string) =>
  `${REPO.url}/blob/${REPO.branch}/${REPO.contentDir}/${level}/${slug}.md`;
