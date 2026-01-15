// CocoaTrack V2 - Supabase Type Extensions
// This file provides type-safe wrappers for Supabase operations
// that work around limitations in auto-generated types

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.gen';

// Type alias for the Supabase client
export type TypedSupabaseClient = SupabaseClient<Database>;

// Helper type for table rows
export type TableRow<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Row'];

// Helper type for table inserts
export type TableInsert<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Insert'];

// Helper type for table updates
export type TableUpdate<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Update'];

// Helper type for RPC function args
export type RpcArgs<T extends keyof Database['public']['Functions']> = 
  Database['public']['Functions'][T]['Args'];

// Helper type for RPC function returns
export type RpcReturns<T extends keyof Database['public']['Functions']> = 
  Database['public']['Functions'][T]['Returns'];

// Type-safe insert helper
export function typedInsert<T extends keyof Database['public']['Tables']>(
  client: TypedSupabaseClient,
  table: T,
  data: TableInsert<T>
) {
  return client.from(table).insert(data as never);
}

// Type-safe update helper
export function typedUpdate<T extends keyof Database['public']['Tables']>(
  client: TypedSupabaseClient,
  table: T,
  data: TableUpdate<T>
) {
  return client.from(table).update(data as never);
}

// Type-safe RPC helper
export function typedRpc<T extends keyof Database['public']['Functions']>(
  client: TypedSupabaseClient,
  fn: T,
  args: RpcArgs<T>
) {
  return client.rpc(fn, args as never);
}
