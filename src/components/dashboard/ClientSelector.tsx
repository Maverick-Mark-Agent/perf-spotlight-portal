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
      <label className="text-sm font-medium text-dashboard-secondary mb-2 block">
        Select Client
      </label>
      <Select value={selectedClient} onValueChange={onClientChange} disabled={loading}>
        <SelectTrigger className="bg-dashboard-card border-border">
          <SelectValue placeholder={loading ? "Loading clients..." : "Choose a client..."} />
        </SelectTrigger>
        <SelectContent className="bg-dashboard-card border-border">
          {clients.map((client) => (
            <SelectItem key={client.id} value={client.id}>
              {client.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};