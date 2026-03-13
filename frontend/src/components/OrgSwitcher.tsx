import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Building2, Plus } from 'lucide-react';
import { Button } from './ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: 'OWNER' | 'ADMIN' | 'STAFF' | 'CLIENT';
  memberCount?: number;
}

interface OrgSwitcherProps {
  organizations: Organization[];
  activeOrgId?: string;
  onSwitch: (orgId: string) => void;
  onCreateNew?: () => void;
}

export function OrgSwitcher({ 
  organizations, 
  activeOrgId, 
  onSwitch, 
  onCreateNew 
}: OrgSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);

  useEffect(() => {
    const active = organizations.find(org => org.id === activeOrgId);
    setSelectedOrg(active || organizations[0] || null);
  }, [organizations, activeOrgId]);

  const handleSelect = (org: Organization) => {
    setSelectedOrg(org);
    onSwitch(org.id);
    setOpen(false);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'OWNER': return 'bg-purple-100 text-purple-800';
      case 'ADMIN': return 'bg-blue-100 text-blue-800';  
      case 'STAFF': return 'bg-green-100 text-green-800';
      case 'CLIENT': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!organizations.length) {
    return (
      <Button 
        variant="outline" 
        onClick={onCreateNew}
        className="w-full justify-start"
      >
        <Plus className="mr-2 h-4 w-4" />
        Create Organization
      </Button>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <div className="flex items-center">
            <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col items-start">
              <span className="font-medium truncate max-w-[200px]">
                {selectedOrg?.name || 'Select organization...'}
              </span>
              {selectedOrg && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${getRoleBadgeColor(selectedOrg.role)}`}>
                  {selectedOrg.role}
                </span>
              )}
            </div>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[300px]" align="start">
        <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
          Organizations
        </div>
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onSelect={() => handleSelect(org)}
            className="cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center space-x-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="font-medium">{org.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {org.memberCount ? `${org.memberCount} members` : ''}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-xs px-2 py-1 rounded-full ${getRoleBadgeColor(org.role)}`}>
                  {org.role}
                </span>
                {selectedOrg?.id === org.id && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </div>
            </div>
          </DropdownMenuItem>
        ))}
        {onCreateNew && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onCreateNew} className="cursor-pointer">
              <Plus className="mr-2 h-4 w-4" />
              <span>Create New Organization</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}