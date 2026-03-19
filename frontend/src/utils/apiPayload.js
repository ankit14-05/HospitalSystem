export const getPayload = (response) => {
  if (!response || typeof response !== 'object') return response;
  if (Object.prototype.hasOwnProperty.call(response, 'success')) return response.data;
  return response?.data ?? response;
};

const getArrayFromPayload = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object' && Array.isArray(payload.data)) {
    return payload.data;
  }
  return [];
};

export const getMeta = (response) => {
  if (!response || typeof response !== 'object') return null;
  if (Object.prototype.hasOwnProperty.call(response, 'success')) return response.meta || null;
  return response?.meta || null;
};

export const getList = (response) => {
  const payload = getPayload(response);
  return getArrayFromPayload(payload);
};

export const getPageData = (response) => {
  const payload = getPayload(response);
  const list = getArrayFromPayload(payload);

  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return {
      items: list,
      total: Number(payload.total) || 0,
      page: Number(payload.page) || 1,
      limit: Number(payload.limit) || list.length || 0,
    };
  }

  return {
    items: list,
    total: list.length,
    page: 1,
    limit: list.length,
  };
};
