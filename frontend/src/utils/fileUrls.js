const resolveBackendOrigin = () => {
  const configuredBase = String(import.meta.env.VITE_API_URL || '/api/v1').trim();

  if (/^https?:\/\//i.test(configuredBase)) {
    return new URL(configuredBase).origin;
  }

  return window.location.origin;
};

export const buildServerFileUrl = (value) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;

  const normalizedPath = String(value).startsWith('/')
    ? value
    : `/${String(value).replace(/^\.?\/?/, '')}`;

  return new URL(normalizedPath, resolveBackendOrigin()).toString();
};

export { resolveBackendOrigin };
