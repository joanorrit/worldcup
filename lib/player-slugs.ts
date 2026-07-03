export function getPlayerSlug(playerName: string): string {
  return playerName
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getPlayerPath(playerName: string, basePath: string): string {
  const normalizedBasePath = basePath === '/' ? '' : basePath.replace(/\/$/, '');

  return `${normalizedBasePath}/${encodeURIComponent(getPlayerSlug(playerName))}`;
}
