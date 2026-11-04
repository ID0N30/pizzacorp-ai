export interface PizzaItem {
  pizza_id: string;
  pizza_type_id: string;
  size: 'S' | 'M' | 'L' | 'XL' | 'XXL' | string;
  raw_price: number;
  price: number;
  name: string;
  category: string;
  ingredients: string;
}

export interface CityItem {
  city_id: number;
  nombreCiudad: string;
  direccion: string;
  state_id: number;
  state_name: string;
  state_code: string;
}

export interface SaleChannelItem {
  salechannel_id: number;
  nombreChannel: string;
}

export interface FactVentaRow {
  order_id: number;
  date: number; // Excel serial date e.g. 46330
  time: string; // e.g. "7:45:12 p. m."
  city_id: number;
  city_name: string;
  salechannel_id: number;
  channel_name: string;
  quantity: number;
  pizza_id: string;
  pizza_name: string;
  size: string;
  unit_price: number;
  total_price: number;
  source: 'excel_historico' | 'voz_ia' | 'simulador_ia' | 'manual';
  syncedToSheets?: boolean;
}

export interface CartItem {
  pizza: PizzaItem;
  quantity: number;
}
