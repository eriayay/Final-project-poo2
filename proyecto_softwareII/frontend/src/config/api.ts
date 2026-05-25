/**
 * API Configuration
 * Uses VITE_API_URL environment variable for flexible deployment
 * Falls back to localhost for development
 */

// @ts-ignore
const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000/api") as string;

// @ts-ignore
const TIENDA_VEGANA_URL = (import.meta.env.VITE_TIENDA_VEGANA_URL || `${API_URL}/tienda-vegana`) as string;

export const apiConfig = {
  baseUrl: API_URL,
  endpoints: {
    register: `${API_URL}/register/`,
    login: `${API_URL}/login/`,
    products: `${API_URL}/products/`,
    productsCreate: `${API_URL}/products/create/`,
    productsEdit: (id: string | number) => `${API_URL}/products/edit/${id}/`,
    orders: `${API_URL}/orders/`,
    ordersCreate: `${API_URL}/orders/create/`,
    ordersUpdateStatus: `${API_URL}/orders/update-status/`,
    ordersByUser: (username: string) => `${API_URL}/orders/user/${encodeURIComponent(username)}/`,
    statsUsers: `${API_URL}/stats/users/`,
    statsSales: `${API_URL}/stats/sales/`,
    tiendaVegana: TIENDA_VEGANA_URL,
  },
};

export default apiConfig;
