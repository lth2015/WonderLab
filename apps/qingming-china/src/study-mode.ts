/** Research views are compile-time excluded from production. */
export const internalStudyEnabled = () => import.meta.env.DEV && ['night-return', 'souvenirs'].includes(new URLSearchParams(location.search).get('study') ?? '');
