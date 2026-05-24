export interface ImageItem {
  id: number;
  name: string;
  img: string;
  alt?: string; // El signo '?' indica que es opcional
  icon: string;
  url?: string
}
