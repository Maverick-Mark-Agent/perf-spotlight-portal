import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ClientSelectorProps {
  selectedClient: string;
  onClientChange: (client: string) => void;
}

const clients = [
  { id: "acme-corp", name: "Acme Corporation" },
  { id: "techstart", name: "TechStart Inc." },
  { id: "globaldyne", name: "GlobalDyne Solutions" },
  { id: "innovate", name: "Innovate Labs" },
  { id: "nexus", name: "Nexus Enterprises" },
];

export const ClientSelector = ({ selectedClient, onClientChange }: ClientSelectorProps) => {
  return (
    <div className="w-full max-w-xs">
      <label className="text-sm font-medium text-dashboard-secondary mb-2 block">
        Select Client
      </label>
      <Select value={selectedClient} onValueChange={onClientChange}>
        <SelectTrigger className="bg-dashboard-card border-border">
          <SelectValue placeholder="Choose a client..." />
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