export const environment = {
  production: true,
  // Relativa: en el servidor, Nginx sirve el frontend y el backend en la misma
  // dirección (/ y /api/). Funciona igual con el túnel de Cloudflare, una IP o
  // un dominio, sin recompilar.
  apiUrl: '/api',
};
