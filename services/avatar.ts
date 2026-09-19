export const generateAvatar = (name: string): string => {
  const getInitials = (name: string) => {
    if (!name) return '';
    const parts = name.split(' ');
    if (parts.length > 1 && parts[1]) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const hash = (name || '').split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
  const color = `hsl(${hash % 360}, 75%, 50%)`;
  const initials = getInitials(name);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="${color}" /><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="48" font-family="Poppins, sans-serif" fill="#ffffff">${initials}</text></svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
};
