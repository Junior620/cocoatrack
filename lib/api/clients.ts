// CocoaTrack V2 - Clients API
// Client-side API functions for clients, contracts, and shipments

import { createClient } from '@/lib/supabase/client';

// Types
export interface Client {
  id: string;
  name: string;
  code: string;
  country: string | null;
  city: string | null;
  address: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ClientContract {
  id: string;
  client_id: string;
  cooperative_id: string;
  code: string;
  season: string;
  quantity_contracted_kg: number;
  price_per_kg: number | null;
  start_date: string;
  end_date: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  client?: { id: string; name: string; code: string };
  cooperative?: { id: string; name: string };
}

export interface ClientShipment {
  id: string;
  contract_id: string;
  client_id: string;
  cooperative_id: string;
  code: string;
  shipped_at: string;
  quantity_kg: number;
  quality_grade: 'A' | 'B' | 'C' | 'D';
  transport_mode: string | null;
  transport_reference: string | null;
  destination_port: string | null;
  estimated_arrival: string | null;
  actual_arrival: string | null;
  status: 'pending' | 'in_transit' | 'delivered' | 'cancelled';
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  client?: { id: string; name: string; code: string };
  contract?: { id: string; code: string; season: string };
  cooperative?: { id: string; name: string };
}

export interface ClientWithStats extends Client {
  total_contracted_kg: number;
  total_shipped_kg: number;
  remaining_kg: number;
  contracts_count: number;
  shipments_count: number;
}

export interface ClientRecapItem {
  client_id: string;
  client_name: string;
  client_code: string;
  country: string | null;
  season: string;
  total_contracted_kg: number;
  total_shipped_kg: number;
  remaining_kg: number;
  pct_completed: number;
  contracts_count: number;
  shipments_count: number;
}

export interface ClientRecapResponse {
  items: ClientRecapItem[];
  total_contracted: number;
  total_shipped: number;
  total_remaining: number;
  pct_global: number;
  total_clients: number;
}

export interface CreateClientInput {
  name: string;
  code: string;
  country?: string;
  city?: string;
  address?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  notes?: string;
  is_active?: boolean;
}

export interface CreateContractInput {
  client_id: string;
  cooperative_id: string;
  code: string;
  season: string;
  quantity_contracted_kg: number;
  price_per_kg?: number;
  start_date: string;
  end_date: string;
  status?: 'draft' | 'active' | 'completed' | 'cancelled';
  notes?: string;
}

export interface CreateShipmentInput {
  contract_id: string;
  client_id: string;
  cooperative_id: string;
  code: string;
  shipped_at?: string;
  quantity_kg: number;
  quality_grade?: 'A' | 'B' | 'C' | 'D';
  transport_mode?: string;
  transport_reference?: string;
  destination_port?: string;
  estimated_arrival?: string;
  status?: 'pending' | 'in_transit' | 'delivered' | 'cancelled';
  notes?: string;
}

export interface ClientFilters {
  search?: string;
  is_active?: boolean;
  country?: string;
}

export interface ContractFilters {
  client_id?: string;
  cooperative_id?: string;
  season?: string;
  status?: string;
}

export interface ShipmentFilters {
  client_id?: string;
  contract_id?: string;
  from?: string;
  to?: string;
  status?: string;
}

export const clientsApi = {
  // CLIENTS
  async getClients(filters: ClientFilters = {}): Promise<Client[]> {
    const supabase = createClient();
    let query = (supabase.from('clients') as any).select('*').order('name');
    if (filters.search) query = query.or(`name.ilike.%${filters.search}%,code.ilike.%${filters.search}%`);
    if (filters.is_active !== undefined) query = query.eq('is_active', filters.is_active);
    if (filters.country) query = query.eq('country', filters.country);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch clients: ${error.message}`);
    return (data || []) as Client[];
  },

  async getClient(id: string): Promise<Client | null> {
    const supabase = createClient();
    const { data, error } = await (supabase.from('clients') as any).select('*').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch client: ${error.message}`);
    }
    return data as Client;
  },

  async getClientWithStats(id: string): Promise<ClientWithStats | null> {
    const supabase = createClient();
    const { data: clientData, error } = await (supabase.from('clients') as any).select('*').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch client: ${error.message}`);
    }
    const client = clientData as Client;
    const { data: contracts } = await (supabase.from('client_contracts') as any).select('id, quantity_contracted_kg').eq('client_id', id).in('status', ['active', 'completed']);
    const { data: shipments } = await (supabase.from('client_shipments') as any).select('id, quantity_kg').eq('client_id', id).neq('status', 'cancelled');
    const contractsList = (contracts || []) as { id: string; quantity_contracted_kg: number }[];
    const shipmentsList = (shipments || []) as { id: string; quantity_kg: number }[];
    const totalContracted = contractsList.reduce((sum, c) => sum + Number(c.quantity_contracted_kg), 0);
    const totalShipped = shipmentsList.reduce((sum, s) => sum + Number(s.quantity_kg), 0);
    return { ...client, total_contracted_kg: totalContracted, total_shipped_kg: totalShipped, remaining_kg: Math.max(0, totalContracted - totalShipped), contracts_count: contractsList.length, shipments_count: shipmentsList.length };
  },

  async createClient(input: CreateClientInput, userId: string): Promise<Client> {
    const supabase = createClient();
    const { data, error } = await (supabase.from('clients') as any).insert({ ...input, created_by: userId }).select().single();
    if (error) throw new Error(`Failed to create client: ${error.message}`);
    return data as Client;
  },

  async updateClient(id: string, input: Partial<CreateClientInput>): Promise<Client> {
    const supabase = createClient();
    const { data, error } = await (supabase.from('clients') as any).update(input).eq('id', id).select().single();
    if (error) throw new Error(`Failed to update client: ${error.message}`);
    return data as Client;
  },

  async deleteClient(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await (supabase.from('clients') as any).delete().eq('id', id);
    if (error) throw new Error(`Failed to delete client: ${error.message}`);
  },

  // CONTRACTS
  async getContracts(filters: ContractFilters = {}): Promise<ClientContract[]> {
    const supabase = createClient();
    let query = (supabase.from('client_contracts') as any).select(`*, client:clients(id, name, code), cooperative:cooperatives(id, name)`).order('created_at', { ascending: false });
    if (filters.client_id) query = query.eq('client_id', filters.client_id);
    if (filters.cooperative_id) query = query.eq('cooperative_id', filters.cooperative_id);
    if (filters.season) query = query.eq('season', filters.season);
    if (filters.status) query = query.eq('status', filters.status);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch contracts: ${error.message}`);
    return (data || []) as ClientContract[];
  },

  async getContract(id: string): Promise<ClientContract | null> {
    const supabase = createClient();
    const { data, error } = await (supabase.from('client_contracts') as any).select(`*, client:clients(id, name, code), cooperative:cooperatives(id, name)`).eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch contract: ${error.message}`);
    }
    return data as ClientContract;
  },

  async createContract(input: CreateContractInput, userId: string): Promise<ClientContract> {
    const supabase = createClient();
    const { data, error } = await (supabase.from('client_contracts') as any).insert({ ...input, created_by: userId }).select().single();
    if (error) throw new Error(`Failed to create contract: ${error.message}`);
    return data as ClientContract;
  },

  async updateContract(id: string, input: Partial<CreateContractInput>): Promise<ClientContract> {
    const supabase = createClient();
    const { data, error } = await (supabase.from('client_contracts') as any).update(input).eq('id', id).select().single();
    if (error) throw new Error(`Failed to update contract: ${error.message}`);
    return data as ClientContract;
  },

  async deleteContract(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await (supabase.from('client_contracts') as any).delete().eq('id', id);
    if (error) throw new Error(`Failed to delete contract: ${error.message}`);
  },

  // SHIPMENTS
  async getShipments(filters: ShipmentFilters = {}): Promise<ClientShipment[]> {
    const supabase = createClient();
    let query = (supabase.from('client_shipments') as any).select(`*, client:clients(id, name, code), contract:client_contracts(id, code, season), cooperative:cooperatives(id, name)`).order('shipped_at', { ascending: false });
    if (filters.client_id) query = query.eq('client_id', filters.client_id);
    if (filters.contract_id) query = query.eq('contract_id', filters.contract_id);
    if (filters.from) query = query.gte('shipped_at', filters.from);
    if (filters.to) query = query.lte('shipped_at', filters.to);
    if (filters.status) query = query.eq('status', filters.status);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch shipments: ${error.message}`);
    return (data || []) as ClientShipment[];
  },

  async getShipment(id: string): Promise<ClientShipment | null> {
    const supabase = createClient();
    const { data, error } = await (supabase.from('client_shipments') as any).select(`*, client:clients(id, name, code), contract:client_contracts(id, code, season), cooperative:cooperatives(id, name)`).eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch shipment: ${error.message}`);
    }
    return data as ClientShipment;
  },

  async createShipment(input: CreateShipmentInput, userId: string): Promise<ClientShipment> {
    const supabase = createClient();
    const { data, error } = await (supabase.from('client_shipments') as any).insert({ ...input, created_by: userId }).select().single();
    if (error) throw new Error(`Failed to create shipment: ${error.message}`);
    return data as ClientShipment;
  },

  async updateShipment(id: string, input: Partial<CreateShipmentInput>): Promise<ClientShipment> {
    const supabase = createClient();
    const { data, error } = await (supabase.from('client_shipments') as any).update(input).eq('id', id).select().single();
    if (error) throw new Error(`Failed to update shipment: ${error.message}`);
    return data as ClientShipment;
  },

  async deleteShipment(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await (supabase.from('client_shipments') as any).delete().eq('id', id);
    if (error) throw new Error(`Failed to delete shipment: ${error.message}`);
  },

  // RECAP
  async getClientRecap(season?: string): Promise<ClientRecapResponse> {
    const supabase = createClient();
    const { data: clients, error: clientsError } = await (supabase.from('clients') as any).select('id, name, code, country').eq('is_active', true).order('name');
    if (clientsError) throw new Error(`Failed to fetch clients: ${clientsError.message}`);

    let contractsQuery = (supabase.from('client_contracts') as any).select('id, client_id, quantity_contracted_kg, season').in('status', ['active', 'completed']);
    if (season) contractsQuery = contractsQuery.eq('season', season);
    const { data: contracts } = await contractsQuery;

    const { data: shipments } = await (supabase.from('client_shipments') as any).select('id, client_id, contract_id, quantity_kg').neq('status', 'cancelled');

    const contractIds = new Set((contracts || []).map((c: any) => c.id));
    const clientMap = new Map<string, ClientRecapItem>();

    (clients || []).forEach((client: any) => {
      clientMap.set(client.id, { client_id: client.id, client_name: client.name, client_code: client.code, country: client.country, season: season || 'Toutes', total_contracted_kg: 0, total_shipped_kg: 0, remaining_kg: 0, pct_completed: 0, contracts_count: 0, shipments_count: 0 });
    });

    (contracts || []).forEach((contract: any) => {
      const item = clientMap.get(contract.client_id);
      if (item) { item.total_contracted_kg += Number(contract.quantity_contracted_kg) || 0; item.contracts_count += 1; }
    });

    (shipments || []).forEach((shipment: any) => {
      if (season && !contractIds.has(shipment.contract_id)) return;
      const item = clientMap.get(shipment.client_id);
      if (item) { item.total_shipped_kg += Number(shipment.quantity_kg) || 0; item.shipments_count += 1; }
    });

    const items: ClientRecapItem[] = Array.from(clientMap.values())
      .map((item) => { item.remaining_kg = Math.max(0, item.total_contracted_kg - item.total_shipped_kg); item.pct_completed = item.total_contracted_kg > 0 ? Math.round((item.total_shipped_kg / item.total_contracted_kg) * 10000) / 100 : 0; return item; })
      .filter((item) => item.contracts_count > 0 || item.shipments_count > 0)
      .sort((a, b) => b.total_contracted_kg - a.total_contracted_kg);

    const totalContracted = items.reduce((sum, i) => sum + i.total_contracted_kg, 0);
    const totalShipped = items.reduce((sum, i) => sum + i.total_shipped_kg, 0);
    const totalRemaining = items.reduce((sum, i) => sum + i.remaining_kg, 0);
    const pctGlobal = totalContracted > 0 ? Math.round((totalShipped / totalContracted) * 10000) / 100 : 0;

    return { items, total_contracted: Math.round(totalContracted * 100) / 100, total_shipped: Math.round(totalShipped * 100) / 100, total_remaining: Math.round(totalRemaining * 100) / 100, pct_global: pctGlobal, total_clients: items.length };
  },

  async getSeasons(): Promise<string[]> {
    const supabase = createClient();
    const { data, error } = await (supabase.from('client_contracts') as any).select('season').order('season', { ascending: false });
    if (error) throw new Error(`Failed to fetch seasons: ${error.message}`);
    return [...new Set((data || []).map((d: any) => d.season))] as string[];
  },

  async generateShipmentCode(): Promise<string> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('generate_shipment_code');
    if (error) {
      const now = new Date();
      const yymm = now.toISOString().slice(2, 4) + now.toISOString().slice(5, 7);
      const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
      return `EXP-${yymm}-${random}`;
    }
    return data;
  },
};
