import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Client {
  id: string;
  name: string;
}

interface ClientSelectorProps {
  clients: Client[];
  selectedClient: string;
  onClientChange: (client: string) => void;
  loading?: boolean;
}

export const ClientSelector = ({ clients, selectedClient, onClientChange, loading = false }: ClientSelectorProps) => {
  return (
    <div className="w-full max-w-xs">
      <label className="text-sm font-semibold text-dashboard-primary mb-3 block">
        Select Client
      </label>
      <Select value={selectedClient} onValueChange={onClientChange} disabled={loading}>
        <SelectTrigger className="h-11 bg-gradient-to-r from-dashboard-card to-dashboard-card border-2 border-dashboard-primary/20 hover:border-dashboard-primary/40 focus:border-dashboard-primary shadow-lg hover:shadow-xl transition-all duration-300 rounded-lg">
          <SelectValue 
            placeholder={loading ? "Loading clients..." : "Choose a client..."} 
            className="text-dashboard-primary font-medium"
          />
        </SelectTrigger>
        <SelectContent className="bg-dashboard-card border-2 border-dashboard-primary/20 shadow-xl rounded-lg">
          {clients.map((client) => (
            <SelectItem 
              key={client.id} 
              value={client.id}
              className="hover:bg-dashboard-primary/10 focus:bg-dashboard-primary/15 text-dashboard-primary font-medium cursor-pointer transition-colors duration-200"
            >
              {client.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};