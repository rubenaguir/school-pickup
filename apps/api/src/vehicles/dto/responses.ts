export interface VehicleResponse {
  id: string;
  description: string;
  plate: string;
  isPrimary: boolean;
}

export interface ListVehiclesResponse {
  vehicles: VehicleResponse[];
}
