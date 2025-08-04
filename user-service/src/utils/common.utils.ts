export const getFullName = (firstName?: string, lastName?: string): string => {
  return `${firstName || ''} ${lastName || ''}`.trim();
};

export const sanitizedWorkspace = (data: string | undefined | null): string => {
  if (typeof data !== 'string') return '';
  return data.replace(/-/g, '_');
};
